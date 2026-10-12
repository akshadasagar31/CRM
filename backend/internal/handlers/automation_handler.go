package handlers

import (
	"fmt"
	"net/http"
	"strconv"

	"crm-backend-go/internal/models"
	"crm-backend-go/internal/repository"

	"github.com/gin-gonic/gin"
)

type AutomationHandler struct {
	repo *repository.AutomationRepository
}

func NewAutomationHandler(repo *repository.AutomationRepository) *AutomationHandler {
	return &AutomationHandler{repo: repo}
}

// ListReminders godoc
// @Summary List active automated reminders
// @Tags Automation
// @Produce json
// @Security BearerAuth
// @Router /api/automation/reminders [get]
func (h *AutomationHandler) ListReminders(c *gin.Context) {
	status := c.DefaultQuery("status", "active")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	workspaceID := 1

	reminders, err := h.repo.ListReminders(c.Request.Context(), status, workspaceID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, reminders)
}

// EvaluateReminders godoc
// @Summary Run on-demand automated reminder evaluation
// @Tags Automation
// @Produce json
// @Security BearerAuth
// @Router /api/automation/reminders/evaluate [post]
func (h *AutomationHandler) EvaluateReminders(c *gin.Context) {
	workspaceID := 1

	count, err := h.repo.EvaluateReminders(c.Request.Context(), workspaceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":                   "Automated reminders evaluated successfully",
		"reminders_synced_or_found": count,
	})
}

// UpdateReminderStatus godoc
// @Summary Update reminder status (snooze, dismiss, resolve)
// @Tags Automation
// @Accept json
// @Produce json
// @Security BearerAuth
// @Router /api/automation/reminders/{id}/status [patch]
func (h *AutomationHandler) UpdateReminderStatus(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid reminder ID"})
		return
	}

	var input models.ReminderStatusInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("invalid input: %v", err)})
		return
	}

	workspaceID := 1
	if err := h.repo.UpdateReminderStatus(c.Request.Context(), id, input.Status, input.SnoozeHours, workspaceID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Reminder status updated to %s", input.Status),
	})
}
