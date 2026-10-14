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

type InventoryHandler struct {
	repo *repository.InventoryRepository
}

func NewInventoryHandler(repo *repository.InventoryRepository) *InventoryHandler {
	return &InventoryHandler{repo: repo}
}

// GetStats handles GET /api/inventory/stats
func (h *InventoryHandler) GetStats(c *gin.Context) {
	workspaceID := 1
	stats, err := h.repo.GetStats(c.Request.Context(), workspaceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	c.JSON(http.StatusOK, stats)
}

// ListMovements handles GET /api/inventory/movements
func (h *InventoryHandler) ListMovements(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	mType := c.Query("movement_type")
	refType := c.Query("reference_type")

	filter := models.StockMovementFilter{
		Page:  page,
		Limit: limit,
	}

	if pIDStr := c.Query("product_id"); pIDStr != "" {
		if pID, err := strconv.Atoi(pIDStr); err == nil && pID > 0 {
			filter.ProductID = &pID
		}
	}

	if strings.TrimSpace(mType) != "" && strings.ToLower(mType) != "all" {
		filter.MovementType = &mType
	}

	if strings.TrimSpace(refType) != "" && strings.ToLower(refType) != "all" {
		filter.ReferenceType = &refType
	}

	workspaceID := 1
	res, err := h.repo.ListMovements(c.Request.Context(), filter, workspaceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, res)
}

// GetAlerts handles GET /api/inventory/alerts
func (h *InventoryHandler) GetAlerts(c *gin.Context) {
	workspaceID := 1
	alerts, err := h.repo.GetLowStockAlerts(c.Request.Context(), workspaceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	c.JSON(http.StatusOK, alerts)
}

// StockIn handles POST /api/inventory/stock-in
func (h *InventoryHandler) StockIn(c *gin.Context) {
	var input models.StockInInput
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

	movement, err := h.repo.StockIn(c.Request.Context(), input, userID, workspaceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, movement)
}

// AdjustStock handles POST /api/inventory/adjust
func (h *InventoryHandler) AdjustStock(c *gin.Context) {
	var input models.StockAdjustmentInput
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

	movement, err := h.repo.AdjustStock(c.Request.Context(), input, userID, workspaceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, movement)
}

// ReturnStock handles POST /api/inventory/return
func (h *InventoryHandler) ReturnStock(c *gin.Context) {
	var input models.StockReturnInput
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

	movement, err := h.repo.ReturnStock(c.Request.Context(), input, userID, workspaceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, movement)
}
