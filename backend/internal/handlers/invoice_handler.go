package handlers

import (
	"fmt"
	"net/http"
	"strconv"

	"crm-backend-go/internal/middleware"
	"crm-backend-go/internal/models"
	"crm-backend-go/internal/pdf"
	"crm-backend-go/internal/repository"

	"github.com/gin-gonic/gin"
)

type InvoiceHandler struct {
	repo        *repository.InvoiceRepository
	companyRepo *repository.CompanyRepository
}

func NewInvoiceHandler(repo *repository.InvoiceRepository, companyRepo *repository.CompanyRepository) *InvoiceHandler {
	return &InvoiceHandler{repo: repo, companyRepo: companyRepo}
}

// List godoc
// @Summary List invoices with pagination, filtering, search, and metrics
// @Tags Invoices
// @Produce json
// @Security BearerAuth
// @Router /api/invoices [get]
func (h *InvoiceHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "25"))
	search := c.Query("search")
	status := c.Query("status")

	var customerID, orderID, quotationID, dealID *int
	if cID, err := strconv.Atoi(c.Query("customer_id")); err == nil && cID > 0 {
		customerID = &cID
	}
	if oID, err := strconv.Atoi(c.Query("order_id")); err == nil && oID > 0 {
		orderID = &oID
	}
	if qID, err := strconv.Atoi(c.Query("quotation_id")); err == nil && qID > 0 {
		quotationID = &qID
	}
	if dID, err := strconv.Atoi(c.Query("deal_id")); err == nil && dID > 0 {
		dealID = &dID
	}

	workspaceID := 1
	filter := repository.InvoiceListFilter{
		Search:      search,
		Status:      status,
		CustomerID:  customerID,
		OrderID:     orderID,
		QuotationID: quotationID,
		DealID:      dealID,
		Page:        page,
		Limit:       limit,
	}

	resp, err := h.repo.List(c.Request.Context(), filter, workspaceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": fmt.Sprintf("Failed to list invoices: %v", err)})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// Get godoc
// @Summary Get invoice by ID
// @Tags Invoices
// @Produce json
// @Security BearerAuth
// @Router /api/invoices/{id} [get]
func (h *InvoiceHandler) Get(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid invoice ID"})
		return
	}

	invoice, err := h.repo.Get(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, invoice)
}

// Create godoc
// @Summary Create a new invoice
// @Tags Invoices
// @Accept json
// @Produce json
// @Security BearerAuth
// @Router /api/invoices [post]
func (h *InvoiceHandler) Create(c *gin.Context) {
	var input models.InvoiceCreateInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}

	user := middleware.GetCurrentUser(c)
	var userID *int
	if user != nil {
		userID = &user.ID
	}
	workspaceID := 1

	invoice, err := h.repo.Create(c.Request.Context(), input, userID, workspaceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, invoice)
}

// CreateFromOrder godoc
// @Summary Create invoice directly from an Order
// @Tags Invoices
// @Produce json
// @Security BearerAuth
// @Router /api/invoices/from-order/{order_id} [post]
func (h *InvoiceHandler) CreateFromOrder(c *gin.Context) {
	paramID := c.Param("order_id")
	if paramID == "" {
		paramID = c.Param("id")
	}
	orderID, err := strconv.Atoi(paramID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid order ID"})
		return
	}

	user := middleware.GetCurrentUser(c)
	var userID *int
	if user != nil {
		userID = &user.ID
	}
	workspaceID := 1

	invoice, err := h.repo.CreateFromOrder(c.Request.Context(), orderID, userID, workspaceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, invoice)
}

// CreateFromQuotation godoc
// @Summary Create invoice directly from an accepted Quotation
// @Tags Invoices
// @Produce json
// @Security BearerAuth
// @Router /api/invoices/from-quotation/{quotation_id} [post]
func (h *InvoiceHandler) CreateFromQuotation(c *gin.Context) {
	paramID := c.Param("quotation_id")
	if paramID == "" {
		paramID = c.Param("id")
	}
	quotationID, err := strconv.Atoi(paramID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid quotation ID"})
		return
	}

	user := middleware.GetCurrentUser(c)
	var userID *int
	if user != nil {
		userID = &user.ID
	}
	workspaceID := 1

	invoice, err := h.repo.CreateFromQuotation(c.Request.Context(), quotationID, userID, workspaceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, invoice)
}

// Update godoc
// @Summary Update invoice details
// @Tags Invoices
// @Accept json
// @Produce json
// @Security BearerAuth
// @Router /api/invoices/{id} [patch]
func (h *InvoiceHandler) Update(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid invoice ID"})
		return
	}

	var input models.InvoiceUpdateInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}

	user := middleware.GetCurrentUser(c)
	var userID *int
	if user != nil {
		userID = &user.ID
	}
	workspaceID := 1

	invoice, err := h.repo.Update(c.Request.Context(), id, input, userID, workspaceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, invoice)
}

// RecordPayment godoc
// @Summary Record a payment on an invoice
// @Tags Invoices
// @Accept json
// @Produce json
// @Security BearerAuth
// @Router /api/invoices/{id}/payment [post]
func (h *InvoiceHandler) RecordPayment(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid invoice ID"})
		return
	}

	var input models.InvoicePaymentInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}

	user := middleware.GetCurrentUser(c)
	var userID *int
	if user != nil {
		userID = &user.ID
	}
	workspaceID := 1

	invoice, err := h.repo.RecordPayment(c.Request.Context(), id, input, userID, workspaceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, invoice)
}

// ChangeStatus godoc
// @Summary Change invoice status
// @Tags Invoices
// @Accept json
// @Produce json
// @Security BearerAuth
// @Router /api/invoices/{id}/status [post]
func (h *InvoiceHandler) ChangeStatus(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid invoice ID"})
		return
	}

	var input models.InvoiceStatusInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}

	user := middleware.GetCurrentUser(c)
	var userID *int
	if user != nil {
		userID = &user.ID
	}
	workspaceID := 1

	invoice, err := h.repo.ChangeStatus(c.Request.Context(), id, input.Status, userID, workspaceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, invoice)
}

// Delete godoc
// @Summary Delete an invoice
// @Tags Invoices
// @Produce json
// @Security BearerAuth
// @Router /api/invoices/{id} [delete]
func (h *InvoiceHandler) Delete(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid invoice ID"})
		return
	}

	if err := h.repo.Delete(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Invoice deleted successfully"})
}

// GeneratePDF godoc
// @Summary Generate Maroto v2 A4 PDF for an Invoice
// @Tags Invoices
// @Produce application/pdf
// @Security BearerAuth
// @Param id path int true "Invoice ID"
// @Param action query string false "inline or download"
// @Router /api/invoices/{id}/pdf [get]
func (h *InvoiceHandler) GeneratePDF(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid invoice ID"})
		return
	}

	invoice, err := h.repo.Get(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": "Invoice not found"})
		return
	}

	var comp *models.CompanyProfile
	var logoBytes []byte
	var logoMime string
	if h.companyRepo != nil {
		comp, _ = h.companyRepo.GetProfile(c.Request.Context())
		logoBytes, logoMime, _ = h.companyRepo.GetLogo(c.Request.Context())
	}

	pdfBytes, err := pdf.GenerateInvoicePDF(invoice, comp, logoBytes, logoMime)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": fmt.Sprintf("Failed to generate PDF: %v", err)})
		return
	}

	action := c.DefaultQuery("action", "inline")
	filename := fmt.Sprintf("Invoice-%s.pdf", invoice.InvoiceNumber)
	if action == "download" {
		c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	} else {
		c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	}

	c.Header("Content-Type", "application/pdf")
	c.Data(http.StatusOK, "application/pdf", pdfBytes)
}
