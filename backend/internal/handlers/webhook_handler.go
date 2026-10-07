package handlers

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"crm-backend-go/internal/models"
	"crm-backend-go/internal/repository"

	"github.com/gin-gonic/gin"
)

type WebhookHandler struct {
	apiKeyRepo *repository.ApiKeyRepository
	leadRepo   *repository.LeadRepository
}

func NewWebhookHandler(apiKeyRepo *repository.ApiKeyRepository, leadRepo *repository.LeadRepository) *WebhookHandler {
	return &WebhookHandler{
		apiKeyRepo: apiKeyRepo,
		leadRepo:   leadRepo,
	}
}

type WebhookLeadPayload struct {
	Number       string                 `json:"number"`
	Phone        string                 `json:"phone"`
	PhoneNumber  string                 `json:"phone_number"`
	Mobile       string                 `json:"mobile"`
	Contact      string                 `json:"contact"`
	Name         string                 `json:"name"`
	FullName     string                 `json:"full_name"`
	FirstName    string                 `json:"first_name"`
	LastName     string                 `json:"last_name"`
	Email        string                 `json:"email"`
	EmailAddress string                 `json:"email_address"`
	Requirement  string                 `json:"requirement"`
	Message      string                 `json:"message"`
	Notes        string                 `json:"notes"`
	Query        string                 `json:"query"`
	Description  string                 `json:"description"`
	Source       string                 `json:"source"`
	LeadSource   string                 `json:"lead_source"`
	City         string                 `json:"city"`
	Location     string                 `json:"location"`
	CustomFields map[string]interface{} `json:"custom_fields"`
}

type WebhookResponse struct {
	Success bool                 `json:"success"`
	Message string               `json:"message"`
	Lead    *models.LeadResponse `json:"lead"`
}

// IngestLeadWebhook godoc
// @Summary Ingest lead from external webhooks using Bearer API Key
// @Tags Webhooks
// @Accept json
// @Produce json
// @Param request body WebhookLeadPayload true "Webhook Lead Payload"
// @Success 201 {object} WebhookResponse
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 409 {object} map[string]string
// @Router /api/webhooks/lead [post]
func (h *WebhookHandler) IngestLead(c *gin.Context) {
	// 1. Authenticate with API key from Authorization header or X-Webhook-Secret
	rawToken := ""
	authHeader := c.GetHeader("Authorization")
	if authHeader != "" {
		if strings.HasPrefix(authHeader, "Bearer ") {
			rawToken = strings.TrimSpace(authHeader[7:])
		} else {
			rawToken = strings.TrimSpace(authHeader)
		}
	} else {
		rawToken = strings.TrimSpace(c.GetHeader("X-Webhook-Secret"))
	}

	if rawToken == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"detail": "Authorization header missing. Provide Authorization: Bearer <API_KEY>.",
		})
		return
	}

	apiKeyObj, err := h.apiKeyRepo.ValidateByRawToken(c.Request.Context(), rawToken)
	if err != nil || apiKeyObj == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"detail": "Invalid API key."})
		return
	}

	if apiKeyObj.Status == "revoked" {
		c.JSON(http.StatusUnauthorized, gin.H{"detail": "API key has been revoked."})
		return
	}

	if apiKeyObj.ExpiresAt != nil && apiKeyObj.ExpiresAt.Before(time.Now()) {
		c.JSON(http.StatusUnauthorized, gin.H{"detail": "API key has expired."})
		return
	}

	// 2. Parse payload
	var p WebhookLeadPayload
	if err := c.ShouldBindJSON(&p); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid payload: " + err.Error()})
		return
	}

	resNumber := p.Number
	if resNumber == "" {
		resNumber = p.Phone
	}
	if resNumber == "" {
		resNumber = p.PhoneNumber
	}
	if resNumber == "" {
		resNumber = p.Mobile
	}
	if resNumber == "" {
		resNumber = p.Contact
	}
	resNumber = strings.TrimSpace(resNumber)
	if resNumber == "" {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Lead phone/number is required."})
		return
	}

	resName := p.Name
	if resName == "" {
		resName = p.FullName
	}
	if resName == "" && (p.FirstName != "" || p.LastName != "") {
		resName = strings.TrimSpace(p.FirstName + " " + p.LastName)
	}
	resName = strings.TrimSpace(resName)
	if resName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Lead 'name' is required."})
		return
	}

	resEmail := p.Email
	if resEmail == "" {
		resEmail = p.EmailAddress
	}
	resEmail = strings.ToLower(strings.TrimSpace(resEmail))
	if resEmail == "" {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Lead 'email' is required."})
		return
	}

	resReq := p.Requirement
	if resReq == "" {
		resReq = p.Message
	}
	if resReq == "" {
		resReq = p.Notes
	}
	if resReq == "" {
		resReq = p.Query
	}
	if resReq == "" {
		resReq = p.Description
	}
	if resReq == "" {
		resReq = "Inquiry submitted via webhook"
	}

	resSource := p.Source
	if resSource == "" {
		resSource = p.LeadSource
	}
	if resSource == "" {
		resSource = "Website"
	}

	resCity := p.City
	if resCity == "" {
		resCity = p.Location
	}
	if resCity == "" {
		resCity = "Online"
	}

	cfMap := p.CustomFields
	if cfMap == nil {
		cfMap = make(map[string]interface{})
	}

	in := repository.CreateLeadInput{
		Number:       resNumber,
		Name:         resName,
		Email:        resEmail,
		Phone:        &resNumber,
		Requirement:  resReq,
		Source:       resSource,
		City:         resCity,
		Status:       "New",
		OwnerID:      apiKeyObj.CreatedByID,
		CustomFields: cfMap,
	}

	currentUserID := 1
	if apiKeyObj.CreatedByID != nil {
		currentUserID = *apiKeyObj.CreatedByID
	}

	lead, err := h.leadRepo.Create(c.Request.Context(), in, currentUserID)
	if err != nil {
		var confErr *repository.ConflictError
		if errors.As(err, &confErr) {
			c.JSON(http.StatusConflict, gin.H{"detail": confErr.Message})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Failed to ingest lead: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, WebhookResponse{
		Success: true,
		Message: "Lead ingested successfully via webhook.",
		Lead:    lead,
	})
}
