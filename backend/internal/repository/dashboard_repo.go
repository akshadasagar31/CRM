package repository

import (
	"context"
	"fmt"
	"strings"
	"time"

	"crm-backend-go/internal/database"
	"crm-backend-go/internal/models"
)

type DashboardRepository struct {
	db *database.DB
}

func NewDashboardRepository(db *database.DB) *DashboardRepository {
	return &DashboardRepository{db: db}
}

// computeDateFilterClause returns SQL date filter expression based on timeframe
func computeDateFilterClause(col string, timeframe string, argIdx int) (string, []interface{}, int) {
	now := time.Now()
	tf := strings.ToLower(strings.TrimSpace(timeframe))

	switch tf {
	case "today":
		start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		return fmt.Sprintf("%s >= $%d", col, argIdx), []interface{}{start}, argIdx + 1
	case "this_month", "month":
		start := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		return fmt.Sprintf("%s >= $%d", col, argIdx), []interface{}{start}, argIdx + 1
	case "last_30_days", "30d":
		start := now.AddDate(0, 0, -30)
		return fmt.Sprintf("%s >= $%d", col, argIdx), []interface{}{start}, argIdx + 1
	case "this_quarter", "quarter":
		currentQuarter := (int(now.Month()) - 1) / 3
		startMonth := time.Month(currentQuarter*3 + 1)
		start := time.Date(now.Year(), startMonth, 1, 0, 0, 0, 0, now.Location())
		return fmt.Sprintf("%s >= $%d", col, argIdx), []interface{}{start}, argIdx + 1
	case "this_year", "year":
		start := time.Date(now.Year(), 1, 1, 0, 0, 0, 0, now.Location())
		return fmt.Sprintf("%s >= $%d", col, argIdx), []interface{}{start}, argIdx + 1
	default:
		// "all" or unrecognized defaults to all-time
		return "1=1", nil, argIdx
	}
}

func (r *DashboardRepository) GetMetrics(ctx context.Context, timeframe string, workspaceID int) (*models.DashboardMetrics, error) {
	metrics := &models.DashboardMetrics{}

	// 1. Deals Metrics
	dealFilter, dealArgs, nextArg := computeDateFilterClause("created_at", timeframe, 2)
	dealQuery := fmt.Sprintf(`
		SELECT
			COUNT(id) AS total_deals,
			COALESCE(SUM(CASE WHEN status = 'open' THEN value ELSE 0 END), 0) AS pipeline_value,
			COALESCE(SUM(CASE WHEN status = 'won' THEN value ELSE 0 END), 0) AS won_value,
			COUNT(CASE WHEN status = 'won' THEN 1 END) AS won_count
		FROM deals
		WHERE workspace_id = $1 AND %s
	`, dealFilter)

	args1 := append([]interface{}{workspaceID}, dealArgs...)
	_ = r.db.Pool.QueryRow(ctx, dealQuery, args1...).Scan(
		&metrics.TotalDeals,
		&metrics.TotalPipelineValue,
		&metrics.WonDealsValue,
		&metrics.WonDealsCount,
	)

	// 2. Invoices & Revenue Metrics
	invFilter, invArgs, _ := computeDateFilterClause("created_at", timeframe, 2)
	invQuery := fmt.Sprintf(`
		SELECT
			COALESCE(SUM(grand_total), 0) AS total_invoiced,
			COALESCE(SUM(amount_paid), 0) AS total_paid,
			COALESCE(SUM(CASE WHEN status != 'Paid' THEN (grand_total - amount_paid) ELSE 0 END), 0) AS outstanding,
			COALESCE(SUM(CASE WHEN status != 'Paid' AND due_date IS NOT NULL AND due_date < NOW() THEN (grand_total - amount_paid) ELSE 0 END), 0) AS overdue
		FROM invoices
		WHERE workspace_id = $1 AND status NOT IN ('Draft', 'Cancelled', 'Refunded') AND %s
	`, invFilter)

	args2 := append([]interface{}{workspaceID}, invArgs...)
	_ = r.db.Pool.QueryRow(ctx, invQuery, args2...).Scan(
		&metrics.TotalInvoiced,
		&metrics.TotalReceived,
		&metrics.OutstandingBalance,
		&metrics.OverdueBalance,
	)

	// In case payments received in timeframe is calculated from payments directly:
	payFilter, payArgs, _ := computeDateFilterClause("ip.payment_date", timeframe, 2)
	payQuery := fmt.Sprintf(`
		SELECT COALESCE(SUM(ip.amount), 0)
		FROM invoice_payments ip
		JOIN invoices i ON ip.invoice_id = i.id
		WHERE i.workspace_id = $1 AND %s
	`, payFilter)
	var directPay float64
	args3 := append([]interface{}{workspaceID}, payArgs...)
	if err := r.db.Pool.QueryRow(ctx, payQuery, args3...).Scan(&directPay); err == nil && directPay > 0 {
		metrics.TotalReceived = directPay
	}

	// 3. Follow-ups
	followQuery := `
		SELECT
			COUNT(CASE WHEN completed = 0 THEN 1 END) AS pending,
			COUNT(CASE WHEN completed = 0 AND due_date < NOW() THEN 1 END) AS overdue
		FROM follow_ups
	`
	_ = r.db.Pool.QueryRow(ctx, followQuery).Scan(
		&metrics.PendingFollowUps,
		&metrics.OverdueFollowUps,
	)

	// 4. Customers & Leads Counts
	_ = r.db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM customers WHERE workspace_id = $1", workspaceID).Scan(&metrics.TotalCustomers)
	_ = r.db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM leads WHERE workspace_id = $1 AND deleted_at IS NULL", workspaceID).Scan(&metrics.TotalLeads)

	// 5. Conversion Rate
	if metrics.TotalDeals > 0 {
		metrics.ConversionRate = (float64(metrics.WonDealsCount) / float64(metrics.TotalDeals)) * 100
	}

	_ = nextArg
	return metrics, nil
}

func (r *DashboardRepository) GetSalesChart(ctx context.Context, timeframe string, workspaceID int) ([]models.SalesChartPoint, error) {
	// Group data by past 6 calendar months
	now := time.Now()
	points := make([]models.SalesChartPoint, 0, 6)

	// Generate months list chronologically: from 5 months ago to current month
	for i := 5; i >= 0; i-- {
		t := now.AddDate(0, -i, 0)
		startOfMonth := time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, t.Location())
		endOfMonth := time.Date(t.Year(), t.Month()+1, 0, 23, 59, 59, 999999999, t.Location())

		periodLabel := t.Format("Jan 2006")

		// Invoiced in this month
		var invoiced float64
		_ = r.db.Pool.QueryRow(ctx, `
			SELECT COALESCE(SUM(grand_total), 0)
			FROM invoices
			WHERE workspace_id = $1 
			  AND status NOT IN ('Draft', 'Cancelled', 'Refunded')
			  AND invoice_date >= $2 AND invoice_date <= $3
		`, workspaceID, startOfMonth, endOfMonth).Scan(&invoiced)

		// Received in this month
		var received float64
		_ = r.db.Pool.QueryRow(ctx, `
			SELECT COALESCE(SUM(ip.amount), 0)
			FROM invoice_payments ip
			JOIN invoices i ON ip.invoice_id = i.id
			WHERE i.workspace_id = $1
			  AND ip.payment_date >= $2 AND ip.payment_date <= $3
		`, workspaceID, startOfMonth, endOfMonth).Scan(&received)

		// Deals won in this month
		var dealsWon float64
		_ = r.db.Pool.QueryRow(ctx, `
			SELECT COALESCE(SUM(value), 0)
			FROM deals
			WHERE workspace_id = $1
			  AND status = 'won'
			  AND updated_at >= $2 AND updated_at <= $3
		`, workspaceID, startOfMonth, endOfMonth).Scan(&dealsWon)

		points = append(points, models.SalesChartPoint{
			Period:         periodLabel,
			InvoicedAmount: invoiced,
			ReceivedAmount: received,
			DealsWonAmount: dealsWon,
		})
	}

	return points, nil
}

func (r *DashboardRepository) GetPipelineDistribution(ctx context.Context, workspaceID int) ([]models.PipelineStageDistribution, error) {
	query := `
		SELECT 
			s.id,
			s.name,
			s.color,
			s.stage_order,
			COUNT(d.id) AS deals_count,
			COALESCE(SUM(CASE WHEN d.status = 'open' THEN d.value ELSE 0 END), 0) AS total_value
		FROM deal_stages s
		JOIN pipelines p ON s.pipeline_id = p.id
		LEFT JOIN deals d ON d.stage_id = s.id AND d.workspace_id = $1
		WHERE p.workspace_id = $1
		GROUP BY s.id, s.name, s.color, s.stage_order
		ORDER BY s.stage_order ASC
	`

	rows, err := r.db.Pool.Query(ctx, query, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("failed to query pipeline distribution: %w", err)
	}
	defer rows.Close()

	dist := make([]models.PipelineStageDistribution, 0)
	for rows.Next() {
		var item models.PipelineStageDistribution
		err := rows.Scan(
			&item.StageID,
			&item.StageName,
			&item.Color,
			&item.StageOrder,
			&item.DealsCount,
			&item.TotalValue,
		)
		if err != nil {
			return nil, err
		}
		dist = append(dist, item)
	}

	return dist, nil
}

func (r *DashboardRepository) GetRecentActivities(ctx context.Context, limit int, workspaceID int) ([]models.DashboardActivity, error) {
	if limit <= 0 || limit > 50 {
		limit = 15
	}

	// Union recent events across invoice_payments, invoices, deals, orders, and follow_ups
	unionQuery := `
		(
			SELECT 
				ip.id,
				'Payment' AS module,
				'payment_received' AS activity_type,
				'Payment Received' AS title,
				'₹' || TRIM(TO_CHAR(ip.amount, '999,999,990.00')) || ' via ' || ip.payment_method || ' for invoice ' || i.invoice_number AS description,
				ip.id::text AS entity_id,
				i.invoice_number AS entity_number,
				COALESCE(u.name, 'System') AS user_name,
				COALESCE(u.email, '') AS user_email,
				ip.payment_date AS timestamp
			FROM invoice_payments ip
			JOIN invoices i ON ip.invoice_id = i.id
			LEFT JOIN users u ON ip.recorded_by_id = u.id
			WHERE i.workspace_id = $1
			ORDER BY ip.payment_date DESC
			LIMIT $2
		)
		UNION ALL
		(
			SELECT
				i.id,
				'Invoice' AS module,
				'invoice_issued' AS activity_type,
				'Invoice ' || i.status AS title,
				'Invoice ' || i.invoice_number || ' (' || i.currency || ' ' || TRIM(TO_CHAR(i.grand_total, '999,999,990.00')) || ') for ' || c.name AS description,
				i.id::text AS entity_id,
				i.invoice_number AS entity_number,
				COALESCE(u.name, 'Admin') AS user_name,
				COALESCE(u.email, '') AS user_email,
				i.created_at AS timestamp
			FROM invoices i
			JOIN customers c ON i.customer_id = c.id
			LEFT JOIN users u ON i.created_by_id = u.id
			WHERE i.workspace_id = $1
			ORDER BY i.created_at DESC
			LIMIT $2
		)
		UNION ALL
		(
			SELECT
				d.id,
				'Deal' AS module,
				'deal_created' AS activity_type,
				'Deal: ' || d.name AS title,
				'Value: ' || d.currency || ' ' || TRIM(TO_CHAR(d.value, '999,999,990.00')) || ' in stage ' || s.name AS description,
				d.id::text AS entity_id,
				d.deal_number AS entity_number,
				COALESCE(u.name, 'Sales Team') AS user_name,
				COALESCE(u.email, '') AS user_email,
				d.created_at AS timestamp
			FROM deals d
			JOIN deal_stages s ON d.stage_id = s.id
			LEFT JOIN users u ON d.created_by_id = u.id
			WHERE d.workspace_id = $1
			ORDER BY d.created_at DESC
			LIMIT $2
		)
		UNION ALL
		(
			SELECT
				o.id,
				'Order' AS module,
				'order_created' AS activity_type,
				'Order: ' || o.order_number AS title,
				o.title || ' (' || o.currency || ' ' || TRIM(TO_CHAR(o.total_amount, '999,999,990.00')) || ')' AS description,
				o.id::text AS entity_id,
				o.order_number AS entity_number,
				COALESCE(u.name, 'Operations') AS user_name,
				COALESCE(u.email, '') AS user_email,
				o.created_at AS timestamp
			FROM orders o
			LEFT JOIN users u ON o.created_by_id = u.id
			WHERE o.workspace_id = $1
			ORDER BY o.created_at DESC
			LIMIT $2
		)
		ORDER BY timestamp DESC
		LIMIT $2
	`

	rows, err := r.db.Pool.Query(ctx, unionQuery, workspaceID, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query dashboard activities: %w", err)
	}
	defer rows.Close()

	activities := make([]models.DashboardActivity, 0)
	for rows.Next() {
		var act models.DashboardActivity
		err := rows.Scan(
			&act.ID,
			&act.Module,
			&act.ActivityType,
			&act.Title,
			&act.Description,
			&act.EntityID,
			&act.EntityNumber,
			&act.UserName,
			&act.UserEmail,
			&act.Timestamp,
		)
		if err != nil {
			return nil, err
		}
		activities = append(activities, act)
	}

	return activities, nil
}
