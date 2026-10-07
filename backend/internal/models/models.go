package models

import (
	"time"
)

// User represents a CRM user
type User struct {
	ID             int       `json:"id"`
	Email          string    `json:"email"`
	Name           string    `json:"name"`
	HashedPassword string    `json:"-"`
	CreatedAt      time.Time `json:"created_at"`
}

type UserSummary struct {
	ID    int    `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

// Lead represents a CRM lead
type Lead struct {
	Number             string     `json:"number"`
	Name               string     `json:"name"`
	Email              string     `json:"email"`
	Phone              *string    `json:"phone"`
	Requirement        string     `json:"requirement"`
	Source             string     `json:"source"`
	City               string     `json:"city"`
	Status             string     `json:"status"`
	OwnerID            *int       `json:"owner_id"`
	Score              int        `json:"score"`
	LostReason         *string    `json:"lost_reason"`
	Tags               string     `json:"-"` // JSON-encoded string in DB
	FollowUpDate       *time.Time `json:"follow_up_date"`
	FollowUpType       *string    `json:"follow_up_type"`
	FollowUpNotes      *string    `json:"follow_up_notes"`
	FollowUpCompleted  int        `json:"-"`
	LastActivityAt     time.Time  `json:"last_activity_at"`
	DeletedAt          *time.Time `json:"deleted_at"`
	WorkspaceID        int        `json:"workspace_id"`
	CreatedByID        *int       `json:"created_by_id"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

// CustomFieldDefinition represents a custom field definition
type CustomFieldDefinition struct {
	ID          int       `json:"id"`
	FieldKey    string    `json:"field_key"`
	FieldLabel  string    `json:"field_label"`
	FieldType   string    `json:"field_type"`
	Options     string    `json:"-"` // JSON array string
	Required    int       `json:"-"`
	Visibility  int       `json:"-"`
	FieldOrder  int       `json:"field_order"`
	Section     string    `json:"section"`
	WorkspaceID int       `json:"workspace_id"`
	CreatedAt   time.Time `json:"created_at"`
}

// CustomFieldDefinitionResponse matches API schema
type CustomFieldDefinitionResponse struct {
	ID          int       `json:"id"`
	FieldKey    string    `json:"field_key"`
	FieldLabel  string    `json:"field_label"`
	FieldType   string    `json:"field_type"`
	Options     []string  `json:"options"`
	Required    bool      `json:"required"`
	Visibility  bool      `json:"visibility"`
	FieldOrder  int       `json:"field_order"`
	Section     string    `json:"section"`
	WorkspaceID int       `json:"workspace_id"`
	CreatedAt   time.Time `json:"created_at"`
}

// CustomFieldValueItem represents an individual custom field value item
type CustomFieldValueItem struct {
	FieldKey   string      `json:"field_key"`
	FieldLabel string      `json:"field_label"`
	FieldType  string      `json:"field_type"`
	Value      interface{} `json:"value"`
}

// LeadCustomFieldValue represents stored custom field value
type LeadCustomFieldValue struct {
	ID            int       `json:"id"`
	LeadNumber    string    `json:"lead_number"`
	CustomFieldID int       `json:"custom_field_id"`
	Value         *string   `json:"value"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// LeadResponse matches FastAPI LeadResponse
type LeadResponse struct {
	Number             string                 `json:"number"`
	Name               string                 `json:"name"`
	Email              string                 `json:"email"`
	Phone              *string                `json:"phone"`
	Requirement        string                 `json:"requirement"`
	Source             string                 `json:"source"`
	City               string                 `json:"city"`
	Status             string                 `json:"status"`
	OwnerID            *int                   `json:"owner_id"`
	Owner              *UserSummary           `json:"owner"`
	Score              int                    `json:"score"`
	LostReason         *string                `json:"lost_reason"`
	Tags               []string               `json:"tags"`
	FollowUpDate       *time.Time             `json:"follow_up_date"`
	FollowUpType       *string                `json:"follow_up_type"`
	FollowUpNotes      *string                `json:"follow_up_notes"`
	FollowUpCompleted  bool                   `json:"follow_up_completed"`
	NotesCount         int                    `json:"notes_count"`
	CreatedByID        *int                   `json:"created_by_id"`
	Creator            *UserSummary           `json:"creator"`
	LastActivityAt     time.Time              `json:"last_activity_at"`
	DeletedAt          *time.Time             `json:"deleted_at"`
	LeadAgeDays        int                    `json:"lead_age_days"`
	CustomFields       map[string]interface{} `json:"custom_fields"`
	CustomFieldDetails []CustomFieldValueItem `json:"custom_field_details"`
	CreatedAt          time.Time              `json:"created_at"`
	UpdatedAt          time.Time              `json:"updated_at"`
}

// LeadListResponse matches pagination response
type LeadListResponse struct {
	Items      []LeadResponse `json:"items"`
	Total      int            `json:"total"`
	Page       int            `json:"page"`
	Limit      int            `json:"limit"`
	Pages      int            `json:"pages"`
	ViewCounts map[string]int `json:"view_counts,omitempty"`
}

// LeadNote represents internal note on a lead
type LeadNote struct {
	ID         int          `json:"id"`
	LeadNumber string       `json:"lead_number"`
	UserID     *int         `json:"user_id"`
	User       *UserSummary `json:"user,omitempty"`
	Content    string       `json:"content"`
	CreatedAt  time.Time    `json:"created_at"`
}

// LeadActivity represents an audit timeline activity
type LeadActivity struct {
	ID           int          `json:"id"`
	LeadNumber   string       `json:"lead_number"`
	UserID       *int         `json:"user_id"`
	User         *UserSummary `json:"user,omitempty"`
	ActivityType string       `json:"activity_type"`
	Title        string       `json:"title"`
	Description  *string      `json:"description"`
	CreatedAt    time.Time    `json:"created_at"`
}

// FollowUp represents a scheduled follow-up
type FollowUp struct {
	ID            int          `json:"id"`
	LeadNumber    string       `json:"lead_number"`
	UserID        *int         `json:"user_id"`
	User          *UserSummary `json:"user,omitempty"`
	Title         string       `json:"title"`
	FollowUpType  string       `json:"follow_up_type"`
	DueDate       time.Time    `json:"due_date"`
	Completed     bool         `json:"completed"`
	CompletedAt   *time.Time   `json:"completed_at"`
	Notes         *string      `json:"notes"`
	ReminderState string       `json:"reminder_state"`
	CreatedAt     time.Time    `json:"created_at"`
}

// LeadStatus represents lead statuses
type LeadStatus struct {
	ID          int       `json:"id"`
	Name        string    `json:"name"`
	Color       string    `json:"color"`
	Order       int       `json:"order"`
	IsDefault   bool      `json:"is_default"`
	WorkspaceID int       `json:"workspace_id"`
	CreatedAt   time.Time `json:"created_at"`
}

// LeadSource represents lead sources
type LeadSource struct {
	ID          int       `json:"id"`
	Name        string    `json:"name"`
	IsDefault   bool      `json:"is_default"`
	WorkspaceID int       `json:"workspace_id"`
	CreatedAt   time.Time `json:"created_at"`
}

// Tag represents tags
type Tag struct {
	ID          int       `json:"id"`
	Name        string    `json:"name"`
	Color       string    `json:"color"`
	WorkspaceID int       `json:"workspace_id"`
	CreatedAt   time.Time `json:"created_at"`
}

// DuplicateCheckSettings represents duplicate rules
type DuplicateCheckSettings struct {
	CheckPhone bool   `json:"check_phone"`
	CheckEmail bool   `json:"check_email"`
	Action     string `json:"action"` // "prevent" or "warn"
}

// SavedView represents a saved filter view
type SavedView struct {
	ID        int                    `json:"id"`
	UserID    int                    `json:"user_id"`
	Name      string                 `json:"name"`
	Filters   map[string]interface{} `json:"filters"`
	IsDefault bool                   `json:"is_default"`
	CreatedAt time.Time              `json:"created_at"`
}

// ApiKey represents programmatic API key
type ApiKey struct {
	ID          int        `json:"id"`
	Name        string     `json:"name"`
	KeyHash     string     `json:"-"`
	KeyPrefix   string     `json:"key_prefix"`
	KeySuffix   string     `json:"key_suffix"`
	MaskedKey   string     `json:"masked_key"`
	Status      string     `json:"status"`
	ExpiresAt   *time.Time `json:"expires_at"`
	LastUsedAt  *time.Time `json:"last_used_at"`
	CreatedByID *int       `json:"created_by_id,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

type ApiKeyCreatedResponse struct {
	ApiKey
	PlaintextKey string `json:"api_key"`
}
