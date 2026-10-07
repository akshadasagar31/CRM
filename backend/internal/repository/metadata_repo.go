package repository

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	"crm-backend-go/internal/database"
	"crm-backend-go/internal/models"

	"github.com/jackc/pgx/v5"
)

type MetadataRepository struct {
	db *database.DB
}

func NewMetadataRepository(db *database.DB) *MetadataRepository {
	return &MetadataRepository{db: db}
}

// --- Custom Fields ---

func (r *MetadataRepository) ListCustomFields(ctx context.Context) ([]models.CustomFieldDefinitionResponse, error) {
	query := `
		SELECT id, field_key, field_label, field_type, options, required, visibility, field_order, section, workspace_id, created_at
		FROM custom_field_definitions
		WHERE workspace_id = 1
		ORDER BY field_order ASC, id ASC
	`
	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.CustomFieldDefinitionResponse
	for rows.Next() {
		var cf models.CustomFieldDefinitionResponse
		var optStr string
		var reqInt, visInt int

		err := rows.Scan(
			&cf.ID, &cf.FieldKey, &cf.FieldLabel, &cf.FieldType, &optStr,
			&reqInt, &visInt, &cf.FieldOrder, &cf.Section, &cf.WorkspaceID, &cf.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		cf.Required = reqInt == 1
		cf.Visibility = visInt == 1
		cf.Options = []string{}
		_ = json.Unmarshal([]byte(optStr), &cf.Options)

		list = append(list, cf)
	}
	if list == nil {
		list = []models.CustomFieldDefinitionResponse{}
	}
	return list, nil
}

func (r *MetadataRepository) CreateCustomField(ctx context.Context, key, label, fType string, options []string, req, vis bool, order int, section string) (*models.CustomFieldDefinitionResponse, error) {
	cleanKey := strings.ToLower(strings.TrimSpace(key))
	var exists int
	_ = r.db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM custom_field_definitions WHERE field_key = $1 AND workspace_id = 1", cleanKey).Scan(&exists)
	if exists > 0 {
		return nil, errors.New("custom field with this key already exists")
	}

	optJSON, _ := json.Marshal(options)
	reqInt := 0
	if req {
		reqInt = 1
	}
	visInt := 0
	if vis {
		visInt = 1
	}
	if section == "" {
		section = "Custom Details"
	}

	query := `
		INSERT INTO custom_field_definitions (field_key, field_label, field_type, options, required, visibility, field_order, section, workspace_id, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, NOW())
		RETURNING id, field_key, field_label, field_type, options, required, visibility, field_order, section, workspace_id, created_at
	`
	var res models.CustomFieldDefinitionResponse
	var optStr string
	var retReq, retVis int

	err := r.db.Pool.QueryRow(ctx, query, cleanKey, label, fType, string(optJSON), reqInt, visInt, order, section).Scan(
		&res.ID, &res.FieldKey, &res.FieldLabel, &res.FieldType, &optStr,
		&retReq, &retVis, &res.FieldOrder, &res.Section, &res.WorkspaceID, &res.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	res.Required = retReq == 1
	res.Visibility = retVis == 1
	res.Options = []string{}
	_ = json.Unmarshal([]byte(optStr), &res.Options)

	return &res, nil
}

func (r *MetadataRepository) UpdateCustomField(ctx context.Context, id int, label *string, options []string, req, vis *bool, order *int, section *string) (*models.CustomFieldDefinitionResponse, error) {
	var current models.CustomFieldDefinitionResponse
	var optStr string
	var curReq, curVis int

	err := r.db.Pool.QueryRow(ctx, `
		SELECT id, field_key, field_label, field_type, options, required, visibility, field_order, section, workspace_id, created_at
		FROM custom_field_definitions WHERE id = $1
	`, id).Scan(
		&current.ID, &current.FieldKey, &current.FieldLabel, &current.FieldType, &optStr,
		&curReq, &curVis, &current.FieldOrder, &current.Section, &current.WorkspaceID, &current.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("custom field not found")
		}
		return nil, err
	}

	if label != nil {
		current.FieldLabel = *label
	}
	if options != nil {
		b, _ := json.Marshal(options)
		optStr = string(b)
	}
	if req != nil {
		if *req {
			curReq = 1
		} else {
			curReq = 0
		}
	}
	if vis != nil {
		if *vis {
			curVis = 1
		} else {
			curVis = 0
		}
	}
	if order != nil {
		current.FieldOrder = *order
	}
	if section != nil {
		current.Section = *section
	}

	query := `
		UPDATE custom_field_definitions
		SET field_label = $1, options = $2, required = $3, visibility = $4, field_order = $5, section = $6
		WHERE id = $7
	`
	_, err = r.db.Pool.Exec(ctx, query, current.FieldLabel, optStr, curReq, curVis, current.FieldOrder, current.Section, id)
	if err != nil {
		return nil, err
	}

	current.Required = curReq == 1
	current.Visibility = curVis == 1
	current.Options = []string{}
	_ = json.Unmarshal([]byte(optStr), &current.Options)

	return &current, nil
}

func (r *MetadataRepository) DeleteCustomField(ctx context.Context, id int) error {
	_, err := r.db.Pool.Exec(ctx, "DELETE FROM custom_field_definitions WHERE id = $1", id)
	return err
}

// --- Statuses ---

func (r *MetadataRepository) ListStatuses(ctx context.Context) ([]models.LeadStatus, error) {
	rows, err := r.db.Pool.Query(ctx, `SELECT id, name, color, "order", is_default, workspace_id, created_at FROM lead_statuses WHERE workspace_id = 1 ORDER BY "order" ASC, id ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.LeadStatus
	for rows.Next() {
		var s models.LeadStatus
		var defInt int
		if err := rows.Scan(&s.ID, &s.Name, &s.Color, &s.Order, &defInt, &s.WorkspaceID, &s.CreatedAt); err != nil {
			return nil, err
		}
		s.IsDefault = defInt == 1
		list = append(list, s)
	}
	if list == nil {
		list = []models.LeadStatus{}
	}
	return list, nil
}

func (r *MetadataRepository) CreateStatus(ctx context.Context, name, color string, order int, isDefault bool) (*models.LeadStatus, error) {
	defInt := 0
	if isDefault {
		defInt = 1
	}
	query := `
		INSERT INTO lead_statuses (name, color, "order", is_default, workspace_id, created_at)
		VALUES ($1, $2, $3, $4, 1, NOW())
		RETURNING id, name, color, "order", is_default, workspace_id, created_at
	`
	var s models.LeadStatus
	var retDef int
	err := r.db.Pool.QueryRow(ctx, query, name, color, order, defInt).Scan(
		&s.ID, &s.Name, &s.Color, &s.Order, &retDef, &s.WorkspaceID, &s.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	s.IsDefault = retDef == 1
	return &s, nil
}

func (r *MetadataRepository) DeleteStatus(ctx context.Context, id int) error {
	_, err := r.db.Pool.Exec(ctx, "DELETE FROM lead_statuses WHERE id = $1", id)
	return err
}

// --- Sources ---

func (r *MetadataRepository) ListSources(ctx context.Context) ([]models.LeadSource, error) {
	rows, err := r.db.Pool.Query(ctx, `SELECT id, name, is_default, workspace_id, created_at FROM lead_sources WHERE workspace_id = 1 ORDER BY name ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.LeadSource
	for rows.Next() {
		var s models.LeadSource
		var defInt int
		if err := rows.Scan(&s.ID, &s.Name, &defInt, &s.WorkspaceID, &s.CreatedAt); err != nil {
			return nil, err
		}
		s.IsDefault = defInt == 1
		list = append(list, s)
	}
	if list == nil {
		list = []models.LeadSource{}
	}
	return list, nil
}

func (r *MetadataRepository) CreateSource(ctx context.Context, name string, isDefault bool) (*models.LeadSource, error) {
	defInt := 0
	if isDefault {
		defInt = 1
	}
	query := `
		INSERT INTO lead_sources (name, is_default, workspace_id, created_at)
		VALUES ($1, $2, 1, NOW())
		RETURNING id, name, is_default, workspace_id, created_at
	`
	var s models.LeadSource
	var retDef int
	err := r.db.Pool.QueryRow(ctx, query, name, defInt).Scan(
		&s.ID, &s.Name, &retDef, &s.WorkspaceID, &s.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	s.IsDefault = retDef == 1
	return &s, nil
}

func (r *MetadataRepository) DeleteSource(ctx context.Context, id int) error {
	_, err := r.db.Pool.Exec(ctx, "DELETE FROM lead_sources WHERE id = $1", id)
	return err
}

// --- Tags ---

func (r *MetadataRepository) ListTags(ctx context.Context) ([]models.Tag, error) {
	rows, err := r.db.Pool.Query(ctx, `SELECT id, name, color, workspace_id, created_at FROM tags WHERE workspace_id = 1 ORDER BY name ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.Tag
	for rows.Next() {
		var t models.Tag
		if err := rows.Scan(&t.ID, &t.Name, &t.Color, &t.WorkspaceID, &t.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, t)
	}
	if list == nil {
		list = []models.Tag{}
	}
	return list, nil
}

func (r *MetadataRepository) CreateTag(ctx context.Context, name, color string) (*models.Tag, error) {
	query := `
		INSERT INTO tags (name, color, workspace_id, created_at)
		VALUES ($1, $2, 1, NOW())
		RETURNING id, name, color, workspace_id, created_at
	`
	var t models.Tag
	err := r.db.Pool.QueryRow(ctx, query, name, color).Scan(
		&t.ID, &t.Name, &t.Color, &t.WorkspaceID, &t.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &t, nil
}

func (r *MetadataRepository) DeleteTag(ctx context.Context, id int) error {
	_, err := r.db.Pool.Exec(ctx, "DELETE FROM tags WHERE id = $1", id)
	return err
}

// --- Duplicate Check Settings ---

func (r *MetadataRepository) GetDuplicateSettings(ctx context.Context) (*models.DuplicateCheckSettings, error) {
	query := `SELECT check_phone, check_email, action FROM duplicate_check_settings WHERE workspace_id = 1`
	var s models.DuplicateCheckSettings
	var pInt, eInt int
	err := r.db.Pool.QueryRow(ctx, query).Scan(&pInt, &eInt, &s.Action)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return &models.DuplicateCheckSettings{CheckPhone: true, CheckEmail: true, Action: "prevent"}, nil
		}
		return nil, err
	}
	s.CheckPhone = pInt == 1
	s.CheckEmail = eInt == 1
	return &s, nil
}

func (r *MetadataRepository) UpdateDuplicateSettings(ctx context.Context, checkPhone, checkEmail bool, action string) (*models.DuplicateCheckSettings, error) {
	pInt := 0
	if checkPhone {
		pInt = 1
	}
	eInt := 0
	if checkEmail {
		eInt = 1
	}
	if action != "warn" {
		action = "prevent"
	}

	query := `
		INSERT INTO duplicate_check_settings (workspace_id, check_phone, check_email, action, updated_at)
		VALUES (1, $1, $2, $3, NOW())
		ON CONFLICT (workspace_id)
		DO UPDATE SET check_phone = EXCLUDED.check_phone, check_email = EXCLUDED.check_email, action = EXCLUDED.action, updated_at = NOW()
	`
	_, err := r.db.Pool.Exec(ctx, query, pInt, eInt, action)
	if err != nil {
		return nil, err
	}
	return &models.DuplicateCheckSettings{CheckPhone: checkPhone, CheckEmail: checkEmail, Action: action}, nil
}

// --- Saved Views ---

func (r *MetadataRepository) ListSavedViews(ctx context.Context, userID int) ([]models.SavedView, error) {
	query := `SELECT id, user_id, name, filters, is_default, created_at FROM saved_views WHERE user_id = $1 ORDER BY id ASC`
	rows, err := r.db.Pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.SavedView
	for rows.Next() {
		var v models.SavedView
		var fStr string
		var defInt int
		if err := rows.Scan(&v.ID, &v.UserID, &v.Name, &fStr, &defInt, &v.CreatedAt); err != nil {
			return nil, err
		}
		v.IsDefault = defInt == 1
		v.Filters = make(map[string]interface{})
		_ = json.Unmarshal([]byte(fStr), &v.Filters)
		list = append(list, v)
	}
	if list == nil {
		list = []models.SavedView{}
	}
	return list, nil
}

func (r *MetadataRepository) CreateSavedView(ctx context.Context, userID int, name string, filters map[string]interface{}, isDefault bool) (*models.SavedView, error) {
	fBytes, _ := json.Marshal(filters)
	defInt := 0
	if isDefault {
		defInt = 1
	}
	query := `
		INSERT INTO saved_views (user_id, name, filters, is_default, created_at)
		VALUES ($1, $2, $3, $4, NOW())
		RETURNING id, user_id, name, filters, is_default, created_at
	`
	var v models.SavedView
	var fStr string
	var retDef int
	err := r.db.Pool.QueryRow(ctx, query, userID, name, string(fBytes), defInt).Scan(
		&v.ID, &v.UserID, &v.Name, &fStr, &retDef, &v.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	v.IsDefault = retDef == 1
	v.Filters = make(map[string]interface{})
	_ = json.Unmarshal([]byte(fStr), &v.Filters)
	return &v, nil
}

func (r *MetadataRepository) DeleteSavedView(ctx context.Context, id, userID int) error {
	cmd, err := r.db.Pool.Exec(ctx, "DELETE FROM saved_views WHERE id = $1 AND user_id = $2", id, userID)
	if err != nil {
		return err
	}
	if cmd.RowsAffected() == 0 {
		return errors.New("saved view not found")
	}
	return nil
}
