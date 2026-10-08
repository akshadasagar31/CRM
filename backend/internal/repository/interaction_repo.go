package repository

import (
	"context"
	"errors"
	"strings"
	"time"

	"crm-backend-go/internal/database"
	"crm-backend-go/internal/models"

	"github.com/jackc/pgx/v5"
)

type InteractionRepository struct {
	db *database.DB
}

func NewInteractionRepository(db *database.DB) *InteractionRepository {
	return &InteractionRepository{db: db}
}

// LogActivity logs an audit timeline activity and updates lead's last_activity_at
func (r *InteractionRepository) LogActivity(ctx context.Context, leadNumber string, userID *int, activityType, title string, desc *string) error {
	query := `
		INSERT INTO lead_activities (lead_number, user_id, activity_type, title, description, created_at)
		VALUES ($1, $2, $3, $4, $5, NOW())
	`
	_, err := r.db.Pool.Exec(ctx, query, leadNumber, userID, activityType, title, desc)
	if err == nil {
		_, _ = r.db.Pool.Exec(ctx, "UPDATE leads SET last_activity_at = NOW() WHERE number = $1", leadNumber)
	}
	return err
}

func (r *InteractionRepository) ListActivities(ctx context.Context, leadNumber string) ([]models.LeadActivity, error) {
	query := `
		SELECT a.id, a.lead_number, a.user_id, a.activity_type, a.title, a.description, a.created_at,
		       u.id, u.name, u.email
		FROM lead_activities a
		LEFT JOIN users u ON a.user_id = u.id
		WHERE a.lead_number = $1
		ORDER BY a.created_at DESC
	`
	rows, err := r.db.Pool.Query(ctx, query, leadNumber)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.LeadActivity
	for rows.Next() {
		var a models.LeadActivity
		var uID *int
		var uName, uEmail *string

		err := rows.Scan(
			&a.ID, &a.LeadNumber, &a.UserID, &a.ActivityType, &a.Title, &a.Description, &a.CreatedAt,
			&uID, &uName, &uEmail,
		)
		if err != nil {
			return nil, err
		}
		if uID != nil && uName != nil && uEmail != nil {
			a.User = &models.UserSummary{ID: *uID, Name: *uName, Email: *uEmail}
		}
		list = append(list, a)
	}
	if list == nil {
		list = []models.LeadActivity{}
	}
	return list, nil
}

func (r *InteractionRepository) AddNote(ctx context.Context, leadNumber string, userID *int, content string) (*models.LeadNote, error) {
	query := `
		INSERT INTO lead_notes (lead_number, user_id, content, created_at)
		VALUES ($1, $2, $3, NOW())
		RETURNING id, lead_number, user_id, content, created_at
	`
	var n models.LeadNote
	err := r.db.Pool.QueryRow(ctx, query, leadNumber, userID, content).Scan(
		&n.ID, &n.LeadNumber, &n.UserID, &n.Content, &n.CreatedAt,
	)
	if err != nil {
		return nil, err
	}

	if userID != nil {
		var u models.UserSummary
		if err := r.db.Pool.QueryRow(ctx, "SELECT id, name, email FROM users WHERE id = $1", *userID).Scan(&u.ID, &u.Name, &u.Email); err == nil {
			n.User = &u
		}
	}

	// Record activity
	preview := content
	if len(preview) > 60 {
		preview = preview[:57] + "..."
	}
	_ = r.LogActivity(ctx, leadNumber, userID, "note_added", "Internal note added", &preview)

	return &n, nil
}

func (r *InteractionRepository) ListNotes(ctx context.Context, leadNumber string) ([]models.LeadNote, error) {
	query := `
		SELECT n.id, n.lead_number, n.user_id, n.content, n.created_at,
		       u.id, u.name, u.email
		FROM lead_notes n
		LEFT JOIN users u ON n.user_id = u.id
		WHERE n.lead_number = $1
		ORDER BY n.created_at DESC
	`
	rows, err := r.db.Pool.Query(ctx, query, leadNumber)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.LeadNote
	for rows.Next() {
		var n models.LeadNote
		var uID *int
		var uName, uEmail *string

		err := rows.Scan(
			&n.ID, &n.LeadNumber, &n.UserID, &n.Content, &n.CreatedAt,
			&uID, &uName, &uEmail,
		)
		if err != nil {
			return nil, err
		}
		if uID != nil && uName != nil && uEmail != nil {
			n.User = &models.UserSummary{ID: *uID, Name: *uName, Email: *uEmail}
		}
		list = append(list, n)
	}
	if list == nil {
		list = []models.LeadNote{}
	}
	return list, nil
}

func (r *InteractionRepository) DeleteNote(ctx context.Context, leadNumber string, noteID int) error {
	cmd, err := r.db.Pool.Exec(ctx, "DELETE FROM lead_notes WHERE id = $1 AND lead_number = $2", noteID, leadNumber)
	if err != nil {
		return err
	}
	if cmd.RowsAffected() == 0 {
		return errors.New("note not found")
	}
	return nil
}

func (r *InteractionRepository) CreateFollowUp(ctx context.Context, leadNumber string, userID *int, title, fType string, dueDate time.Time, notes *string) (*models.FollowUp, error) {
	if fType == "" {
		fType = "Call"
	}
	query := `
		INSERT INTO follow_ups (lead_number, user_id, title, follow_up_type, due_date, completed, reminder_state, notes, created_at)
		VALUES ($1, $2, $3, $4, $5, 0, 'pending', $6, NOW())
		RETURNING id, lead_number, user_id, title, follow_up_type, due_date, completed, completed_at, notes, reminder_state, created_at
	`
	var f models.FollowUp
	var compInt int
	err := r.db.Pool.QueryRow(ctx, query, leadNumber, userID, title, fType, dueDate, notes).Scan(
		&f.ID, &f.LeadNumber, &f.UserID, &f.Title, &f.FollowUpType, &f.DueDate,
		&compInt, &f.CompletedAt, &f.Notes, &f.ReminderState, &f.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	f.Completed = compInt == 1

	if userID != nil {
		var u models.UserSummary
		if err := r.db.Pool.QueryRow(ctx, "SELECT id, name, email FROM users WHERE id = $1", *userID).Scan(&u.ID, &u.Name, &u.Email); err == nil {
			f.User = &u
		}
	}

	// Update lead follow-up cache
	_, _ = r.db.Pool.Exec(ctx, `
		UPDATE leads
		SET follow_up_date = $1, follow_up_type = $2, follow_up_notes = $3, follow_up_completed = 0, last_activity_at = NOW()
		WHERE number = $4
	`, dueDate, fType, notes, leadNumber)

	desc := title
	_ = r.LogActivity(ctx, leadNumber, userID, "follow_up_scheduled", "Follow-up scheduled: "+title, &desc)

	return &f, nil
}

func (r *InteractionRepository) ListFollowUps(ctx context.Context, leadNumber string) ([]models.FollowUp, error) {
	query := `
		SELECT f.id, f.lead_number, f.user_id, f.title, f.follow_up_type, f.due_date, f.completed, f.completed_at, f.notes, f.reminder_state, f.created_at,
		       u.id, u.name, u.email
		FROM follow_ups f
		LEFT JOIN users u ON f.user_id = u.id
		WHERE f.lead_number = $1
		ORDER BY f.due_date DESC
	`
	rows, err := r.db.Pool.Query(ctx, query, leadNumber)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.FollowUp
	for rows.Next() {
		var f models.FollowUp
		var compInt int
		var uID *int
		var uName, uEmail *string

		err := rows.Scan(
			&f.ID, &f.LeadNumber, &f.UserID, &f.Title, &f.FollowUpType, &f.DueDate,
			&compInt, &f.CompletedAt, &f.Notes, &f.ReminderState, &f.CreatedAt,
			&uID, &uName, &uEmail,
		)
		if err != nil {
			return nil, err
		}
		f.Completed = compInt == 1
		if uID != nil && uName != nil && uEmail != nil {
			f.User = &models.UserSummary{ID: *uID, Name: *uName, Email: *uEmail}
		}
		list = append(list, f)
	}
	if list == nil {
		list = []models.FollowUp{}
	}
	return list, nil
}

func (r *InteractionRepository) UpdateFollowUp(ctx context.Context, leadNumber string, fupID int, title, fType *string, dueDate *time.Time, completed *bool, notes *string) (*models.FollowUp, error) {
	var current models.FollowUp
	var compInt int
	err := r.db.Pool.QueryRow(ctx, `
		SELECT id, lead_number, user_id, title, follow_up_type, due_date, completed, completed_at, notes, reminder_state, created_at
		FROM follow_ups WHERE id = $1 AND lead_number = $2
	`, fupID, leadNumber).Scan(
		&current.ID, &current.LeadNumber, &current.UserID, &current.Title, &current.FollowUpType, &current.DueDate,
		&compInt, &current.CompletedAt, &current.Notes, &current.ReminderState, &current.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("follow-up not found")
		}
		return nil, err
	}
	current.Completed = compInt == 1

	if title != nil {
		current.Title = *title
	}
	if fType != nil {
		current.FollowUpType = *fType
	}
	if dueDate != nil {
		current.DueDate = *dueDate
	}
	if notes != nil {
		current.Notes = notes
	}

	newCompInt := compInt
	if completed != nil {
		if *completed {
			newCompInt = 1
			now := time.Now().UTC()
			current.CompletedAt = &now
		} else {
			newCompInt = 0
			current.CompletedAt = nil
		}
		current.Completed = *completed
	}

	query := `
		UPDATE follow_ups
		SET title = $1, follow_up_type = $2, due_date = $3, completed = $4, completed_at = $5, notes = $6
		WHERE id = $7 AND lead_number = $8
	`
	_, err = r.db.Pool.Exec(ctx, query, current.Title, current.FollowUpType, current.DueDate, newCompInt, current.CompletedAt, current.Notes, fupID, leadNumber)
	if err != nil {
		return nil, err
	}

	// Update lead follow-up status
	if completed != nil && *completed {
		_, _ = r.db.Pool.Exec(ctx, "UPDATE leads SET follow_up_completed = 1, last_activity_at = NOW() WHERE number = $1", leadNumber)
		actTitle := "Follow-up completed: " + current.Title
		_ = r.LogActivity(ctx, leadNumber, current.UserID, "follow_up_completed", actTitle, current.Notes)
	}

	return &current, nil
}

func (r *InteractionRepository) ListAllFollowUps(ctx context.Context, filter string) ([]models.FollowUp, map[string]int, error) {
	query := `
		SELECT f.id, f.lead_number, COALESCE(l.name, f.lead_number) AS lead_name, CAST('' AS TEXT) AS lead_company,
		       f.user_id, f.title, f.follow_up_type, f.due_date, f.completed, f.completed_at, f.notes, f.reminder_state, f.created_at,
		       u.id, u.name, u.email
		FROM follow_ups f
		LEFT JOIN leads l ON f.lead_number = l.number
		LEFT JOIN users u ON f.user_id = u.id
		ORDER BY f.due_date ASC
	`
	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	now := time.Now().UTC()
	todayDate := now.Format("2006-01-02")

	counts := map[string]int{
		"all":       0,
		"overdue":   0,
		"today":     0,
		"pending":   0,
		"completed": 0,
	}

	var allItems []models.FollowUp

	for rows.Next() {
		var f models.FollowUp
		var compInt int
		var uID *int
		var uName, uEmail *string

		err := rows.Scan(
			&f.ID, &f.LeadNumber, &f.LeadName, &f.LeadCompany,
			&f.UserID, &f.Title, &f.FollowUpType, &f.DueDate,
			&compInt, &f.CompletedAt, &f.Notes, &f.ReminderState, &f.CreatedAt,
			&uID, &uName, &uEmail,
		)
		if err != nil {
			return nil, nil, err
		}
		f.Completed = compInt == 1
		if uID != nil && uName != nil && uEmail != nil {
			f.User = &models.UserSummary{ID: *uID, Name: *uName, Email: *uEmail}
		}

		counts["all"]++
		if f.Completed {
			counts["completed"]++
		} else {
			counts["pending"]++
			dueDateStr := f.DueDate.UTC().Format("2006-01-02")
			if dueDateStr == todayDate {
				counts["today"]++
			} else if f.DueDate.Before(now) {
				counts["overdue"]++
			}
		}

		allItems = append(allItems, f)
	}

	var filtered []models.FollowUp
	filter = strings.ToLower(strings.TrimSpace(filter))

	for _, item := range allItems {
		dueDateStr := item.DueDate.UTC().Format("2006-01-02")
		isDueToday := dueDateStr == todayDate
		isPast := item.DueDate.Before(now)

		switch filter {
		case "overdue":
			if !item.Completed && isPast && !isDueToday {
				filtered = append(filtered, item)
			}
		case "today", "due_today", "due today":
			if !item.Completed && isDueToday {
				filtered = append(filtered, item)
			}
		case "pending":
			if !item.Completed {
				filtered = append(filtered, item)
			}
		case "completed":
			if item.Completed {
				filtered = append(filtered, item)
			}
		default: // "all"
			filtered = append(filtered, item)
		}
	}

	if filtered == nil {
		filtered = []models.FollowUp{}
	}

	return filtered, counts, nil
}

func (r *InteractionRepository) UpdateFollowUpByID(ctx context.Context, fupID int, title, fType *string, dueDate *time.Time, completed *bool, notes *string) (*models.FollowUp, error) {
	var leadNumber string
	err := r.db.Pool.QueryRow(ctx, "SELECT lead_number FROM follow_ups WHERE id = $1", fupID).Scan(&leadNumber)
	if err != nil {
		return nil, errors.New("follow-up not found")
	}
	return r.UpdateFollowUp(ctx, leadNumber, fupID, title, fType, dueDate, completed, notes)
}

func (r *InteractionRepository) DeleteFollowUpByID(ctx context.Context, fupID int) error {
	cmd, err := r.db.Pool.Exec(ctx, "DELETE FROM follow_ups WHERE id = $1", fupID)
	if err != nil {
		return err
	}
	if cmd.RowsAffected() == 0 {
		return errors.New("follow-up not found")
	}
	return nil
}
