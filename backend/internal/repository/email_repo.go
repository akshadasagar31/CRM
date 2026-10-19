package repository

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"crm-backend-go/internal/database"
	"crm-backend-go/internal/models"
)

type EmailRepository struct {
	db *database.DB
}

func NewEmailRepository(db *database.DB) *EmailRepository {
	return &EmailRepository{db: db}
}

// Enqueue inserts a new email record with idempotency duplicate prevention.
// Returns (enqueued=true, nil) if successfully queued, or (enqueued=false, nil) if duplicate key already exists.
func (r *EmailRepository) Enqueue(ctx context.Context, item *models.EmailLog) (bool, error) {
	if item.WorkspaceID <= 0 {
		item.WorkspaceID = 1
	}
	if item.MaxRetries <= 0 {
		item.MaxRetries = 3
	}
	if item.Status == "" {
		item.Status = "pending"
	}

	query := `
		INSERT INTO email_logs (
			workspace_id, recipient_email, recipient_name, subject, body_html, body_text,
			entity_type, entity_id, email_type, status, retry_count, max_retries,
			next_retry_at, last_error, has_attachment, attachment_name, idempotency_key,
			created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6,
			$7, $8, $9, $10, $11, $12,
			$13, $14, $15, $16, $17,
			NOW(), NOW()
		)
		ON CONFLICT (idempotency_key) DO NOTHING
		RETURNING id, created_at, updated_at
	`

	err := r.db.Pool.QueryRow(ctx, query,
		item.WorkspaceID, item.RecipientEmail, item.RecipientName, item.Subject, item.BodyHTML, item.BodyText,
		item.EntityType, item.EntityID, item.EmailType, item.Status, item.RetryCount, item.MaxRetries,
		item.NextRetryAt, item.LastError, item.HasAttachment, item.AttachmentName, item.IdempotencyKey,
	).Scan(&item.ID, &item.CreatedAt, &item.UpdatedAt)

	if err != nil {
		if strings.Contains(err.Error(), "no rows in result set") {
			// Duplicate idempotency key prevented!
			return false, nil
		}
		return false, fmt.Errorf("failed to enqueue email: %w", err)
	}

	return true, nil
}

// GetByID retrieves a single email log record
func (r *EmailRepository) GetByID(ctx context.Context, id int) (*models.EmailLog, error) {
	query := `
		SELECT id, workspace_id, recipient_email, recipient_name, subject, body_html, body_text,
		       entity_type, entity_id, email_type, status, retry_count, max_retries,
		       next_retry_at, last_error, has_attachment, attachment_name, idempotency_key,
		       sent_at, created_at, updated_at
		FROM email_logs
		WHERE id = $1
	`
	row := r.db.Pool.QueryRow(ctx, query, id)

	var item models.EmailLog
	err := row.Scan(
		&item.ID, &item.WorkspaceID, &item.RecipientEmail, &item.RecipientName, &item.Subject, &item.BodyHTML, &item.BodyText,
		&item.EntityType, &item.EntityID, &item.EmailType, &item.Status, &item.RetryCount, &item.MaxRetries,
		&item.NextRetryAt, &item.LastError, &item.HasAttachment, &item.AttachmentName, &item.IdempotencyKey,
		&item.SentAt, &item.CreatedAt, &item.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &item, nil
}

// UpdateStatus records delivery success or failure with retry scheduling
func (r *EmailRepository) UpdateStatus(ctx context.Context, id int, status string, lastErr string, sentAt *time.Time, nextRetryAt *time.Time, incrementRetry bool) error {
	var query string
	if incrementRetry {
		query = `
			UPDATE email_logs
			SET status = $1, last_error = $2, sent_at = $3, next_retry_at = $4, retry_count = retry_count + 1, updated_at = NOW()
			WHERE id = $5
		`
	} else {
		query = `
			UPDATE email_logs
			SET status = $1, last_error = $2, sent_at = $3, next_retry_at = $4, updated_at = NOW()
			WHERE id = $5
		`
	}

	var errVal *string
	if lastErr != "" {
		errVal = &lastErr
	}

	_, err := r.db.Pool.Exec(ctx, query, status, errVal, sentAt, nextRetryAt, id)
	return err
}

// ClaimForDispatch atomically transitions an email log from pending or retryable failed to sending
func (r *EmailRepository) ClaimForDispatch(ctx context.Context, id int) (bool, error) {
	query := `
		UPDATE email_logs
		SET status = 'sending', updated_at = NOW()
		WHERE id = $1
		  AND (
		    status = 'pending' 
		    OR (status = 'failed' AND retry_count < max_retries AND (next_retry_at IS NULL OR next_retry_at <= NOW()))
		  )
		RETURNING id
	`
	var claimedID int
	err := r.db.Pool.QueryRow(ctx, query, id).Scan(&claimedID)
	if err != nil {
		if strings.Contains(err.Error(), "no rows in result set") {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

// GetPendingOrRetryable gets uncompleted or retryable emails
func (r *EmailRepository) GetPendingOrRetryable(ctx context.Context, workspaceID int, limit int) ([]models.EmailLog, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	query := `
		SELECT id, workspace_id, recipient_email, recipient_name, subject, body_html, body_text,
		       entity_type, entity_id, email_type, status, retry_count, max_retries,
		       next_retry_at, last_error, has_attachment, attachment_name, idempotency_key,
		       sent_at, created_at, updated_at
		FROM email_logs
		WHERE workspace_id = $1
		  AND (
		    status = 'pending' 
		    OR (status = 'failed' AND retry_count < max_retries AND (next_retry_at IS NULL OR next_retry_at <= NOW()))
		  )
		ORDER BY id ASC
		LIMIT $2
	`

	rows, err := r.db.Pool.Query(ctx, query, workspaceID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]models.EmailLog, 0)
	for rows.Next() {
		var item models.EmailLog
		if err := rows.Scan(
			&item.ID, &item.WorkspaceID, &item.RecipientEmail, &item.RecipientName, &item.Subject, &item.BodyHTML, &item.BodyText,
			&item.EntityType, &item.EntityID, &item.EmailType, &item.Status, &item.RetryCount, &item.MaxRetries,
			&item.NextRetryAt, &item.LastError, &item.HasAttachment, &item.AttachmentName, &item.IdempotencyKey,
			&item.SentAt, &item.CreatedAt, &item.UpdatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, nil
}

// List returns email delivery logs with filtering
func (r *EmailRepository) List(ctx context.Context, workspaceID int, entityType string, entityID string, status string, page int, limit int) (*models.EmailLogListResponse, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 25
	}
	offset := (page - 1) * limit

	where := []string{"workspace_id = $1"}
	args := []interface{}{workspaceID}
	idx := 2

	if entityType != "" && entityType != "all" {
		where = append(where, "entity_type = $"+strconv.Itoa(idx))
		args = append(args, entityType)
		idx++
	}
	if entityID != "" && entityID != "all" {
		where = append(where, "entity_id = $"+strconv.Itoa(idx))
		args = append(args, entityID)
		idx++
	}
	if status != "" && status != "all" {
		where = append(where, "status = $"+strconv.Itoa(idx))
		args = append(args, status)
		idx++
	}

	whereSQL := strings.Join(where, " AND ")

	var total int
	countQuery := "SELECT COUNT(*) FROM email_logs WHERE " + whereSQL
	if err := r.db.Pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, err
	}

	selectQuery := fmt.Sprintf(`
		SELECT id, workspace_id, recipient_email, recipient_name, subject, body_html, body_text,
		       entity_type, entity_id, email_type, status, retry_count, max_retries,
		       next_retry_at, last_error, has_attachment, attachment_name, idempotency_key,
		       sent_at, created_at, updated_at
		FROM email_logs
		WHERE %s
		ORDER BY id DESC
		LIMIT $%d OFFSET $%d
	`, whereSQL, idx, idx+1)

	args = append(args, limit, offset)

	rows, err := r.db.Pool.Query(ctx, selectQuery, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]models.EmailLog, 0)
	for rows.Next() {
		var item models.EmailLog
		if err := rows.Scan(
			&item.ID, &item.WorkspaceID, &item.RecipientEmail, &item.RecipientName, &item.Subject, &item.BodyHTML, &item.BodyText,
			&item.EntityType, &item.EntityID, &item.EmailType, &item.Status, &item.RetryCount, &item.MaxRetries,
			&item.NextRetryAt, &item.LastError, &item.HasAttachment, &item.AttachmentName, &item.IdempotencyKey,
			&item.SentAt, &item.CreatedAt, &item.UpdatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, item)
	}

	pages := (total + limit - 1) / limit
	if pages < 1 {
		pages = 1
	}

	return &models.EmailLogListResponse{
		Items: items,
		Total: total,
		Page:  page,
		Limit: limit,
		Pages: pages,
	}, nil
}

// GetLatestStatusForEntity returns the latest email log for a specific quotation, invoice, or follow-up
func (r *EmailRepository) GetLatestStatusForEntity(ctx context.Context, workspaceID int, entityType string, entityID string) (*models.EmailLog, error) {
	query := `
		SELECT id, workspace_id, recipient_email, recipient_name, subject, body_html, body_text,
		       entity_type, entity_id, email_type, status, retry_count, max_retries,
		       next_retry_at, last_error, has_attachment, attachment_name, idempotency_key,
		       sent_at, created_at, updated_at
		FROM email_logs
		WHERE workspace_id = $1 AND entity_type = $2 AND entity_id = $3
		ORDER BY id DESC
		LIMIT 1
	`
	var item models.EmailLog
	err := r.db.Pool.QueryRow(ctx, query, workspaceID, entityType, entityID).Scan(
		&item.ID, &item.WorkspaceID, &item.RecipientEmail, &item.RecipientName, &item.Subject, &item.BodyHTML, &item.BodyText,
		&item.EntityType, &item.EntityID, &item.EmailType, &item.Status, &item.RetryCount, &item.MaxRetries,
		&item.NextRetryAt, &item.LastError, &item.HasAttachment, &item.AttachmentName, &item.IdempotencyKey,
		&item.SentAt, &item.CreatedAt, &item.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &item, nil
}
