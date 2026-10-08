package models

import (
	"time"
)

// User represents a CRM user
type User struct {
	ID             int       `json:"id"`
	Email          string    `json:"email"`
	Name           string    `json:"name"`
	Role           string    `json:"role"`
	HashedPassword string    `json:"-"`
	CreatedAt      time.Time `json:"created_at"`
}

type UserSummary struct {
	ID    int    `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
	Role  string `json:"role,omitempty"`
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
	DealID             *int                   `json:"deal_id,omitempty"`
	DealNumber         *string                `json:"deal_number,omitempty"`
	DealStage          *string                `json:"deal_stage,omitempty"`
	DealStageColor     *string                `json:"deal_stage_color,omitempty"`
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
	LeadNumber    *string      `json:"lead_number,omitempty"`
	LeadName      string       `json:"lead_name,omitempty"`
	LeadCompany   string       `json:"lead_company,omitempty"`
	DealID        *int         `json:"deal_id,omitempty"`
	DealName      string       `json:"deal_name,omitempty"`
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

// Customer represents a converted customer
type Customer struct {
	ID          int          `json:"id"`
	Name        string       `json:"name"`
	Email       *string      `json:"email"`
	Phone       *string      `json:"phone"`
	Company     *string      `json:"company"`
	Website     *string      `json:"website"`
	Address     *string      `json:"address"`
	City        *string      `json:"city"`
	State       *string      `json:"state"`
	Pincode     *string      `json:"pincode"`
	GSTIN       *string      `json:"gstin"`
	WorkspaceID int          `json:"workspace_id"`
	CreatedByID *int         `json:"created_by_id"`
	Creator     *UserSummary `json:"creator,omitempty"`
	DealsCount  int          `json:"deals_count,omitempty"`
	CreatedAt   time.Time    `json:"created_at"`
	UpdatedAt   time.Time    `json:"updated_at"`
}

type CustomerCreateInput struct {
	Name    string  `json:"name" binding:"required"`
	Email   *string `json:"email"`
	Phone   *string `json:"phone"`
	Company *string `json:"company"`
	Website *string `json:"website"`
	Address *string `json:"address"`
	City    *string `json:"city"`
	State   *string `json:"state"`
	Pincode *string `json:"pincode"`
	GSTIN   *string `json:"gstin"`
}

// Pipeline represents a sales pipeline
type Pipeline struct {
	ID          int         `json:"id"`
	Name        string      `json:"name"`
	IsDefault   bool        `json:"is_default"`
	WorkspaceID int         `json:"workspace_id"`
	CreatedAt   time.Time   `json:"created_at"`
	Stages      []DealStage `json:"stages,omitempty"`
	DealsCount  int         `json:"deals_count,omitempty"`
	TotalValue  float64     `json:"total_value,omitempty"`
}

type PipelineCreateInput struct {
	Name      string `json:"name" binding:"required"`
	IsDefault bool   `json:"is_default"`
}

// DealStage represents a pipeline stage
type DealStage struct {
	ID          int       `json:"id"`
	PipelineID  int       `json:"pipeline_id"`
	Name        string    `json:"name"`
	StageOrder  int       `json:"stage_order"`
	Probability int       `json:"probability"`
	Color       string    `json:"color"`
	IsWon       bool      `json:"is_won"`
	IsLost      bool      `json:"is_lost"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	DealsCount  int       `json:"deals_count,omitempty"`
	TotalValue  float64   `json:"total_value,omitempty"`
}

type DealStageCreateInput struct {
	Name        string `json:"name" binding:"required"`
	StageOrder  int    `json:"stage_order"`
	Probability int    `json:"probability"`
	Color       string `json:"color"`
	IsWon       bool   `json:"is_won"`
	IsLost      bool   `json:"is_lost"`
	IsActive    *bool  `json:"is_active"`
}

type DealStageUpdateInput struct {
	Name        *string `json:"name"`
	StageOrder  *int    `json:"stage_order"`
	Probability *int    `json:"probability"`
	Color       *string `json:"color"`
	IsWon       *bool   `json:"is_won"`
	IsLost      *bool   `json:"is_lost"`
	IsActive    *bool   `json:"is_active"`
}

// Deal represents a sales deal
type Deal struct {
	ID                int          `json:"id"`
	DealNumber        string       `json:"deal_number"`
	Name              string       `json:"name"`
	CustomerID        int          `json:"customer_id"`
	Customer          *Customer    `json:"customer,omitempty"`
	LeadNumber        *string      `json:"lead_number"`
	PipelineID        int          `json:"pipeline_id"`
	Pipeline          *Pipeline    `json:"pipeline,omitempty"`
	StageID           int          `json:"stage_id"`
	Stage             *DealStage   `json:"stage,omitempty"`
	OwnerID           *int         `json:"owner_id"`
	Owner             *UserSummary `json:"owner,omitempty"`
	Value             float64      `json:"value"`
	Currency          string       `json:"currency"`
	Priority          string       `json:"priority"` // "Low", "Medium", "High", "Urgent"
	ExpectedCloseDate *time.Time   `json:"expected_close_date"`
	Requirement       string       `json:"requirement"`
	Status            string       `json:"status"` // "open", "won", "lost"
	LostReason        *string      `json:"lost_reason"`
	WorkspaceID       int          `json:"workspace_id"`
	CreatedByID       *int         `json:"created_by_id"`
	Creator           *UserSummary `json:"creator,omitempty"`
	CreatedAt         time.Time    `json:"created_at"`
	UpdatedAt         time.Time    `json:"updated_at"`
}

type DealCreateInput struct {
	Name              string     `json:"name" binding:"required"`
	CustomerID        int        `json:"customer_id" binding:"required"`
	LeadNumber        *string    `json:"lead_number"`
	PipelineID        int        `json:"pipeline_id" binding:"required"`
	StageID           int        `json:"stage_id" binding:"required"`
	OwnerID           *int       `json:"owner_id"`
	Value             float64    `json:"value"`
	Currency          string     `json:"currency"`
	Priority          string     `json:"priority"`
	ExpectedCloseDate *time.Time `json:"expected_close_date"`
	Requirement       string     `json:"requirement"`
}

type DealUpdateInput struct {
	Name              *string    `json:"name"`
	CustomerID        *int       `json:"customer_id"`
	PipelineID        *int       `json:"pipeline_id"`
	StageID           *int       `json:"stage_id"`
	OwnerID           *int       `json:"owner_id"`
	Value             *float64   `json:"value"`
	Currency          *string    `json:"currency"`
	Priority          *string    `json:"priority"`
	ExpectedCloseDate *time.Time `json:"expected_close_date"`
	Requirement       *string    `json:"requirement"`
	Status            *string    `json:"status"`
	LostReason        *string    `json:"lost_reason"`
}

type DealStageChangeInput struct {
	StageID    int     `json:"stage_id" binding:"required"`
	LostReason *string `json:"lost_reason"`
}

type DealListResponse struct {
	Items      []Deal  `json:"items"`
	Total      int     `json:"total"`
	Page       int     `json:"page"`
	Limit      int     `json:"limit"`
	Pages      int     `json:"pages"`
	TotalValue float64 `json:"total_value"`
}

// DealNote represents an internal note on a deal
type DealNote struct {
	ID        int          `json:"id"`
	DealID    int          `json:"deal_id"`
	UserID    *int         `json:"user_id"`
	User      *UserSummary `json:"user,omitempty"`
	Content   string       `json:"content"`
	CreatedAt time.Time    `json:"created_at"`
}

// DealActivity represents a timeline entry on a deal
type DealActivity struct {
	ID           int          `json:"id"`
	DealID       int          `json:"deal_id"`
	UserID       *int         `json:"user_id"`
	User         *UserSummary `json:"user,omitempty"`
	ActivityType string       `json:"activity_type"`
	Title        string       `json:"title"`
	Description  *string      `json:"description"`
	CreatedAt    time.Time    `json:"created_at"`
}

// LeadConvertInput represents input to convert a Lead to Customer + Deal
type LeadConvertInput struct {
	DealName          string     `json:"deal_name" binding:"required"`
	DealValue         float64    `json:"deal_value"`
	PipelineID        int        `json:"pipeline_id" binding:"required"`
	StageID           int        `json:"stage_id" binding:"required"`
	ExpectedCloseDate *time.Time `json:"expected_close_date"`
	OwnerID           *int       `json:"owner_id"`
	Priority          string     `json:"priority"`
	Requirement       string     `json:"requirement"`
	CustomerName      string     `json:"customer_name"`
	CustomerEmail     string     `json:"customer_email"`
	CustomerPhone     string     `json:"customer_phone"`
	CustomerCompany   string     `json:"customer_company"`
}

type LeadConvertResponse struct {
	Success    bool     `json:"success"`
	Customer   Customer `json:"customer"`
	Deal       Deal     `json:"deal"`
	LeadNumber string   `json:"lead_number"`
}

// Product represents a product, subscription or service in the catalog
type Product struct {
	ID           int          `json:"id"`
	Name         string       `json:"name"`
	SKU          string       `json:"sku"`
	Category     string       `json:"category"`
	Description  *string      `json:"description"`
	Unit         string       `json:"unit"`
	SellingPrice float64      `json:"selling_price"`
	Currency     string       `json:"currency"`
	TaxRate      float64      `json:"tax_rate"`
	HsnSac       *string      `json:"hsn_sac"`
	Status       string       `json:"status"` // "active" or "inactive"
	WorkspaceID  int          `json:"workspace_id"`
	CreatedByID  *int         `json:"created_by_id"`
	Creator      *UserSummary `json:"creator,omitempty"`
	CreatedAt    time.Time    `json:"created_at"`
	UpdatedAt    time.Time    `json:"updated_at"`
	DeletedAt    *time.Time   `json:"deleted_at,omitempty"`
}

type ProductCreateInput struct {
	Name         string  `json:"name" binding:"required"`
	SKU          string  `json:"sku" binding:"required"`
	Category     string  `json:"category"`
	Description  *string `json:"description"`
	Unit         string  `json:"unit"`
	SellingPrice float64 `json:"selling_price"`
	Currency     string  `json:"currency"`
	TaxRate      float64 `json:"tax_rate"`
	HsnSac       *string `json:"hsn_sac"`
	Status       string  `json:"status"` // "active" or "inactive"
}

type ProductUpdateInput struct {
	Name         *string  `json:"name"`
	SKU          *string  `json:"sku"`
	Category     *string  `json:"category"`
	Description  *string  `json:"description"`
	Unit         *string  `json:"unit"`
	SellingPrice *float64 `json:"selling_price"`
	Currency     *string  `json:"currency"`
	TaxRate      *float64 `json:"tax_rate"`
	HsnSac       *string  `json:"hsn_sac"`
	Status       *string  `json:"status"`
}

type ProductListResponse struct {
	Items         []Product `json:"items"`
	Total         int       `json:"total"`
	Page          int       `json:"page"`
	Limit         int       `json:"limit"`
	Pages         int       `json:"pages"`
	ActiveCount   int       `json:"active_count"`
	InactiveCount int       `json:"inactive_count"`
}

// QuotationItem represents an item within a Quotation with GST tax split
type QuotationItem struct {
	ID                 int       `json:"id"`
	QuotationID        int       `json:"quotation_id"`
	ProductID          *int      `json:"product_id"`
	ProductName        string    `json:"product_name"`
	SKU                *string   `json:"sku"`
	HSNSAC             *string   `json:"hsn_sac"`
	Description        *string   `json:"description"`
	Quantity           float64   `json:"quantity"`
	UnitPrice          float64   `json:"unit_price"`
	DiscountPercentage float64   `json:"discount_percentage"`
	TaxPercentage      float64   `json:"tax_percentage"` // applicable GST rate %
	TaxableAmount      float64   `json:"taxable_amount"`
	GSTRate            float64   `json:"gst_rate"`
	GSTAmount          float64   `json:"gst_amount"`
	CGSTRate           float64   `json:"cgst_rate"`
	CGSTAmount         float64   `json:"cgst_amount"`
	SGSTRate           float64   `json:"sgst_rate"`
	SGSTAmount         float64   `json:"sgst_amount"`
	IGSTRate           float64   `json:"igst_rate"`
	IGSTAmount         float64   `json:"igst_amount"`
	LineTotal          float64   `json:"line_total"`
	CreatedAt          time.Time `json:"created_at"`
}

type QuotationItemInput struct {
	ProductID          *int    `json:"product_id"`
	ProductName        string  `json:"product_name" binding:"required"`
	SKU                *string `json:"sku"`
	HSNSAC             *string `json:"hsn_sac"`
	Description        *string `json:"description"`
	Quantity           float64 `json:"quantity"`
	UnitPrice          float64 `json:"unit_price"`
	DiscountPercentage float64 `json:"discount_percentage"`
	TaxPercentage      float64 `json:"tax_percentage"` // applicable GST rate %
}

// Quotation represents a formal quotation linked to a Deal with full GST compliance
type Quotation struct {
	ID                 int             `json:"id"`
	QuotationNumber    string          `json:"quotation_number"`
	Title              string          `json:"title"`
	DealID             int             `json:"deal_id"`
	Deal               *Deal           `json:"deal,omitempty"`
	CustomerID         int             `json:"customer_id"`
	Customer           *Customer       `json:"customer,omitempty"`
	LeadNumber         *string         `json:"lead_number"`
	Lead               *Lead           `json:"lead,omitempty"`
	Status             string          `json:"status"` // "Draft", "Sent", "Accepted", "Rejected", "Expired"
	Currency           string          `json:"currency"`
	Subtotal           float64         `json:"subtotal"`
	DiscountPercentage float64         `json:"discount_percentage"`
	DiscountAmount     float64         `json:"discount_amount"`
	TaxPercentage      float64         `json:"tax_percentage"`
	TaxAmount          float64         `json:"tax_amount"` // total GST amount
	TotalAmount        float64         `json:"total_amount"`
	ValidUntil         *time.Time      `json:"valid_until"`
	TermsAndConditions *string         `json:"terms_and_conditions"`
	Notes              *string         `json:"notes"`

	// Company GST Profile Snapshot
	CompanyName        *string         `json:"company_name"`
	CompanyGSTIN       *string         `json:"company_gstin"`
	CompanyPAN         *string         `json:"company_pan"`
	CompanyState       *string         `json:"company_state"`
	CompanyAddress     *string         `json:"company_address"`

	// Customer GST & Place of Supply Snapshot
	CustomerState      *string         `json:"customer_state"`
	CustomerGSTIN      *string         `json:"customer_gstin"`
	IsInterState       bool            `json:"is_inter_state"`

	// Detailed GST Breakdown
	TaxableAmount      float64         `json:"taxable_amount"`
	CGSTAmount         float64         `json:"cgst_amount"`
	SGSTAmount         float64         `json:"sgst_amount"`
	IGSTAmount         float64         `json:"igst_amount"`
	TotalGSTAmount     float64         `json:"total_gst_amount"`
	RoundOffAmount     float64         `json:"round_off_amount"`

	WorkspaceID        int             `json:"workspace_id"`
	CreatedByID        *int            `json:"created_by_id"`
	Creator            *UserSummary    `json:"creator,omitempty"`
	Items              []QuotationItem `json:"items,omitempty"`
	CreatedAt          time.Time       `json:"created_at"`
	UpdatedAt          time.Time       `json:"updated_at"`
}

type QuotationCreateInput struct {
	QuotationNumber    string               `json:"quotation_number"`
	Title              string               `json:"title" binding:"required"`
	DealID             int                  `json:"deal_id" binding:"required"`
	Currency           string               `json:"currency"`
	DiscountPercentage float64              `json:"discount_percentage"`
	TaxPercentage      float64              `json:"tax_percentage"`
	ValidUntil         *time.Time           `json:"valid_until"`
	TermsAndConditions *string              `json:"terms_and_conditions"`
	Notes              *string              `json:"notes"`
	CustomerState      *string              `json:"customer_state"`
	CustomerGSTIN      *string              `json:"customer_gstin"`
	RoundOffAmount     *float64             `json:"round_off_amount"`
	Items              []QuotationItemInput `json:"items" binding:"required"`
}

type QuotationUpdateInput struct {
	QuotationNumber    *string              `json:"quotation_number"`
	DealID             *int                 `json:"deal_id"`
	Title              *string              `json:"title"`
	Status             *string              `json:"status"`
	Currency           *string              `json:"currency"`
	DiscountPercentage *float64             `json:"discount_percentage"`
	TaxPercentage      *float64             `json:"tax_percentage"`
	ValidUntil         *time.Time           `json:"valid_until"`
	TermsAndConditions *string              `json:"terms_and_conditions"`
	Notes              *string              `json:"notes"`
	CustomerState      *string              `json:"customer_state"`
	CustomerGSTIN      *string              `json:"customer_gstin"`
	RoundOffAmount     *float64             `json:"round_off_amount"`
	Items              []QuotationItemInput `json:"items"`
}

type QuotationListResponse struct {
	Items         []Quotation `json:"items"`
	Total         int         `json:"total"`
	Page          int         `json:"page"`
	Limit         int         `json:"limit"`
	Pages         int         `json:"pages"`
	TotalValue    float64     `json:"total_value"`
	DraftCount    int         `json:"draft_count"`
	SentCount     int         `json:"sent_count"`
	AcceptedCount int         `json:"accepted_count"`
	RejectedCount int         `json:"rejected_count"`
}

// CompanyProfile represents organizational branding and statutory details
type CompanyProfile struct {
	ID              int       `json:"id"`
	WorkspaceID     int       `json:"workspace_id"`
	CompanyName     string    `json:"company_name"`
	HasLogo         bool      `json:"has_logo"`
	LogoMimeType    *string   `json:"logo_mime_type,omitempty"`
	LogoURL         string    `json:"logo_url"`
	GSTNumber       string    `json:"gst_number"`
	PANNumber       string    `json:"pan_number"`
	Email           string    `json:"email"`
	Phone           string    `json:"phone"`
	Website         string    `json:"website"`
	Address         string    `json:"address"`
	City            string    `json:"city"`
	State           string    `json:"state"`
	Country         string    `json:"country"`
	Pincode         string    `json:"pincode"`
	DefaultCurrency string    `json:"default_currency"`
	UpdatedByID     *int      `json:"updated_by_id"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// CompanyProfileUpdateInput represents editable fields for company details
type CompanyProfileUpdateInput struct {
	CompanyName     string  `json:"company_name" binding:"required"`
	GSTNumber       *string `json:"gst_number"`
	PANNumber       *string `json:"pan_number"`
	Email           *string `json:"email"`
	Phone           *string `json:"phone"`
	Website         *string `json:"website"`
	Address         *string `json:"address"`
	City            *string `json:"city"`
	State           *string `json:"state"`
	Country         *string `json:"country"`
	Pincode         *string `json:"pincode"`
	DefaultCurrency string  `json:"default_currency"`
}

// Order represents a fulfillment project created from a Won Deal & Accepted Quotation
type Order struct {
	ID            int             `json:"id"`
	OrderNumber   string          `json:"order_number"`
	Title         string          `json:"title"`
	CustomerID    int             `json:"customer_id"`
	Customer      *Customer       `json:"customer,omitempty"`
	DealID        *int            `json:"deal_id,omitempty"`
	Deal          *Deal           `json:"deal,omitempty"`
	QuotationID   *int            `json:"quotation_id,omitempty"`
	Quotation     *Quotation      `json:"quotation,omitempty"`
	Stage         string          `json:"stage"` // Not Started, Planning, In Progress, Client Review, Revision/Changes, Delivered, Completed
	PaymentStatus string          `json:"payment_status"` // Unpaid, Partially Paid, Paid
	InvoiceStatus string          `json:"invoice_status"` // Not Invoiced, Invoiced
	TotalAmount   float64         `json:"total_amount"`
	Currency      string          `json:"currency"`
	StartDate     *string         `json:"start_date,omitempty"`
	DeliveryDate  *string         `json:"delivery_date,omitempty"`
	Notes         *string         `json:"notes,omitempty"`
	OwnerID       *int            `json:"owner_id,omitempty"`
	Owner         *UserSummary    `json:"owner,omitempty"`
	WorkspaceID   int             `json:"workspace_id"`
	CreatedByID   *int            `json:"created_by_id,omitempty"`
	Creator       *UserSummary    `json:"creator,omitempty"`
	Items         []OrderItem     `json:"items,omitempty"`
	Activities    []OrderActivity `json:"activities,omitempty"`
	CreatedAt     time.Time       `json:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at"`
}

// OrderItem represents a line item deliverable on an Order
type OrderItem struct {
	ID            int       `json:"id"`
	OrderID       int       `json:"order_id"`
	ProductID     *int      `json:"product_id,omitempty"`
	Name          string    `json:"name"`
	Description   *string   `json:"description,omitempty"`
	Quantity      float64   `json:"quantity"`
	UnitPrice     float64   `json:"unit_price"`
	GSTRate       float64   `json:"gst_rate"`
	TaxableAmount float64   `json:"taxable_amount"`
	TaxAmount     float64   `json:"tax_amount"`
	TotalAmount   float64   `json:"total_amount"`
	CreatedAt     time.Time `json:"created_at"`
}

// OrderActivity tracks events and stage changes on an Order
type OrderActivity struct {
	ID           int          `json:"id"`
	OrderID      int          `json:"order_id"`
	UserID       *int         `json:"user_id,omitempty"`
	User         *UserSummary `json:"user,omitempty"`
	ActivityType string       `json:"activity_type"`
	Title        string       `json:"title"`
	Description  *string      `json:"description,omitempty"`
	CreatedAt    time.Time    `json:"created_at"`
}

// OrderItemInput for creating line items
type OrderItemInput struct {
	ProductID     *int     `json:"product_id"`
	Name          string   `json:"name"`
	Description   *string  `json:"description"`
	Quantity      float64  `json:"quantity"`
	UnitPrice     float64  `json:"unit_price"`
	GSTRate       *float64 `json:"gst_rate"`
	TaxableAmount *float64 `json:"taxable_amount"`
	TaxAmount     *float64 `json:"tax_amount"`
	TotalAmount   *float64 `json:"total_amount"`
}

// OrderCreateInput represents the request payload to create an Order
type OrderCreateInput struct {
	Title         string           `json:"title" binding:"required"`
	CustomerID    int              `json:"customer_id" binding:"required"`
	DealID        *int             `json:"deal_id"`
	QuotationID   *int             `json:"quotation_id"`
	Stage         *string          `json:"stage"`
	PaymentStatus *string          `json:"payment_status"`
	InvoiceStatus *string          `json:"invoice_status"`
	TotalAmount   *float64         `json:"total_amount"`
	Currency      *string          `json:"currency"`
	StartDate     *string          `json:"start_date"`
	DeliveryDate  *string          `json:"delivery_date"`
	Notes         *string          `json:"notes"`
	OwnerID       *int             `json:"owner_id"`
	Items         []OrderItemInput `json:"items"`
}

// OrderUpdateInput represents partial updates on an Order
type OrderUpdateInput struct {
	Title         *string  `json:"title"`
	Stage         *string  `json:"stage"`
	PaymentStatus *string  `json:"payment_status"`
	InvoiceStatus *string  `json:"invoice_status"`
	TotalAmount   *float64 `json:"total_amount"`
	Currency      *string  `json:"currency"`
	StartDate     *string  `json:"start_date"`
	DeliveryDate  *string  `json:"delivery_date"`
	Notes         *string  `json:"notes"`
	OwnerID       *int     `json:"owner_id"`
}

// OrderStageChangeInput represents dedicated stage change payload
type OrderStageChangeInput struct {
	Stage string `json:"stage" binding:"required"`
	Notes string `json:"notes"`
}

// OrderListResponse for paginated order lists
type OrderListResponse struct {
	Items              []Order `json:"items"`
	Total              int     `json:"total"`
	Page               int     `json:"page"`
	Limit              int     `json:"limit"`
	Pages              int     `json:"pages"`
	TotalValue         float64 `json:"total_value"`
	NotStartedCount    int     `json:"not_started_count"`
	PlanningCount      int     `json:"planning_count"`
	InProgressCount    int     `json:"in_progress_count"`
	ClientReviewCount  int     `json:"client_review_count"`
	RevisionCount      int     `json:"revision_count"`
	DeliveredCount     int     `json:"delivered_count"`
	CompletedCount     int     `json:"completed_count"`
}

// InvoiceItem represents line items on an Invoice with GST splits
type InvoiceItem struct {
	ID                 int       `json:"id"`
	InvoiceID          int       `json:"invoice_id"`
	ProductID          *int      `json:"product_id"`
	ProductName        string    `json:"product_name"`
	SKU                *string   `json:"sku"`
	HSNSAC             *string   `json:"hsn_sac"`
	Description        *string   `json:"description"`
	Quantity           float64   `json:"quantity"`
	UnitPrice          float64   `json:"unit_price"`
	DiscountPercentage float64   `json:"discount_percentage"`
	TaxPercentage      float64   `json:"tax_percentage"`
	TaxableAmount      float64   `json:"taxable_amount"`
	GSTRate            float64   `json:"gst_rate"`
	GSTAmount          float64   `json:"gst_amount"`
	CGSTRate           float64   `json:"cgst_rate"`
	CGSTAmount         float64   `json:"cgst_amount"`
	SGSTRate           float64   `json:"sgst_rate"`
	SGSTAmount         float64   `json:"sgst_amount"`
	IGSTRate           float64   `json:"igst_rate"`
	IGSTAmount         float64   `json:"igst_amount"`
	LineTotal          float64   `json:"line_total"`
	CreatedAt          time.Time `json:"created_at"`
}

// InvoicePayment represents a payment audit record on an invoice
type InvoicePayment struct {
	ID              int          `json:"id"`
	InvoiceID       int          `json:"invoice_id"`
	Amount          float64      `json:"amount"`
	PaymentDate     time.Time    `json:"payment_date"`
	PaymentMethod   string       `json:"payment_method"`
	ReferenceNumber *string      `json:"reference_number"`
	Notes           *string      `json:"notes"`
	RecordedByID    *int         `json:"recorded_by_id"`
	Recorder        *UserSummary `json:"recorder,omitempty"`
	CreatedAt       time.Time    `json:"created_at"`
}

// Invoice represents a formal tax invoice
type Invoice struct {
	ID                 int              `json:"id"`
	InvoiceNumber      string           `json:"invoice_number"`
	CustomerID         int              `json:"customer_id"`
	Customer           *Customer        `json:"customer,omitempty"`
	OrderID            *int             `json:"order_id"`
	Order              *Order           `json:"order,omitempty"`
	QuotationID        *int             `json:"quotation_id"`
	Quotation          *Quotation       `json:"quotation,omitempty"`
	DealID             *int             `json:"deal_id"`
	Deal               *Deal            `json:"deal,omitempty"`
	Status             string           `json:"status"` // Draft, Issued/Sent, Unpaid, Partially Paid, Paid, Overdue, Cancelled, Refunded
	InvoiceDate        time.Time        `json:"invoice_date"`
	DueDate            *time.Time       `json:"due_date"`
	Currency           string           `json:"currency"`
	Subtotal           float64          `json:"subtotal"`
	DiscountPercentage float64          `json:"discount_percentage"`
	DiscountAmount     float64          `json:"discount_amount"`
	TaxableAmount      float64          `json:"taxable_amount"`
	CGSTAmount         float64          `json:"cgst_amount"`
	SGSTAmount         float64          `json:"sgst_amount"`
	IGSTAmount         float64          `json:"igst_amount"`
	TotalTax           float64          `json:"total_tax"`
	RoundOffAmount     float64          `json:"round_off_amount"`
	GrandTotal         float64          `json:"grand_total"`
	AmountPaid         float64          `json:"amount_paid"`
	RemainingBalance   float64          `json:"remaining_balance"`
	PaymentMethod      *string          `json:"payment_method"`
	PaymentNotes       *string          `json:"payment_notes"`
	Notes              *string          `json:"notes"`
	TermsAndConditions *string          `json:"terms_and_conditions"`

	// Company snapshot
	CompanyName        *string          `json:"company_name"`
	CompanyGSTIN       *string          `json:"company_gstin"`
	CompanyPAN         *string          `json:"company_pan"`
	CompanyState       *string          `json:"company_state"`
	CompanyAddress     *string          `json:"company_address"`

	// Customer snapshot
	CustomerState      *string          `json:"customer_state"`
	CustomerGSTIN      *string          `json:"customer_gstin"`
	IsInterState       bool             `json:"is_inter_state"`

	WorkspaceID        int              `json:"workspace_id"`
	CreatedByID        *int             `json:"created_by_id"`
	Creator            *UserSummary     `json:"creator,omitempty"`
	Items              []InvoiceItem    `json:"items,omitempty"`
	Payments           []InvoicePayment `json:"payments,omitempty"`
	CreatedAt          time.Time        `json:"created_at"`
	UpdatedAt          time.Time        `json:"updated_at"`
}

type InvoiceItemInput struct {
	ProductID          *int    `json:"product_id"`
	ProductName        string  `json:"product_name" binding:"required"`
	SKU                *string `json:"sku"`
	HSNSAC             *string `json:"hsn_sac"`
	Description        *string `json:"description"`
	Quantity           float64 `json:"quantity"`
	UnitPrice          float64 `json:"unit_price"`
	DiscountPercentage float64 `json:"discount_percentage"`
	TaxPercentage      float64 `json:"tax_percentage"`
}

type InvoiceCreateInput struct {
	CustomerID         int                `json:"customer_id" binding:"required"`
	OrderID            *int               `json:"order_id"`
	QuotationID        *int               `json:"quotation_id"`
	DealID             *int               `json:"deal_id"`
	Status             *string            `json:"status"`
	InvoiceDate        *string            `json:"invoice_date"`
	DueDate            *string            `json:"due_date"`
	Currency           *string            `json:"currency"`
	DiscountPercentage *float64           `json:"discount_percentage"`
	Notes              *string            `json:"notes"`
	TermsAndConditions *string            `json:"terms_and_conditions"`
	Items              []InvoiceItemInput `json:"items"`
}

type InvoiceUpdateInput struct {
	Status             *string            `json:"status"`
	InvoiceDate        *string            `json:"invoice_date"`
	DueDate            *string            `json:"due_date"`
	DiscountPercentage *float64           `json:"discount_percentage"`
	Notes              *string            `json:"notes"`
	TermsAndConditions *string            `json:"terms_and_conditions"`
	Items              []InvoiceItemInput `json:"items"`
}

type InvoicePaymentInput struct {
	Amount          float64 `json:"amount" binding:"required,gt=0"`
	PaymentMethod   string  `json:"payment_method" binding:"required"`
	PaymentDate     *string `json:"payment_date"`
	ReferenceNumber *string `json:"reference_number"`
	Notes           *string `json:"notes"`
}

type InvoiceStatusInput struct {
	Status string `json:"status" binding:"required"`
}

type InvoiceListResponse struct {
	Items              []Invoice `json:"items"`
	Total              int       `json:"total"`
	Page               int       `json:"page"`
	Limit              int       `json:"limit"`
	Pages              int       `json:"pages"`
	TotalInvoiced      float64   `json:"total_invoiced"`
	TotalPaid          float64   `json:"total_paid"`
	TotalBalance       float64   `json:"total_balance"`
	DraftCount         int       `json:"draft_count"`
	IssuedCount        int       `json:"issued_count"`
	UnpaidCount        int       `json:"unpaid_count"`
	PartiallyPaidCount int       `json:"partially_paid_count"`
	PaidCount          int       `json:"paid_count"`
	OverdueCount       int       `json:"overdue_count"`
	CancelledCount     int       `json:"cancelled_count"`
}




