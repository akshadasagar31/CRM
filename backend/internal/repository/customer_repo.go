package repository

import (
	"context"
	"errors"
	"strconv"
	"strings"

	"crm-backend-go/internal/database"
	"crm-backend-go/internal/models"

	"github.com/jackc/pgx/v5"
)

type CustomerRepository struct {
	db *database.DB
}

func NewCustomerRepository(db *database.DB) *CustomerRepository {
	return &CustomerRepository{db: db}
}

func (r *CustomerRepository) Create(ctx context.Context, input models.CustomerCreateInput, createdByID *int, workspaceID int) (*models.Customer, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return nil, errors.New("customer name is required")
	}

	query := `
		INSERT INTO customers (name, email, phone, company, website, address, city, state, pincode, gstin, workspace_id, created_by_id, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
		RETURNING id, name, email, phone, company, website, address, city, state, pincode, gstin, workspace_id, created_by_id, created_at, updated_at
	`

	var c models.Customer
	err := r.db.Pool.QueryRow(ctx, query,
		name, input.Email, input.Phone, input.Company, input.Website, input.Address, input.City, input.State, input.Pincode, input.GSTIN, workspaceID, createdByID,
	).Scan(
		&c.ID, &c.Name, &c.Email, &c.Phone, &c.Company, &c.Website, &c.Address,
		&c.City, &c.State, &c.Pincode, &c.GSTIN,
		&c.WorkspaceID, &c.CreatedByID, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *CustomerRepository) FindOrCreateByEmailOrPhone(ctx context.Context, name, email, phone, company string, createdByID *int, workspaceID int) (*models.Customer, error) {
	cleanEmail := strings.ToLower(strings.TrimSpace(email))
	cleanPhone := strings.TrimSpace(phone)

	if cleanEmail != "" {
		var existing models.Customer
		err := r.db.Pool.QueryRow(ctx,
			`SELECT id, name, email, phone, company, website, address, city, state, pincode, gstin, workspace_id, created_by_id, created_at, updated_at
			 FROM customers WHERE workspace_id = $1 AND LOWER(email) = $2 LIMIT 1`,
			workspaceID, cleanEmail,
		).Scan(
			&existing.ID, &existing.Name, &existing.Email, &existing.Phone, &existing.Company,
			&existing.Website, &existing.Address, &existing.City, &existing.State, &existing.Pincode, &existing.GSTIN,
			&existing.WorkspaceID, &existing.CreatedByID,
			&existing.CreatedAt, &existing.UpdatedAt,
		)
		if err == nil {
			return &existing, nil
		}
	}

	if cleanPhone != "" {
		var existing models.Customer
		err := r.db.Pool.QueryRow(ctx,
			`SELECT id, name, email, phone, company, website, address, city, state, pincode, gstin, workspace_id, created_by_id, created_at, updated_at
			 FROM customers WHERE workspace_id = $1 AND phone = $2 LIMIT 1`,
			workspaceID, cleanPhone,
		).Scan(
			&existing.ID, &existing.Name, &existing.Email, &existing.Phone, &existing.Company,
			&existing.Website, &existing.Address, &existing.City, &existing.State, &existing.Pincode, &existing.GSTIN,
			&existing.WorkspaceID, &existing.CreatedByID,
			&existing.CreatedAt, &existing.UpdatedAt,
		)
		if err == nil {
			return &existing, nil
		}
	}

	// Create new
	input := models.CustomerCreateInput{
		Name: name,
	}
	if cleanEmail != "" {
		input.Email = &cleanEmail
	}
	if cleanPhone != "" {
		input.Phone = &cleanPhone
	}
	if company != "" {
		input.Company = &company
	}
	return r.Create(ctx, input, createdByID, workspaceID)
}

func (r *CustomerRepository) GetByID(ctx context.Context, id int, workspaceID int) (*models.Customer, error) {
	query := `
		SELECT c.id, c.name, c.email, c.phone, c.company, c.website, c.address,
		       c.city, c.state, c.pincode, c.gstin,
		       c.workspace_id, c.created_by_id, c.created_at, c.updated_at,
		       u.id, u.name, u.email,
		       (SELECT COUNT(*) FROM deals d WHERE d.customer_id = c.id) as deals_count
		FROM customers c
		LEFT JOIN users u ON u.id = c.created_by_id
		WHERE c.id = $1 AND c.workspace_id = $2
	`
	var c models.Customer
	var uID *int
	var uName, uEmail *string

	err := r.db.Pool.QueryRow(ctx, query, id, workspaceID).Scan(
		&c.ID, &c.Name, &c.Email, &c.Phone, &c.Company, &c.Website, &c.Address,
		&c.City, &c.State, &c.Pincode, &c.GSTIN,
		&c.WorkspaceID, &c.CreatedByID, &c.CreatedAt, &c.UpdatedAt,
		&uID, &uName, &uEmail, &c.DealsCount,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if uID != nil && uName != nil && uEmail != nil {
		c.Creator = &models.UserSummary{ID: *uID, Name: *uName, Email: *uEmail}
	}
	return &c, nil
}

func (r *CustomerRepository) List(ctx context.Context, search string, workspaceID int, limit, offset int) ([]models.Customer, int, error) {
	fromJoin := `FROM customers c LEFT JOIN users u ON u.id = c.created_by_id`
	whereClauses := []string{"c.workspace_id = $1"}
	args := []interface{}{workspaceID}
	idx := 2

	if strings.TrimSpace(search) != "" {
		whereClauses = append(whereClauses, "(c.name ILIKE $"+strconv.Itoa(idx)+" OR c.email ILIKE $"+strconv.Itoa(idx)+" OR c.company ILIKE $"+strconv.Itoa(idx)+")")
		args = append(args, "%"+strings.TrimSpace(search)+"%")
		idx++
	}

	whereSQL := " WHERE " + strings.Join(whereClauses, " AND ")

	var total int
	countQuery := `SELECT COUNT(*) ` + fromJoin + whereSQL
	if err := r.db.Pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	selectQuery := `
		SELECT c.id, c.name, c.email, c.phone, c.company, c.website, c.address,
		       c.city, c.state, c.pincode, c.gstin,
		       c.workspace_id, c.created_by_id, c.created_at, c.updated_at,
		       u.id, u.name, u.email,
		       (SELECT COUNT(*) FROM deals d WHERE d.customer_id = c.id) as deals_count
		` + fromJoin + whereSQL + `
		ORDER BY c.created_at DESC
		LIMIT $` + strconv.Itoa(idx) + ` OFFSET $` + strconv.Itoa(idx+1)

	args = append(args, limit, offset)

	rows, err := r.db.Pool.Query(ctx, selectQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var customers []models.Customer
	for rows.Next() {
		var c models.Customer
		var uID *int
		var uName, uEmail *string
		if err := rows.Scan(
			&c.ID, &c.Name, &c.Email, &c.Phone, &c.Company, &c.Website, &c.Address,
			&c.City, &c.State, &c.Pincode, &c.GSTIN,
			&c.WorkspaceID, &c.CreatedByID, &c.CreatedAt, &c.UpdatedAt,
			&uID, &uName, &uEmail, &c.DealsCount,
		); err != nil {
			return nil, 0, err
		}
		if uID != nil && uName != nil && uEmail != nil {
			c.Creator = &models.UserSummary{ID: *uID, Name: *uName, Email: *uEmail}
		}
		customers = append(customers, c)
	}

	if customers == nil {
		customers = []models.Customer{}
	}
	return customers, total, nil
}
