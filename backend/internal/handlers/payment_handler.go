package handlers

import (
	"fmt"
	"net/http"
	"strconv"

	"crm-backend-go/internal/middleware"
	"crm-backend-go/internal/models"
	"crm-backend-go/internal/repository"

	"github.com/gin-gonic/gin"
)

type PaymentHandler struct {
	repo *repository.PaymentRepository
}

func NewPaymentHandler(repo *repository.PaymentRepository) *PaymentHandler {
	return &PaymentHandler{repo: repo}
}

// List godoc
// @Summary List payments ledger with pagination and filters
// @Tags Payments
// @Produce json
// @Security BearerAuth
// @Router /api/payments [get]
func (h *PaymentHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "25"))
	search := c.Query("search")
	method := c.Query("method")
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")

	var customerID, invoiceID *int
	if cID, err := strconv.Atoi(c.Query("customer_id")); err == nil && cID > 0 {
		customerID = &cID
	}
	if iID, err := strconv.Atoi(c.Query("invoice_id")); err == nil && iID > 0 {
		invoiceID = &iID
	}

	workspaceID := 1
	filter := repository.PaymentFilter{
		Search:        search,
		PaymentMethod: method,
		StartDate:     startDate,
		EndDate:       endDate,
		CustomerID:    customerID,
		InvoiceID:     invoiceID,
		Page:          page,
		Limit:         limit,
	}

	res, err := h.repo.List(c.Request.Context(), filter, workspaceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, res)
}

// GetSummary godoc
// @Summary Get payment aggregates and summary metrics
// @Tags Payments
// @Produce json
// @Security BearerAuth
// @Router /api/payments/summary [get]
func (h *PaymentHandler) GetSummary(c *gin.Context) {
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")

	var customerID *int
	if cID, err := strconv.Atoi(c.Query("customer_id")); err == nil && cID > 0 {
		customerID = &cID
	}

	workspaceID := 1
	summary, err := h.repo.GetSummary(c.Request.Context(), startDate, endDate, customerID, workspaceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, summary)
}

// RecordPayment godoc
// @Summary Record a new payment against an invoice
// @Tags Payments
// @Accept json
// @Produce json
// @Security BearerAuth
// @Router /api/payments [post]
func (h *PaymentHandler) RecordPayment(c *gin.Context) {
	var input models.GlobalPaymentInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("invalid input: %v", err)})
		return
	}

	var recordedByID *int
	if user := middleware.GetCurrentUser(c); user != nil {
		recordedByID = &user.ID
	}

	workspaceID := 1
	payment, err := h.repo.RecordPayment(c.Request.Context(), input, recordedByID, workspaceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, payment)
}

// DeletePayment godoc
// @Summary Void / Delete a payment (Admin & Manager only)
// @Tags Payments
// @Security BearerAuth
// @Router /api/payments/{id} [delete]
func (h *PaymentHandler) DeletePayment(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payment ID"})
		return
	}

	workspaceID := 1
	if err := h.repo.DeletePayment(c.Request.Context(), id, workspaceID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Payment voided and removed successfully"})
}

// GetReceipt godoc
// @Summary Get payment receipt details
// @Tags Payments
// @Produce json
// @Security BearerAuth
// @Router /api/payments/{id}/receipt [get]
func (h *PaymentHandler) GetReceipt(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payment ID"})
		return
	}

	workspaceID := 1
	receipt, err := h.repo.GetReceipt(c.Request.Context(), id, workspaceID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, receipt)
}
