package repository

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"crm-backend-go/internal/database"
	"crm-backend-go/internal/models"
	"crm-backend-go/internal/utils"

	"github.com/jackc/pgx/v5"
)

var ValidInvoiceStatuses = []string{
	"Draft",
	"Issued/Sent",
	"Unpaid",
	"Partially Paid",
	"Paid",
	"Overdue",
	"Cancelled",
	"Refunded",
}

func IsValidInvoiceStatus(status string) bool {
	norm := strings.TrimSpace(status)
	for _, s := range ValidInvoiceStatuses {
		if strings.EqualFold(s, norm) {
			return true
		}
	}
	return false
}

func NormalizeInvoiceStatus(status string) string {
	norm := strings.TrimSpace(status)
	for _, s := range ValidInvoiceStatuses {
		if strings.EqualFold(s, norm) {
			return s
		}
	}
	return "Draft"
}

type InvoiceRepository struct {
	db            *database.DB
	customerRepo  *CustomerRepository
	orderRepo     *OrderRepository
	quotationRepo *QuotationRepository
	dealRepo      *DealRepository
	companyRepo   *CompanyRepository
}

func NewInvoiceRepository(
	db *database.DB,
	customerRepo *CustomerRepository,
	orderRepo *OrderRepository,
	quotationRepo *QuotationRepository,
	dealRepo *DealRepository,
	companyRepo *CompanyRepository,
) *InvoiceRepository {
	return &InvoiceRepository{
		db:            db,
		customerRepo:  customerRepo,
		orderRepo:     orderRepo,
		quotationRepo: quotationRepo,
		dealRepo:      dealRepo,
		companyRepo:   companyRepo,
	}
}

func (r *InvoiceRepository) generateInvoiceNumber(ctx context.Context, workspaceID int) (string, error) {
	for attempt := 0; attempt < 20; attempt++ {
		var nextNum int
		err := r.db.Pool.QueryRow(ctx, `
			SELECT COALESCE(
				MAX(
					CASE 
						WHEN invoice_number ~ '^INV-[0-9]+$' 
						THEN CAST(SUBSTRING(invoice_number FROM 5) AS INTEGER) 
						ELSE 0 
					END
				), 0
			) + 1 + $1
			FROM invoices
		`, attempt).Scan(&nextNum)
		if err != nil || nextNum <= 0 {
			nextNum = int(time.Now().UnixNano()%90000) + 10000
		}
		invNum := fmt.Sprintf("INV-%04d", nextNum)

		var exists bool
		_ = r.db.Pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM invoices WHERE invoice_number = $1)", invNum).Scan(&exists)
		if !exists {
			return invNum, nil
		}
	}
	return fmt.Sprintf("INV-%d", time.Now().UnixNano()%1000000), nil
}

type InvoiceListFilter struct {
	Search      string
	Status      string
	CustomerID  *int
	OrderID     *int
	QuotationID *int
	DealID      *int
	Page        int
	Limit       int
}

func (r *InvoiceRepository) List(ctx context.Context, filter InvoiceListFilter, workspaceID int) (*models.InvoiceListResponse, error) {
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

	if filter.Search != "" {
		where = append(where, fmt.Sprintf("(i.invoice_number ILIKE $%d OR c.name ILIKE $%d OR COALESCE(i.notes, '') ILIKE $%d)", argIdx, argIdx, argIdx))
		args = append(args, "%"+filter.Search+"%")
		argIdx++
	}
	if filter.Status != "" && filter.Status != "all" {
		where = append(where, fmt.Sprintf("i.status = $%d", argIdx))
		args = append(args, NormalizeInvoiceStatus(filter.Status))
		argIdx++
	}
	if filter.CustomerID != nil {
		where = append(where, fmt.Sprintf("i.customer_id = $%d", argIdx))
		args = append(args, *filter.CustomerID)
		argIdx++
	}
	if filter.OrderID != nil {
		where = append(where, fmt.Sprintf("i.order_id = $%d", argIdx))
		args = append(args, *filter.OrderID)
		argIdx++
	}
	if filter.QuotationID != nil {
		where = append(where, fmt.Sprintf("i.quotation_id = $%d", argIdx))
		args = append(args, *filter.QuotationID)
		argIdx++
	}

	whereClause := strings.Join(where, " AND ")

	countQuery := fmt.Sprintf(`
		SELECT COUNT(*) 
		FROM invoices i
		LEFT JOIN customers c ON i.customer_id = c.id
		WHERE %s
	`, whereClause)
	var total int
	if err := r.db.Pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, err
	}

	// Metric counts and sums across all active invoices for this workspace
	var totalInvoiced, totalPaid, totalBalance float64
	var draftCount, issuedCount, unpaidCount, partialCount, paidCount, overdueCount, cancelledCount int
	_ = r.db.Pool.QueryRow(ctx, `
		SELECT 
			COALESCE(SUM(grand_total), 0),
			COALESCE(SUM(amount_paid), 0),
			COALESCE(SUM(GREATEST(0, grand_total - amount_paid)), 0),
			COALESCE(COUNT(*) FILTER (WHERE status = 'Draft'), 0),
			COALESCE(COUNT(*) FILTER (WHERE status = 'Issued/Sent'), 0),
			COALESCE(COUNT(*) FILTER (WHERE status = 'Unpaid'), 0),
			COALESCE(COUNT(*) FILTER (WHERE status = 'Partially Paid'), 0),
			COALESCE(COUNT(*) FILTER (WHERE status = 'Paid'), 0),
			COALESCE(COUNT(*) FILTER (WHERE status = 'Overdue' OR (due_date < CURRENT_DATE AND status IN ('Unpaid', 'Issued/Sent', 'Partially Paid'))), 0),
			COALESCE(COUNT(*) FILTER (WHERE status = 'Cancelled'), 0)
		FROM invoices
		WHERE workspace_id = $1
	`, workspaceID).Scan(
		&totalInvoiced, &totalPaid, &totalBalance,
		&draftCount, &issuedCount, &unpaidCount, &partialCount, &paidCount, &overdueCount, &cancelledCount,
	)

	selectQuery := fmt.Sprintf(`
		SELECT 
			i.id, i.invoice_number, i.customer_id, i.order_id, i.quotation_id, i.deal_id,
			i.status, i.invoice_date, i.due_date, i.currency, i.subtotal, i.discount_percentage,
			i.discount_amount, i.taxable_amount, i.cgst_amount, i.sgst_amount, i.igst_amount,
			i.total_tax, i.round_off_amount, i.grand_total, i.amount_paid,
			i.payment_method, i.payment_notes, i.notes, i.terms_and_conditions,
			i.company_name, i.company_gstin, i.company_pan, i.company_state, i.company_address,
			i.customer_state, i.customer_gstin, i.is_inter_state,
			i.workspace_id, i.created_by_id, i.created_at, i.updated_at,
			c.id, c.name, c.email, c.phone, c.company,
			u.id, u.name, u.email,
			o.id, o.order_number, o.title,
			q.id, q.quotation_number, q.title, q.lead_number,
			d.id, d.deal_number, d.name, d.lead_number
		FROM invoices i
		LEFT JOIN customers c ON i.customer_id = c.id
		LEFT JOIN users u ON i.created_by_id = u.id
		LEFT JOIN orders o ON i.order_id = o.id
		LEFT JOIN quotations q ON i.quotation_id = q.id
		LEFT JOIN deals d ON i.deal_id = d.id
		WHERE %s
		ORDER BY i.created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIdx, argIdx+1)

	args = append(args, limit, offset)
	rows, err := r.db.Pool.Query(ctx, selectQuery, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.Invoice
	for rows.Next() {
		var inv models.Invoice
		var (
			cID, uID, oID, qID, dID                         *int
			cName, cEmail, cPhone, cCompany                 *string
			uName, uEmail                                   *string
			oNum, oTitle, qNum, qTitle, dNum, dName         *string
			qLeadNum, dLeadNum                              *string
		)

		err := rows.Scan(
			&inv.ID, &inv.InvoiceNumber, &inv.CustomerID, &inv.OrderID, &inv.QuotationID, &inv.DealID,
			&inv.Status, &inv.InvoiceDate, &inv.DueDate, &inv.Currency, &inv.Subtotal, &inv.DiscountPercentage,
			&inv.DiscountAmount, &inv.TaxableAmount, &inv.CGSTAmount, &inv.SGSTAmount, &inv.IGSTAmount,
			&inv.TotalTax, &inv.RoundOffAmount, &inv.GrandTotal, &inv.AmountPaid,
			&inv.PaymentMethod, &inv.PaymentNotes, &inv.Notes, &inv.TermsAndConditions,
			&inv.CompanyName, &inv.CompanyGSTIN, &inv.CompanyPAN, &inv.CompanyState, &inv.CompanyAddress,
			&inv.CustomerState, &inv.CustomerGSTIN, &inv.IsInterState,
			&inv.WorkspaceID, &inv.CreatedByID, &inv.CreatedAt, &inv.UpdatedAt,
			&cID, &cName, &cEmail, &cPhone, &cCompany,
			&uID, &uName, &uEmail,
			&oID, &oNum, &oTitle,
			&qID, &qNum, &qTitle, &qLeadNum,
			&dID, &dNum, &dName, &dLeadNum,
		)
		if err != nil {
			return nil, err
		}

		inv.RemainingBalance = math.Max(0, inv.GrandTotal-inv.AmountPaid)

		if cID != nil && cName != nil {
			inv.CustomerName = *cName
			inv.Customer = &models.Customer{
				ID:      *cID,
				Name:    *cName,
				Email:   cEmail,
				Phone:   cPhone,
				Company: cCompany,
			}
		}
		if uID != nil && uName != nil {
			inv.Creator = &models.UserSummary{
				ID:    *uID,
				Name:  *uName,
				Email: *uEmail,
			}
		}
		if oID != nil && oNum != nil {
			inv.Order = &models.Order{
				ID:          *oID,
				OrderNumber: *oNum,
				Title:       *oTitle,
			}
		}
		if qID != nil && qNum != nil {
			inv.Quotation = &models.Quotation{
				ID:              *qID,
				QuotationNumber: *qNum,
				Title:           *qTitle,
				LeadNumber:      qLeadNum,
			}
		}
		if dID != nil && dNum != nil {
			inv.Deal = &models.Deal{
				ID:         *dID,
				DealNumber: *dNum,
				Name:       *dName,
				LeadNumber: dLeadNum,
			}
		}
		if dLeadNum != nil && *dLeadNum != "" {
			inv.LeadNumber = dLeadNum
		} else if qLeadNum != nil && *qLeadNum != "" {
			inv.LeadNumber = qLeadNum
		}

		items = append(items, inv)
	}

	pages := (total + limit - 1) / limit
	if pages < 1 {
		pages = 1
	}

	return &models.InvoiceListResponse{
		Items:              items,
		Total:              total,
		Page:               page,
		Limit:              limit,
		Pages:              pages,
		TotalInvoiced:      totalInvoiced,
		TotalPaid:          totalPaid,
		TotalBalance:       totalBalance,
		TotalOutstanding:   totalBalance,
		DraftCount:         draftCount,
		IssuedCount:        issuedCount,
		UnpaidCount:        unpaidCount,
		PartiallyPaidCount: partialCount,
		PaidCount:          paidCount,
		OverdueCount:       overdueCount,
		CancelledCount:     cancelledCount,
	}, nil
}

func (r *InvoiceRepository) Get(ctx context.Context, id int) (*models.Invoice, error) {
	query := `
		SELECT 
			i.id, i.invoice_number, i.customer_id, i.order_id, i.quotation_id, i.deal_id,
			i.status, i.invoice_date, i.due_date, i.currency, i.subtotal, i.discount_percentage,
			i.discount_amount, i.taxable_amount, i.cgst_amount, i.sgst_amount, i.igst_amount,
			i.total_tax, i.round_off_amount, i.grand_total, i.amount_paid,
			i.payment_method, i.payment_notes, i.notes, i.terms_and_conditions,
			i.company_name, i.company_gstin, i.company_pan, i.company_state, i.company_address,
			i.customer_state, i.customer_gstin, i.is_inter_state,
			i.workspace_id, i.created_by_id, i.created_at, i.updated_at,
			c.id, c.name, c.email, c.phone, c.company, c.address, c.city, c.state, c.pincode, c.gstin,
			u.id, u.name, u.email,
			o.id, o.order_number, o.title,
			q.id, q.quotation_number, q.title, q.lead_number,
			d.id, d.deal_number, d.name, d.lead_number
		FROM invoices i
		LEFT JOIN customers c ON i.customer_id = c.id
		LEFT JOIN users u ON i.created_by_id = u.id
		LEFT JOIN orders o ON i.order_id = o.id
		LEFT JOIN quotations q ON i.quotation_id = q.id
		LEFT JOIN deals d ON i.deal_id = d.id
		WHERE i.id = $1
	`
	var inv models.Invoice
	var (
		cID, uID, oID, qID, dID                         *int
		cName, cEmail, cPhone, cCompany, cAddr, cCity, cState, cPin, cGst *string
		uName, uEmail                                   *string
		oNum, oTitle, qNum, qTitle, dNum, dName         *string
		qLeadNum, dLeadNum                              *string
	)

	err := r.db.Pool.QueryRow(ctx, query, id).Scan(
		&inv.ID, &inv.InvoiceNumber, &inv.CustomerID, &inv.OrderID, &inv.QuotationID, &inv.DealID,
		&inv.Status, &inv.InvoiceDate, &inv.DueDate, &inv.Currency, &inv.Subtotal, &inv.DiscountPercentage,
		&inv.DiscountAmount, &inv.TaxableAmount, &inv.CGSTAmount, &inv.SGSTAmount, &inv.IGSTAmount,
		&inv.TotalTax, &inv.RoundOffAmount, &inv.GrandTotal, &inv.AmountPaid,
		&inv.PaymentMethod, &inv.PaymentNotes, &inv.Notes, &inv.TermsAndConditions,
		&inv.CompanyName, &inv.CompanyGSTIN, &inv.CompanyPAN, &inv.CompanyState, &inv.CompanyAddress,
		&inv.CustomerState, &inv.CustomerGSTIN, &inv.IsInterState,
		&inv.WorkspaceID, &inv.CreatedByID, &inv.CreatedAt, &inv.UpdatedAt,
		&cID, &cName, &cEmail, &cPhone, &cCompany, &cAddr, &cCity, &cState, &cPin, &cGst,
		&uID, &uName, &uEmail,
		&oID, &oNum, &oTitle,
		&qID, &qNum, &qTitle, &qLeadNum,
		&dID, &dNum, &dName, &dLeadNum,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("invoice not found")
		}
		return nil, err
	}

	inv.RemainingBalance = math.Max(0, inv.GrandTotal-inv.AmountPaid)

	if cID != nil && cName != nil {
		inv.Customer = &models.Customer{
			ID:      *cID,
			Name:    *cName,
			Email:   cEmail,
			Phone:   cPhone,
			Company: cCompany,
			Address: cAddr,
			City:    cCity,
			State:   cState,
			Pincode: cPin,
			GSTIN:   cGst,
		}
		inv.CustomerName = *cName
	}
	if uID != nil && uName != nil {
		inv.Creator = &models.UserSummary{
			ID:    *uID,
			Name:  *uName,
			Email: *uEmail,
		}
	}
	if oID != nil && oNum != nil {
		inv.Order = &models.Order{
			ID:          *oID,
			OrderNumber: *oNum,
			Title:       *oTitle,
		}
	}
	if qID != nil && qNum != nil {
		inv.Quotation = &models.Quotation{
			ID:              *qID,
			QuotationNumber: *qNum,
			Title:           *qTitle,
			LeadNumber:      qLeadNum,
		}
	}
	if dID != nil && dNum != nil {
		inv.Deal = &models.Deal{
			ID:         *dID,
			DealNumber: *dNum,
			Name:       *dName,
			LeadNumber: dLeadNum,
		}
	}
	if dLeadNum != nil && *dLeadNum != "" {
		inv.LeadNumber = dLeadNum
	} else if qLeadNum != nil && *qLeadNum != "" {
		inv.LeadNumber = qLeadNum
	}

	// Load Items
	itemsQuery := `
		SELECT 
			id, invoice_id, product_id, product_name, sku, hsn_sac, description,
			quantity, unit_price, discount_percentage, tax_percentage, taxable_amount,
			gst_rate, gst_amount, cgst_rate, cgst_amount, sgst_rate, sgst_amount,
			igst_rate, igst_amount, line_total, created_at
		FROM invoice_items
		WHERE invoice_id = $1
		ORDER BY id ASC
	`
	itemRows, err := r.db.Pool.Query(ctx, itemsQuery, id)
	if err == nil {
		defer itemRows.Close()
		var items []models.InvoiceItem
		for itemRows.Next() {
			var it models.InvoiceItem
			if errScan := itemRows.Scan(
				&it.ID, &it.InvoiceID, &it.ProductID, &it.ProductName, &it.SKU, &it.HSNSAC, &it.Description,
				&it.Quantity, &it.UnitPrice, &it.DiscountPercentage, &it.TaxPercentage, &it.TaxableAmount,
				&it.GSTRate, &it.GSTAmount, &it.CGSTRate, &it.CGSTAmount, &it.SGSTRate, &it.SGSTAmount,
				&it.IGSTRate, &it.IGSTAmount, &it.LineTotal, &it.CreatedAt,
			); errScan == nil {
				it.Name = it.ProductName
				it.TotalAmount = it.LineTotal
				items = append(items, it)
			}
		}
		inv.Items = items
	}

	// Load Payments
	payQuery := `
		SELECT 
			p.id, p.invoice_id, p.amount, p.payment_date, p.payment_method,
			p.reference_number, p.notes, p.recorded_by_id, p.created_at,
			u.id, u.name, u.email
		FROM invoice_payments p
		LEFT JOIN users u ON p.recorded_by_id = u.id
		WHERE p.invoice_id = $1
		ORDER BY p.payment_date DESC, p.id DESC
	`
	payRows, err := r.db.Pool.Query(ctx, payQuery, id)
	if err == nil {
		defer payRows.Close()
		var payments []models.InvoicePayment
		for payRows.Next() {
			var pay models.InvoicePayment
			var uID *int
			var uName, uEmail *string
			if errScan := payRows.Scan(
				&pay.ID, &pay.InvoiceID, &pay.Amount, &pay.PaymentDate, &pay.PaymentMethod,
				&pay.ReferenceNumber, &pay.Notes, &pay.RecordedByID, &pay.CreatedAt,
				&uID, &uName, &uEmail,
			); errScan == nil {
				if uID != nil && uName != nil {
					pay.Recorder = &models.UserSummary{
						ID:    *uID,
						Name:  *uName,
						Email: *uEmail,
					}
				}
				payments = append(payments, pay)
			}
		}
		inv.Payments = payments
	}

	return &inv, nil
}

type calculatedInvoiceItem struct {
	productID   *int
	productName string
	sku         *string
	hsnSac      *string
	desc        *string
	qty         float64
	unitPrice   float64
	discPct     float64
	taxPct      float64
	taxableAmt  float64
	gstRate     float64
	gstAmt      float64
	cgstRate    float64
	cgstAmt     float64
	sgstRate    float64
	sgstAmt     float64
	igstRate    float64
	igstAmt     float64
	lineTotal   float64
}

func (r *InvoiceRepository) calculateInvoiceTotals(
	rawItems []models.InvoiceItemInput,
	discountPct float64,
	isInterState bool,
) (
	items []calculatedInvoiceItem,
	subtotal float64,
	discAmt float64,
	totalTaxable float64,
	totalCGST float64,
	totalSGST float64,
	totalIGST float64,
	totalTax float64,
	roundOff float64,
	grandTotal float64,
) {
	for _, it := range rawItems {
		qty := it.Quantity
		if qty <= 0 {
			qty = 1
		}
		price := it.UnitPrice
		if price < 0 {
			price = 0
		}
		itemDisc := it.DiscountPercentage
		if itemDisc < 0 {
			itemDisc = 0
		} else if itemDisc > 100 {
			itemDisc = 100
		}

		taxRate := it.TaxPercentage
		if taxRate < 0 {
			taxRate = 18
		}

		taxable := qty * price * (1.0 - (itemDisc / 100.0))
		tax := taxable * (taxRate / 100.0)

		var cgstR, cgstA, sgstR, sgstA, igstR, igstA float64
		if isInterState {
			igstR = taxRate
			igstA = tax
		} else {
			cgstR = taxRate / 2.0
			cgstA = tax / 2.0
			sgstR = taxRate / 2.0
			sgstA = tax / 2.0
		}

		lineTot := taxable + tax

		subtotal += (qty * price)
		totalTaxable += taxable
		totalCGST += cgstA
		totalSGST += sgstA
		totalIGST += igstA
		totalTax += tax

		items = append(items, calculatedInvoiceItem{
			productID:   it.ProductID,
			productName: it.ProductName,
			sku:         it.SKU,
			hsnSac:      it.HSNSAC,
			desc:        it.Description,
			qty:         qty,
			unitPrice:   price,
			discPct:     itemDisc,
			taxPct:      taxRate,
			taxableAmt:  taxable,
			gstRate:     taxRate,
			gstAmt:      tax,
			cgstRate:    cgstR,
			cgstAmt:     cgstA,
			sgstRate:    sgstR,
			sgstAmt:     sgstA,
			igstRate:    igstR,
			igstAmt:     igstA,
			lineTotal:   lineTot,
		})
	}

	if discountPct < 0 {
		discountPct = 0
	} else if discountPct > 100 {
		discountPct = 100
	}

	discAmt = totalTaxable * (discountPct / 100.0)
	if discountPct > 0 {
		factor := 1.0 - (discountPct / 100.0)
		totalTaxable *= factor
		totalCGST *= factor
		totalSGST *= factor
		totalIGST *= factor
		totalTax *= factor
	}

	rawGrandTotal := totalTaxable + totalTax
	roundTotal := math.Round(rawGrandTotal)
	roundOff = roundTotal - rawGrandTotal
	grandTotal = roundTotal

	return
}

func (r *InvoiceRepository) Create(ctx context.Context, input models.InvoiceCreateInput, createdByID *int, workspaceID int) (*models.Invoice, error) {
	if input.CustomerID <= 0 {
		return nil, errors.New("customer is required")
	}

	// Verify Customer
	cust, err := r.customerRepo.GetByID(ctx, input.CustomerID, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("customer error: %w", err)
	}

	// Load Company profile
	var compName, compGSTIN, compPAN, compState, compAddress *string
	comp, _ := r.companyRepo.GetProfile(ctx)
	if comp != nil {
		compName = &comp.CompanyName
		compGSTIN = &comp.GSTNumber
		compPAN = &comp.PANNumber
		compState = &comp.State
		compAddress = &comp.Address
	}

	// Determine Place of Supply
	var custState, custGSTIN *string
	isInterState := false
	if cust != nil {
		custState = cust.State
		custGSTIN = cust.GSTIN
		if compState != nil && custState != nil && *compState != "" && *custState != "" {
			if !strings.EqualFold(strings.TrimSpace(*compState), strings.TrimSpace(*custState)) {
				isInterState = true
			}
		}
	}

	invNum, err := r.generateInvoiceNumber(ctx, workspaceID)
	if err != nil {
		return nil, err
	}

	var invDate time.Time = time.Now()
	if input.InvoiceDate != nil && *input.InvoiceDate != "" {
		if pt, err := utils.ParseFlexibleTime(*input.InvoiceDate); err == nil {
			invDate = pt
		}
	}

	var dueDate *time.Time
	if input.DueDate != nil && *input.DueDate != "" {
		if pt, err := utils.ParseFlexibleTime(*input.DueDate); err == nil {
			dueDate = &pt
		}
	}

	currency := "INR"
	if input.Currency != nil && *input.Currency != "" {
		currency = *input.Currency
	}

	discPct := 0.0
	if input.DiscountPercentage != nil {
		discPct = *input.DiscountPercentage
	}

	status := "Draft"
	if input.Status != nil && *input.Status != "" {
		status = NormalizeInvoiceStatus(*input.Status)
	}

	calcItems, subtotal, discAmt, taxable, cgst, sgst, igst, totalTax, roundOff, grandTotal := r.calculateInvoiceTotals(
		input.Items,
		discPct,
		isInterState,
	)

	orderID := input.OrderID
	quotationID := input.QuotationID
	dealID := input.DealID

	if orderID != nil && *orderID > 0 {
		var oDealID, oQuotID *int
		_ = r.db.Pool.QueryRow(ctx, "SELECT deal_id, quotation_id FROM orders WHERE id = $1", *orderID).Scan(&oDealID, &oQuotID)
		if dealID == nil && oDealID != nil {
			dealID = oDealID
		}
		if quotationID == nil && oQuotID != nil {
			quotationID = oQuotID
		}
	}

	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var invoiceID int
	insertQuery := `
		INSERT INTO invoices (
			invoice_number, customer_id, order_id, quotation_id, deal_id,
			status, invoice_date, due_date, currency, subtotal, discount_percentage,
			discount_amount, taxable_amount, cgst_amount, sgst_amount, igst_amount,
			total_tax, round_off_amount, grand_total, amount_paid,
			notes, terms_and_conditions,
			company_name, company_gstin, company_pan, company_state, company_address,
			customer_state, customer_gstin, is_inter_state,
			workspace_id, created_by_id, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5,
			$6, $7, $8, $9, $10, $11,
			$12, $13, $14, $15, $16,
			$17, $18, $19, 0,
			$20, $21,
			$22, $23, $24, $25, $26,
			$27, $28, $29,
			$30, $31, NOW(), NOW()
		) RETURNING id
	`

	err = tx.QueryRow(ctx, insertQuery,
		invNum, input.CustomerID, orderID, quotationID, dealID,
		status, invDate, dueDate, currency, subtotal, discPct,
		discAmt, taxable, cgst, sgst, igst,
		totalTax, roundOff, grandTotal,
		input.Notes, input.TermsAndConditions,
		compName, compGSTIN, compPAN, compState, compAddress,
		custState, custGSTIN, isInterState,
		workspaceID, createdByID,
	).Scan(&invoiceID)
	if err != nil {
		return nil, fmt.Errorf("failed to create invoice: %w", err)
	}

	// Insert line items
	for _, it := range calcItems {
		itemQuery := `
			INSERT INTO invoice_items (
				invoice_id, product_id, product_name, sku, hsn_sac, description,
				quantity, unit_price, discount_percentage, tax_percentage, taxable_amount,
				gst_rate, gst_amount, cgst_rate, cgst_amount, sgst_rate, sgst_amount,
				igst_rate, igst_amount, line_total, created_at
			) VALUES (
				$1, $2, $3, $4, $5, $6,
				$7, $8, $9, $10, $11,
				$12, $13, $14, $15, $16, $17,
				$18, $19, $20, NOW()
			)
		`
		_, err = tx.Exec(ctx, itemQuery,
			invoiceID, it.productID, it.productName, it.sku, it.hsnSac, it.desc,
			it.qty, it.unitPrice, it.discPct, it.taxPct, it.taxableAmt,
			it.gstRate, it.gstAmt, it.cgstRate, it.cgstAmt, it.sgstRate, it.sgstAmt,
			it.igstRate, it.igstAmt, it.lineTotal,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to insert invoice item: %w", err)
		}
	}

	// If linked to Order, automatically mark the Order's invoice_status = 'Invoiced'
	if input.OrderID != nil && *input.OrderID > 0 {
		_, _ = tx.Exec(ctx, `UPDATE orders SET invoice_status = 'Invoiced', updated_at = NOW() WHERE id = $1`, *input.OrderID)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return r.Get(ctx, invoiceID)
}

func (r *InvoiceRepository) CreateFromOrder(ctx context.Context, orderID int, createdByID *int, workspaceID int) (*models.Invoice, error) {
	order, err := r.orderRepo.GetByID(ctx, orderID, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("order not found: %w", err)
	}

	var rawItems []models.InvoiceItemInput
	if len(order.Items) > 0 {
		for _, oIt := range order.Items {
			taxPct := oIt.GSTRate
			if taxPct <= 0 {
				taxPct = 18.0
			}
			rawItems = append(rawItems, models.InvoiceItemInput{
				ProductID:          oIt.ProductID,
				ProductName:        oIt.Name,
				Description:        oIt.Description,
				Quantity:           oIt.Quantity,
				UnitPrice:          oIt.UnitPrice,
				DiscountPercentage: 0,
				TaxPercentage:      taxPct,
			})
		}
	} else if order.QuotationID != nil && *order.QuotationID > 0 {
		quot, errQ := r.quotationRepo.GetByID(ctx, *order.QuotationID, workspaceID)
		if errQ == nil && len(quot.Items) > 0 {
			for _, qIt := range quot.Items {
				rawItems = append(rawItems, models.InvoiceItemInput{
					ProductID:          qIt.ProductID,
					ProductName:        qIt.ProductName,
					SKU:                qIt.SKU,
					HSNSAC:             qIt.HSNSAC,
					Description:        qIt.Description,
					Quantity:           qIt.Quantity,
					UnitPrice:          qIt.UnitPrice,
					DiscountPercentage: qIt.DiscountPercentage,
					TaxPercentage:      qIt.GSTRate,
				})
			}
		}
	}

	if len(rawItems) == 0 {
		rawItems = append(rawItems, models.InvoiceItemInput{
			ProductName:   fmt.Sprintf("Fulfillment for Order %s", order.OrderNumber),
			Quantity:      1,
			UnitPrice:     order.TotalAmount,
			TaxPercentage: 18,
		})
	}

	status := "Draft"
	due := time.Now().AddDate(0, 0, 15).Format("2006-01-02")
	invCreateInput := models.InvoiceCreateInput{
		CustomerID:  order.CustomerID,
		OrderID:     &order.ID,
		QuotationID: order.QuotationID,
		DealID:      order.DealID,
		Status:      &status,
		DueDate:     &due,
		Items:       rawItems,
		Notes:       order.Notes,
	}

	return r.Create(ctx, invCreateInput, createdByID, workspaceID)
}

func (r *InvoiceRepository) CreateFromQuotation(ctx context.Context, quotationID int, createdByID *int, workspaceID int) (*models.Invoice, error) {
	quot, err := r.quotationRepo.GetByID(ctx, quotationID, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("quotation not found: %w", err)
	}

	var rawItems []models.InvoiceItemInput
	for _, qIt := range quot.Items {
		rawItems = append(rawItems, models.InvoiceItemInput{
			ProductID:          qIt.ProductID,
			ProductName:        qIt.ProductName,
			SKU:                qIt.SKU,
			HSNSAC:             qIt.HSNSAC,
			Description:        qIt.Description,
			Quantity:           qIt.Quantity,
			UnitPrice:          qIt.UnitPrice,
			DiscountPercentage: qIt.DiscountPercentage,
			TaxPercentage:      qIt.GSTRate,
		})
	}

	status := "Draft"
	due := time.Now().AddDate(0, 0, 15).Format("2006-01-02")
	invCreateInput := models.InvoiceCreateInput{
		CustomerID:         quot.CustomerID,
		QuotationID:        &quot.ID,
		DealID:             &quot.DealID,
		Status:             &status,
		DueDate:            &due,
		DiscountPercentage: &quot.DiscountPercentage,
		TermsAndConditions: quot.TermsAndConditions,
		Notes:              quot.Notes,
		Items:              rawItems,
	}

	return r.Create(ctx, invCreateInput, createdByID, workspaceID)
}

func (r *InvoiceRepository) Update(ctx context.Context, id int, in models.InvoiceUpdateInput, userID *int, workspaceID int) (*models.Invoice, error) {
	existing, err := r.Get(ctx, id)
	if err != nil {
		return nil, err
	}

	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	if in.Status != nil && *in.Status != "" {
		existing.Status = NormalizeInvoiceStatus(*in.Status)
	}
	if in.InvoiceDate != nil && *in.InvoiceDate != "" {
		if pt, err := utils.ParseFlexibleTime(*in.InvoiceDate); err == nil {
			existing.InvoiceDate = pt
		}
	}
	if in.DueDate != nil && *in.DueDate != "" {
		if pt, err := utils.ParseFlexibleTime(*in.DueDate); err == nil {
			existing.DueDate = &pt
		}
	}
	if in.Notes != nil {
		existing.Notes = in.Notes
	}
	if in.TermsAndConditions != nil {
		existing.TermsAndConditions = in.TermsAndConditions
	}

	if len(in.Items) > 0 {
		discPct := existing.DiscountPercentage
		if in.DiscountPercentage != nil {
			discPct = *in.DiscountPercentage
		}

		calcItems, subtotal, discAmt, taxable, cgst, sgst, igst, totalTax, roundOff, grandTotal := r.calculateInvoiceTotals(
			in.Items,
			discPct,
			existing.IsInterState,
		)

		existing.Subtotal = subtotal
		existing.DiscountPercentage = discPct
		existing.DiscountAmount = discAmt
		existing.TaxableAmount = taxable
		existing.CGSTAmount = cgst
		existing.SGSTAmount = sgst
		existing.IGSTAmount = igst
		existing.TotalTax = totalTax
		existing.RoundOffAmount = roundOff
		existing.GrandTotal = grandTotal

		// Replace items
		_, _ = tx.Exec(ctx, "DELETE FROM invoice_items WHERE invoice_id = $1", id)
		for _, it := range calcItems {
			itemQuery := `
				INSERT INTO invoice_items (
					invoice_id, product_id, product_name, sku, hsn_sac, description,
					quantity, unit_price, discount_percentage, tax_percentage, taxable_amount,
					gst_rate, gst_amount, cgst_rate, cgst_amount, sgst_rate, sgst_amount,
					igst_rate, igst_amount, line_total, created_at
				) VALUES (
					$1, $2, $3, $4, $5, $6,
					$7, $8, $9, $10, $11,
					$12, $13, $14, $15, $16, $17,
					$18, $19, $20, NOW()
				)
			`
			_, err = tx.Exec(ctx, itemQuery,
				id, it.productID, it.productName, it.sku, it.hsnSac, it.desc,
				it.qty, it.unitPrice, it.discPct, it.taxPct, it.taxableAmt,
				it.gstRate, it.gstAmt, it.cgstRate, it.cgstAmt, it.sgstRate, it.sgstAmt,
				it.igstRate, it.igstAmt, it.lineTotal,
			)
			if err != nil {
				return nil, err
			}
		}
	}

	updateQuery := `
		UPDATE invoices
		SET status = $1, invoice_date = $2, due_date = $3, subtotal = $4,
		    discount_percentage = $5, discount_amount = $6, taxable_amount = $7,
		    cgst_amount = $8, sgst_amount = $9, igst_amount = $10, total_tax = $11,
		    round_off_amount = $12, grand_total = $13, notes = $14,
		    terms_and_conditions = $15, updated_at = NOW()
		WHERE id = $16
	`
	_, err = tx.Exec(ctx, updateQuery,
		existing.Status, existing.InvoiceDate, existing.DueDate, existing.Subtotal,
		existing.DiscountPercentage, existing.DiscountAmount, existing.TaxableAmount,
		existing.CGSTAmount, existing.SGSTAmount, existing.IGSTAmount, existing.TotalTax,
		existing.RoundOffAmount, existing.GrandTotal, existing.Notes,
		existing.TermsAndConditions, id,
	)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return r.Get(ctx, id)
}

func (r *InvoiceRepository) RecordPayment(ctx context.Context, id int, in models.InvoicePaymentInput, recordedByID *int, workspaceID int) (*models.Invoice, error) {
	if in.Amount <= 0 {
		return nil, errors.New("payment amount must be greater than 0")
	}

	existing, err := r.Get(ctx, id)
	if err != nil {
		return nil, err
	}
	if existing.Status == "Cancelled" {
		return nil, errors.New("cannot record payment on a cancelled invoice")
	}

	// Overpayment check
	remainingBalance := existing.GrandTotal - existing.AmountPaid
	if in.Amount > remainingBalance+0.001 {
		return nil, fmt.Errorf("payment amount (%.2f) exceeds outstanding invoice balance (%.2f)", in.Amount, remainingBalance)
	}

	// Duplicate reference number check
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

	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	payDate := time.Now()
	if in.PaymentDate != nil && *in.PaymentDate != "" {
		if pt, err := utils.ParseFlexibleTime(*in.PaymentDate); err == nil {
			payDate = pt
		}
	}

	method := strings.TrimSpace(in.PaymentMethod)
	if method == "" {
		method = "Bank Transfer"
	}

	payQuery := `
		INSERT INTO invoice_payments (
			invoice_id, amount, payment_date, payment_method, reference_number, notes, recorded_by_id, created_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, NOW()
		)
	`
	_, err = tx.Exec(ctx, payQuery, id, in.Amount, payDate, method, in.ReferenceNumber, in.Notes, recordedByID)
	if err != nil {
		return nil, fmt.Errorf("failed to record payment: %w", err)
	}

	// Calculate new total amount_paid
	var totalPaid float64
	_ = tx.QueryRow(ctx, "SELECT COALESCE(SUM(amount), 0) FROM invoice_payments WHERE invoice_id = $1", id).Scan(&totalPaid)

	newStatus := existing.Status
	if totalPaid >= existing.GrandTotal {
		newStatus = "Paid"
	} else if totalPaid > 0 {
		newStatus = "Partially Paid"
	}

	_, err = tx.Exec(ctx, `
		UPDATE invoices 
		SET amount_paid = $1, status = $2, payment_method = $3, updated_at = NOW()
		WHERE id = $4
	`, totalPaid, newStatus, method, id)
	if err != nil {
		return nil, err
	}

	// If linked to Order and fully paid, update Order's payment_status to 'Paid'
	if existing.OrderID != nil && *existing.OrderID > 0 {
		if newStatus == "Paid" {
			_, _ = tx.Exec(ctx, `UPDATE orders SET payment_status = 'Paid', updated_at = NOW() WHERE id = $1`, *existing.OrderID)
		} else if newStatus == "Partially Paid" {
			_, _ = tx.Exec(ctx, `UPDATE orders SET payment_status = 'Partially Paid', updated_at = NOW() WHERE id = $1`, *existing.OrderID)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return r.Get(ctx, id)
}

func (r *InvoiceRepository) ChangeStatus(ctx context.Context, id int, status string, userID *int, workspaceID int) (*models.Invoice, error) {
	norm := NormalizeInvoiceStatus(status)
	_, err := r.db.Pool.Exec(ctx, "UPDATE invoices SET status = $1, updated_at = NOW() WHERE id = $2", norm, id)
	if err != nil {
		return nil, err
	}

	// If status changed to Paid, also sync linked order payment status
	if norm == "Paid" {
		inv, _ := r.Get(ctx, id)
		if inv != nil && inv.OrderID != nil && *inv.OrderID > 0 {
			_, _ = r.db.Pool.Exec(ctx, "UPDATE orders SET payment_status = 'Paid', updated_at = NOW() WHERE id = $1", *inv.OrderID)
		}
	}

	return r.Get(ctx, id)
}

func (r *InvoiceRepository) Delete(ctx context.Context, id int) error {
	res, err := r.db.Pool.Exec(ctx, "DELETE FROM invoices WHERE id = $1", id)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return errors.New("invoice not found")
	}
	return nil
}
