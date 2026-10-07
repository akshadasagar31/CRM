package handlers

import (
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"crm-backend-go/internal/middleware"
	"crm-backend-go/internal/repository"

	"github.com/gin-gonic/gin"
)

type InteractionHandler struct {
	interactionRepo *repository.InteractionRepository
}

func NewInteractionHandler(interactionRepo *repository.InteractionRepository) *InteractionHandler {
	return &InteractionHandler{interactionRepo: interactionRepo}
}

func getInteractionLeadNumber(c *gin.Context) string {
	raw := c.Param("number")
	if unescaped, err := url.PathUnescape(raw); err == nil && unescaped != "" {
		return strings.TrimSpace(unescaped)
	}
	return strings.TrimSpace(raw)
}

type CreateNoteRequest struct {
	Content string `json:"content" binding:"required,min=1,max=5000"`
}

// ListNotes godoc
// @Summary List internal notes for a lead
// @Tags Leads
// @Produce json
// @Security BearerAuth
// @Param number path string true "Lead Number"
// @Success 200 {array} models.LeadNote
// @Router /api/leads/{number}/notes [get]
func (h *InteractionHandler) ListNotes(c *gin.Context) {
	number := getInteractionLeadNumber(c)
	notes, err := h.interactionRepo.ListNotes(c.Request.Context(), number)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Failed to fetch notes: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, notes)
}

// CreateNote godoc
// @Summary Add internal note to a lead
// @Tags Leads
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param number path string true "Lead Number"
// @Param request body CreateNoteRequest true "Note content"
// @Success 201 {object} models.LeadNote
// @Router /api/leads/{number}/notes [post]
func (h *InteractionHandler) CreateNote(c *gin.Context) {
	number := getInteractionLeadNumber(c)
	var req CreateNoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid note content: " + err.Error()})
		return
	}

	user := middleware.GetCurrentUser(c)
	var userID *int
	if user != nil {
		userID = &user.ID
	}

	note, err := h.interactionRepo.AddNote(c.Request.Context(), number, userID, req.Content)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Failed to add note: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, note)
}

// DeleteNote godoc
// @Summary Delete internal note from a lead
// @Tags Leads
// @Security BearerAuth
// @Param number path string true "Lead Number"
// @Param note_id path int true "Note ID"
// @Success 200 {object} map[string]interface{}
// @Router /api/leads/{number}/notes/{note_id} [delete]
func (h *InteractionHandler) DeleteNote(c *gin.Context) {
	number := getInteractionLeadNumber(c)
	noteID, err := strconv.Atoi(c.Param("note_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid note ID"})
		return
	}

	err = h.interactionRepo.DeleteNote(c.Request.Context(), number, noteID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": "Note not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Note deleted"})
}

type CreateFollowUpRequest struct {
	Title        string    `json:"title" binding:"required"`
	FollowUpType string    `json:"follow_up_type"`
	DueDate      time.Time `json:"due_date" binding:"required"`
	Notes        *string   `json:"notes"`
}

// ListFollowUps godoc
// @Summary List follow-ups for a lead
// @Tags Leads
// @Produce json
// @Security BearerAuth
// @Param number path string true "Lead Number"
// @Success 200 {array} models.FollowUp
// @Router /api/leads/{number}/follow-ups [get]
func (h *InteractionHandler) ListFollowUps(c *gin.Context) {
	number := getInteractionLeadNumber(c)
	followups, err := h.interactionRepo.ListFollowUps(c.Request.Context(), number)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Failed to fetch follow-ups: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, followups)
}

// CreateFollowUp godoc
// @Summary Schedule a follow-up for a lead
// @Tags Leads
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param number path string true "Lead Number"
// @Param request body CreateFollowUpRequest true "Follow-up Details"
// @Success 201 {object} models.FollowUp
// @Router /api/leads/{number}/follow-ups [post]
func (h *InteractionHandler) CreateFollowUp(c *gin.Context) {
	number := getInteractionLeadNumber(c)
	var req CreateFollowUpRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid follow-up details: " + err.Error()})
		return
	}

	user := middleware.GetCurrentUser(c)
	var userID *int
	if user != nil {
		userID = &user.ID
	}

	fup, err := h.interactionRepo.CreateFollowUp(c.Request.Context(), number, userID, req.Title, req.FollowUpType, req.DueDate, req.Notes)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Failed to schedule follow-up: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, fup)
}

type UpdateFollowUpRequest struct {
	Title        *string    `json:"title"`
	FollowUpType *string    `json:"follow_up_type"`
	DueDate      *time.Time `json:"due_date"`
	Completed    *bool      `json:"completed"`
	Notes        *string    `json:"notes"`
}

// UpdateFollowUp godoc
// @Summary Update follow-up status or details
// @Tags Leads
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param number path string true "Lead Number"
// @Param follow_up_id path int true "Follow-up ID"
// @Param request body UpdateFollowUpRequest true "Update fields"
// @Success 200 {object} models.FollowUp
// @Router /api/leads/{number}/follow-ups/{follow_up_id} [patch]
func (h *InteractionHandler) UpdateFollowUp(c *gin.Context) {
	number := getInteractionLeadNumber(c)
	fupID, err := strconv.Atoi(c.Param("follow_up_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid follow-up ID"})
		return
	}

	var req UpdateFollowUpRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid update request: " + err.Error()})
		return
	}

	fup, err := h.interactionRepo.UpdateFollowUp(c.Request.Context(), number, fupID, req.Title, req.FollowUpType, req.DueDate, req.Completed, req.Notes)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": "Follow-up not found: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, fup)
}

// ListActivities godoc
// @Summary Get chronological audit timeline for a lead
// @Tags Leads
// @Produce json
// @Security BearerAuth
// @Param number path string true "Lead Number"
// @Success 200 {array} models.LeadActivity
// @Router /api/leads/{number}/activities [get]
func (h *InteractionHandler) ListActivities(c *gin.Context) {
	number := getInteractionLeadNumber(c)
	activities, err := h.interactionRepo.ListActivities(c.Request.Context(), number)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Failed to fetch activities: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, activities)
}
