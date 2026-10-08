package handlers

import (
	"net/http"
	"strconv"

	"crm-backend-go/internal/middleware"
	"crm-backend-go/internal/models"
	"crm-backend-go/internal/repository"

	"github.com/gin-gonic/gin"
)

type OrderHandler struct {
	repo *repository.OrderRepository
}

func NewOrderHandler(repo *repository.OrderRepository) *OrderHandler {
	return &OrderHandler{repo: repo}
}

// List godoc
// @Summary List orders with pagination and filtering
// @Tags Orders
// @Produce json
// @Security BearerAuth
// @Router /api/orders [get]
func (h *OrderHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	stage := c.Query("stage")
	paymentStatus := c.Query("payment_status")
	invoiceStatus := c.Query("invoice_status")
	search := c.Query("search")
	sortBy := c.DefaultQuery("sort_by", "id")
	sortDir := c.DefaultQuery("sort_dir", "desc")

	var custID *int
	if cStr := c.Query("customer_id"); cStr != "" {
		if cid, err := strconv.Atoi(cStr); err == nil && cid > 0 {
			custID = &cid
		}
	}

	var dealID *int
	if dStr := c.Query("deal_id"); dStr != "" {
		if did, err := strconv.Atoi(dStr); err == nil && did > 0 {
			dealID = &did
		}
	}

	var ownerID *int
	if oStr := c.Query("owner_id"); oStr != "" {
		if oid, err := strconv.Atoi(oStr); err == nil && oid > 0 {
			ownerID = &oid
		}
	}

	filter := repository.OrderFilter{
		Stage:         stage,
		PaymentStatus: paymentStatus,
		InvoiceStatus: invoiceStatus,
		CustomerID:    custID,
		DealID:        dealID,
		OwnerID:       ownerID,
		Search:        search,
		Page:          page,
		Limit:         limit,
		SortBy:        sortBy,
		SortDir:       sortDir,
	}

	workspaceID := 1
	resp, err := h.repo.List(c.Request.Context(), filter, workspaceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// Get godoc
// @Summary Get order details by ID
// @Tags Orders
// @Produce json
// @Security BearerAuth
// @Router /api/orders/{id} [get]
func (h *OrderHandler) Get(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid order ID"})
		return
	}

	workspaceID := 1
	order, err := h.repo.GetByID(c.Request.Context(), id, workspaceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	if order == nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": "Order not found"})
		return
	}

	c.JSON(http.StatusOK, order)
}

// Create godoc
// @Summary Create a new order manually
// @Tags Orders
// @Accept json
// @Produce json
// @Security BearerAuth
// @Router /api/orders [post]
func (h *OrderHandler) Create(c *gin.Context) {
	var input models.OrderCreateInput
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

	order, err := h.repo.Create(c.Request.Context(), input, userID, workspaceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, order)
}

// Update godoc
// @Summary Update an existing order
// @Tags Orders
// @Accept json
// @Produce json
// @Security BearerAuth
// @Router /api/orders/{id} [patch]
func (h *OrderHandler) Update(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid order ID"})
		return
	}

	var input models.OrderUpdateInput
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

	order, err := h.repo.Update(c.Request.Context(), id, input, userID, workspaceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, order)
}

// ChangeStage godoc
// @Summary Change order fulfillment stage
// @Tags Orders
// @Accept json
// @Produce json
// @Security BearerAuth
// @Router /api/orders/{id}/stage [post]
func (h *OrderHandler) ChangeStage(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid order ID"})
		return
	}

	var input models.OrderStageChangeInput
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

	order, err := h.repo.ChangeStage(c.Request.Context(), id, input.Stage, input.Notes, userID, workspaceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, order)
}

// Delete godoc
// @Summary Delete an order
// @Tags Orders
// @Security BearerAuth
// @Router /api/orders/{id} [delete]
func (h *OrderHandler) Delete(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid order ID"})
		return
	}

	workspaceID := 1
	if err := h.repo.Delete(c.Request.Context(), id, workspaceID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Order deleted successfully"})
}

// CreateFromDeal godoc
// @Summary Generate an order from a Won deal
// @Tags Orders
// @Security BearerAuth
// @Router /api/deals/{id}/create-order [post]
func (h *OrderHandler) CreateFromDeal(c *gin.Context) {
	dealID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid deal ID"})
		return
	}

	user := middleware.GetCurrentUser(c)
	var userID *int
	if user != nil {
		userID = &user.ID
	}
	workspaceID := 1

	order, err := h.repo.CreateFromWonDeal(c.Request.Context(), dealID, userID, workspaceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, order)
}
