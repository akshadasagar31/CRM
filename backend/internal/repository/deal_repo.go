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

type DealRepository struct {
	db           *database.DB
	customerRepo *CustomerRepository
	pipeRepo     *PipelineRepository
	orderRepo    *OrderRepository
}

func NewDealRepository(db *database.DB, customerRepo *CustomerRepository, pipeRepo *PipelineRepository) *DealRepository {
	return &DealRepository{
		db:           db,
		customerRepo: customerRepo,
		pipeRepo:     pipeRepo,
	}
}

func (r *DealRepository) SetOrderRepo(orderRepo *OrderRepository) {
	r.orderRepo = orderRepo
}

type DealFilter struct {
	Search     string
	PipelineID *int
	StageID    *int
	OwnerID    *int
	Priority   string
	Status     string // "open", "won", "lost", "all"
	Page       int
	Limit      int
}

func (r *DealRepository) generateDealNumber(ctx context.Context, workspaceID int) (string, error) {
	for attempt := 0; attempt < 20; attempt++ {
		var nextNum int
		err := r.db.Pool.QueryRow(ctx, `
			SELECT COALESCE(
				MAX(
					CASE 
						WHEN deal_number ~ '^DEAL-[0-9]+$' 
						THEN CAST(SUBSTRING(deal_number FROM 6) AS INTEGER) 
						ELSE 0 
					END
				), 0
			) + 1 + $1
			FROM deals
		`, attempt).Scan(&nextNum)
		if err != nil || nextNum <= 0 {
			nextNum = int(time.Now().UnixNano()%90000) + 10000
		}
		dealNum := fmt.Sprintf("DEAL-%04d", nextNum)

		var exists bool
		_ = r.db.Pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM deals WHERE deal_number = $1)", dealNum).Scan(&exists)
		if !exists {
			return dealNum, nil
		}
	}
	return fmt.Sprintf("DEAL-%d", time.Now().UnixNano()%1000000), nil
}

func (r *DealRepository) Create(ctx context.Context, input models.DealCreateInput, createdByID *int, workspaceID int) (*models.Deal, error) {
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return nil, errors.New("deal name is required")
	}

	dealNum, err := r.generateDealNumber(ctx, workspaceID)
	if err != nil {
		return nil, err
	}

	// Verify stage and determine status
	stage, err := r.pipeRepo.GetStageByID(ctx, input.StageID)
	if err != nil || stage == nil {
		return nil, errors.New("invalid stage selected")
	}

	status := "open"
	if stage.IsWon {
		status = "won"
	} else if stage.IsLost {
		status = "lost"
	}

	currency := input.Currency
	if currency == "" {
		currency = "USD"
	}
	priority := input.Priority
	if priority == "" {
		priority = "Medium"
	}

	query := `
		INSERT INTO deals (
			deal_number, name, customer_id, lead_number, pipeline_id, stage_id,
			owner_id, value, currency, priority, expected_close_date, requirement,
			status, workspace_id, created_by_id, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6,
			$7, $8, $9, $10, $11, $12,
			$13, $14, $15, NOW(), NOW()
		)
		RETURNING id, deal_number, name, customer_id, lead_number, pipeline_id, stage_id,
		          owner_id, value, currency, priority, expected_close_date, requirement,
		          status, lost_reason, workspace_id, created_by_id, created_at, updated_at
	`

	var d models.Deal
	err = r.db.Pool.QueryRow(ctx, query,
		dealNum, name, input.CustomerID, input.LeadNumber, input.PipelineID, input.StageID,
		input.OwnerID, input.Value, currency, priority, input.ExpectedCloseDate, input.Requirement,
		status, workspaceID, createdByID,
	).Scan(
		&d.ID, &d.DealNumber, &d.Name, &d.CustomerID, &d.LeadNumber, &d.PipelineID, &d.StageID,
		&d.OwnerID, &d.Value, &d.Currency, &d.Priority, &d.ExpectedCloseDate, &d.Requirement,
		&d.Status, &d.LostReason, &d.WorkspaceID, &d.CreatedByID, &d.CreatedAt, &d.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	// Record activity
	_ = r.CreateActivity(ctx, d.ID, createdByID, "deal_created", "Deal Created", fmt.Sprintf("Deal %s was created in stage %s with value %s %.2f", d.Name, stage.Name, d.Currency, d.Value))

	return r.GetByID(ctx, d.ID, workspaceID)
}

func (r *DealRepository) GetByID(ctx context.Context, id int, workspaceID int) (*models.Deal, error) {
	query := `
		SELECT d.id, d.deal_number, d.name, d.customer_id, d.lead_number, d.pipeline_id, d.stage_id,
		       d.owner_id, d.value, d.currency, d.priority, d.expected_close_date, d.requirement,
		       d.status, d.lost_reason, d.workspace_id, d.created_by_id, d.created_at, d.updated_at,
		       c.id, c.name, c.email, c.phone, c.company,
		       p.id, p.name,
		       s.id, s.name, s.stage_order, s.probability, s.color, s.is_won, s.is_lost,
		       u.id, u.name, u.email,
		       cu.id, cu.name, cu.email
		FROM deals d
		JOIN customers c ON d.customer_id = c.id
		JOIN pipelines p ON d.pipeline_id = p.id
		JOIN deal_stages s ON d.stage_id = s.id
		LEFT JOIN users u ON u.id = d.owner_id
		LEFT JOIN users cu ON cu.id = d.created_by_id
		WHERE d.id = $1 AND d.workspace_id = $2
	`

	var d models.Deal
	var cID int
	var cName string
	var cEmail, cPhone, cCompany *string
	var pID int
	var pName string
	var sID int
	var sName string
	var sOrder, sProb, wonInt, lostInt int
	var sColor string
	var uID *int
	var uName, uEmail *string
	var cuID *int
	var cuName, cuEmail *string

	err := r.db.Pool.QueryRow(ctx, query, id, workspaceID).Scan(
		&d.ID, &d.DealNumber, &d.Name, &d.CustomerID, &d.LeadNumber, &d.PipelineID, &d.StageID,
		&d.OwnerID, &d.Value, &d.Currency, &d.Priority, &d.ExpectedCloseDate, &d.Requirement,
		&d.Status, &d.LostReason, &d.WorkspaceID, &d.CreatedByID, &d.CreatedAt, &d.UpdatedAt,
		&cID, &cName, &cEmail, &cPhone, &cCompany,
		&pID, &pName,
		&sID, &sName, &sOrder, &sProb, &sColor, &wonInt, &lostInt,
		&uID, &uName, &uEmail,
		&cuID, &cuName, &cuEmail,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	d.Customer = &models.Customer{
		ID:      cID,
		Name:    cName,
		Email:   cEmail,
		Phone:   cPhone,
		Company: cCompany,
	}
	d.Pipeline = &models.Pipeline{
		ID:   pID,
		Name: pName,
	}
	d.Stage = &models.DealStage{
		ID:          sID,
		Name:        sName,
		StageOrder:  sOrder,
		Probability: sProb,
		Color:       sColor,
		IsWon:       (wonInt == 1),
		IsLost:      (lostInt == 1),
	}
	if uID != nil && uName != nil && uEmail != nil {
		d.Owner = &models.UserSummary{ID: *uID, Name: *uName, Email: *uEmail}
	}
	if cuID != nil && cuName != nil && cuEmail != nil {
		d.Creator = &models.UserSummary{ID: *cuID, Name: *cuName, Email: *cuEmail}
	}

	return &d, nil
}

func (r *DealRepository) List(ctx context.Context, filter DealFilter, workspaceID int) (*models.DealListResponse, error) {
	if filter.Page < 1 {
		filter.Page = 1
	}
	if filter.Limit < 1 || filter.Limit > 200 {
		filter.Limit = 50
	}
	offset := (filter.Page - 1) * filter.Limit

	whereClauses := []string{"d.workspace_id = $1"}
	args := []interface{}{workspaceID}
	idx := 2

	if filter.PipelineID != nil && *filter.PipelineID > 0 {
		whereClauses = append(whereClauses, "d.pipeline_id = $"+strconv.Itoa(idx))
		args = append(args, *filter.PipelineID)
		idx++
	}

	if filter.StageID != nil && *filter.StageID > 0 {
		whereClauses = append(whereClauses, "d.stage_id = $"+strconv.Itoa(idx))
		args = append(args, *filter.StageID)
		idx++
	}

	if filter.OwnerID != nil && *filter.OwnerID > 0 {
		whereClauses = append(whereClauses, "d.owner_id = $"+strconv.Itoa(idx))
		args = append(args, *filter.OwnerID)
		idx++
	}

	if filter.Priority != "" && filter.Priority != "all" {
		whereClauses = append(whereClauses, "d.priority = $"+strconv.Itoa(idx))
		args = append(args, filter.Priority)
		idx++
	}

	if filter.Status != "" && filter.Status != "all" {
		whereClauses = append(whereClauses, "d.status = $"+strconv.Itoa(idx))
		args = append(args, filter.Status)
		idx++
	}

	if strings.TrimSpace(filter.Search) != "" {
		searchTerm := "%" + strings.TrimSpace(filter.Search) + "%"
		whereClauses = append(whereClauses, "(d.name ILIKE $"+strconv.Itoa(idx)+" OR d.deal_number ILIKE $"+strconv.Itoa(idx)+" OR d.lead_number ILIKE $"+strconv.Itoa(idx)+" OR d.requirement ILIKE $"+strconv.Itoa(idx)+" OR c.name ILIKE $"+strconv.Itoa(idx)+" OR c.company ILIKE $"+strconv.Itoa(idx)+" OR c.email ILIKE $"+strconv.Itoa(idx)+" OR c.phone ILIKE $"+strconv.Itoa(idx)+")")
		args = append(args, searchTerm)
		idx++
	}

	whereSQL := " WHERE " + strings.Join(whereClauses, " AND ")

	// Count & Total Value
	countQuery := `
		SELECT COUNT(*), COALESCE(SUM(d.value), 0.0)
		FROM deals d
		JOIN customers c ON d.customer_id = c.id
		LEFT JOIN users u ON u.id = d.owner_id
	` + whereSQL

	var total int
	var totalValue float64
	if err := r.db.Pool.QueryRow(ctx, countQuery, args...).Scan(&total, &totalValue); err != nil {
		return nil, err
	}

	selectQuery := `
		SELECT d.id, d.deal_number, d.name, d.customer_id, d.lead_number, d.pipeline_id, d.stage_id,
		       d.owner_id, d.value, d.currency, d.priority, d.expected_close_date, d.requirement,
		       d.status, d.lost_reason, d.workspace_id, d.created_by_id, d.created_at, d.updated_at,
		       c.id, c.name, c.email, c.phone, c.company,
		       p.id, p.name,
		       s.id, s.name, s.stage_order, s.probability, s.color, s.is_won, s.is_lost,
		       u.id, u.name, u.email
		FROM deals d
		JOIN customers c ON d.customer_id = c.id
		JOIN pipelines p ON d.pipeline_id = p.id
		JOIN deal_stages s ON d.stage_id = s.id
		LEFT JOIN users u ON u.id = d.owner_id
	` + whereSQL + `
		ORDER BY d.created_at DESC
		LIMIT $` + strconv.Itoa(idx) + ` OFFSET $` + strconv.Itoa(idx+1)

	args = append(args, filter.Limit, offset)

	rows, err := r.db.Pool.Query(ctx, selectQuery, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var deals []models.Deal
	for rows.Next() {
		var d models.Deal
		var cID int
		var cName string
		var cEmail, cPhone, cCompany *string
		var pID int
		var pName string
		var sID int
		var sName string
		var sOrder, sProb, wonInt, lostInt int
		var sColor string
		var uID *int
		var uName, uEmail *string

		if err := rows.Scan(
			&d.ID, &d.DealNumber, &d.Name, &d.CustomerID, &d.LeadNumber, &d.PipelineID, &d.StageID,
			&d.OwnerID, &d.Value, &d.Currency, &d.Priority, &d.ExpectedCloseDate, &d.Requirement,
			&d.Status, &d.LostReason, &d.WorkspaceID, &d.CreatedByID, &d.CreatedAt, &d.UpdatedAt,
			&cID, &cName, &cEmail, &cPhone, &cCompany,
			&pID, &pName,
			&sID, &sName, &sOrder, &sProb, &sColor, &wonInt, &lostInt,
			&uID, &uName, &uEmail,
		); err != nil {
			return nil, err
		}

		d.Customer = &models.Customer{
			ID:      cID,
			Name:    cName,
			Email:   cEmail,
			Phone:   cPhone,
			Company: cCompany,
		}
		d.Pipeline = &models.Pipeline{
			ID:   pID,
			Name: pName,
		}
		d.Stage = &models.DealStage{
			ID:          sID,
			Name:        sName,
			StageOrder:  sOrder,
			Probability: sProb,
			Color:       sColor,
			IsWon:       (wonInt == 1),
			IsLost:      (lostInt == 1),
		}
		if uID != nil && uName != nil && uEmail != nil {
			d.Owner = &models.UserSummary{ID: *uID, Name: *uName, Email: *uEmail}
		}

		deals = append(deals, d)
	}

	if deals == nil {
		deals = []models.Deal{}
	}

	pages := (total + filter.Limit - 1) / filter.Limit
	return &models.DealListResponse{
		Items:      deals,
		Total:      total,
		Page:       filter.Page,
		Limit:      filter.Limit,
		Pages:      pages,
		TotalValue: totalValue,
	}, nil
}

func (r *DealRepository) Update(ctx context.Context, id int, input models.DealUpdateInput, userID *int, workspaceID int) (*models.Deal, error) {
	current, err := r.GetByID(ctx, id, workspaceID)
	if err != nil || current == nil {
		return nil, errors.New("deal not found")
	}

	if input.Name != nil && strings.TrimSpace(*input.Name) != "" {
		current.Name = strings.TrimSpace(*input.Name)
	}
	if input.CustomerID != nil && *input.CustomerID > 0 {
		current.CustomerID = *input.CustomerID
	}
	if input.PipelineID != nil && *input.PipelineID > 0 {
		current.PipelineID = *input.PipelineID
	}
	if input.StageID != nil && *input.StageID > 0 && *input.StageID != current.StageID {
		return r.ChangeStage(ctx, id, *input.StageID, input.LostReason, userID, workspaceID)
	}
	if input.OwnerID != nil {
		current.OwnerID = input.OwnerID
	}
	if input.Value != nil {
		current.Value = *input.Value
	}
	if input.Currency != nil {
		current.Currency = *input.Currency
	}
	if input.Priority != nil {
		current.Priority = *input.Priority
	}
	if input.ExpectedCloseDate != nil {
		current.ExpectedCloseDate = input.ExpectedCloseDate
	}
	if input.Requirement != nil {
		current.Requirement = *input.Requirement
	}
	if input.Status != nil {
		current.Status = *input.Status
	}
	if input.LostReason != nil {
		current.LostReason = input.LostReason
	}

	query := `
		UPDATE deals
		SET name = $1, customer_id = $2, pipeline_id = $3, owner_id = $4,
		    value = $5, currency = $6, priority = $7, expected_close_date = $8,
		    requirement = $9, status = $10, lost_reason = $11, updated_at = NOW()
		WHERE id = $12 AND workspace_id = $13
	`
	_, err = r.db.Pool.Exec(ctx, query,
		current.Name, current.CustomerID, current.PipelineID, current.OwnerID,
		current.Value, current.Currency, current.Priority, current.ExpectedCloseDate,
		current.Requirement, current.Status, current.LostReason, id, workspaceID,
	)
	if err != nil {
		return nil, err
	}

	_ = r.CreateActivity(ctx, id, userID, "deal_updated", "Deal Updated", fmt.Sprintf("Deal %s details were updated", current.Name))
	return r.GetByID(ctx, id, workspaceID)
}

func (r *DealRepository) ChangeStage(ctx context.Context, id int, targetStageID int, lostReason *string, userID *int, workspaceID int) (*models.Deal, error) {
	current, err := r.GetByID(ctx, id, workspaceID)
	if err != nil || current == nil {
		return nil, errors.New("deal not found")
	}

	targetStage, err := r.pipeRepo.GetStageByID(ctx, targetStageID)
	if err != nil || targetStage == nil {
		return nil, errors.New("target stage not found")
	}

	oldStageName := ""
	if current.Stage != nil {
		oldStageName = current.Stage.Name
	}

	newStatus := "open"
	var reason *string = nil
	if targetStage.IsWon {
		newStatus = "won"
	} else if targetStage.IsLost {
		newStatus = "lost"
		if lostReason != nil && strings.TrimSpace(*lostReason) != "" {
			cleanReason := strings.TrimSpace(*lostReason)
			reason = &cleanReason
		} else if current.LostReason != nil {
			reason = current.LostReason
		} else {
			defReason := "No specific reason provided"
			reason = &defReason
		}
	}

	query := `
		UPDATE deals
		SET stage_id = $1, status = $2, lost_reason = $3, updated_at = NOW()
		WHERE id = $4 AND workspace_id = $5
	`
	_, err = r.db.Pool.Exec(ctx, query, targetStageID, newStatus, reason, id, workspaceID)
	if err != nil {
		return nil, err
	}

	// Create Stage Change Activity
	actTitle := fmt.Sprintf("Stage changed: %s → %s", oldStageName, targetStage.Name)
	actDesc := fmt.Sprintf("Stage moved to %s (Probability: %d%%)", targetStage.Name, targetStage.Probability)
	if newStatus == "won" {
		actTitle = fmt.Sprintf("Deal WON in stage %s! 🎉", targetStage.Name)
	} else if newStatus == "lost" {
		actTitle = fmt.Sprintf("Deal Closed Lost in stage %s", targetStage.Name)
		if reason != nil {
			actDesc += fmt.Sprintf(" Reason: %s", *reason)
		}
	}

	_ = r.CreateActivity(ctx, id, userID, "stage_change", actTitle, actDesc)

	// Reverse Sync to Lead if this Deal originated from a Lead
	if current.LeadNumber != nil && strings.TrimSpace(*current.LeadNumber) != "" {
		leadNumber := strings.TrimSpace(*current.LeadNumber)
		var newLeadStatus string
		stageNameLower := strings.ToLower(strings.TrimSpace(targetStage.Name))
		if targetStage.IsWon || stageNameLower == "won" {
			newLeadStatus = "Won"
		} else if targetStage.IsLost || stageNameLower == "lost" {
			newLeadStatus = "Lost"
		} else {
			switch stageNameLower {
			case "new opportunity":
				newLeadStatus = "New"
			case "requirement discussion":
				newLeadStatus = "Contacted"
			default:
				// "Quotation Preparation", "Quotation Sent", "Negotiation", "Quotation Accepted", "Final Amount Confirmed", etc.
				newLeadStatus = "Qualified"
			}
		}

		if newLeadStatus != "" {
			_, _ = r.db.Pool.Exec(ctx, `
				UPDATE leads 
				SET status = $1, lost_reason = $2, last_activity_at = NOW(), updated_at = NOW() 
				WHERE number = $3 AND workspace_id = $4
			`, newLeadStatus, reason, leadNumber, workspaceID)

			leadActTitle := fmt.Sprintf("Lead status synced to %s", newLeadStatus)
			leadActDesc := fmt.Sprintf("Deal %s moved to stage '%s'", current.DealNumber, targetStage.Name)
			_, _ = r.db.Pool.Exec(ctx, `
				INSERT INTO lead_activities (lead_number, user_id, activity_type, title, description, created_at)
				VALUES ($1, $2, 'stage_change', $3, $4, NOW())
			`, leadNumber, userID, leadActTitle, leadActDesc)
		}
	}

	// Auto-create Order when Deal is Won
	if (targetStage.IsWon || newStatus == "won") && r.orderRepo != nil {
		_, _ = r.orderRepo.CreateFromWonDeal(ctx, id, userID, workspaceID)
	}

	return r.GetByID(ctx, id, workspaceID)
}

func (r *DealRepository) Delete(ctx context.Context, id int, workspaceID int) error {
	_, err := r.db.Pool.Exec(ctx, "DELETE FROM deals WHERE id = $1 AND workspace_id = $2", id, workspaceID)
	return err
}

func (r *DealRepository) ListActivities(ctx context.Context, dealID int) ([]models.DealActivity, error) {
	query := `
		SELECT a.id, a.deal_id, a.user_id, a.activity_type, a.title, a.description, a.created_at,
		       u.id, u.name, u.email
		FROM deal_activities a
		LEFT JOIN users u ON a.user_id = u.id
		WHERE a.deal_id = $1
		ORDER BY a.created_at DESC
	`
	rows, err := r.db.Pool.Query(ctx, query, dealID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var activities []models.DealActivity
	for rows.Next() {
		var a models.DealActivity
		var uID *int
		var uName, uEmail *string
		if err := rows.Scan(
			&a.ID, &a.DealID, &a.UserID, &a.ActivityType, &a.Title, &a.Description, &a.CreatedAt,
			&uID, &uName, &uEmail,
		); err != nil {
			return nil, err
		}
		if uID != nil && uName != nil && uEmail != nil {
			a.User = &models.UserSummary{ID: *uID, Name: *uName, Email: *uEmail}
		}
		activities = append(activities, a)
	}

	if activities == nil {
		activities = []models.DealActivity{}
	}
	return activities, nil
}

func (r *DealRepository) CreateActivity(ctx context.Context, dealID int, userID *int, activityType, title, description string) error {
	var desc *string
	if strings.TrimSpace(description) != "" {
		desc = &description
	}
	_, err := r.db.Pool.Exec(ctx,
		`INSERT INTO deal_activities (deal_id, user_id, activity_type, title, description, created_at)
		 VALUES ($1, $2, $3, $4, $5, NOW())`,
		dealID, userID, activityType, title, desc,
	)
	return err
}

func (r *DealRepository) ListNotes(ctx context.Context, dealID int) ([]models.DealNote, error) {
	query := `
		SELECT n.id, n.deal_id, n.user_id, n.content, n.created_at,
		       u.id, u.name, u.email
		FROM deal_notes n
		LEFT JOIN users u ON n.user_id = u.id
		WHERE n.deal_id = $1
		ORDER BY n.created_at DESC
	`
	rows, err := r.db.Pool.Query(ctx, query, dealID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var notes []models.DealNote
	for rows.Next() {
		var n models.DealNote
		var uID *int
		var uName, uEmail *string
		if err := rows.Scan(
			&n.ID, &n.DealID, &n.UserID, &n.Content, &n.CreatedAt,
			&uID, &uName, &uEmail,
		); err != nil {
			return nil, err
		}
		if uID != nil && uName != nil && uEmail != nil {
			n.User = &models.UserSummary{ID: *uID, Name: *uName, Email: *uEmail}
		}
		notes = append(notes, n)
	}

	if notes == nil {
		notes = []models.DealNote{}
	}
	return notes, nil
}

func (r *DealRepository) CreateNote(ctx context.Context, dealID int, userID *int, content string) (*models.DealNote, error) {
	cleanContent := strings.TrimSpace(content)
	if cleanContent == "" {
		return nil, errors.New("note content cannot be empty")
	}

	var n models.DealNote
	query := `
		INSERT INTO deal_notes (deal_id, user_id, content, created_at)
		VALUES ($1, $2, $3, NOW())
		RETURNING id, deal_id, user_id, content, created_at
	`
	err := r.db.Pool.QueryRow(ctx, query, dealID, userID, cleanContent).Scan(
		&n.ID, &n.DealID, &n.UserID, &n.Content, &n.CreatedAt,
	)
	if err != nil {
		return nil, err
	}

	_ = r.CreateActivity(ctx, dealID, userID, "note_added", "Note Added", cleanContent)

	if userID != nil {
		var uName, uEmail string
		_ = r.db.Pool.QueryRow(ctx, "SELECT name, email FROM users WHERE id = $1", *userID).Scan(&uName, &uEmail)
		n.User = &models.UserSummary{ID: *userID, Name: uName, Email: uEmail}
	}
	return &n, nil
}

func (r *DealRepository) DeleteNote(ctx context.Context, dealID int, noteID int) error {
	_, err := r.db.Pool.Exec(ctx, "DELETE FROM deal_notes WHERE id = $1 AND deal_id = $2", noteID, dealID)
	return err
}

func (r *DealRepository) ListFollowUps(ctx context.Context, dealID int) ([]models.FollowUp, error) {
	query := `
		SELECT f.id, f.deal_id, d.name, f.user_id, f.title, f.follow_up_type,
		       f.due_date, f.completed, f.completed_at, f.notes, f.reminder_state, f.created_at,
		       u.id, u.name, u.email
		FROM follow_ups f
		JOIN deals d ON f.deal_id = d.id
		LEFT JOIN users u ON f.user_id = u.id
		WHERE f.deal_id = $1
		ORDER BY f.due_date ASC
	`
	rows, err := r.db.Pool.Query(ctx, query, dealID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var followUps []models.FollowUp
	for rows.Next() {
		var f models.FollowUp
		var completedInt int
		var uID *int
		var uName, uEmail *string

		if err := rows.Scan(
			&f.ID, &f.DealID, &f.DealName, &f.UserID, &f.Title, &f.FollowUpType,
			&f.DueDate, &completedInt, &f.CompletedAt, &f.Notes, &f.ReminderState, &f.CreatedAt,
			&uID, &uName, &uEmail,
		); err != nil {
			return nil, err
		}
		f.Completed = (completedInt == 1)
		if uID != nil && uName != nil && uEmail != nil {
			f.User = &models.UserSummary{ID: *uID, Name: *uName, Email: *uEmail}
		}
		followUps = append(followUps, f)
	}

	if followUps == nil {
		followUps = []models.FollowUp{}
	}
	return followUps, nil
}

func (r *DealRepository) CreateFollowUp(ctx context.Context, dealID int, title, followUpType string, dueDate time.Time, notes *string, userID *int) (*models.FollowUp, error) {
	cleanTitle := strings.TrimSpace(title)
	if cleanTitle == "" {
		return nil, errors.New("follow-up title is required")
	}
	if followUpType == "" {
		followUpType = "Call"
	}

	var f models.FollowUp
	var completedInt int
	query := `
		INSERT INTO follow_ups (deal_id, user_id, title, follow_up_type, due_date, completed, notes, reminder_state, created_at)
		VALUES ($1, $2, $3, $4, $5, 0, $6, 'pending', NOW())
		RETURNING id, deal_id, user_id, title, follow_up_type, due_date, completed, notes, reminder_state, created_at
	`
	err := r.db.Pool.QueryRow(ctx, query, dealID, userID, cleanTitle, followUpType, dueDate, notes).Scan(
		&f.ID, &f.DealID, &f.UserID, &f.Title, &f.FollowUpType, &f.DueDate, &completedInt, &f.Notes, &f.ReminderState, &f.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	f.Completed = (completedInt == 1)

	_ = r.CreateActivity(ctx, dealID, userID, "follow_up_scheduled", "Follow-up Scheduled", fmt.Sprintf("%s: %s (Due: %s)", followUpType, cleanTitle, dueDate.Format("Jan 02, 2006")))

	return &f, nil
}

func (r *DealRepository) ConvertLeadToDeal(ctx context.Context, leadNumber string, input models.LeadConvertInput, userID *int, workspaceID int) (*models.LeadConvertResponse, error) {
	// 1. Get the lead
	var lead models.Lead
	err := r.db.Pool.QueryRow(ctx, `
		SELECT number, name, email, phone, requirement, status, owner_id
		FROM leads WHERE number = $1 AND workspace_id = $2
	`, leadNumber, workspaceID).Scan(
		&lead.Number, &lead.Name, &lead.Email, &lead.Phone, &lead.Requirement, &lead.Status, &lead.OwnerID,
	)
	if err != nil {
		return nil, fmt.Errorf("lead '%s' not found: %w", leadNumber, err)
	}

	// 2. Find or create Customer
	custName := strings.TrimSpace(input.CustomerName)
	if custName == "" {
		custName = lead.Name
	}
	custEmail := strings.TrimSpace(input.CustomerEmail)
	if custEmail == "" {
		custEmail = lead.Email
	}
	custPhone := strings.TrimSpace(input.CustomerPhone)
	if custPhone == "" && lead.Phone != nil {
		custPhone = *lead.Phone
	}
	custCompany := strings.TrimSpace(input.CustomerCompany)

	customer, err := r.customerRepo.FindOrCreateByEmailOrPhone(ctx, custName, custEmail, custPhone, custCompany, userID, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("failed to create or find customer: %w", err)
	}

	// 3. Create Deal
	dealOwnerID := input.OwnerID
	if dealOwnerID == nil {
		dealOwnerID = lead.OwnerID
	}
	dealReq := strings.TrimSpace(input.Requirement)
	if dealReq == "" {
		dealReq = lead.Requirement
	}

	dealInput := models.DealCreateInput{
		Name:              input.DealName,
		CustomerID:        customer.ID,
		LeadNumber:        &lead.Number,
		PipelineID:        input.PipelineID,
		StageID:           input.StageID,
		OwnerID:           dealOwnerID,
		Value:             input.DealValue,
		Priority:          input.Priority,
		ExpectedCloseDate: input.ExpectedCloseDate,
		Requirement:       dealReq,
	}

	deal, err := r.Create(ctx, dealInput, userID, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("failed to create deal: %w", err)
	}

	// 4. Update Lead status to 'Converted'
	_, _ = r.db.Pool.Exec(ctx,
		"UPDATE leads SET status = 'Converted', last_activity_at = NOW(), updated_at = NOW() WHERE number = $1",
		lead.Number,
	)

	// 5. Copy lead notes to deal notes
	noteRows, err := r.db.Pool.Query(ctx, "SELECT user_id, content FROM lead_notes WHERE lead_number = $1 ORDER BY created_at ASC", lead.Number)
	if err == nil {
		defer noteRows.Close()
		for noteRows.Next() {
			var nUserID *int
			var nContent string
			if err := noteRows.Scan(&nUserID, &nContent); err == nil {
				_, _ = r.CreateNote(ctx, deal.ID, nUserID, fmt.Sprintf("[From Lead Note] %s", nContent))
			}
		}
	}

	// 6. Record Activity on Lead
	_, _ = r.db.Pool.Exec(ctx, `
		INSERT INTO lead_activities (lead_number, user_id, activity_type, title, description, created_at)
		VALUES ($1, $2, 'converted_to_deal', 'Converted to Deal', $3, NOW())
	`, lead.Number, userID, fmt.Sprintf("Lead converted to Deal %s (%s)", deal.DealNumber, deal.Name))

	// 7. Record Activity on Deal
	_ = r.CreateActivity(ctx, deal.ID, userID, "lead_converted", "Converted from Lead", fmt.Sprintf("Deal generated from Lead %s (%s)", lead.Number, lead.Name))

	return &models.LeadConvertResponse{
		Success:    true,
		Customer:   *customer,
		Deal:       *deal,
		LeadNumber: lead.Number,
	}, nil
}
