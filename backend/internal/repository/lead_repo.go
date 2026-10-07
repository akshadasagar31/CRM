package repository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"crm-backend-go/internal/database"
	"crm-backend-go/internal/models"
	"crm-backend-go/internal/utils"

	"github.com/jackc/pgx/v5"
)

type LeadRepository struct {
	db              *database.DB
	interactionRepo *InteractionRepository
	metadataRepo    *MetadataRepository
}

func NewLeadRepository(db *database.DB, iRepo *InteractionRepository, mRepo *MetadataRepository) *LeadRepository {
	return &LeadRepository{
		db:              db,
		interactionRepo: iRepo,
		metadataRepo:    mRepo,
	}
}

// ConflictError represents a 409 conflict
type ConflictError struct {
	Message string
}

func (e *ConflictError) Error() string {
	return e.Message
}

func (r *LeadRepository) CheckDuplicates(ctx context.Context, number, phone, email, excludeNumber string) error {
	settings, err := r.metadataRepo.GetDuplicateSettings(ctx)
	if err != nil || settings == nil || settings.Action != "prevent" {
		return nil
	}

	cleanNumber := strings.TrimSpace(number)
	// Check primary number
	var numCount int
	var existingName string
	numQuery := "SELECT COUNT(*), COALESCE(MAX(name), '') FROM leads WHERE number = $1"
	if excludeNumber != "" {
		numQuery += " AND number != '" + excludeNumber + "'"
	}
	_ = r.db.Pool.QueryRow(ctx, numQuery, cleanNumber).Scan(&numCount, &existingName)
	if numCount > 0 {
		return &ConflictError{Message: fmt.Sprintf("This number '%s' already exists.", cleanNumber)}
	}

	// Check phone
	normPhone := utils.NormalizePhone(phone)
	if normPhone == "" {
		normPhone = utils.NormalizePhone(cleanNumber)
	}
	if settings.CheckPhone && normPhone != "" {
		pQuery := "SELECT name FROM leads WHERE (phone = $1 OR number = $1) AND deleted_at IS NULL"
		if excludeNumber != "" {
			pQuery += " AND number != '" + excludeNumber + "'"
		}
		pQuery += " LIMIT 1"
		var pName string
		err := r.db.Pool.QueryRow(ctx, pQuery, normPhone).Scan(&pName)
		if err == nil {
			return &ConflictError{Message: fmt.Sprintf("A lead with phone '%s' already exists (%s).", phone, pName)}
		}
	}

	// Check email
	normEmail := strings.ToLower(strings.TrimSpace(email))
	if settings.CheckEmail && normEmail != "" {
		eQuery := "SELECT name FROM leads WHERE LOWER(email) = $1 AND deleted_at IS NULL"
		if excludeNumber != "" {
			eQuery += " AND number != '" + excludeNumber + "'"
		}
		eQuery += " LIMIT 1"
		var eName string
		err := r.db.Pool.QueryRow(ctx, eQuery, normEmail).Scan(&eName)
		if err == nil {
			return &ConflictError{Message: fmt.Sprintf("A lead with email '%s' already exists (%s).", normEmail, eName)}
		}
	}

	return nil
}

func (r *LeadRepository) SaveCustomFields(ctx context.Context, leadNumber string, customFields map[string]interface{}) error {
	if len(customFields) == 0 {
		return nil
	}

	definitions, err := r.metadataRepo.ListCustomFields(ctx)
	if err != nil {
		return err
	}
	defMap := make(map[string]models.CustomFieldDefinitionResponse)
	for _, d := range definitions {
		defMap[d.FieldKey] = d
	}

	for key, val := range customFields {
		def, ok := defMap[key]
		if !ok {
			continue
		}

		var strVal *string
		if val != nil {
			switch v := val.(type) {
			case string:
				strVal = &v
			case []interface{}, map[string]interface{}, bool:
				b, _ := json.Marshal(v)
				s := string(b)
				strVal = &s
			default:
				s := fmt.Sprintf("%v", v)
				strVal = &s
			}
		}

		query := `
			INSERT INTO lead_custom_field_values (lead_number, custom_field_id, value, created_at, updated_at)
			VALUES ($1, $2, $3, NOW(), NOW())
			ON CONFLICT (id) DO NOTHING
		`
		// Check if exists
		var existingID int
		err := r.db.Pool.QueryRow(ctx, "SELECT id FROM lead_custom_field_values WHERE lead_number = $1 AND custom_field_id = $2", leadNumber, def.ID).Scan(&existingID)
		if err == nil {
			_, _ = r.db.Pool.Exec(ctx, "UPDATE lead_custom_field_values SET value = $1, updated_at = NOW() WHERE id = $2", strVal, existingID)
		} else {
			_, _ = r.db.Pool.Exec(ctx, query, leadNumber, def.ID, strVal)
		}
	}

	return nil
}

func (r *LeadRepository) FormatLeadResponse(ctx context.Context, lead *models.Lead) (*models.LeadResponse, error) {
	tagsList := []string{}
	if lead.Tags != "" {
		_ = json.Unmarshal([]byte(lead.Tags), &tagsList)
	}

	var notesCount int
	_ = r.db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM lead_notes WHERE lead_number = $1", lead.Number).Scan(&notesCount)

	var ownerSummary *models.UserSummary
	if lead.OwnerID != nil {
		var u models.UserSummary
		if err := r.db.Pool.QueryRow(ctx, "SELECT id, name, email FROM users WHERE id = $1", *lead.OwnerID).Scan(&u.ID, &u.Name, &u.Email); err == nil {
			ownerSummary = &u
		}
	}

	var creatorSummary *models.UserSummary
	if lead.CreatedByID != nil {
		var u models.UserSummary
		if err := r.db.Pool.QueryRow(ctx, "SELECT id, name, email FROM users WHERE id = $1", *lead.CreatedByID).Scan(&u.ID, &u.Name, &u.Email); err == nil {
			creatorSummary = &u
		}
	}

	// Fetch custom field values
	cfMap := make(map[string]interface{})
	cfDetails := []models.CustomFieldValueItem{}

	cfQuery := `
		SELECT d.field_key, d.field_label, d.field_type, v.value
		FROM lead_custom_field_values v
		JOIN custom_field_definitions d ON v.custom_field_id = d.id
		WHERE v.lead_number = $1
	`
	rows, err := r.db.Pool.Query(ctx, cfQuery, lead.Number)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var k, l, t string
			var val *string
			if err := rows.Scan(&k, &l, &t, &val); err == nil {
				var parsedVal interface{}
				if val != nil {
					parsedVal = *val
					if t == "Multi-select" || t == "Checkbox" {
						var jsonParsed interface{}
						if err := json.Unmarshal([]byte(*val), &jsonParsed); err == nil {
							parsedVal = jsonParsed
						}
					}
				}
				cfMap[k] = parsedVal
				cfDetails = append(cfDetails, models.CustomFieldValueItem{
					FieldKey:   k,
					FieldLabel: l,
					FieldType:  t,
					Value:      parsedVal,
				})
			}
		}
	}

	leadAge := 0
	if !lead.CreatedAt.IsZero() {
		leadAge = int(time.Since(lead.CreatedAt).Hours() / 24)
		if leadAge < 0 {
			leadAge = 0
		}
	}

	return &models.LeadResponse{
		Number:             lead.Number,
		Name:               lead.Name,
		Email:              lead.Email,
		Phone:              lead.Phone,
		Requirement:        lead.Requirement,
		Source:             lead.Source,
		City:               lead.City,
		Status:             lead.Status,
		OwnerID:            lead.OwnerID,
		Owner:              ownerSummary,
		Score:              lead.Score,
		LostReason:         lead.LostReason,
		Tags:               tagsList,
		FollowUpDate:       lead.FollowUpDate,
		FollowUpType:       lead.FollowUpType,
		FollowUpNotes:      lead.FollowUpNotes,
		FollowUpCompleted:  lead.FollowUpCompleted == 1,
		NotesCount:         notesCount,
		CreatedByID:        lead.CreatedByID,
		Creator:            creatorSummary,
		LastActivityAt:     lead.LastActivityAt,
		DeletedAt:          lead.DeletedAt,
		LeadAgeDays:        leadAge,
		CustomFields:       cfMap,
		CustomFieldDetails: cfDetails,
		CreatedAt:          lead.CreatedAt,
		UpdatedAt:          lead.UpdatedAt,
	}, nil
}

type CreateLeadInput struct {
	Number            string                 `json:"number"`
	Name              string                 `json:"name"`
	Email             string                 `json:"email"`
	Phone             *string                `json:"phone"`
	Requirement       string                 `json:"requirement"`
	Source            string                 `json:"source"`
	City              string                 `json:"city"`
	Status            string                 `json:"status"`
	OwnerID           *int                   `json:"owner_id"`
	Score             *int                   `json:"score"`
	LostReason        *string                `json:"lost_reason"`
	Tags              []string               `json:"tags"`
	FollowUpDate      *time.Time             `json:"follow_up_date"`
	FollowUpType      *string                `json:"follow_up_type"`
	FollowUpNotes     *string                `json:"follow_up_notes"`
	FollowUpCompleted *bool                  `json:"follow_up_completed"`
	CustomFields      map[string]interface{} `json:"custom_fields"`
}

func (r *LeadRepository) Create(ctx context.Context, in CreateLeadInput, currentUserID int) (*models.LeadResponse, error) {
	cleanNumber := strings.TrimSpace(in.Number)
	phoneVal := ""
	if in.Phone != nil {
		phoneVal = *in.Phone
	} else {
		phoneVal = cleanNumber
	}
	normPhone := utils.NormalizePhone(phoneVal)
	cleanEmail := strings.ToLower(strings.TrimSpace(in.Email))

	if err := r.CheckDuplicates(ctx, cleanNumber, normPhone, cleanEmail, ""); err != nil {
		return nil, err
	}

	tagsJSON, _ := json.Marshal(in.Tags)
	if in.Tags == nil {
		tagsJSON = []byte("[]")
	}

	scoreVal := 50
	if in.Score != nil {
		scoreVal = *in.Score
	}

	statusVal := strings.TrimSpace(in.Status)
	if statusVal == "" {
		statusVal = "New"
	}

	sourceVal := strings.TrimSpace(in.Source)
	if sourceVal == "" {
		sourceVal = "Website"
	}

	ownerIDVal := in.OwnerID
	if ownerIDVal == nil {
		ownerIDVal = &currentUserID
	}

	compInt := 0
	if in.FollowUpCompleted != nil && *in.FollowUpCompleted {
		compInt = 1
	}

	var lead models.Lead
	lead.Number = cleanNumber
	lead.Name = strings.TrimSpace(in.Name)
	lead.Email = cleanEmail
	lead.Phone = &normPhone
	lead.Requirement = strings.TrimSpace(in.Requirement)
	lead.Source = sourceVal
	lead.City = strings.TrimSpace(in.City)
	lead.Status = statusVal
	lead.OwnerID = ownerIDVal
	lead.Score = scoreVal
	lead.LostReason = in.LostReason
	lead.Tags = string(tagsJSON)
	lead.FollowUpDate = in.FollowUpDate
	lead.FollowUpType = in.FollowUpType
	lead.FollowUpNotes = in.FollowUpNotes
	lead.FollowUpCompleted = compInt
	lead.WorkspaceID = 1
	lead.CreatedByID = &currentUserID

	query := `
		INSERT INTO leads (
			number, name, email, phone, requirement, source, city, status,
			owner_id, score, lost_reason, tags, follow_up_date, follow_up_type,
			follow_up_notes, follow_up_completed, workspace_id, created_by_id,
			last_activity_at, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8,
			$9, $10, $11, $12, $13, $14,
			$15, $16, 1, $17,
			NOW(), NOW(), NOW()
		) RETURNING created_at, updated_at, last_activity_at
	`
	err := r.db.Pool.QueryRow(ctx, query,
		lead.Number, lead.Name, lead.Email, lead.Phone, lead.Requirement, lead.Source, lead.City, lead.Status,
		lead.OwnerID, lead.Score, lead.LostReason, lead.Tags, lead.FollowUpDate, lead.FollowUpType,
		lead.FollowUpNotes, lead.FollowUpCompleted, lead.CreatedByID,
	).Scan(&lead.CreatedAt, &lead.UpdatedAt, &lead.LastActivityAt)
	if err != nil {
		return nil, err
	}

	if len(in.CustomFields) > 0 {
		_ = r.SaveCustomFields(ctx, lead.Number, in.CustomFields)
	}

	if in.FollowUpDate != nil {
		fType := "Call"
		if in.FollowUpType != nil && *in.FollowUpType != "" {
			fType = *in.FollowUpType
		}
		_, _ = r.interactionRepo.CreateFollowUp(ctx, lead.Number, lead.OwnerID, "Initial Follow-up", fType, *in.FollowUpDate, in.FollowUpNotes)
	}

	_ = r.interactionRepo.LogActivity(ctx, lead.Number, &currentUserID, "lead_created", "Lead created", nil)

	return r.FormatLeadResponse(ctx, &lead)
}

func (r *LeadRepository) GetByNumber(ctx context.Context, number string) (*models.LeadResponse, error) {
	var lead models.Lead
	query := `
		SELECT number, name, email, phone, requirement, source, city, status,
		       owner_id, score, lost_reason, tags, follow_up_date, follow_up_type,
		       follow_up_notes, follow_up_completed, last_activity_at, deleted_at,
		       workspace_id, created_by_id, created_at, updated_at
		FROM leads
		WHERE number = $1
	`
	err := r.db.Pool.QueryRow(ctx, query, number).Scan(
		&lead.Number, &lead.Name, &lead.Email, &lead.Phone, &lead.Requirement, &lead.Source, &lead.City, &lead.Status,
		&lead.OwnerID, &lead.Score, &lead.LostReason, &lead.Tags, &lead.FollowUpDate, &lead.FollowUpType,
		&lead.FollowUpNotes, &lead.FollowUpCompleted, &lead.LastActivityAt, &lead.DeletedAt,
		&lead.WorkspaceID, &lead.CreatedByID, &lead.CreatedAt, &lead.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	return r.FormatLeadResponse(ctx, &lead)
}

type ListFilter struct {
	View          string
	Search        string
	Status        string
	Source        string
	OwnerID       *int
	Tag           string
	FollowUpState string
	Page          int
	Limit         int
	SortBy        string
	SortDir       string
	CurrentUserID int
}

func (r *LeadRepository) List(ctx context.Context, f ListFilter) (*models.LeadListResponse, error) {
	if f.Page <= 0 {
		f.Page = 1
	}
	if f.Limit <= 0 || f.Limit > 200 {
		f.Limit = 20
	}

	whereClauses := []string{"workspace_id = 1"}
	args := []interface{}{}
	argIdx := 1

	view := strings.ToLower(strings.TrimSpace(f.View))
	if view == "trash" {
		whereClauses = append(whereClauses, "deleted_at IS NOT NULL")
	} else {
		whereClauses = append(whereClauses, "deleted_at IS NULL")
		switch view {
		case "my", "my_leads":
			whereClauses = append(whereClauses, fmt.Sprintf("owner_id = $%d", argIdx))
			args = append(args, f.CurrentUserID)
			argIdx++
		case "unassigned":
			whereClauses = append(whereClauses, "owner_id IS NULL")
		case "hot", "hot_leads":
			whereClauses = append(whereClauses, `(score >= 70 OR tags ILIKE '%"Hot"%' OR tags ILIKE '%"Hot Lead"%')`)
		case "today":
			whereClauses = append(whereClauses, "follow_up_date::date = CURRENT_DATE AND follow_up_completed = 0")
		case "overdue":
			whereClauses = append(whereClauses, "follow_up_date < NOW() AND follow_up_completed = 0")
		}
	}

	if f.Status != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, f.Status)
		argIdx++
	}

	if f.Source != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("source = $%d", argIdx))
		args = append(args, f.Source)
		argIdx++
	}

	if f.OwnerID != nil {
		whereClauses = append(whereClauses, fmt.Sprintf("owner_id = $%d", argIdx))
		args = append(args, *f.OwnerID)
		argIdx++
	}

	if f.Tag != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("tags ILIKE $%d", argIdx))
		args = append(args, "%\""+f.Tag+"\"%")
		argIdx++
	}

	if f.Search != "" {
		searchPattern := "%" + strings.ToLower(f.Search) + "%"
		clause := fmt.Sprintf(`(
			LOWER(name) LIKE $%d OR
			LOWER(email) LIKE $%d OR
			LOWER(number) LIKE $%d OR
			LOWER(COALESCE(phone, '')) LIKE $%d OR
			LOWER(requirement) LIKE $%d OR
			LOWER(city) LIKE $%d OR
			LOWER(tags) LIKE $%d OR
			number IN (SELECT lead_number FROM lead_custom_field_values WHERE LOWER(COALESCE(value, '')) LIKE $%d)
		)`, argIdx, argIdx, argIdx, argIdx, argIdx, argIdx, argIdx, argIdx)
		whereClauses = append(whereClauses, clause)
		args = append(args, searchPattern)
		argIdx++
	}

	whereSQL := strings.Join(whereClauses, " AND ")

	// Count total
	countQuery := "SELECT COUNT(*) FROM leads WHERE " + whereSQL
	var total int
	err := r.db.Pool.QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, err
	}

	// Order by
	sortField := "created_at"
	switch f.SortBy {
	case "name", "email", "status", "source", "city", "score", "follow_up_date", "last_activity_at", "created_at":
		sortField = f.SortBy
	}
	sortOrder := "DESC"
	if strings.ToUpper(f.SortDir) == "ASC" {
		sortOrder = "ASC"
	}

	offset := (f.Page - 1) * f.Limit
	selectQuery := fmt.Sprintf(`
		SELECT number, name, email, phone, requirement, source, city, status,
		       owner_id, score, lost_reason, tags, follow_up_date, follow_up_type,
		       follow_up_notes, follow_up_completed, last_activity_at, deleted_at,
		       workspace_id, created_by_id, created_at, updated_at
		FROM leads
		WHERE %s
		ORDER BY %s %s
		LIMIT %d OFFSET %d
	`, whereSQL, sortField, sortOrder, f.Limit, offset)

	rows, err := r.db.Pool.Query(ctx, selectQuery, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []models.LeadResponse{}
	for rows.Next() {
		var lead models.Lead
		err := rows.Scan(
			&lead.Number, &lead.Name, &lead.Email, &lead.Phone, &lead.Requirement, &lead.Source, &lead.City, &lead.Status,
			&lead.OwnerID, &lead.Score, &lead.LostReason, &lead.Tags, &lead.FollowUpDate, &lead.FollowUpType,
			&lead.FollowUpNotes, &lead.FollowUpCompleted, &lead.LastActivityAt, &lead.DeletedAt,
			&lead.WorkspaceID, &lead.CreatedByID, &lead.CreatedAt, &lead.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		item, err := r.FormatLeadResponse(ctx, &lead)
		if err == nil && item != nil {
			items = append(items, *item)
		}
	}

	// Calculate view counts
	viewCounts := make(map[string]int)
	var cAll, cMy, cUnassigned, cHot, cToday, cOverdue, cTrash int
	_ = r.db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM leads WHERE workspace_id = 1 AND deleted_at IS NULL").Scan(&cAll)
	_ = r.db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM leads WHERE workspace_id = 1 AND deleted_at IS NULL AND owner_id = $1", f.CurrentUserID).Scan(&cMy)
	_ = r.db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM leads WHERE workspace_id = 1 AND deleted_at IS NULL AND owner_id IS NULL").Scan(&cUnassigned)
	_ = r.db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM leads WHERE workspace_id = 1 AND deleted_at IS NULL AND (score >= 70 OR tags ILIKE '%"Hot"%' OR tags ILIKE '%"Hot Lead"%')`).Scan(&cHot)
	_ = r.db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM leads WHERE workspace_id = 1 AND deleted_at IS NULL AND follow_up_date::date = CURRENT_DATE AND follow_up_completed = 0").Scan(&cToday)
	_ = r.db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM leads WHERE workspace_id = 1 AND deleted_at IS NULL AND follow_up_date < NOW() AND follow_up_completed = 0").Scan(&cOverdue)
	_ = r.db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM leads WHERE workspace_id = 1 AND deleted_at IS NOT NULL").Scan(&cTrash)

	viewCounts["all"] = cAll
	viewCounts["my"] = cMy
	viewCounts["my_leads"] = cMy
	viewCounts["unassigned"] = cUnassigned
	viewCounts["hot"] = cHot
	viewCounts["hot_leads"] = cHot
	viewCounts["today"] = cToday
	viewCounts["overdue"] = cOverdue
	viewCounts["trash"] = cTrash

	pages := (total + f.Limit - 1) / f.Limit

	return &models.LeadListResponse{
		Items:      items,
		Total:      total,
		Page:       f.Page,
		Limit:      f.Limit,
		Pages:      pages,
		ViewCounts: viewCounts,
	}, nil
}

type UpdateLeadInput struct {
	Name              *string                `json:"name"`
	Email             *string                `json:"email"`
	Phone             *string                `json:"phone"`
	Requirement       *string                `json:"requirement"`
	Source            *string                `json:"source"`
	City              *string                `json:"city"`
	Status            *string                `json:"status"`
	OwnerID           *int                   `json:"owner_id"`
	Score             *int                   `json:"score"`
	LostReason        *string                `json:"lost_reason"`
	Tags              []string               `json:"tags"`
	FollowUpDate      *time.Time             `json:"follow_up_date"`
	FollowUpType      *string                `json:"follow_up_type"`
	FollowUpNotes     *string                `json:"follow_up_notes"`
	FollowUpCompleted *bool                  `json:"follow_up_completed"`
	CustomFields      map[string]interface{} `json:"custom_fields"`
}

func (r *LeadRepository) Update(ctx context.Context, number string, in UpdateLeadInput, currentUserID int) (*models.LeadResponse, error) {
	var lead models.Lead
	err := r.db.Pool.QueryRow(ctx, `
		SELECT number, name, email, phone, requirement, source, city, status,
		       owner_id, score, lost_reason, tags, follow_up_date, follow_up_type,
		       follow_up_notes, follow_up_completed, last_activity_at, deleted_at,
		       workspace_id, created_by_id, created_at, updated_at
		FROM leads WHERE number = $1
	`, number).Scan(
		&lead.Number, &lead.Name, &lead.Email, &lead.Phone, &lead.Requirement, &lead.Source, &lead.City, &lead.Status,
		&lead.OwnerID, &lead.Score, &lead.LostReason, &lead.Tags, &lead.FollowUpDate, &lead.FollowUpType,
		&lead.FollowUpNotes, &lead.FollowUpCompleted, &lead.LastActivityAt, &lead.DeletedAt,
		&lead.WorkspaceID, &lead.CreatedByID, &lead.CreatedAt, &lead.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("lead not found")
		}
		return nil, err
	}

	// Duplicate check if phone or email is updating
	checkPhone := ""
	if in.Phone != nil {
		checkPhone = *in.Phone
	}
	checkEmail := ""
	if in.Email != nil {
		checkEmail = *in.Email
	}
	if checkPhone != "" || checkEmail != "" {
		if err := r.CheckDuplicates(ctx, number, checkPhone, checkEmail, number); err != nil {
			return nil, err
		}
	}

	oldStatus := lead.Status
	oldOwner := lead.OwnerID

	if in.Name != nil {
		lead.Name = strings.TrimSpace(*in.Name)
	}
	if in.Email != nil {
		lead.Email = strings.ToLower(strings.TrimSpace(*in.Email))
	}
	if in.Phone != nil {
		p := utils.NormalizePhone(*in.Phone)
		lead.Phone = &p
	}
	if in.Requirement != nil {
		lead.Requirement = strings.TrimSpace(*in.Requirement)
	}
	if in.Source != nil {
		lead.Source = strings.TrimSpace(*in.Source)
	}
	if in.City != nil {
		lead.City = strings.TrimSpace(*in.City)
	}
	if in.Status != nil {
		lead.Status = strings.TrimSpace(*in.Status)
	}
	if in.OwnerID != nil {
		lead.OwnerID = in.OwnerID
	}
	if in.Score != nil {
		lead.Score = *in.Score
	}
	if in.LostReason != nil {
		lead.LostReason = in.LostReason
	}
	if in.Tags != nil {
		b, _ := json.Marshal(in.Tags)
		lead.Tags = string(b)
	}
	if in.FollowUpDate != nil {
		lead.FollowUpDate = in.FollowUpDate
	}
	if in.FollowUpType != nil {
		lead.FollowUpType = in.FollowUpType
	}
	if in.FollowUpNotes != nil {
		lead.FollowUpNotes = in.FollowUpNotes
	}
	if in.FollowUpCompleted != nil {
		if *in.FollowUpCompleted {
			lead.FollowUpCompleted = 1
		} else {
			lead.FollowUpCompleted = 0
		}
	}

	updateQuery := `
		UPDATE leads
		SET name = $1, email = $2, phone = $3, requirement = $4, source = $5, city = $6, status = $7,
		    owner_id = $8, score = $9, lost_reason = $10, tags = $11, follow_up_date = $12, follow_up_type = $13,
		    follow_up_notes = $14, follow_up_completed = $15, last_activity_at = NOW(), updated_at = NOW()
		WHERE number = $16
		RETURNING updated_at, last_activity_at
	`
	err = r.db.Pool.QueryRow(ctx, updateQuery,
		lead.Name, lead.Email, lead.Phone, lead.Requirement, lead.Source, lead.City, lead.Status,
		lead.OwnerID, lead.Score, lead.LostReason, lead.Tags, lead.FollowUpDate, lead.FollowUpType,
		lead.FollowUpNotes, lead.FollowUpCompleted, number,
	).Scan(&lead.UpdatedAt, &lead.LastActivityAt)
	if err != nil {
		return nil, err
	}

	if in.CustomFields != nil {
		_ = r.SaveCustomFields(ctx, number, in.CustomFields)
	}

	// Status change activity
	if in.Status != nil && *in.Status != oldStatus {
		desc := fmt.Sprintf("Status changed from %s to %s", oldStatus, *in.Status)
		_ = r.interactionRepo.LogActivity(ctx, number, &currentUserID, "status_change", "Status updated", &desc)
	}

	// Owner assignment activity
	if in.OwnerID != nil && (oldOwner == nil || *in.OwnerID != *oldOwner) {
		desc := "Owner reassigned"
		_ = r.interactionRepo.LogActivity(ctx, number, &currentUserID, "owner_assigned", "Owner reassigned", &desc)
	}

	_ = r.interactionRepo.LogActivity(ctx, number, &currentUserID, "lead_updated", "Lead details updated", nil)

	return r.FormatLeadResponse(ctx, &lead)
}

func (r *LeadRepository) Delete(ctx context.Context, number string, permanent bool, currentUserID int) error {
	if permanent {
		cmd, err := r.db.Pool.Exec(ctx, "DELETE FROM leads WHERE number = $1", number)
		if err != nil {
			return err
		}
		if cmd.RowsAffected() == 0 {
			return errors.New("lead not found")
		}
		return nil
	}

	cmd, err := r.db.Pool.Exec(ctx, "UPDATE leads SET deleted_at = NOW(), last_activity_at = NOW() WHERE number = $1", number)
	if err != nil {
		return err
	}
	if cmd.RowsAffected() == 0 {
		return errors.New("lead not found")
	}

	_ = r.interactionRepo.LogActivity(ctx, number, &currentUserID, "lead_deleted", "Lead moved to trash", nil)
	return nil
}

func (r *LeadRepository) Restore(ctx context.Context, number string, currentUserID int) error {
	cmd, err := r.db.Pool.Exec(ctx, "UPDATE leads SET deleted_at = NULL, last_activity_at = NOW() WHERE number = $1", number)
	if err != nil {
		return err
	}
	if cmd.RowsAffected() == 0 {
		return errors.New("lead not found")
	}

	_ = r.interactionRepo.LogActivity(ctx, number, &currentUserID, "lead_restored", "Lead restored from trash", nil)
	return nil
}

func (r *LeadRepository) BulkAction(ctx context.Context, numbers []string, action string, status *string, ownerID *int, tags []string, lostReason *string, currentUserID int) (int, error) {
	if len(numbers) == 0 {
		return 0, nil
	}

	affected := 0
	switch action {
	case "update_status":
		if status == nil {
			return 0, errors.New("status is required for update_status")
		}
		for _, num := range numbers {
			cmd, err := r.db.Pool.Exec(ctx, `
				UPDATE leads
				SET status = $1, lost_reason = $2, last_activity_at = NOW(), updated_at = NOW()
				WHERE number = $3
			`, *status, lostReason, num)
			if err == nil && cmd.RowsAffected() > 0 {
				affected++
				desc := "Bulk status updated to " + *status
				_ = r.interactionRepo.LogActivity(ctx, num, &currentUserID, "status_change", "Bulk status update", &desc)
			}
		}

	case "assign_owner":
		for _, num := range numbers {
			cmd, err := r.db.Pool.Exec(ctx, `
				UPDATE leads
				SET owner_id = $1, last_activity_at = NOW(), updated_at = NOW()
				WHERE number = $2
			`, ownerID, num)
			if err == nil && cmd.RowsAffected() > 0 {
				affected++
				_ = r.interactionRepo.LogActivity(ctx, num, &currentUserID, "owner_assigned", "Bulk owner reassigned", nil)
			}
		}

	case "add_tags":
		if len(tags) == 0 {
			return 0, nil
		}
		for _, num := range numbers {
			var currentTagsStr string
			_ = r.db.Pool.QueryRow(ctx, "SELECT tags FROM leads WHERE number = $1", num).Scan(&currentTagsStr)
			tagList := []string{}
			_ = json.Unmarshal([]byte(currentTagsStr), &tagList)
			tagMap := make(map[string]bool)
			for _, t := range tagList {
				tagMap[t] = true
			}
			for _, t := range tags {
				tagMap[t] = true
			}
			merged := []string{}
			for t := range tagMap {
				merged = append(merged, t)
			}
			mergedJSON, _ := json.Marshal(merged)
			cmd, err := r.db.Pool.Exec(ctx, "UPDATE leads SET tags = $1, last_activity_at = NOW() WHERE number = $2", string(mergedJSON), num)
			if err == nil && cmd.RowsAffected() > 0 {
				affected++
			}
		}

	case "remove_tags":
		if len(tags) == 0 {
			return 0, nil
		}
		removeMap := make(map[string]bool)
		for _, t := range tags {
			removeMap[t] = true
		}
		for _, num := range numbers {
			var currentTagsStr string
			_ = r.db.Pool.QueryRow(ctx, "SELECT tags FROM leads WHERE number = $1", num).Scan(&currentTagsStr)
			tagList := []string{}
			_ = json.Unmarshal([]byte(currentTagsStr), &tagList)
			filtered := []string{}
			for _, t := range tagList {
				if !removeMap[t] {
					filtered = append(filtered, t)
				}
			}
			filteredJSON, _ := json.Marshal(filtered)
			cmd, err := r.db.Pool.Exec(ctx, "UPDATE leads SET tags = $1, last_activity_at = NOW() WHERE number = $2", string(filteredJSON), num)
			if err == nil && cmd.RowsAffected() > 0 {
				affected++
			}
		}

	case "soft_delete":
		for _, num := range numbers {
			cmd, err := r.db.Pool.Exec(ctx, "UPDATE leads SET deleted_at = NOW(), last_activity_at = NOW() WHERE number = $1", num)
			if err == nil && cmd.RowsAffected() > 0 {
				affected++
				_ = r.interactionRepo.LogActivity(ctx, num, &currentUserID, "lead_deleted", "Lead soft-deleted (bulk)", nil)
			}
		}

	case "restore":
		for _, num := range numbers {
			cmd, err := r.db.Pool.Exec(ctx, "UPDATE leads SET deleted_at = NULL, last_activity_at = NOW() WHERE number = $1", num)
			if err == nil && cmd.RowsAffected() > 0 {
				affected++
				_ = r.interactionRepo.LogActivity(ctx, num, &currentUserID, "lead_restored", "Lead restored (bulk)", nil)
			}
		}

	case "delete_permanent":
		for _, num := range numbers {
			cmd, err := r.db.Pool.Exec(ctx, "DELETE FROM leads WHERE number = $1", num)
			if err == nil && cmd.RowsAffected() > 0 {
				affected++
			}
		}
	}

	return affected, nil
}
