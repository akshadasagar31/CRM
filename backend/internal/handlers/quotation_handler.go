package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"crm-backend-go/internal/middleware"
	"crm-backend-go/internal/models"
	"crm-backend-go/internal/repository"

	"github.com/gin-gonic/gin"
)

type QuotationHandler struct {
	repo *repository.QuotationRepository
}

func NewQuotationHandler(repo *repository.QuotationRepository) *QuotationHandler {
	return &QuotationHandler{repo: repo}
}

// Create godoc
// @Summary Create a new Quotation for an existing Deal
// @Tags Quotations
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param quotation body models.QuotationCreateInput true "Quotation Details"
// @Success 201 {object} models.Quotation
// @Failure 400 {object} map[string]string
// @Router /api/quotations [post]
func (h *QuotationHandler) Create(c *gin.Context) {
	var in models.QuotationCreateInput
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Validation error: " + err.Error()})
		return
	}

	user := middleware.GetCurrentUser(c)
	var userID *int
	if user != nil {
		userID = &user.ID
	}
	workspaceID := 1

	q, err := h.repo.Create(c.Request.Context(), in, userID, workspaceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, q)
}

// Get godoc
// @Summary Get a Quotation by ID with full Deal, Customer, Lead, and line items
// @Tags Quotations
// @Produce json
// @Security BearerAuth
// @Param id path int true "Quotation ID"
// @Success 200 {object} models.Quotation
// @Failure 404 {object} map[string]string
// @Router /api/quotations/{id} [get]
func (h *QuotationHandler) Get(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid quotation ID"})
		return
	}

	workspaceID := 1
	q, err := h.repo.GetByID(c.Request.Context(), id, workspaceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	if q == nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": "Quotation not found"})
		return
	}

	c.JSON(http.StatusOK, q)
}

// List godoc
// @Summary List quotations with pagination, filtering by deal, customer, status, search
// @Tags Quotations
// @Produce json
// @Security BearerAuth
// @Param deal_id query int false "Deal ID"
// @Param customer_id query int false "Customer ID"
// @Param status query string false "Status (Draft, Sent, Accepted, Rejected, Expired)"
// @Param search query string false "Search query"
// @Param page query int false "Page" default(1)
// @Param limit query int false "Limit" default(50)
// @Success 200 {object} models.QuotationListResponse
// @Router /api/quotations [get]
func (h *QuotationHandler) List(c *gin.Context) {
	workspaceID := 1
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	search := c.Query("search")
	status := c.Query("status")

	var dealID *int
	if dStr := c.Query("deal_id"); dStr != "" {
		if id, err := strconv.Atoi(dStr); err == nil {
			dealID = &id
		}
	}

	var customerID *int
	if cStr := c.Query("customer_id"); cStr != "" {
		if id, err := strconv.Atoi(cStr); err == nil {
			customerID = &id
		}
	}

	filter := repository.QuotationFilter{
		DealID:     dealID,
		CustomerID: customerID,
		Status:     status,
		Search:     search,
		Page:       page,
		Limit:      limit,
	}

	res, err := h.repo.List(c.Request.Context(), filter, workspaceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, res)
}

// Update godoc
// @Summary Update an existing Quotation
// @Tags Quotations
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "Quotation ID"
// @Param quotation body models.QuotationUpdateInput true "Quotation Details"
// @Success 200 {object} models.Quotation
// @Router /api/quotations/{id} [patch]
func (h *QuotationHandler) Update(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid quotation ID"})
		return
	}

	var in models.QuotationUpdateInput
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Validation error: " + err.Error()})
		return
	}

	user := middleware.GetCurrentUser(c)
	var userID *int
	if user != nil {
		userID = &user.ID
	}
	workspaceID := 1

	q, err := h.repo.Update(c.Request.Context(), id, in, userID, workspaceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, q)
}

// ChangeStatus godoc
// @Summary Update status of a Quotation (Draft, Sent, Accepted, Rejected, Expired)
// @Tags Quotations
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "Quotation ID"
// @Param body body map[string]string true "Status object"
// @Success 200 {object} models.Quotation
// @Router /api/quotations/{id}/status [post]
func (h *QuotationHandler) ChangeStatus(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid quotation ID"})
		return
	}

	var body struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}

	user := middleware.GetCurrentUser(c)
	var userID *int
	if user != nil {
		userID = &user.ID
	}
	workspaceID := 1

	q, err := h.repo.ChangeStatus(c.Request.Context(), id, strings.TrimSpace(body.Status), userID, workspaceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, q)
}

// Delete godoc
// @Summary Delete a Quotation
// @Tags Quotations
// @Security BearerAuth
// @Param id path int true "Quotation ID"
// @Success 200 {object} map[string]string
// @Router /api/quotations/{id} [delete]
func (h *QuotationHandler) Delete(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid quotation ID"})
		return
	}

	workspaceID := 1
	if err := h.repo.Delete(c.Request.Context(), id, workspaceID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Quotation deleted successfully"})
}
