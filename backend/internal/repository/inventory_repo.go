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

type InventoryRepository struct {
	db *database.DB
}

func NewInventoryRepository(db *database.DB) *InventoryRepository {
	return &InventoryRepository{db: db}
}

// GetStats returns aggregated inventory KPIs for the dashboard
func (r *InventoryRepository) GetStats(ctx context.Context, workspaceID int) (*models.InventoryStats, error) {
	stats := &models.InventoryStats{}

	query := `
		SELECT 
			COUNT(*),
			COALESCE(SUM(current_stock), 0),
			COALESCE(SUM(reserved_stock), 0),
			COUNT(*) FILTER (WHERE (current_stock - reserved_stock) <= low_stock_threshold AND (current_stock - reserved_stock) > 0),
			COUNT(*) FILTER (WHERE (current_stock - reserved_stock) <= 0)
		FROM products
		WHERE workspace_id = $1 AND deleted_at IS NULL
	`

	err := r.db.Pool.QueryRow(ctx, query, workspaceID).Scan(
		&stats.TotalProducts,
		&stats.TotalUnits,
		&stats.TotalReserved,
		&stats.LowStockCount,
		&stats.OutOfStockCount,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch inventory stats: %w", err)
	}

	stats.TotalAvailable = stats.TotalUnits - stats.TotalReserved
	if stats.TotalAvailable < 0 {
		stats.TotalAvailable = 0
	}

	return stats, nil
}

// ListMovements retrieves paginated audit logs of stock movements
func (r *InventoryRepository) ListMovements(ctx context.Context, filter models.StockMovementFilter, workspaceID int) (*models.StockMovementListResponse, error) {
	if filter.Page < 1 {
		filter.Page = 1
	}
	if filter.Limit < 1 || filter.Limit > 200 {
		filter.Limit = 50
	}
	offset := (filter.Page - 1) * filter.Limit

	whereClauses := []string{"sm.workspace_id = $1"}
	args := []interface{}{workspaceID}
	idx := 2

	if filter.ProductID != nil && *filter.ProductID > 0 {
		whereClauses = append(whereClauses, "sm.product_id = $"+strconv.Itoa(idx))
		args = append(args, *filter.ProductID)
		idx++
	}

	if filter.MovementType != nil && strings.TrimSpace(*filter.MovementType) != "" && strings.ToLower(*filter.MovementType) != "all" {
		whereClauses = append(whereClauses, "sm.movement_type = $"+strconv.Itoa(idx))
		args = append(args, strings.ToLower(strings.TrimSpace(*filter.MovementType)))
		idx++
	}

	if filter.ReferenceType != nil && strings.TrimSpace(*filter.ReferenceType) != "" && strings.ToLower(*filter.ReferenceType) != "all" {
		whereClauses = append(whereClauses, "sm.reference_type = $"+strconv.Itoa(idx))
		args = append(args, strings.ToLower(strings.TrimSpace(*filter.ReferenceType)))
		idx++
	}

	whereSQL := " WHERE " + strings.Join(whereClauses, " AND ")

	countQuery := "SELECT COUNT(*) FROM stock_movements sm " + whereSQL
	var total int
	if err := r.db.Pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, err
	}

	selectQuery := `
		SELECT sm.id, sm.product_id, sm.movement_type, sm.quantity, sm.reference_type, sm.reference_id,
		       sm.previous_stock, sm.new_stock, sm.previous_reserved, sm.new_reserved,
		       sm.notes, sm.condition, sm.workspace_id, sm.created_by_id, sm.created_at,
		       p.name, p.sku, p.category, p.unit,
		       u.id, u.name, u.email
		FROM stock_movements sm
		JOIN products p ON sm.product_id = p.id
		LEFT JOIN users u ON sm.created_by_id = u.id
	` + whereSQL + `
		ORDER BY sm.created_at DESC, sm.id DESC
		LIMIT $` + strconv.Itoa(idx) + ` OFFSET $` + strconv.Itoa(idx+1)

	args = append(args, filter.Limit, offset)

	rows, err := r.db.Pool.Query(ctx, selectQuery, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.StockMovement
	for rows.Next() {
		var sm models.StockMovement
		var pName, pSKU, pCategory, pUnit string
		var uID *int
		var uName, uEmail *string

		err := rows.Scan(
			&sm.ID, &sm.ProductID, &sm.MovementType, &sm.Quantity, &sm.ReferenceType, &sm.ReferenceID,
			&sm.PreviousStock, &sm.NewStock, &sm.PreviousReserved, &sm.NewReserved,
			&sm.Notes, &sm.Condition, &sm.WorkspaceID, &sm.CreatedByID, &sm.CreatedAt,
			&pName, &pSKU, &pCategory, &pUnit,
			&uID, &uName, &uEmail,
		)
		if err != nil {
			return nil, err
		}

		sm.Product = &models.Product{
			ID:       sm.ProductID,
			Name:     pName,
			SKU:      pSKU,
			Category: pCategory,
			Unit:     pUnit,
		}

		if uID != nil && uName != nil && uEmail != nil {
			sm.Creator = &models.UserSummary{
				ID:    *uID,
				Name:  *uName,
				Email: *uEmail,
			}
		}

		items = append(items, sm)
	}

	if items == nil {
		items = []models.StockMovement{}
	}

	pages := (total + filter.Limit - 1) / filter.Limit
	if pages < 1 {
		pages = 1
	}

	return &models.StockMovementListResponse{
		Items: items,
		Total: total,
		Page:  filter.Page,
		Limit: filter.Limit,
		Pages: pages,
	}, nil
}

// StockIn performs purchase / restock entry with immediate on-hand update
func (r *InventoryRepository) StockIn(ctx context.Context, input models.StockInInput, userID *int, workspaceID int) (*models.StockMovement, error) {
	if input.ProductID <= 0 {
		return nil, errors.New("product ID is required")
	}
	if input.Quantity <= 0 {
		return nil, errors.New("quantity must be greater than zero")
	}

	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var pName string
	var prevStock, prevRes float64
	err = tx.QueryRow(ctx, `
		SELECT name, COALESCE(current_stock, 0), COALESCE(reserved_stock, 0)
		FROM products
		WHERE id = $1 AND workspace_id = $2 AND deleted_at IS NULL
		FOR UPDATE
	`, input.ProductID, workspaceID).Scan(&pName, &prevStock, &prevRes)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("product not found")
		}
		return nil, err
	}

	newStock := prevStock + input.Quantity

	_, err = tx.Exec(ctx, `
		UPDATE products
		SET current_stock = $1, updated_at = NOW()
		WHERE id = $2 AND workspace_id = $3
	`, newStock, input.ProductID, workspaceID)
	if err != nil {
		return nil, err
	}

	refType := "stock_in"
	notes := "Restock / Stock In"
	if input.Notes != nil && strings.TrimSpace(*input.Notes) != "" {
		notes = strings.TrimSpace(*input.Notes)
	}

	var movementID int
	err = tx.QueryRow(ctx, `
		INSERT INTO stock_movements (
			product_id, movement_type, quantity, reference_type, reference_id,
			previous_stock, new_stock, previous_reserved, new_reserved, notes,
			condition, workspace_id, created_by_id, created_at
		) VALUES ($1, 'stock_in', $2, $3, 'STOCK_IN', $4, $5, $6, $6, $7, 'good', $8, $9, NOW())
		RETURNING id
	`, input.ProductID, input.Quantity, refType, prevStock, newStock, prevRes, notes, workspaceID, userID).Scan(&movementID)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return &models.StockMovement{
		ID:               movementID,
		ProductID:        input.ProductID,
		MovementType:     "stock_in",
		Quantity:         input.Quantity,
		ReferenceType:    &refType,
		PreviousStock:    prevStock,
		NewStock:         newStock,
		PreviousReserved: prevRes,
		NewReserved:      prevRes,
		Notes:            &notes,
		Condition:        "good",
		WorkspaceID:      workspaceID,
		CreatedByID:      userID,
		CreatedAt:        time.Now(),
	}, nil
}

// AdjustStock handles count audits, damages, or discrepancies
func (r *InventoryRepository) AdjustStock(ctx context.Context, input models.StockAdjustmentInput, userID *int, workspaceID int) (*models.StockMovement, error) {
	if input.ProductID <= 0 {
		return nil, errors.New("product ID is required")
	}
	reason := strings.TrimSpace(input.Reason)
	if reason == "" {
		return nil, errors.New("adjustment reason is required")
	}

	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var pName string
	var prevStock, prevRes float64
	err = tx.QueryRow(ctx, `
		SELECT name, COALESCE(current_stock, 0), COALESCE(reserved_stock, 0)
		FROM products
		WHERE id = $1 AND workspace_id = $2 AND deleted_at IS NULL
		FOR UPDATE
	`, input.ProductID, workspaceID).Scan(&pName, &prevStock, &prevRes)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("product not found")
		}
		return nil, err
	}

	var targetStock float64
	var deltaQty float64

	adjType := strings.ToLower(strings.TrimSpace(input.AdjustmentType))
	if adjType == "set" {
		targetStock = input.Quantity
		deltaQty = targetStock - prevStock
	} else { // default to delta
		deltaQty = input.Quantity
		targetStock = prevStock + deltaQty
	}

	if targetStock < 0 {
		return nil, fmt.Errorf("adjustment would result in negative physical stock (target: %.2f)", targetStock)
	}
	if targetStock < prevRes {
		return nil, fmt.Errorf("physical stock (%.2f) cannot be adjusted lower than currently reserved stock (%.2f)", targetStock, prevRes)
	}

	_, err = tx.Exec(ctx, `
		UPDATE products
		SET current_stock = $1, updated_at = NOW()
		WHERE id = $2 AND workspace_id = $3
	`, targetStock, input.ProductID, workspaceID)
	if err != nil {
		return nil, err
	}

	refType := "adjustment"
	notes := fmt.Sprintf("Adjustment [%s]", reason)
	if input.Notes != nil && strings.TrimSpace(*input.Notes) != "" {
		notes += fmt.Sprintf(": %s", strings.TrimSpace(*input.Notes))
	}

	condition := "good"
	if strings.Contains(strings.ToLower(reason), "damage") {
		condition = "damaged"
	}

	var movementID int
	err = tx.QueryRow(ctx, `
		INSERT INTO stock_movements (
			product_id, movement_type, quantity, reference_type, reference_id,
			previous_stock, new_stock, previous_reserved, new_reserved, notes,
			condition, workspace_id, created_by_id, created_at
		) VALUES ($1, 'adjustment', $2, $3, $4, $5, $6, $7, $7, $8, $9, $10, $11, NOW())
		RETURNING id
	`, input.ProductID, deltaQty, refType, strings.ToUpper(reason), prevStock, targetStock, prevRes, notes, condition, workspaceID, userID).Scan(&movementID)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return &models.StockMovement{
		ID:               movementID,
		ProductID:        input.ProductID,
		MovementType:     "adjustment",
		Quantity:         deltaQty,
		ReferenceType:    &refType,
		PreviousStock:    prevStock,
		NewStock:         targetStock,
		PreviousReserved: prevRes,
		NewReserved:      prevRes,
		Notes:            &notes,
		Condition:        condition,
		WorkspaceID:      workspaceID,
		CreatedByID:      userID,
		CreatedAt:        time.Now(),
	}, nil
}

// ReturnStock processes customer returns, with option to restock or scrap
func (r *InventoryRepository) ReturnStock(ctx context.Context, input models.StockReturnInput, userID *int, workspaceID int) (*models.StockMovement, error) {
	if input.ProductID <= 0 {
		return nil, errors.New("product ID is required")
	}
	if input.Quantity <= 0 {
		return nil, errors.New("quantity must be greater than zero")
	}
	reason := strings.TrimSpace(input.Reason)
	if reason == "" {
		return nil, errors.New("return reason is required")
	}

	condition := strings.ToLower(strings.TrimSpace(input.Condition))
	if condition != "damaged" && condition != "scrap" {
		condition = "good"
	}

	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var pName string
	var prevStock, prevRes float64
	err = tx.QueryRow(ctx, `
		SELECT name, COALESCE(current_stock, 0), COALESCE(reserved_stock, 0)
		FROM products
		WHERE id = $1 AND workspace_id = $2 AND deleted_at IS NULL
		FOR UPDATE
	`, input.ProductID, workspaceID).Scan(&pName, &prevStock, &prevRes)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("product not found")
		}
		return nil, err
	}

	newStock := prevStock
	if input.Restock {
		newStock = prevStock + input.Quantity
		_, err = tx.Exec(ctx, `
			UPDATE products
			SET current_stock = $1, sold_quantity = GREATEST(sold_quantity - $2, 0), updated_at = NOW()
			WHERE id = $3 AND workspace_id = $4
		`, newStock, input.Quantity, input.ProductID, workspaceID)
		if err != nil {
			return nil, err
		}
	}

	refType := "return"
	var refID *string
	if input.OrderID != nil && *input.OrderID > 0 {
		var orderNum string
		_ = tx.QueryRow(ctx, "SELECT order_number FROM orders WHERE id = $1", *input.OrderID).Scan(&orderNum)
		if orderNum != "" {
			refID = &orderNum
		} else {
			strID := strconv.Itoa(*input.OrderID)
			refID = &strID
		}
	}

	notes := fmt.Sprintf("Customer Return [%s]", reason)
	if input.Restock {
		notes += " (Restocked to Available Stock)"
	} else {
		notes += " (Not Restocked - " + condition + ")"
	}
	if input.Notes != nil && strings.TrimSpace(*input.Notes) != "" {
		notes += fmt.Sprintf(": %s", strings.TrimSpace(*input.Notes))
	}

	var movementID int
	err = tx.QueryRow(ctx, `
		INSERT INTO stock_movements (
			product_id, movement_type, quantity, reference_type, reference_id,
			previous_stock, new_stock, previous_reserved, new_reserved, notes,
			condition, workspace_id, created_by_id, created_at
		) VALUES ($1, 'return', $2, $3, $4, $5, $6, $7, $7, $8, $9, $10, $11, NOW())
		RETURNING id
	`, input.ProductID, input.Quantity, refType, refID, prevStock, newStock, prevRes, notes, condition, workspaceID, userID).Scan(&movementID)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return &models.StockMovement{
		ID:               movementID,
		ProductID:        input.ProductID,
		MovementType:     "return",
		Quantity:         input.Quantity,
		ReferenceType:    &refType,
		ReferenceID:      refID,
		PreviousStock:    prevStock,
		NewStock:         newStock,
		PreviousReserved: prevRes,
		NewReserved:      prevRes,
		Notes:            &notes,
		Condition:        condition,
		WorkspaceID:      workspaceID,
		CreatedByID:      userID,
		CreatedAt:        time.Now(),
	}, nil
}

// GetLowStockAlerts lists all active catalog items where available stock is below or at the threshold
func (r *InventoryRepository) GetLowStockAlerts(ctx context.Context, workspaceID int) ([]models.Product, error) {
	query := `
		SELECT p.id, p.name, p.sku, p.category, p.description, p.unit,
		       p.selling_price, p.currency, p.tax_rate, p.hsn_sac,
		       p.status, COALESCE(p.current_stock, 0), COALESCE(p.reserved_stock, 0),
		       COALESCE(p.sold_quantity, 0), COALESCE(p.low_stock_threshold, 10),
		       p.workspace_id, p.created_by_id, p.created_at, p.updated_at, p.deleted_at
		FROM products p
		WHERE p.workspace_id = $1 AND p.deleted_at IS NULL
		  AND (p.current_stock - p.reserved_stock) <= p.low_stock_threshold
		ORDER BY (p.current_stock - p.reserved_stock) ASC, p.name ASC
	`

	rows, err := r.db.Pool.Query(ctx, query, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var alerts []models.Product
	for rows.Next() {
		var p models.Product
		if err := rows.Scan(
			&p.ID, &p.Name, &p.SKU, &p.Category, &p.Description, &p.Unit,
			&p.SellingPrice, &p.Currency, &p.TaxRate, &p.HsnSac,
			&p.Status, &p.CurrentStock, &p.ReservedStock,
			&p.SoldQuantity, &p.LowStockThreshold,
			&p.WorkspaceID, &p.CreatedByID, &p.CreatedAt, &p.UpdatedAt, &p.DeletedAt,
		); err == nil {
			p.AvailableStock = p.CurrentStock - p.ReservedStock
			if p.AvailableStock < 0 {
				p.AvailableStock = 0
			}
			alerts = append(alerts, p)
		}
	}

	if alerts == nil {
		alerts = []models.Product{}
	}

	return alerts, nil
}
