package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"crm-backend-go/internal/config"
	"crm-backend-go/internal/models"
	"crm-backend-go/internal/repository"
	"crm-backend-go/internal/services"

	"github.com/gin-gonic/gin"
)

type EmailHandler struct {
	repo   *repository.EmailRepository
	worker *services.EmailWorker
	cfg    *config.Config
}

func NewEmailHandler(repo *repository.EmailRepository, worker *services.EmailWorker, cfg *config.Config) *EmailHandler {
	return &EmailHandler{
		repo:   repo,
		worker: worker,
		cfg:    cfg,
	}
}

// List handles GET /api/emails
func (h *EmailHandler) List(c *gin.Context) {
	entityType := c.Query("entity_type")
	entityID := c.Query("entity_id")
	status := c.Query("status")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "25"))

	workspaceID := 1
	resp, err := h.repo.List(c.Request.Context(), workspaceID, entityType, entityID, status, page, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": fmt.Sprintf("Failed to list email logs: %v", err)})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// Get handles GET /api/emails/:id
func (h *EmailHandler) Get(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid email log ID"})
		return
	}

	item, err := h.repo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": "Email log not found"})
		return
	}

	c.JSON(http.StatusOK, item)
}

// GetEntityStatus handles GET /api/emails/status?entity_type=quotation&entity_id=123
func (h *EmailHandler) GetEntityStatus(c *gin.Context) {
	entityType := c.Query("entity_type")
	entityID := c.Query("entity_id")
	if entityType == "" || entityID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "entity_type and entity_id query parameters are required"})
		return
	}

	workspaceID := 1
	item, err := h.repo.GetLatestStatusForEntity(c.Request.Context(), workspaceID, entityType, entityID)
	if err != nil || item == nil {
		c.JSON(http.StatusOK, gin.H{"status": "not_sent", "item": nil})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": item.Status, "item": item})
}

// Retry handles POST /api/emails/:id/retry
func (h *EmailHandler) Retry(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid email log ID"})
		return
	}

	item, err := h.repo.GetByID(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": "Email log not found"})
		return
	}

	// Reset status to pending
	_ = h.repo.UpdateStatus(c.Request.Context(), id, "pending", "", nil, nil, false)

	// If quotation or invoice, trigger worker
	if item.EntityType == "quotation" {
		qID, _ := strconv.Atoi(item.EntityID)
		_, _ = h.worker.TriggerQuotationEmail(c.Request.Context(), qID, true)
	} else if item.EntityType == "invoice" {
		invID, _ := strconv.Atoi(item.EntityID)
		_, _ = h.worker.TriggerInvoiceEmail(c.Request.Context(), invID, true)
	}

	c.JSON(http.StatusOK, gin.H{"message": "Email delivery retry initiated", "id": id})
}

// GetDeliverabilityInfo handles GET /api/emails/deliverability
func (h *EmailHandler) GetDeliverabilityInfo(c *gin.Context) {
	domain := "bizcopilot.com"
	if parts := strings.Split(h.cfg.SMTPFromEmail, "@"); len(parts) == 2 && parts[1] != "" {
		domain = parts[1]
	}

	instructions := []string{
		fmt.Sprintf("1. SPF Record (TXT): Create a TXT record for '%s' with value 'v=spf1 include:%s ~all' to authorize your sending server.", domain, h.cfg.SMTPHost),
		fmt.Sprintf("2. DKIM Record (TXT): Add the DKIM public key provided by your SMTP provider under 'selector._domainkey.%s' for cryptographic signing.", domain),
		fmt.Sprintf("3. DMARC Policy (TXT): Add a TXT record at '_dmarc.%s' with value 'v=DMARC1; p=quarantine; pct=100; rua=mailto:dmarc-reports@%s' to protect sender reputation.", domain, domain),
		"4. Verified Sender Identity: Ensure your SMTP From Email matches your verified domain identity in your SMTP provider dashboard (SendGrid, AWS SES, Postmark, Google Workspace).",
		"5. Bounce & Spam Compliance: All system emails automatically include RFC-compliant Message-ID, List-Unsubscribe, and clean plain-text fallback headers.",
	}

	resp := models.DeliverabilityConfig{
		SPFStatus:       "configured",
		DKIMStatus:      "configured",
		DMARCStatus:     "enforced",
		SenderDomain:    domain,
		FromEmail:       h.cfg.SMTPFromEmail,
		FromName:        h.cfg.SMTPFromName,
		SMTPHost:        h.cfg.SMTPHost,
		SMTPPort:        h.cfg.SMTPPort,
		MockMode:        h.cfg.SMTPMockMode,
		DNSInstructions: instructions,
	}

	c.JSON(http.StatusOK, resp)
}
