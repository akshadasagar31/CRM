package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"crm-backend-go/internal/database"
	"crm-backend-go/internal/models"
	"crm-backend-go/internal/utils"

	"github.com/jackc/pgx/v5"
)

type PaymentRepository struct {
	db           *database.DB
	invoiceRepo  *InvoiceRepository
	orderRepo    *OrderRepository
	companyRepo  *CompanyRepository
	customerRepo *CustomerRepository
}

func NewPaymentRepository(
	db *database.DB,
	invoiceRepo *InvoiceRepository,
	orderRepo *OrderRepository,
	companyRepo *CompanyRepository,
	customerRepo *CustomerRepository,
) *PaymentRepository {
	return &PaymentRepository{
		db:           db,
		invoiceRepo:  invoiceRepo,
		orderRepo:    orderRepo,
		companyRepo:  companyRepo,
		customerRepo: customerRepo,
	}
}

type PaymentFilter struct {
	Search        string
	PaymentMethod string
	StartDate     string
	EndDate       string
	CustomerID    *int
	InvoiceID     *int
	Page          int
	Limit         int
}

func (r *PaymentRepository) List(ctx context.Context, filter PaymentFilter, workspaceID int) (*models.PaymentListResponse, error) {
	page := filter.Page
	if page < 1 {
		page = 1
	}
	limit := filter.Limit
	if limit < 1 || limit > 100 {
		limit = 25
	}
	offset := (page - 1) * limit

	where := []string{"i.workspace_id = $1"}
	args := []interface{}{workspaceID}
	argIdx := 2

	if strings.TrimSpace(filter.Search) != "" {
		searchTerm := "%" + strings.TrimSpace(filter.Search) + "%"
		where = append(where, fmt.Sprintf("(i.invoice_number ILIKE $%d OR c.name ILIKE $%d OR COALESCE(ip.reference_number, '') ILIKE $%d OR COALESCE(ip.notes, '') ILIKE $%d)", argIdx, argIdx, argIdx, argIdx))
		args = append(args, searchTerm)
		argIdx++
	}

	if strings.TrimSpace(filter.PaymentMethod) != "" && strings.ToLower(filter.PaymentMethod) != "all" {
		where = append(where, fmt.Sprintf("LOWER(TRIM(ip.payment_method)) = LOWER(TRIM($%d))", argIdx))
		args = append(args, strings.TrimSpace(filter.PaymentMethod))
		argIdx++
	}

	if strings.TrimSpace(filter.StartDate) != "" {
		if st, err := utils.ParseFlexibleTime(filter.StartDate); err == nil {
			where = append(where, fmt.Sprintf("ip.payment_date >= $%d", argIdx))
			args = append(args, st)
			argIdx++
		}
	}

	if strings.TrimSpace(filter.EndDate) != "" {
		if et, err := utils.ParseFlexibleTime(filter.EndDate); err == nil {
			// Include full end date till end of day
			etEndOfDay := time.Date(et.Year(), et.Month(), et.Day(), 23, 59, 59, 999999999, et.Location())
			where = append(where, fmt.Sprintf("ip.payment_date <= $%d", argIdx))
			args = append(args, etEndOfDay)
			argIdx++
		}
	}

	if filter.CustomerID != nil && *filter.CustomerID > 0 {
		where = append(where, fmt.Sprintf("i.customer_id = $%d", argIdx))
		args = append(args, *filter.CustomerID)
		argIdx++
	}

	if filter.InvoiceID != nil && *filter.InvoiceID > 0 {
		where = append(where, fmt.Sprintf("ip.invoice_id = $%d", argIdx))
		args = append(args, *filter.InvoiceID)
		argIdx++
	}

	whereClause := strings.Join(where, " AND ")

	countQuery := fmt.Sprintf(`
		SELECT COUNT(ip.id)
		FROM invoice_payments ip
		JOIN invoices i ON ip.invoice_id = i.id
		JOIN customers c ON i.customer_id = c.id
		WHERE %s
	`, whereClause)

	var total int
	if err := r.db.Pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, fmt.Errorf("failed to count payments: %w", err)
	}

	listQuery := fmt.Sprintf(`
		SELECT 
			ip.id,
			ip.invoice_id,
			i.invoice_number,
			i.customer_id,
			c.name,
			i.order_id,
			o.order_number,
			ip.amount,
			ip.payment_date,
			ip.payment_method,
			ip.reference_number,
			ip.notes,
			ip.recorded_by_id,
			u.id,
			u.name,
			u.email,
			u.role,
			i.grand_total,
			i.amount_paid,
			(i.grand_total - i.amount_paid) AS remaining_balance,
			i.status,
			i.due_date,
			i.currency,
			ip.created_at,
			d.id,
			d.deal_number,
			q.id,
			q.quotation_number,
			COALESCE(q.lead_number, d.lead_number) AS lead_number
		FROM invoice_payments ip
		JOIN invoices i ON ip.invoice_id = i.id
		JOIN customers c ON i.customer_id = c.id
		LEFT JOIN orders o ON i.order_id = o.id
		LEFT JOIN deals d ON i.deal_id = d.id
		LEFT JOIN quotations q ON i.quotation_id = q.id
		LEFT JOIN users u ON ip.recorded_by_id = u.id
		WHERE %s
		ORDER BY ip.payment_date DESC, ip.id DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIdx, argIdx+1)

	queryArgs := append(args, limit, offset)
	rows, err := r.db.Pool.Query(ctx, listQuery, queryArgs...)
	if err != nil {
		return nil, fmt.Errorf("failed to list payments: %w", err)
	}
	defer rows.Close()

	items := make([]models.PaymentLedgerItem, 0)
	for rows.Next() {
		var item models.PaymentLedgerItem
		var uID *int
		var uName, uEmail, uRole *string
		var dID, qID *int
		var dNum, qNum, leadNum *string

		err := rows.Scan(
			&item.ID,
			&item.InvoiceID,
			&item.InvoiceNumber,
			&item.CustomerID,
			&item.CustomerName,
			&item.OrderID,
			&item.OrderNumber,
			&item.Amount,
			&item.PaymentDate,
			&item.PaymentMethod,
			&item.ReferenceNumber,
			&item.Notes,
			&item.RecordedByID,
			&uID,
			&uName,
			&uEmail,
			&uRole,
			&item.InvoiceGrandTotal,
			&item.InvoiceAmountPaid,
			&item.InvoiceRemainingBalance,
			&item.InvoiceStatus,
			&item.InvoiceDueDate,
			&item.Currency,
			&item.CreatedAt,
			&dID,
			&dNum,
			&qID,
			&qNum,
			&leadNum,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan payment: %w", err)
		}

		item.DealID = dID
		item.DealNumber = dNum
		item.QuotationID = qID
		item.QuotationNumber = qNum
		item.LeadNumber = leadNum

		if uID != nil && uName != nil && uEmail != nil {
			role := "sales_rep"
			if uRole != nil {
				role = *uRole
			}
			item.Recorder = &models.UserSummary{
				ID:    *uID,
				Name:  *uName,
				Email: *uEmail,
				Role:  role,
			}
		}

		items = append(items, item)
	}

	summary, err := r.GetSummary(ctx, filter.StartDate, filter.EndDate, filter.CustomerID, workspaceID)
	if err != nil {
		summary = &models.PaymentSummary{}
	}

	pages := 0
	if limit > 0 {
		pages = (total + limit - 1) / limit
	}

	return &models.PaymentListResponse{
		Items:   items,
		Total:   total,
		Page:    page,
		Limit:   limit,
		Pages:   pages,
		Summary: *summary,
	}, nil
}

func (r *PaymentRepository) GetSummary(ctx context.Context, startDate string, endDate string, customerID *int, workspaceID int) (*models.PaymentSummary, error) {
	summary := &models.PaymentSummary{}

	// 1. Total Received
	payWhere := []string{"i.workspace_id = $1"}
	payArgs := []interface{}{workspaceID}
	pIdx := 2

	if strings.TrimSpace(startDate) != "" {
		if st, err := utils.ParseFlexibleTime(startDate); err == nil {
			payWhere = append(payWhere, fmt.Sprintf("ip.payment_date >= $%d", pIdx))
			payArgs = append(payArgs, st)
			pIdx++
		}
	}
	if strings.TrimSpace(endDate) != "" {
		if et, err := utils.ParseFlexibleTime(endDate); err == nil {
			etEndOfDay := time.Date(et.Year(), et.Month(), et.Day(), 23, 59, 59, 999999999, et.Location())
			payWhere = append(payWhere, fmt.Sprintf("ip.payment_date <= $%d", pIdx))
			payArgs = append(payArgs, etEndOfDay)
			pIdx++
		}
	}
	if customerID != nil && *customerID > 0 {
		payWhere = append(payWhere, fmt.Sprintf("i.customer_id = $%d", pIdx))
		payArgs = append(payArgs, *customerID)
		pIdx++
	}

	payQuery := fmt.Sprintf(`
		SELECT 
			COALESCE(SUM(ip.amount), 0),
			COUNT(ip.id)
		FROM invoice_payments ip
		JOIN invoices i ON ip.invoice_id = i.id
		WHERE %s
	`, strings.Join(payWhere, " AND "))

	if err := r.db.Pool.QueryRow(ctx, payQuery, payArgs...).Scan(&summary.TotalReceived, &summary.TotalPayments); err != nil {
		return nil, fmt.Errorf("failed to calculate payments summary: %w", err)
	}

	// 2. Invoice metrics (Total Invoiced, Outstanding, Overdue)
	invWhere := []string{"workspace_id = $1", "status != 'Cancelled'", "status != 'Draft'"}
	invArgs := []interface{}{workspaceID}
	iIdx := 2

	if strings.TrimSpace(startDate) != "" {
		if st, err := utils.ParseFlexibleTime(startDate); err == nil {
			invWhere = append(invWhere, fmt.Sprintf("invoice_date >= $%d", iIdx))
			invArgs = append(invArgs, st)
			iIdx++
		}
	}
	if strings.TrimSpace(endDate) != "" {
		if et, err := utils.ParseFlexibleTime(endDate); err == nil {
			etEndOfDay := time.Date(et.Year(), et.Month(), et.Day(), 23, 59, 59, 999999999, et.Location())
			invWhere = append(invWhere, fmt.Sprintf("invoice_date <= $%d", iIdx))
			invArgs = append(invArgs, etEndOfDay)
			iIdx++
		}
	}
	if customerID != nil && *customerID > 0 {
		invWhere = append(invWhere, fmt.Sprintf("customer_id = $%d", iIdx))
		invArgs = append(invArgs, *customerID)
		iIdx++
	}

	invQuery := fmt.Sprintf(`
		SELECT
			COALESCE(SUM(grand_total), 0),
			COALESCE(SUM(CASE WHEN status != 'Paid' THEN (grand_total - amount_paid) ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN status != 'Paid' AND due_date IS NOT NULL AND due_date < CURRENT_DATE THEN (grand_total - amount_paid) ELSE 0 END), 0),
			COUNT(CASE WHEN status != 'Paid' AND due_date IS NOT NULL AND due_date < CURRENT_DATE THEN 1 END)
		FROM invoices
		WHERE %s
	`, strings.Join(invWhere, " AND "))

	if err := r.db.Pool.QueryRow(ctx, invQuery, invArgs...).Scan(
		&summary.TotalInvoiced,
		&summary.TotalOutstanding,
		&summary.TotalOverdue,
		&summary.OverdueInvoices,
	); err != nil {
		return nil, fmt.Errorf("failed to calculate invoice summary: %w", err)
	}

	return summary, nil
}

func (r *PaymentRepository) RecordPayment(ctx context.Context, in models.GlobalPaymentInput, recordedByID *int, workspaceID int) (*models.PaymentLedgerItem, error) {
	if in.InvoiceID <= 0 {
		return nil, errors.New("invoice_id is required")
	}
	if in.Amount <= 0 {
		return nil, errors.New("payment amount must be greater than 0")
	}

	existing, err := r.invoiceRepo.Get(ctx, in.InvoiceID)
	if err != nil {
		return nil, fmt.Errorf("invoice not found: %w", err)
	}
	if existing.WorkspaceID != workspaceID {
		return nil, errors.New("invoice does not belong to this workspace")
	}
	if existing.Status == "Cancelled" {
		return nil, errors.New("cannot record payment on a cancelled invoice")
	}

	// 1. Overpayment prevention
	remainingBalance := existing.GrandTotal - existing.AmountPaid
	if in.Amount > remainingBalance+0.001 {
		return nil, fmt.Errorf("payment amount (%.2f) exceeds outstanding invoice balance (%.2f)", in.Amount, remainingBalance)
	}

	// 2. Duplicate reference number prevention
	if in.ReferenceNumber != nil && strings.TrimSpace(*in.ReferenceNumber) != "" {
		ref := strings.TrimSpace(*in.ReferenceNumber)
		var dupCount int
		err := r.db.Pool.QueryRow(ctx, `
			SELECT COUNT(ip.id) 
			FROM invoice_payments ip
			JOIN invoices i ON ip.invoice_id = i.id
			WHERE i.workspace_id = $1 AND LOWER(TRIM(ip.reference_number)) = LOWER($2)
		`, workspaceID, ref).Scan(&dupCount)
		if err == nil && dupCount > 0 {
			return nil, fmt.Errorf("a payment with reference number '%s' has already been recorded in this workspace", ref)
		}
	}

	// 3. PostgreSQL Transaction
	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	payDate := time.Now()
	if in.PaymentDate != nil && strings.TrimSpace(*in.PaymentDate) != "" {
		if pt, err := utils.ParseFlexibleTime(*in.PaymentDate); err == nil {
			payDate = pt
		}
	}

	method := strings.TrimSpace(in.PaymentMethod)
	if method == "" {
		method = "Bank Transfer"
	}

	var newPaymentID int
	payQuery := `
		INSERT INTO invoice_payments (
			invoice_id, amount, payment_date, payment_method, reference_number, notes, recorded_by_id, created_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, NOW()
		)
		RETURNING id
	`
	err = tx.QueryRow(ctx, payQuery, in.InvoiceID, in.Amount, payDate, method, in.ReferenceNumber, in.Notes, recordedByID).Scan(&newPaymentID)
	if err != nil {
		return nil, fmt.Errorf("failed to insert payment: %w", err)
	}

	// Recalculate total amount paid for this invoice
	var totalPaid float64
	err = tx.QueryRow(ctx, "SELECT COALESCE(SUM(amount), 0) FROM invoice_payments WHERE invoice_id = $1", in.InvoiceID).Scan(&totalPaid)
	if err != nil {
		return nil, err
	}

	newStatus := existing.Status
	if totalPaid >= existing.GrandTotal-0.001 {
		newStatus = "Paid"
	} else if totalPaid > 0 {
		newStatus = "Partially Paid"
	}

	_, err = tx.Exec(ctx, `
		UPDATE invoices
		SET amount_paid = $1, status = $2, payment_method = $3, updated_at = NOW()
		WHERE id = $4
	`, totalPaid, newStatus, method, in.InvoiceID)
	if err != nil {
		return nil, fmt.Errorf("failed to update invoice: %w", err)
	}

	// Update linked order status
	if existing.OrderID != nil && *existing.OrderID > 0 {
		r.syncOrderPaymentStatusTx(ctx, tx, *existing.OrderID)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit payment transaction: %w", err)
	}

	return r.Get(ctx, newPaymentID, workspaceID)
}

func (r *PaymentRepository) DeletePayment(ctx context.Context, paymentID int, workspaceID int) error {
	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var invoiceID int
	var amount float64
	var invWorkspaceID int
	var invGrandTotal float64
	var invDueDate *time.Time
	var orderID *int

	err = tx.QueryRow(ctx, `
		SELECT ip.invoice_id, ip.amount, i.workspace_id, i.grand_total, i.due_date, i.order_id
		FROM invoice_payments ip
		JOIN invoices i ON ip.invoice_id = i.id
		WHERE ip.id = $1
	`, paymentID).Scan(&invoiceID, &amount, &invWorkspaceID, &invGrandTotal, &invDueDate, &orderID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return errors.New("payment not found")
		}
		return err
	}

	if invWorkspaceID != workspaceID {
		return errors.New("payment does not belong to this workspace")
	}

	_, err = tx.Exec(ctx, "DELETE FROM invoice_payments WHERE id = $1", paymentID)
	if err != nil {
		return fmt.Errorf("failed to delete payment: %w", err)
	}

	// Recalculate invoice amount_paid
	var totalPaid float64
	err = tx.QueryRow(ctx, "SELECT COALESCE(SUM(amount), 0) FROM invoice_payments WHERE invoice_id = $1", invoiceID).Scan(&totalPaid)
	if err != nil {
		return err
	}

	var newStatus string
	if totalPaid >= invGrandTotal-0.001 {
		newStatus = "Paid"
	} else if totalPaid > 0 {
		newStatus = "Partially Paid"
	} else {
		if invDueDate != nil && invDueDate.Before(time.Now()) {
			newStatus = "Overdue"
		} else {
			newStatus = "Issued/Sent"
		}
	}

	_, err = tx.Exec(ctx, `
		UPDATE invoices 
		SET amount_paid = $1, status = $2, updated_at = NOW()
		WHERE id = $3
	`, totalPaid, newStatus, invoiceID)
	if err != nil {
		return fmt.Errorf("failed to update invoice after payment rollback: %w", err)
	}

	if orderID != nil && *orderID > 0 {
		r.syncOrderPaymentStatusTx(ctx, tx, *orderID)
	}

	return tx.Commit(ctx)
}

func (r *PaymentRepository) syncOrderPaymentStatusTx(ctx context.Context, tx pgx.Tx, orderID int) {
	// Calculate sum of grand_total and amount_paid for all invoices belonging to this order
	var orderTotal, orderPaid float64
	var invCount int

	err := tx.QueryRow(ctx, `
		SELECT 
			COUNT(id),
			COALESCE(SUM(grand_total), 0),
			COALESCE(SUM(amount_paid), 0)
		FROM invoices
		WHERE order_id = $1 AND status != 'Cancelled'
	`, orderID).Scan(&invCount, &orderTotal, &orderPaid)

	if err != nil || invCount == 0 {
		return
	}

	var newOrderStatus string
	if orderPaid >= orderTotal && orderTotal > 0 {
		newOrderStatus = "Paid"
	} else if orderPaid > 0 {
		newOrderStatus = "Partially Paid"
	} else {
		newOrderStatus = "Unpaid"
	}

	_, _ = tx.Exec(ctx, `UPDATE orders SET payment_status = $1, updated_at = NOW() WHERE id = $2`, newOrderStatus, orderID)
}

func (r *PaymentRepository) Get(ctx context.Context, paymentID int, workspaceID int) (*models.PaymentLedgerItem, error) {
	query := `
		SELECT 
			ip.id,
			ip.invoice_id,
			i.invoice_number,
			i.customer_id,
			c.name,
			i.order_id,
			o.order_number,
			ip.amount,
			ip.payment_date,
			ip.payment_method,
			ip.reference_number,
			ip.notes,
			ip.recorded_by_id,
			u.id,
			u.name,
			u.email,
			u.role,
			i.grand_total,
			i.amount_paid,
			(i.grand_total - i.amount_paid) AS remaining_balance,
			i.status,
			i.due_date,
			i.currency,
			ip.created_at,
			d.id,
			d.deal_number,
			q.id,
			q.quotation_number,
			COALESCE(q.lead_number, d.lead_number) AS lead_number
		FROM invoice_payments ip
		JOIN invoices i ON ip.invoice_id = i.id
		JOIN customers c ON i.customer_id = c.id
		LEFT JOIN orders o ON i.order_id = o.id
		LEFT JOIN deals d ON i.deal_id = d.id
		LEFT JOIN quotations q ON i.quotation_id = q.id
		LEFT JOIN users u ON ip.recorded_by_id = u.id
		WHERE ip.id = $1 AND i.workspace_id = $2
	`

	var item models.PaymentLedgerItem
	var uID *int
	var uName, uEmail, uRole *string
	var dID, qID *int
	var dNum, qNum, leadNum *string

	err := r.db.Pool.QueryRow(ctx, query, paymentID, workspaceID).Scan(
		&item.ID,
		&item.InvoiceID,
		&item.InvoiceNumber,
		&item.CustomerID,
		&item.CustomerName,
		&item.OrderID,
		&item.OrderNumber,
		&item.Amount,
		&item.PaymentDate,
		&item.PaymentMethod,
		&item.ReferenceNumber,
		&item.Notes,
		&item.RecordedByID,
		&uID,
		&uName,
		&uEmail,
		&uRole,
		&item.InvoiceGrandTotal,
		&item.InvoiceAmountPaid,
		&item.InvoiceRemainingBalance,
		&item.InvoiceStatus,
		&item.InvoiceDueDate,
		&item.Currency,
		&item.CreatedAt,
		&dID,
		&dNum,
		&qID,
		&qNum,
		&leadNum,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("payment not found")
		}
		return nil, fmt.Errorf("failed to get payment: %w", err)
	}

	item.DealID = dID
	item.DealNumber = dNum
	item.QuotationID = qID
	item.QuotationNumber = qNum
	item.LeadNumber = leadNum

	if uID != nil && uName != nil && uEmail != nil {
		role := "sales_rep"
		if uRole != nil {
			role = *uRole
		}
		item.Recorder = &models.UserSummary{
			ID:    *uID,
			Name:  *uName,
			Email: *uEmail,
			Role:  role,
		}
	}

	return &item, nil
}

func (r *PaymentRepository) GetReceipt(ctx context.Context, paymentID int, workspaceID int) (*models.PaymentReceiptDetail, error) {
	payment, err := r.Get(ctx, paymentID, workspaceID)
	if err != nil {
		return nil, err
	}

	invoice, err := r.invoiceRepo.Get(ctx, payment.InvoiceID)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve invoice for receipt: %w", err)
	}

	company, _ := r.companyRepo.GetProfile(ctx)

	customer, _ := r.customerRepo.GetByID(ctx, payment.CustomerID, workspaceID)

	return &models.PaymentReceiptDetail{
		Payment:  *payment,
		Invoice:  invoice,
		Company:  company,
		Customer: customer,
	}, nil
}
