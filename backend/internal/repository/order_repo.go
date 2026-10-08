package repository

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"crm-backend-go/internal/database"
	"crm-backend-go/internal/models"

	"github.com/jackc/pgx/v5"
)

var ValidOrderStages = []string{
	"Not Started",
	"Planning",
	"In Progress",
	"Client Review",
	"Revision/Changes",
	"Delivered",
	"Completed",
}

func IsValidOrderStage(stage string) bool {
	norm := strings.TrimSpace(stage)
	for _, s := range ValidOrderStages {
		if strings.EqualFold(s, norm) {
			return true
		}
	}
	return false
}

func NormalizeOrderStage(stage string) string {
	norm := strings.TrimSpace(stage)
	for _, s := range ValidOrderStages {
		if strings.EqualFold(s, norm) {
			return s
		}
	}
	return "Not Started"
}

type OrderRepository struct {
	db            *database.DB
	customerRepo  *CustomerRepository
	dealRepo      *DealRepository
	quotationRepo *QuotationRepository
}

func NewOrderRepository(
	db *database.DB,
	customerRepo *CustomerRepository,
	dealRepo *DealRepository,
	quotationRepo *QuotationRepository,
) *OrderRepository {
	return &OrderRepository{
		db:            db,
		customerRepo:  customerRepo,
		dealRepo:      dealRepo,
		quotationRepo: quotationRepo,
	}
}

func (r *OrderRepository) generateOrderNumber(ctx context.Context, workspaceID int) (string, error) {
	for attempt := 0; attempt < 20; attempt++ {
		var nextNum int
		err := r.db.Pool.QueryRow(ctx, `
			SELECT COALESCE(
				MAX(
					CASE 
						WHEN order_number ~ '^ORD-[0-9]+$' 
						THEN CAST(SUBSTRING(order_number FROM 5) AS INTEGER) 
						ELSE 0 
					END
				), 0
			) + 1 + $1
			FROM orders
		`, attempt).Scan(&nextNum)
		if err != nil || nextNum <= 0 {
			nextNum = int(time.Now().UnixNano()%90000) + 10000
		}
		orderNum := fmt.Sprintf("ORD-%04d", nextNum)

		var exists bool
		_ = r.db.Pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM orders WHERE order_number = $1)", orderNum).Scan(&exists)
		if !exists {
			return orderNum, nil
		}
	}
	return fmt.Sprintf("ORD-%d", time.Now().UnixNano()%1000000), nil
}

func (r *OrderRepository) Create(ctx context.Context, input models.OrderCreateInput, createdByID *int, workspaceID int) (*models.Order, error) {
	title := strings.TrimSpace(input.Title)
	if title == "" {
		return nil, errors.New("order title is required")
	}
	if input.CustomerID <= 0 {
		return nil, errors.New("customer is required")
	}

	orderNum, err := r.generateOrderNumber(ctx, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("failed to generate order number: %w", err)
	}

	stage := "Not Started"
	if input.Stage != nil && strings.TrimSpace(*input.Stage) != "" {
		stage = NormalizeOrderStage(*input.Stage)
	}

	paymentStatus := "Unpaid"
	if input.PaymentStatus != nil && strings.TrimSpace(*input.PaymentStatus) != "" {
		paymentStatus = strings.TrimSpace(*input.PaymentStatus)
	}

	invoiceStatus := "Not Invoiced"
	if input.InvoiceStatus != nil && strings.TrimSpace(*input.InvoiceStatus) != "" {
		invoiceStatus = strings.TrimSpace(*input.InvoiceStatus)
	}

	currency := "INR"
	if input.Currency != nil && strings.TrimSpace(*input.Currency) != "" {
		currency = strings.TrimSpace(*input.Currency)
	}

	totalAmount := 0.00
	if input.TotalAmount != nil && *input.TotalAmount >= 0 {
		totalAmount = *input.TotalAmount
	}

	query := `
		INSERT INTO orders (
			order_number, title, customer_id, deal_id, quotation_id,
			stage, payment_status, invoice_status, total_amount, currency,
			start_date, delivery_date, notes, owner_id, workspace_id, created_by_id,
			created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5,
			$6, $7, $8, $9, $10,
			$11, $12, $13, $14, $15, $16,
			NOW(), NOW()
		) RETURNING id
	`

	var orderID int
	err = r.db.Pool.QueryRow(ctx, query,
		orderNum, title, input.CustomerID, input.DealID, input.QuotationID,
		stage, paymentStatus, invoiceStatus, totalAmount, currency,
		input.StartDate, input.DeliveryDate, input.Notes, input.OwnerID, workspaceID, createdByID,
	).Scan(&orderID)
	if err != nil {
		return nil, fmt.Errorf("failed to insert order: %w", err)
	}

	// Insert line items
	for _, it := range input.Items {
		name := strings.TrimSpace(it.Name)
		if name == "" {
			continue
		}
		qty := it.Quantity
		if qty <= 0 {
			qty = 1.00
		}
		price := it.UnitPrice
		gstRate := 0.00
		if it.GSTRate != nil {
			gstRate = *it.GSTRate
		}
		taxable := qty * price
		if it.TaxableAmount != nil {
			taxable = *it.TaxableAmount
		}
		tax := (taxable * gstRate) / 100.00
		if it.TaxAmount != nil {
			tax = *it.TaxAmount
		}
		itemTotal := taxable + tax
		if it.TotalAmount != nil {
			itemTotal = *it.TotalAmount
		}

		_, _ = r.db.Pool.Exec(ctx, `
			INSERT INTO order_items (
				order_id, product_id, name, description, quantity,
				unit_price, gst_rate, taxable_amount, tax_amount, total_amount, created_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
		`, orderID, it.ProductID, name, it.Description, qty, price, gstRate, taxable, tax, itemTotal)
	}

	// Record initial activity
	_ = r.CreateActivity(ctx, orderID, createdByID, "order_created", "Order Created", fmt.Sprintf("Order %s was created in stage %s with total %s %.2f", orderNum, stage, currency, totalAmount))

	return r.GetByID(ctx, orderID, workspaceID)
}

func (r *OrderRepository) GetByID(ctx context.Context, id int, workspaceID int) (*models.Order, error) {
	query := `
		SELECT o.id, o.order_number, o.title, o.customer_id, o.deal_id, o.quotation_id,
		       o.stage, o.payment_status, o.invoice_status, o.total_amount, o.currency,
		       o.start_date::text, o.delivery_date::text, o.notes, o.owner_id, o.workspace_id,
		       o.created_by_id, o.created_at, o.updated_at,
		       c.id, c.name, c.email, c.phone, c.company,
		       d.id, d.deal_number, d.name,
		       q.id, q.quotation_number, q.title, q.status,
		       u.id, u.name, u.email,
		       cu.id, cu.name, cu.email
		FROM orders o
		JOIN customers c ON o.customer_id = c.id
		LEFT JOIN deals d ON o.deal_id = d.id
		LEFT JOIN quotations q ON o.quotation_id = q.id
		LEFT JOIN users u ON o.owner_id = u.id
		LEFT JOIN users cu ON o.created_by_id = cu.id
		WHERE o.id = $1 AND o.workspace_id = $2
	`

	var o models.Order
	var cID int
	var cName string
	var cEmail, cPhone, cCompany *string
	var dID *int
	var dNum, dName *string
	var qID *int
	var qNum, qTitle, qStatus *string
	var uID *int
	var uName, uEmail *string
	var cuID *int
	var cuName, cuEmail *string

	err := r.db.Pool.QueryRow(ctx, query, id, workspaceID).Scan(
		&o.ID, &o.OrderNumber, &o.Title, &o.CustomerID, &o.DealID, &o.QuotationID,
		&o.Stage, &o.PaymentStatus, &o.InvoiceStatus, &o.TotalAmount, &o.Currency,
		&o.StartDate, &o.DeliveryDate, &o.Notes, &o.OwnerID, &o.WorkspaceID,
		&o.CreatedByID, &o.CreatedAt, &o.UpdatedAt,
		&cID, &cName, &cEmail, &cPhone, &cCompany,
		&dID, &dNum, &dName,
		&qID, &qNum, &qTitle, &qStatus,
		&uID, &uName, &uEmail,
		&cuID, &cuName, &cuEmail,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	o.Customer = &models.Customer{
		ID:      cID,
		Name:    cName,
		Email:   cEmail,
		Phone:   cPhone,
		Company: cCompany,
	}

	if dID != nil && dNum != nil && dName != nil {
		o.Deal = &models.Deal{
			ID:         *dID,
			DealNumber: *dNum,
			Name:       *dName,
		}
	}

	if qID != nil && qNum != nil {
		o.Quotation = &models.Quotation{
			ID:              *qID,
			QuotationNumber: *qNum,
			Title:           *qTitle,
			Status:          *qStatus,
		}
	}

	if uID != nil && uName != nil && uEmail != nil {
		o.Owner = &models.UserSummary{ID: *uID, Name: *uName, Email: *uEmail}
	}
	if cuID != nil && cuName != nil && cuEmail != nil {
		o.Creator = &models.UserSummary{ID: *cuID, Name: *cuName, Email: *cuEmail}
	}

	// Fetch items
	itemRows, err := r.db.Pool.Query(ctx, `
		SELECT id, order_id, product_id, name, description, quantity,
		       unit_price, gst_rate, taxable_amount, tax_amount, total_amount, created_at
		FROM order_items
		WHERE order_id = $1
		ORDER BY id ASC
	`, o.ID)
	if err == nil {
		defer itemRows.Close()
		var items []models.OrderItem
		for itemRows.Next() {
			var it models.OrderItem
			if err := itemRows.Scan(
				&it.ID, &it.OrderID, &it.ProductID, &it.Name, &it.Description,
				&it.Quantity, &it.UnitPrice, &it.GSTRate, &it.TaxableAmount,
				&it.TaxAmount, &it.TotalAmount, &it.CreatedAt,
			); err == nil {
				items = append(items, it)
			}
		}
		o.Items = items
	}

	// Fetch activities
	actRows, err := r.db.Pool.Query(ctx, `
		SELECT oa.id, oa.order_id, oa.user_id, oa.activity_type, oa.title, oa.description, oa.created_at,
		       u.id, u.name, u.email
		FROM order_activities oa
		LEFT JOIN users u ON oa.user_id = u.id
		WHERE oa.order_id = $1
		ORDER BY oa.created_at DESC LIMIT 50
	`, o.ID)
	if err == nil {
		defer actRows.Close()
		var activities []models.OrderActivity
		for actRows.Next() {
			var act models.OrderActivity
			var actUID *int
			var actUName, actUEmail *string
			if err := actRows.Scan(
				&act.ID, &act.OrderID, &act.UserID, &act.ActivityType, &act.Title, &act.Description, &act.CreatedAt,
				&actUID, &actUName, &actUEmail,
			); err == nil {
				if actUID != nil && actUName != nil && actUEmail != nil {
					act.User = &models.UserSummary{ID: *actUID, Name: *actUName, Email: *actUEmail}
				}
				activities = append(activities, act)
			}
		}
		o.Activities = activities
	}

	return &o, nil
}

type OrderFilter struct {
	Stage         string
	PaymentStatus string
	InvoiceStatus string
	CustomerID    *int
	DealID        *int
	OwnerID       *int
	Search        string
	Page          int
	Limit         int
	SortBy        string
	SortDir       string
}

func (r *OrderRepository) List(ctx context.Context, filter OrderFilter, workspaceID int) (*models.OrderListResponse, error) {
	if filter.Page < 1 {
		filter.Page = 1
	}
	if filter.Limit < 1 || filter.Limit > 200 {
		filter.Limit = 50
	}
	offset := (filter.Page - 1) * filter.Limit

	whereClauses := []string{"o.workspace_id = $1"}
	args := []interface{}{workspaceID}
	idx := 2

	if filter.Stage != "" && !strings.EqualFold(filter.Stage, "all") {
		whereClauses = append(whereClauses, "LOWER(o.stage) = LOWER($"+strconv.Itoa(idx)+")")
		args = append(args, filter.Stage)
		idx++
	}

	if filter.PaymentStatus != "" && !strings.EqualFold(filter.PaymentStatus, "all") {
		whereClauses = append(whereClauses, "LOWER(o.payment_status) = LOWER($"+strconv.Itoa(idx)+")")
		args = append(args, filter.PaymentStatus)
		idx++
	}

	if filter.InvoiceStatus != "" && !strings.EqualFold(filter.InvoiceStatus, "all") {
		whereClauses = append(whereClauses, "LOWER(o.invoice_status) = LOWER($"+strconv.Itoa(idx)+")")
		args = append(args, filter.InvoiceStatus)
		idx++
	}

	if filter.CustomerID != nil && *filter.CustomerID > 0 {
		whereClauses = append(whereClauses, "o.customer_id = $"+strconv.Itoa(idx))
		args = append(args, *filter.CustomerID)
		idx++
	}

	if filter.DealID != nil && *filter.DealID > 0 {
		whereClauses = append(whereClauses, "o.deal_id = $"+strconv.Itoa(idx))
		args = append(args, *filter.DealID)
		idx++
	}

	if filter.OwnerID != nil && *filter.OwnerID > 0 {
		whereClauses = append(whereClauses, "o.owner_id = $"+strconv.Itoa(idx))
		args = append(args, *filter.OwnerID)
		idx++
	}

	if strings.TrimSpace(filter.Search) != "" {
		searchTerm := "%" + strings.TrimSpace(filter.Search) + "%"
		whereClauses = append(whereClauses, "(o.title ILIKE $"+strconv.Itoa(idx)+" OR o.order_number ILIKE $"+strconv.Itoa(idx)+" OR c.name ILIKE $"+strconv.Itoa(idx)+" OR c.company ILIKE $"+strconv.Itoa(idx)+")")
		args = append(args, searchTerm)
		idx++
	}

	whereSQL := " WHERE " + strings.Join(whereClauses, " AND ")

	// Total Count & Value
	countQuery := `
		SELECT COUNT(*), COALESCE(SUM(o.total_amount), 0.0)
		FROM orders o
		JOIN customers c ON o.customer_id = c.id
	` + whereSQL

	var total int
	var totalValue float64
	if err := r.db.Pool.QueryRow(ctx, countQuery, args...).Scan(&total, &totalValue); err != nil {
		return nil, err
	}

	// Fetch stage metric counts for workspace
	stageCounts := make(map[string]int)
	countRows, err := r.db.Pool.Query(ctx, `
		SELECT stage, COUNT(*) 
		FROM orders 
		WHERE workspace_id = $1 
		GROUP BY stage
	`, workspaceID)
	if err == nil {
		defer countRows.Close()
		for countRows.Next() {
			var st string
			var cnt int
			if err := countRows.Scan(&st, &cnt); err == nil {
				stageCounts[NormalizeOrderStage(st)] = cnt
			}
		}
	}

	sortColumn := "o.id"
	switch filter.SortBy {
	case "order_number":
		sortColumn = "o.order_number"
	case "title":
		sortColumn = "o.title"
	case "total_amount":
		sortColumn = "o.total_amount"
	case "delivery_date":
		sortColumn = "o.delivery_date"
	case "stage":
		sortColumn = "o.stage"
	default:
		sortColumn = "o.id"
	}
	sortOrder := "DESC"
	if strings.EqualFold(filter.SortDir, "asc") {
		sortOrder = "ASC"
	}

	selectQuery := `
		SELECT o.id, o.order_number, o.title, o.customer_id, o.deal_id, o.quotation_id,
		       o.stage, o.payment_status, o.invoice_status, o.total_amount, o.currency,
		       o.start_date::text, o.delivery_date::text, o.notes, o.owner_id, o.workspace_id,
		       o.created_by_id, o.created_at, o.updated_at,
		       c.id, c.name, c.email, c.phone, c.company,
		       d.id, d.deal_number, d.name,
		       q.id, q.quotation_number, q.title, q.status,
		       u.id, u.name, u.email
		FROM orders o
		JOIN customers c ON o.customer_id = c.id
		LEFT JOIN deals d ON o.deal_id = d.id
		LEFT JOIN quotations q ON o.quotation_id = q.id
		LEFT JOIN users u ON o.owner_id = u.id
	` + whereSQL + fmt.Sprintf(" ORDER BY %s %s LIMIT $%d OFFSET $%d", sortColumn, sortOrder, idx, idx+1)

	args = append(args, filter.Limit, offset)

	rows, err := r.db.Pool.Query(ctx, selectQuery, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]models.Order, 0)
	for rows.Next() {
		var o models.Order
		var cID int
		var cName string
		var cEmail, cPhone, cCompany *string
		var dID *int
		var dNum, dName *string
		var qID *int
		var qNum, qTitle, qStatus *string
		var uID *int
		var uName, uEmail *string

		if err := rows.Scan(
			&o.ID, &o.OrderNumber, &o.Title, &o.CustomerID, &o.DealID, &o.QuotationID,
			&o.Stage, &o.PaymentStatus, &o.InvoiceStatus, &o.TotalAmount, &o.Currency,
			&o.StartDate, &o.DeliveryDate, &o.Notes, &o.OwnerID, &o.WorkspaceID,
			&o.CreatedByID, &o.CreatedAt, &o.UpdatedAt,
			&cID, &cName, &cEmail, &cPhone, &cCompany,
			&dID, &dNum, &dName,
			&qID, &qNum, &qTitle, &qStatus,
			&uID, &uName, &uEmail,
		); err == nil {
			o.Customer = &models.Customer{
				ID:      cID,
				Name:    cName,
				Email:   cEmail,
				Phone:   cPhone,
				Company: cCompany,
			}
			if dID != nil && dNum != nil && dName != nil {
				o.Deal = &models.Deal{ID: *dID, DealNumber: *dNum, Name: *dName}
			}
			if qID != nil && qNum != nil {
				o.Quotation = &models.Quotation{ID: *qID, QuotationNumber: *qNum, Title: *qTitle, Status: *qStatus}
			}
			if uID != nil && uName != nil && uEmail != nil {
				o.Owner = &models.UserSummary{ID: *uID, Name: *uName, Email: *uEmail}
			}
			items = append(items, o)
		}
	}

	pages := (total + filter.Limit - 1) / filter.Limit

	return &models.OrderListResponse{
		Items:             items,
		Total:             total,
		Page:              filter.Page,
		Limit:             filter.Limit,
		Pages:             pages,
		TotalValue:        totalValue,
		NotStartedCount:   stageCounts["Not Started"],
		PlanningCount:     stageCounts["Planning"],
		InProgressCount:   stageCounts["In Progress"],
		ClientReviewCount: stageCounts["Client Review"],
		RevisionCount:     stageCounts["Revision/Changes"],
		DeliveredCount:    stageCounts["Delivered"],
		CompletedCount:    stageCounts["Completed"],
	}, nil
}

func (r *OrderRepository) Update(ctx context.Context, id int, input models.OrderUpdateInput, currentUserID *int, workspaceID int) (*models.Order, error) {
	current, err := r.GetByID(ctx, id, workspaceID)
	if err != nil {
		return nil, err
	}
	if current == nil {
		return nil, errors.New("order not found")
	}

	newTitle := current.Title
	if input.Title != nil && strings.TrimSpace(*input.Title) != "" {
		newTitle = strings.TrimSpace(*input.Title)
	}

	newStage := current.Stage
	stageChanged := false
	if input.Stage != nil && strings.TrimSpace(*input.Stage) != "" {
		normalized := NormalizeOrderStage(*input.Stage)
		if normalized != current.Stage {
			newStage = normalized
			stageChanged = true
		}
	}

	newPaymentStatus := current.PaymentStatus
	if input.PaymentStatus != nil && strings.TrimSpace(*input.PaymentStatus) != "" {
		newPaymentStatus = strings.TrimSpace(*input.PaymentStatus)
	}

	newInvoiceStatus := current.InvoiceStatus
	if input.InvoiceStatus != nil && strings.TrimSpace(*input.InvoiceStatus) != "" {
		newInvoiceStatus = strings.TrimSpace(*input.InvoiceStatus)
	}

	newTotal := current.TotalAmount
	if input.TotalAmount != nil && *input.TotalAmount >= 0 {
		newTotal = *input.TotalAmount
	}

	newCurrency := current.Currency
	if input.Currency != nil && strings.TrimSpace(*input.Currency) != "" {
		newCurrency = strings.TrimSpace(*input.Currency)
	}

	newStartDate := current.StartDate
	if input.StartDate != nil {
		newStartDate = input.StartDate
	}

	newDeliveryDate := current.DeliveryDate
	if input.DeliveryDate != nil {
		newDeliveryDate = input.DeliveryDate
	}

	newNotes := current.Notes
	if input.Notes != nil {
		newNotes = input.Notes
	}

	newOwnerID := current.OwnerID
	if input.OwnerID != nil {
		newOwnerID = input.OwnerID
	}

	_, err = r.db.Pool.Exec(ctx, `
		UPDATE orders
		SET title = $1, stage = $2, payment_status = $3, invoice_status = $4,
		    total_amount = $5, currency = $6, start_date = $7, delivery_date = $8,
		    notes = $9, owner_id = $10, updated_at = NOW()
		WHERE id = $11 AND workspace_id = $12
	`, newTitle, newStage, newPaymentStatus, newInvoiceStatus,
		newTotal, newCurrency, newStartDate, newDeliveryDate,
		newNotes, newOwnerID, id, workspaceID)
	if err != nil {
		return nil, err
	}

	if stageChanged {
		_ = r.CreateActivity(ctx, id, currentUserID, "stage_changed", "Stage Updated", fmt.Sprintf("Stage changed from %s to %s", current.Stage, newStage))
	}

	return r.GetByID(ctx, id, workspaceID)
}

func (r *OrderRepository) ChangeStage(ctx context.Context, id int, newStage string, notes string, currentUserID *int, workspaceID int) (*models.Order, error) {
	current, err := r.GetByID(ctx, id, workspaceID)
	if err != nil {
		return nil, err
	}
	if current == nil {
		return nil, errors.New("order not found")
	}

	if !IsValidOrderStage(newStage) {
		return nil, fmt.Errorf("invalid order stage '%s'", newStage)
	}
	normalized := NormalizeOrderStage(newStage)
	if normalized == current.Stage {
		return current, nil
	}

	_, err = r.db.Pool.Exec(ctx, `
		UPDATE orders
		SET stage = $1, updated_at = NOW()
		WHERE id = $2 AND workspace_id = $3
	`, normalized, id, workspaceID)
	if err != nil {
		return nil, err
	}

	desc := fmt.Sprintf("Stage changed from %s to %s", current.Stage, normalized)
	if strings.TrimSpace(notes) != "" {
		desc += fmt.Sprintf(" (Notes: %s)", strings.TrimSpace(notes))
	}
	_ = r.CreateActivity(ctx, id, currentUserID, "stage_changed", "Stage Updated", desc)

	return r.GetByID(ctx, id, workspaceID)
}

func (r *OrderRepository) Delete(ctx context.Context, id int, workspaceID int) error {
	tag, err := r.db.Pool.Exec(ctx, "DELETE FROM orders WHERE id = $1 AND workspace_id = $2", id, workspaceID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return errors.New("order not found")
	}
	return nil
}

func (r *OrderRepository) CreateActivity(ctx context.Context, orderID int, userID *int, actType, title, description string) error {
	_, err := r.db.Pool.Exec(ctx, `
		INSERT INTO order_activities (order_id, user_id, activity_type, title, description, created_at)
		VALUES ($1, $2, $3, $4, $5, NOW())
	`, orderID, userID, actType, title, description)
	return err
}

func (r *OrderRepository) CreateFromWonDeal(ctx context.Context, dealID int, currentUserID *int, workspaceID int) (*models.Order, error) {
	// 1. Check if Order already exists for this deal
	var existingID int
	err := r.db.Pool.QueryRow(ctx, "SELECT id FROM orders WHERE deal_id = $1 AND workspace_id = $2 LIMIT 1", dealID, workspaceID).Scan(&existingID)
	if err == nil && existingID > 0 {
		return r.GetByID(ctx, existingID, workspaceID)
	}

	// 2. Fetch Deal details
	deal, err := r.dealRepo.GetByID(ctx, dealID, workspaceID)
	if err != nil || deal == nil {
		return nil, fmt.Errorf("failed to fetch deal %d: %w", dealID, err)
	}

	// 3. Find Accepted Quotation first; fallback to latest quotation
	var qtnID int
	errQ := r.db.Pool.QueryRow(ctx, `
		SELECT id FROM quotations 
		WHERE deal_id = $1 AND status = 'Accepted' 
		ORDER BY id DESC LIMIT 1
	`, dealID).Scan(&qtnID)
	if errQ != nil || qtnID == 0 {
		_ = r.db.Pool.QueryRow(ctx, `
			SELECT id FROM quotations 
			WHERE deal_id = $1 
			ORDER BY id DESC LIMIT 1
		`, dealID).Scan(&qtnID)
	}

	title := fmt.Sprintf("Order - %s", deal.Name)
	custID := deal.CustomerID
	currency := deal.Currency
	if currency == "" {
		currency = "INR"
	}
	totalAmount := deal.Value
	stage := "Not Started"
	paymentStatus := "Unpaid"
	invoiceStatus := "Not Invoiced"

	var itemsInput []models.OrderItemInput
	var linkedQtnID *int

	if qtnID > 0 {
		qtn, qErr := r.quotationRepo.GetByID(ctx, qtnID, workspaceID)
		if qErr == nil && qtn != nil {
			linkedQtnID = &qtn.ID
			if qtn.TotalAmount > 0 {
				totalAmount = qtn.TotalAmount
			}
			if qtn.Currency != "" {
				currency = qtn.Currency
			}

			// Copy line items from quotation
			for _, qi := range qtn.Items {
				pID := qi.ProductID
				taxable := qi.TaxableAmount
				taxAmt := qi.GSTAmount
				total := qi.LineTotal
				gstR := qi.GSTRate
				name := qi.ProductName
				if strings.TrimSpace(name) == "" && qi.Description != nil {
					name = *qi.Description
				}
				if strings.TrimSpace(name) == "" {
					name = "Item"
				}
				itemsInput = append(itemsInput, models.OrderItemInput{
					ProductID:     pID,
					Name:          name,
					Description:   qi.Description,
					Quantity:      qi.Quantity,
					UnitPrice:     qi.UnitPrice,
					GSTRate:       &gstR,
					TaxableAmount: &taxable,
					TaxAmount:     &taxAmt,
					TotalAmount:   &total,
				})
			}
		}
	}

	// If no items were added from quotation, create a default deliverable matching deal
	if len(itemsInput) == 0 {
		unitPrice := totalAmount
		taxable := totalAmount
		zero := 0.00
		itemsInput = append(itemsInput, models.OrderItemInput{
			Name:          deal.Name,
			Quantity:      1.00,
			UnitPrice:     unitPrice,
			GSTRate:       &zero,
			TaxableAmount: &taxable,
			TaxAmount:     &zero,
			TotalAmount:   &totalAmount,
		})
	}

	notes := fmt.Sprintf("Automatically generated from Won Deal %s (%s).", deal.DealNumber, deal.Name)
	todayStr := time.Now().Format("2006-01-02")
	ownerID := deal.OwnerID

	createInput := models.OrderCreateInput{
		Title:         title,
		CustomerID:    custID,
		DealID:        &dealID,
		QuotationID:   linkedQtnID,
		Stage:         &stage,
		PaymentStatus: &paymentStatus,
		InvoiceStatus: &invoiceStatus,
		TotalAmount:   &totalAmount,
		Currency:      &currency,
		StartDate:     &todayStr,
		Notes:         &notes,
		OwnerID:       ownerID,
		Items:         itemsInput,
	}

	createdOrder, err := r.Create(ctx, createInput, currentUserID, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("failed to auto-create order from deal: %w", err)
	}

	// Record activity on deal
	_ = r.dealRepo.CreateActivity(ctx, dealID, currentUserID, "order_created", "Order Generated", fmt.Sprintf("Order %s was created for delivery", createdOrder.OrderNumber))

	return createdOrder, nil
}
