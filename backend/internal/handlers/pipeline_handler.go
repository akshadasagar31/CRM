package handlers

import (
	"net/http"
	"strconv"

	"crm-backend-go/internal/models"
	"crm-backend-go/internal/repository"

	"github.com/gin-gonic/gin"
)

type PipelineHandler struct {
	repo *repository.PipelineRepository
}

func NewPipelineHandler(repo *repository.PipelineRepository) *PipelineHandler {
	return &PipelineHandler{repo: repo}
}

func (h *PipelineHandler) List(c *gin.Context) {
	workspaceID := 1
	pipelines, err := h.repo.ListWithStages(c.Request.Context(), workspaceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	c.JSON(http.StatusOK, pipelines)
}

func (h *PipelineHandler) Get(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid pipeline ID"})
		return
	}

	workspaceID := 1
	pipeline, err := h.repo.GetByID(c.Request.Context(), id, workspaceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	if pipeline == nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": "Pipeline not found"})
		return
	}

	c.JSON(http.StatusOK, pipeline)
}

func (h *PipelineHandler) Create(c *gin.Context) {
	var input models.PipelineCreateInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}

	workspaceID := 1
	pipeline, err := h.repo.Create(c.Request.Context(), input, workspaceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, pipeline)
}

func (h *PipelineHandler) Update(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid pipeline ID"})
		return
	}

	var body struct {
		Name      string `json:"name"`
		IsDefault *bool  `json:"is_default"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}

	workspaceID := 1
	pipeline, err := h.repo.Update(c.Request.Context(), id, body.Name, body.IsDefault, workspaceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, pipeline)
}

func (h *PipelineHandler) Delete(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid pipeline ID"})
		return
	}

	workspaceID := 1
	if err := h.repo.Delete(c.Request.Context(), id, workspaceID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Pipeline deleted successfully"})
}

func (h *PipelineHandler) CreateStage(c *gin.Context) {
	pipeID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid pipeline ID"})
		return
	}

	var input models.DealStageCreateInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}

	stage, err := h.repo.CreateStage(c.Request.Context(), pipeID, input)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, stage)
}

func (h *PipelineHandler) UpdateStage(c *gin.Context) {
	stageID, err := strconv.Atoi(c.Param("stage_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid stage ID"})
		return
	}

	var input models.DealStageUpdateInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}

	stage, err := h.repo.UpdateStage(c.Request.Context(), stageID, input)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, stage)
}

func (h *PipelineHandler) DeleteStage(c *gin.Context) {
	stageID, err := strconv.Atoi(c.Param("stage_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid stage ID"})
		return
	}

	if err := h.repo.DeleteStage(c.Request.Context(), stageID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Stage deleted successfully"})
}

func (h *PipelineHandler) ReorderStages(c *gin.Context) {
	pipeID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid pipeline ID"})
		return
	}

	var body struct {
		StageIDs []int `json:"stage_ids" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}

	if err := h.repo.ReorderStages(c.Request.Context(), pipeID, body.StageIDs); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Stages reordered successfully"})
}
