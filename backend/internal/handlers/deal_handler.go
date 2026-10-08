package handlers

import (
	"net/http"
	"strconv"
	"time"

	"crm-backend-go/internal/middleware"
	"crm-backend-go/internal/models"
	"crm-backend-go/internal/repository"
	"crm-backend-go/internal/utils"

	"github.com/gin-gonic/gin"
)

type DealHandler struct {
	repo *repository.DealRepository
}

func NewDealHandler(repo *repository.DealRepository) *DealHandler {
	return &DealHandler{repo: repo}
}

func (h *DealHandler) List(c *gin.Context) {
	search := c.Query("search")
	priority := c.Query("priority")
	status := c.Query("status")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))

	var pipeID *int
	if pStr := c.Query("pipeline_id"); pStr != "" {
		if pid, err := strconv.Atoi(pStr); err == nil && pid > 0 {
			pipeID = &pid
		}
	}

	var stageID *int
	if sStr := c.Query("stage_id"); sStr != "" {
		if sid, err := strconv.Atoi(sStr); err == nil && sid > 0 {
			stageID = &sid
		}
	}

	var ownerID *int
	if oStr := c.Query("owner_id"); oStr != "" {
		if oid, err := strconv.Atoi(oStr); err == nil && oid > 0 {
			ownerID = &oid
		}
	}

	filter := repository.DealFilter{
		Search:     search,
		PipelineID: pipeID,
		StageID:    stageID,
		OwnerID:    ownerID,
		Priority:   priority,
		Status:     status,
		Page:       page,
		Limit:      limit,
	}

	workspaceID := 1
	resp, err := h.repo.List(c.Request.Context(), filter, workspaceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *DealHandler) Get(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid deal ID"})
		return
	}

	workspaceID := 1
	deal, err := h.repo.GetByID(c.Request.Context(), id, workspaceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	if deal == nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": "Deal not found"})
		return
	}

	c.JSON(http.StatusOK, deal)
}

func (h *DealHandler) Create(c *gin.Context) {
	var input models.DealCreateInput
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

	deal, err := h.repo.Create(c.Request.Context(), input, userID, workspaceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, deal)
}

func (h *DealHandler) Update(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid deal ID"})
		return
	}

	var input models.DealUpdateInput
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

	deal, err := h.repo.Update(c.Request.Context(), id, input, userID, workspaceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, deal)
}

func (h *DealHandler) ChangeStage(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid deal ID"})
		return
	}

	var input models.DealStageChangeInput
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

	deal, err := h.repo.ChangeStage(c.Request.Context(), id, input.StageID, input.LostReason, userID, workspaceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, deal)
}

func (h *DealHandler) Delete(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid deal ID"})
		return
	}

	workspaceID := 1
	if err := h.repo.Delete(c.Request.Context(), id, workspaceID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Deal deleted successfully"})
}

func (h *DealHandler) ListActivities(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid deal ID"})
		return
	}

	activities, err := h.repo.ListActivities(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, activities)
}

func (h *DealHandler) ListNotes(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid deal ID"})
		return
	}

	notes, err := h.repo.ListNotes(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, notes)
}

func (h *DealHandler) CreateNote(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid deal ID"})
		return
	}

	var body struct {
		Content string `json:"content" binding:"required"`
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

	note, err := h.repo.CreateNote(c.Request.Context(), id, userID, body.Content)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, note)
}

func (h *DealHandler) DeleteNote(c *gin.Context) {
	dealID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid deal ID"})
		return
	}
	noteID, err := strconv.Atoi(c.Param("note_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid note ID"})
		return
	}

	if err := h.repo.DeleteNote(c.Request.Context(), dealID, noteID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Note deleted successfully"})
}

func (h *DealHandler) ListFollowUps(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid deal ID"})
		return
	}

	followUps, err := h.repo.ListFollowUps(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, followUps)
}

func (h *DealHandler) CreateFollowUp(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid deal ID"})
		return
	}

	var body struct {
		Title        string             `json:"title" binding:"required"`
		FollowUpType string             `json:"follow_up_type"`
		DueDate      utils.NullableTime `json:"due_date" binding:"required"`
		Notes        *string            `json:"notes"`
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

	var dueDate time.Time
	if body.DueDate.Val != nil {
		dueDate = *body.DueDate.Val
	} else {
		dueDate = time.Now()
	}

	fu, err := h.repo.CreateFollowUp(c.Request.Context(), id, body.Title, body.FollowUpType, dueDate, body.Notes, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, fu)
}

func (h *DealHandler) ConvertLead(c *gin.Context) {
	leadNumber := c.Param("number")
	if leadNumber == "" {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Lead number is required"})
		return
	}

	var input models.LeadConvertInput
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

	resp, err := h.repo.ConvertLeadToDeal(c.Request.Context(), leadNumber, input, userID, workspaceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}
