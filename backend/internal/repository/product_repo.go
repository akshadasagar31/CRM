package repository

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"crm-backend-go/internal/database"
	"crm-backend-go/internal/models"

	"github.com/jackc/pgx/v5"
)

type ProductRepository struct {
	db *database.DB
}

func NewProductRepository(db *database.DB) *ProductRepository {
	return &ProductRepository{db: db}
}

type ProductFilter struct {
	Search    string
	Category  string
	Status    string // "all", "active", "inactive"
	SortBy    string // "name", "sku", "selling_price", "created_at"
	SortOrder string // "asc", "desc"
	Page      int
	Limit     int
}

// Create adds a new product to the catalog
func (r *ProductRepository) Create(ctx context.Context, input models.ProductCreateInput, createdByID *int, workspaceID int) (*models.Product, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return nil, errors.New("product name is required")
	}

	sku := strings.ToUpper(strings.TrimSpace(input.SKU))
	if sku == "" {
		return nil, errors.New("product SKU is required")
	}

	if input.SellingPrice < 0 {
		return nil, errors.New("selling price cannot be negative")
	}
	if input.TaxRate < 0 {
		return nil, errors.New("tax rate cannot be negative")
	}

	category := strings.TrimSpace(input.Category)
	if category == "" {
		category = "General"
	}

	unit := strings.TrimSpace(input.Unit)
	if unit == "" {
		unit = "Unit"
	}

	currency := strings.TrimSpace(input.Currency)
	if currency == "" {
		currency = "INR"
	}

	status := strings.ToLower(strings.TrimSpace(input.Status))
	if status != "inactive" {
		status = "active"
	}

	// Check SKU uniqueness among non-deleted products
	var existingID int
	err := r.db.Pool.QueryRow(ctx,
		"SELECT id FROM products WHERE sku = $1 AND workspace_id = $2 AND deleted_at IS NULL",
		sku, workspaceID,
	).Scan(&existingID)
	if err == nil {
		return nil, fmt.Errorf("a product with SKU '%s' already exists", sku)
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}

	query := `
		INSERT INTO products (
			name, sku, category, description, unit,
			selling_price, currency, tax_rate, hsn_sac,
			status, workspace_id, created_by_id, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
		RETURNING id
	`

	var id int
	err = r.db.Pool.QueryRow(ctx, query,
		name, sku, category, input.Description, unit,
		input.SellingPrice, currency, input.TaxRate, input.HsnSac,
		status, workspaceID, createdByID,
	).Scan(&id)
	if err != nil {
		return nil, err
	}

	return r.GetByID(ctx, id, workspaceID)
}

// GetByID returns a single product with creator summary
func (r *ProductRepository) GetByID(ctx context.Context, id int, workspaceID int) (*models.Product, error) {
	query := `
		SELECT p.id, p.name, p.sku, p.category, p.description, p.unit,
		       p.selling_price, p.currency, p.tax_rate, p.hsn_sac,
		       p.status, p.workspace_id, p.created_by_id, p.created_at, p.updated_at, p.deleted_at,
		       u.id, u.name, u.email
		FROM products p
		LEFT JOIN users u ON u.id = p.created_by_id
		WHERE p.id = $1 AND p.workspace_id = $2 AND p.deleted_at IS NULL
	`

	var p models.Product
	var uID *int
	var uName, uEmail *string

	err := r.db.Pool.QueryRow(ctx, query, id, workspaceID).Scan(
		&p.ID, &p.Name, &p.SKU, &p.Category, &p.Description, &p.Unit,
		&p.SellingPrice, &p.Currency, &p.TaxRate, &p.HsnSac,
		&p.Status, &p.WorkspaceID, &p.CreatedByID, &p.CreatedAt, &p.UpdatedAt, &p.DeletedAt,
		&uID, &uName, &uEmail,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	if uID != nil && uName != nil && uEmail != nil {
		p.Creator = &models.UserSummary{ID: *uID, Name: *uName, Email: *uEmail}
	}

	return &p, nil
}

// List returns filtered and paginated products
func (r *ProductRepository) List(ctx context.Context, filter ProductFilter, workspaceID int) (*models.ProductListResponse, error) {
	if filter.Page < 1 {
		filter.Page = 1
	}
	if filter.Limit < 1 || filter.Limit > 200 {
		filter.Limit = 50
	}
	offset := (filter.Page - 1) * filter.Limit

	whereClauses := []string{"p.workspace_id = $1", "p.deleted_at IS NULL"}
	args := []interface{}{workspaceID}
	idx := 2

	if strings.TrimSpace(filter.Category) != "" && filter.Category != "all" {
		whereClauses = append(whereClauses, "p.category = $"+strconv.Itoa(idx))
		args = append(args, strings.TrimSpace(filter.Category))
		idx++
	}

	if strings.TrimSpace(filter.Status) != "" && filter.Status != "all" {
		whereClauses = append(whereClauses, "p.status = $"+strconv.Itoa(idx))
		args = append(args, strings.ToLower(strings.TrimSpace(filter.Status)))
		idx++
	}

	if strings.TrimSpace(filter.Search) != "" {
		searchTerm := "%" + strings.TrimSpace(filter.Search) + "%"
		whereClauses = append(whereClauses, "(p.name ILIKE $"+strconv.Itoa(idx)+" OR p.sku ILIKE $"+strconv.Itoa(idx)+" OR p.category ILIKE $"+strconv.Itoa(idx)+" OR COALESCE(p.hsn_sac, '') ILIKE $"+strconv.Itoa(idx)+" OR COALESCE(p.description, '') ILIKE $"+strconv.Itoa(idx)+")")
		args = append(args, searchTerm)
		idx++
	}

	whereSQL := " WHERE " + strings.Join(whereClauses, " AND ")

	// Counts
	countQuery := `SELECT COUNT(*) FROM products p ` + whereSQL
	var total int
	if err := r.db.Pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, err
	}

	var activeCount, inactiveCount int
	_ = r.db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM products WHERE workspace_id = $1 AND deleted_at IS NULL AND status = 'active'", workspaceID).Scan(&activeCount)
	_ = r.db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM products WHERE workspace_id = $1 AND deleted_at IS NULL AND status = 'inactive'", workspaceID).Scan(&inactiveCount)

	// Sorting
	sortCol := "p.created_at"
	switch filter.SortBy {
	case "name":
		sortCol = "p.name"
	case "sku":
		sortCol = "p.sku"
	case "selling_price":
		sortCol = "p.selling_price"
	case "category":
		sortCol = "p.category"
	}

	sortDir := "DESC"
	if strings.ToLower(filter.SortOrder) == "asc" {
		sortDir = "ASC"
	}

	selectQuery := `
		SELECT p.id, p.name, p.sku, p.category, p.description, p.unit,
		       p.selling_price, p.currency, p.tax_rate, p.hsn_sac,
		       p.status, p.workspace_id, p.created_by_id, p.created_at, p.updated_at, p.deleted_at,
		       u.id, u.name, u.email
		FROM products p
		LEFT JOIN users u ON u.id = p.created_by_id
	` + whereSQL + `
		ORDER BY ` + sortCol + ` ` + sortDir + `, p.id DESC
		LIMIT $` + strconv.Itoa(idx) + ` OFFSET $` + strconv.Itoa(idx+1)

	args = append(args, filter.Limit, offset)

	rows, err := r.db.Pool.Query(ctx, selectQuery, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.Product
	for rows.Next() {
		var p models.Product
		var uID *int
		var uName, uEmail *string

		if err := rows.Scan(
			&p.ID, &p.Name, &p.SKU, &p.Category, &p.Description, &p.Unit,
			&p.SellingPrice, &p.Currency, &p.TaxRate, &p.HsnSac,
			&p.Status, &p.WorkspaceID, &p.CreatedByID, &p.CreatedAt, &p.UpdatedAt, &p.DeletedAt,
			&uID, &uName, &uEmail,
		); err != nil {
			return nil, err
		}

		if uID != nil && uName != nil && uEmail != nil {
			p.Creator = &models.UserSummary{ID: *uID, Name: *uName, Email: *uEmail}
		}

		items = append(items, p)
	}

	if items == nil {
		items = []models.Product{}
	}

	pages := (total + filter.Limit - 1) / filter.Limit
	if pages < 1 {
		pages = 1
	}

	return &models.ProductListResponse{
		Items:         items,
		Total:         total,
		Page:          filter.Page,
		Limit:         filter.Limit,
		Pages:         pages,
		ActiveCount:   activeCount,
		InactiveCount: inactiveCount,
	}, nil
}

// Update updates product details
func (r *ProductRepository) Update(ctx context.Context, id int, input models.ProductUpdateInput, workspaceID int) (*models.Product, error) {
	current, err := r.GetByID(ctx, id, workspaceID)
	if err != nil {
		return nil, err
	}
	if current == nil {
		return nil, errors.New("product not found")
	}

	setClauses := []string{"updated_at = NOW()"}
	args := []interface{}{id, workspaceID}
	idx := 3

	if input.Name != nil {
		name := strings.TrimSpace(*input.Name)
		if name == "" {
			return nil, errors.New("product name cannot be empty")
		}
		setClauses = append(setClauses, "name = $"+strconv.Itoa(idx))
		args = append(args, name)
		idx++
	}

	if input.SKU != nil {
		sku := strings.ToUpper(strings.TrimSpace(*input.SKU))
		if sku == "" {
			return nil, errors.New("product SKU cannot be empty")
		}
		// Check uniqueness
		var existingID int
		err := r.db.Pool.QueryRow(ctx,
			"SELECT id FROM products WHERE sku = $1 AND workspace_id = $2 AND id <> $3 AND deleted_at IS NULL",
			sku, workspaceID, id,
		).Scan(&existingID)
		if err == nil {
			return nil, fmt.Errorf("another product with SKU '%s' already exists", sku)
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return nil, err
		}
		setClauses = append(setClauses, "sku = $"+strconv.Itoa(idx))
		args = append(args, sku)
		idx++
	}

	if input.Category != nil {
		category := strings.TrimSpace(*input.Category)
		if category == "" {
			category = "General"
		}
		setClauses = append(setClauses, "category = $"+strconv.Itoa(idx))
		args = append(args, category)
		idx++
	}

	if input.Description != nil {
		setClauses = append(setClauses, "description = $"+strconv.Itoa(idx))
		args = append(args, input.Description)
		idx++
	}

	if input.Unit != nil {
		unit := strings.TrimSpace(*input.Unit)
		if unit == "" {
			unit = "Unit"
		}
		setClauses = append(setClauses, "unit = $"+strconv.Itoa(idx))
		args = append(args, unit)
		idx++
	}

	if input.SellingPrice != nil {
		if *input.SellingPrice < 0 {
			return nil, errors.New("selling price cannot be negative")
		}
		setClauses = append(setClauses, "selling_price = $"+strconv.Itoa(idx))
		args = append(args, *input.SellingPrice)
		idx++
	}

	if input.Currency != nil {
		setClauses = append(setClauses, "currency = $"+strconv.Itoa(idx))
		args = append(args, strings.TrimSpace(*input.Currency))
		idx++
	}

	if input.TaxRate != nil {
		if *input.TaxRate < 0 {
			return nil, errors.New("tax rate cannot be negative")
		}
		setClauses = append(setClauses, "tax_rate = $"+strconv.Itoa(idx))
		args = append(args, *input.TaxRate)
		idx++
	}

	if input.HsnSac != nil {
		setClauses = append(setClauses, "hsn_sac = $"+strconv.Itoa(idx))
		args = append(args, input.HsnSac)
		idx++
	}

	if input.Status != nil {
		status := strings.ToLower(strings.TrimSpace(*input.Status))
		if status != "inactive" {
			status = "active"
		}
		setClauses = append(setClauses, "status = $"+strconv.Itoa(idx))
		args = append(args, status)
		idx++
	}

	query := fmt.Sprintf(
		"UPDATE products SET %s WHERE id = $1 AND workspace_id = $2 AND deleted_at IS NULL",
		strings.Join(setClauses, ", "),
	)

	_, err = r.db.Pool.Exec(ctx, query, args...)
	if err != nil {
		return nil, err
	}

	return r.GetByID(ctx, id, workspaceID)
}

// Delete marks product as soft-deleted
func (r *ProductRepository) Delete(ctx context.Context, id int, workspaceID int) error {
	res, err := r.db.Pool.Exec(ctx,
		"UPDATE products SET deleted_at = NOW(), status = 'inactive', updated_at = NOW() WHERE id = $1 AND workspace_id = $2 AND deleted_at IS NULL",
		id, workspaceID,
	)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return errors.New("product not found or already deleted")
	}
	return nil
}

// ListCategories returns distinct active categories
func (r *ProductRepository) ListCategories(ctx context.Context, workspaceID int) ([]string, error) {
	rows, err := r.db.Pool.Query(ctx,
		"SELECT DISTINCT category FROM products WHERE workspace_id = $1 AND deleted_at IS NULL ORDER BY category ASC",
		workspaceID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	catsMap := map[string]bool{
		"Software":     true,
		"Services":     true,
		"Hardware":     true,
		"Subscription": true,
		"Consulting":   true,
		"Support":      true,
	}

	for rows.Next() {
		var cat string
		if err := rows.Scan(&cat); err == nil && cat != "" {
			catsMap[cat] = true
		}
	}

	var result []string
	for c := range catsMap {
		result = append(result, c)
	}
	return result, nil
}
