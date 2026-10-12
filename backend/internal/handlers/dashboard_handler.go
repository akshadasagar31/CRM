package handlers

import (
	"net/http"
	"strconv"

	"crm-backend-go/internal/repository"

	"github.com/gin-gonic/gin"
)

type DashboardHandler struct {
	repo *repository.DashboardRepository
}

func NewDashboardHandler(repo *repository.DashboardRepository) *DashboardHandler {
	return &DashboardHandler{repo: repo}
}

// GetMetrics godoc
// @Summary Get live dashboard aggregate metrics
// @Tags Dashboard
// @Produce json
// @Security BearerAuth
// @Router /api/dashboard/metrics [get]
func (h *DashboardHandler) GetMetrics(c *gin.Context) {
	timeframe := c.DefaultQuery("timeframe", "this_month")
	workspaceID := 1

	metrics, err := h.repo.GetMetrics(c.Request.Context(), timeframe, workspaceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, metrics)
}

// GetSalesChart godoc
// @Summary Get monthly invoiced vs received sales chart data
// @Tags Dashboard
// @Produce json
// @Security BearerAuth
// @Router /api/dashboard/sales-chart [get]
func (h *DashboardHandler) GetSalesChart(c *gin.Context) {
	timeframe := c.DefaultQuery("timeframe", "all")
	workspaceID := 1

	chart, err := h.repo.GetSalesChart(c.Request.Context(), timeframe, workspaceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, chart)
}

// GetPipelineDistribution godoc
// @Summary Get deals count and value grouped by active pipeline stages
// @Tags Dashboard
// @Produce json
// @Security BearerAuth
// @Router /api/dashboard/pipeline-distribution [get]
func (h *DashboardHandler) GetPipelineDistribution(c *gin.Context) {
	workspaceID := 1

	dist, err := h.repo.GetPipelineDistribution(c.Request.Context(), workspaceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, dist)
}

// GetActivities godoc
// @Summary Get unified recent activities across modules
// @Tags Dashboard
// @Produce json
// @Security BearerAuth
// @Router /api/dashboard/activities [get]
func (h *DashboardHandler) GetActivities(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "15"))
	workspaceID := 1

	activities, err := h.repo.GetRecentActivities(c.Request.Context(), limit, workspaceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, activities)
}
