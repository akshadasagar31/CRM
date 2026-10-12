package repository

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"crm-backend-go/internal/database"
	"crm-backend-go/internal/models"
)

type AutomationRepository struct {
	db *database.DB
}

func NewAutomationRepository(db *database.DB) *AutomationRepository {
	return &AutomationRepository{db: db}
}

// EvaluateReminders scans invoices and follow-ups, upserting active alerts and resolving completed items
func (r *AutomationRepository) EvaluateReminders(ctx context.Context, workspaceID int) (int, error) {
	remindersCreatedOrUpdated := 0

	// ==========================================
	// 1. Overdue Invoices Evaluation
	// ==========================================
	invQuery := `
		SELECT id, invoice_number, grand_total, amount_paid, due_date
		FROM invoices
		WHERE workspace_id = $1
		  AND status NOT IN ('Paid', 'Cancelled', 'Refunded', 'Draft')
		  AND due_date IS NOT NULL
		  AND due_date < NOW()
	`
	invRows, err := r.db.Pool.Query(ctx, invQuery, workspaceID)
	if err == nil {
		defer invRows.Close()

		for invRows.Next() {
			var id int
			var invNumber string
			var grandTotal, amountPaid float64
			var dueDate time.Time

			if err := invRows.Scan(&id, &invNumber, &grandTotal, &amountPaid, &dueDate); err == nil {
				balance := grandTotal - amountPaid
				if balance > 0.01 {
					daysOverdue := int(math.Floor(time.Since(dueDate).Hours() / 24))
					if daysOverdue < 1 {
						daysOverdue = 1
					}

					title := fmt.Sprintf("Overdue Invoice: %s", invNumber)
					msg := fmt.Sprintf("Invoice %s is overdue by %d day(s) with an outstanding balance of ₹%.2f.", invNumber, daysOverdue, balance)

					upsertQuery := `
						INSERT INTO automated_reminders (
							workspace_id, reminder_type, entity_type, entity_id, title, message, severity, status, due_at, created_at, updated_at
						) VALUES (
							$1, 'invoice_overdue', 'invoice', $2, $3, $4, 'critical', 'pending', $5, NOW(), NOW()
						)
						ON CONFLICT (workspace_id, reminder_type, entity_id)
						DO UPDATE SET
							message = EXCLUDED.message,
							due_at = EXCLUDED.due_at,
							updated_at = NOW()
						WHERE automated_reminders.status NOT IN ('dismissed')
					`
					_, _ = r.db.Pool.Exec(ctx, upsertQuery, workspaceID, strconv.Itoa(id), title, msg, dueDate)
					remindersCreatedOrUpdated++
				}
			}
		}
	}

	// Auto-resolve invoice reminders that are now paid or cancelled
	resolveInvQuery := `
		UPDATE automated_reminders ar
		SET status = 'resolved', resolved_at = NOW(), updated_at = NOW()
		FROM invoices i
		WHERE ar.workspace_id = $1
		  AND ar.reminder_type = 'invoice_overdue'
		  AND ar.entity_id = i.id::text
		  AND (i.status IN ('Paid', 'Cancelled', 'Refunded') OR (i.grand_total - i.amount_paid) <= 0.01)
		  AND ar.status != 'resolved'
	`
	_, _ = r.db.Pool.Exec(ctx, resolveInvQuery, workspaceID)

	// ==========================================
	// 2. Pending / Overdue Follow-ups Evaluation
	// ==========================================
	followQuery := `
		SELECT f.id, f.title, f.due_date, f.follow_up_type, COALESCE(l.name, d.name, 'Customer') AS entity_name
		FROM follow_ups f
		LEFT JOIN leads l ON f.lead_number = l.number
		LEFT JOIN deals d ON f.deal_id = d.id
		WHERE f.completed = 0
		  AND f.due_date <= NOW()
	`
	followRows, err := r.db.Pool.Query(ctx, followQuery)
	if err == nil {
		defer followRows.Close()

		for followRows.Next() {
			var fID int
			var title, fType, entityName string
			var dueDate time.Time

			if err := followRows.Scan(&fID, &title, &dueDate, &fType, &entityName); err == nil {
				severity := "warning"
				hoursDiff := time.Since(dueDate).Hours()
				if hoursDiff > 24 {
					severity = "critical"
				}

				remTitle := fmt.Sprintf("Pending Follow-up: %s", title)
				msg := fmt.Sprintf("%s scheduled with %s is due for follow-up.", fType, entityName)

				upsertFollowQuery := `
					INSERT INTO automated_reminders (
						workspace_id, reminder_type, entity_type, entity_id, title, message, severity, status, due_at, created_at, updated_at
					) VALUES (
						$1, 'follow_up_due', 'follow_up', $2, $3, $4, $5, 'pending', $6, NOW(), NOW()
					)
					ON CONFLICT (workspace_id, reminder_type, entity_id)
					DO UPDATE SET
						title = EXCLUDED.title,
						message = EXCLUDED.message,
						severity = EXCLUDED.severity,
						due_at = EXCLUDED.due_at,
						updated_at = NOW()
					WHERE automated_reminders.status NOT IN ('dismissed')
				`
				_, _ = r.db.Pool.Exec(ctx, upsertFollowQuery, workspaceID, strconv.Itoa(fID), remTitle, msg, severity, dueDate)
				remindersCreatedOrUpdated++
			}
		}
	}

	// Auto-resolve follow-up reminders that have been marked completed
	resolveFollowQuery := `
		UPDATE automated_reminders ar
		SET status = 'resolved', resolved_at = NOW(), updated_at = NOW()
		FROM follow_ups f
		WHERE ar.workspace_id = $1
		  AND ar.reminder_type = 'follow_up_due'
		  AND ar.entity_id = f.id::text
		  AND f.completed = 1
		  AND ar.status != 'resolved'
	`
	_, _ = r.db.Pool.Exec(ctx, resolveFollowQuery, workspaceID)

	return remindersCreatedOrUpdated, nil
}

// ListReminders returns automated reminders filtered by active status
func (r *AutomationRepository) ListReminders(ctx context.Context, statusFilter string, workspaceID int, limit int) ([]models.AutomatedReminder, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	where := []string{"workspace_id = $1"}
	args := []interface{}{workspaceID}
	argIdx := 2

	normStatus := strings.ToLower(strings.TrimSpace(statusFilter))
	if normStatus == "" || normStatus == "active" || normStatus == "pending" {
		where = append(where, "(status = 'pending' OR (status = 'snoozed' AND snoozed_until IS NOT NULL AND snoozed_until <= NOW()))")
	} else if normStatus != "all" {
		where = append(where, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, normStatus)
		argIdx++
	}

	query := fmt.Sprintf(`
		SELECT id, workspace_id, reminder_type, entity_type, entity_id, title, message, severity, status, due_at, snoozed_until, resolved_at, created_at, updated_at
		FROM automated_reminders
		WHERE %s
		ORDER BY 
			CASE WHEN severity = 'critical' THEN 1 WHEN severity = 'warning' THEN 2 ELSE 3 END ASC,
			due_at ASC,
			id DESC
		LIMIT $%d
	`, strings.Join(where, " AND "), argIdx)

	args = append(args, limit)
	rows, err := r.db.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to list automated reminders: %w", err)
	}
	defer rows.Close()

	reminders := make([]models.AutomatedReminder, 0)
	for rows.Next() {
		var item models.AutomatedReminder
		err := rows.Scan(
			&item.ID,
			&item.WorkspaceID,
			&item.ReminderType,
			&item.EntityType,
			&item.EntityID,
			&item.Title,
			&item.Message,
			&item.Severity,
			&item.Status,
			&item.DueAt,
			&item.SnoozedUntil,
			&item.ResolvedAt,
			&item.CreatedAt,
			&item.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan automated reminder: %w", err)
		}
		reminders = append(reminders, item)
	}

	return reminders, nil
}

// UpdateReminderStatus updates the status or snoozes a reminder
func (r *AutomationRepository) UpdateReminderStatus(ctx context.Context, id int, status string, snoozeHours int, workspaceID int) error {
	norm := strings.ToLower(strings.TrimSpace(status))
	if norm != "pending" && norm != "snoozed" && norm != "dismissed" && norm != "resolved" {
		return errors.New("invalid reminder status: must be pending, snoozed, dismissed, or resolved")
	}

	var snoozedUntil *time.Time
	var resolvedAt *time.Time

	if norm == "snoozed" {
		if snoozeHours <= 0 {
			snoozeHours = 24
		}
		t := time.Now().Add(time.Duration(snoozeHours) * time.Hour)
		snoozedUntil = &t
	} else if norm == "resolved" {
		t := time.Now()
		resolvedAt = &t
	}

	query := `
		UPDATE automated_reminders
		SET status = $1, snoozed_until = $2, resolved_at = $3, updated_at = NOW()
		WHERE id = $4 AND workspace_id = $5
	`
	cmdTag, err := r.db.Pool.Exec(ctx, query, norm, snoozedUntil, resolvedAt, id, workspaceID)
	if err != nil {
		return err
	}
	if cmdTag.RowsAffected() == 0 {
		return errors.New("reminder not found")
	}
	return nil
}

// StartPeriodicEvaluator starts a background worker ticking every 10 minutes
func (r *AutomationRepository) StartPeriodicEvaluator(ctx context.Context) {
	ticker := time.NewTicker(10 * time.Minute)
	go func() {
		// Run initial check immediately on server start
		_, _ = r.EvaluateReminders(context.Background(), 1)
		for {
			select {
			case <-ctx.Done():
				ticker.Stop()
				return
			case <-ticker.C:
				_, _ = r.EvaluateReminders(context.Background(), 1)
			}
		}
	}()
}
