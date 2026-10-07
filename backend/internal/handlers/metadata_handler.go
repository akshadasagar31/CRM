package handlers

import (
	"net/http"
	"strconv"

	"crm-backend-go/internal/middleware"
	"crm-backend-go/internal/repository"

	"github.com/gin-gonic/gin"
)

type MetadataHandler struct {
	metaRepo *repository.MetadataRepository
}

func NewMetadataHandler(metaRepo *repository.MetadataRepository) *MetadataHandler {
	return &MetadataHandler{metaRepo: metaRepo}
}

// --- Custom Fields ---

type CreateCustomFieldRequest struct {
	FieldKey   string   `json:"field_key" binding:"required"`
	FieldLabel string   `json:"field_label" binding:"required"`
	FieldType  string   `json:"field_type" binding:"required"`
	Options    []string `json:"options"`
	Required   bool     `json:"required"`
	Visibility bool     `json:"visibility"`
	FieldOrder int      `json:"field_order"`
	Section    string   `json:"section"`
}

type UpdateCustomFieldRequest struct {
	FieldLabel *string  `json:"field_label"`
	Options    []string `json:"options"`
	Required   *bool    `json:"required"`
	Visibility *bool    `json:"visibility"`
	FieldOrder *int     `json:"field_order"`
	Section    *string  `json:"section"`
}

// ListCustomFields godoc
// @Summary List custom field definitions
// @Tags Leads
// @Produce json
// @Security BearerAuth
// @Success 200 {array} models.CustomFieldDefinitionResponse
// @Router /api/leads/custom-fields [get]
func (h *MetadataHandler) ListCustomFields(c *gin.Context) {
	fields, err := h.metaRepo.ListCustomFields(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Failed to list custom fields: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, fields)
}

// CreateCustomField godoc
// @Summary Define a new dynamic custom field
// @Tags Leads
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body CreateCustomFieldRequest true "Custom Field definition"
// @Success 201 {object} models.CustomFieldDefinitionResponse
// @Router /api/leads/custom-fields [post]
func (h *MetadataHandler) CreateCustomField(c *gin.Context) {
	var req CreateCustomFieldRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid custom field definition: " + err.Error()})
		return
	}

	cf, err := h.metaRepo.CreateCustomField(c.Request.Context(), req.FieldKey, req.FieldLabel, req.FieldType, req.Options, req.Required, req.Visibility, req.FieldOrder, req.Section)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, cf)
}

// UpdateCustomField godoc
// @Summary Update an existing custom field definition
// @Tags Leads
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param field_id path int true "Custom Field ID"
// @Param request body UpdateCustomFieldRequest true "Fields to update"
// @Success 200 {object} models.CustomFieldDefinitionResponse
// @Router /api/leads/custom-fields/{field_id} [patch]
func (h *MetadataHandler) UpdateCustomField(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("field_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid custom field ID"})
		return
	}

	var req UpdateCustomFieldRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid update request: " + err.Error()})
		return
	}

	cf, err := h.metaRepo.UpdateCustomField(c.Request.Context(), id, req.FieldLabel, req.Options, req.Required, req.Visibility, req.FieldOrder, req.Section)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, cf)
}

// DeleteCustomField godoc
// @Summary Delete a custom field definition
// @Tags Leads
// @Security BearerAuth
// @Param field_id path int true "Custom Field ID"
// @Success 200 {object} map[string]interface{}
// @Router /api/leads/custom-fields/{field_id} [delete]
func (h *MetadataHandler) DeleteCustomField(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("field_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid custom field ID"})
		return
	}

	err = h.metaRepo.DeleteCustomField(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Failed to delete custom field"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Custom field deleted"})
}

// --- Statuses ---

type CreateStatusRequest struct {
	Name      string `json:"name" binding:"required"`
	Color     string `json:"color"`
	Order     int    `json:"order"`
	IsDefault bool   `json:"is_default"`
}

// ListStatuses godoc
// @Summary List lead statuses
// @Tags Leads
// @Produce json
// @Security BearerAuth
// @Success 200 {array} models.LeadStatus
// @Router /api/leads/statuses [get]
func (h *MetadataHandler) ListStatuses(c *gin.Context) {
	list, err := h.metaRepo.ListStatuses(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Failed to list statuses: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

// CreateStatus godoc
// @Summary Create a lead status
// @Tags Leads
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body CreateStatusRequest true "Status details"
// @Success 201 {object} models.LeadStatus
// @Router /api/leads/statuses [post]
func (h *MetadataHandler) CreateStatus(c *gin.Context) {
	var req CreateStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid status data"})
		return
	}
	if req.Color == "" {
		req.Color = "#0D9488"
	}

	s, err := h.metaRepo.CreateStatus(c.Request.Context(), req.Name, req.Color, req.Order, req.IsDefault)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Failed to create status: " + err.Error()})
		return
	}
	c.JSON(http.StatusCreated, s)
}

// DeleteStatus godoc
// @Summary Delete lead status
// @Tags Leads
// @Security BearerAuth
// @Param status_id path int true "Status ID"
// @Success 200 {object} map[string]interface{}
// @Router /api/leads/statuses/{status_id} [delete]
func (h *MetadataHandler) DeleteStatus(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("status_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid status ID"})
		return
	}
	_ = h.metaRepo.DeleteStatus(c.Request.Context(), id)
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Status deleted"})
}

// --- Sources ---

type CreateSourceRequest struct {
	Name      string `json:"name" binding:"required"`
	IsDefault bool   `json:"is_default"`
}

// ListSources godoc
// @Summary List lead sources
// @Tags Leads
// @Produce json
// @Security BearerAuth
// @Success 200 {array} models.LeadSource
// @Router /api/leads/sources [get]
func (h *MetadataHandler) ListSources(c *gin.Context) {
	list, err := h.metaRepo.ListSources(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Failed to list sources: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

// CreateSource godoc
// @Summary Create a lead source
// @Tags Leads
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body CreateSourceRequest true "Source details"
// @Success 201 {object} models.LeadSource
// @Router /api/leads/sources [post]
func (h *MetadataHandler) CreateSource(c *gin.Context) {
	var req CreateSourceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid source data"})
		return
	}

	s, err := h.metaRepo.CreateSource(c.Request.Context(), req.Name, req.IsDefault)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Failed to create source: " + err.Error()})
		return
	}
	c.JSON(http.StatusCreated, s)
}

// DeleteSource godoc
// @Summary Delete lead source
// @Tags Leads
// @Security BearerAuth
// @Param source_id path int true "Source ID"
// @Success 200 {object} map[string]interface{}
// @Router /api/leads/sources/{source_id} [delete]
func (h *MetadataHandler) DeleteSource(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("source_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid source ID"})
		return
	}
	_ = h.metaRepo.DeleteSource(c.Request.Context(), id)
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Source deleted"})
}

// --- Tags ---

type CreateTagRequest struct {
	Name  string `json:"name" binding:"required"`
	Color string `json:"color"`
}

// ListTags godoc
// @Summary List tags
// @Tags Leads
// @Produce json
// @Security BearerAuth
// @Success 200 {array} models.Tag
// @Router /api/leads/tags [get]
func (h *MetadataHandler) ListTags(c *gin.Context) {
	list, err := h.metaRepo.ListTags(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Failed to list tags: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, list)
}

// CreateTag godoc
// @Summary Create a tag
// @Tags Leads
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body CreateTagRequest true "Tag details"
// @Success 201 {object} models.Tag
// @Router /api/leads/tags [post]
func (h *MetadataHandler) CreateTag(c *gin.Context) {
	var req CreateTagRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid tag data"})
		return
	}
	if req.Color == "" {
		req.Color = "#6366F1"
	}

	t, err := h.metaRepo.CreateTag(c.Request.Context(), req.Name, req.Color)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Failed to create tag: " + err.Error()})
		return
	}
	c.JSON(http.StatusCreated, t)
}

// DeleteTag godoc
// @Summary Delete tag
// @Tags Leads
// @Security BearerAuth
// @Param tag_id path int true "Tag ID"
// @Success 200 {object} map[string]interface{}
// @Router /api/leads/tags/{tag_id} [delete]
func (h *MetadataHandler) DeleteTag(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("tag_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid tag ID"})
		return
	}
	_ = h.metaRepo.DeleteTag(c.Request.Context(), id)
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Tag deleted"})
}

// --- Duplicate Check Settings ---

type DuplicateSettingsRequest struct {
	CheckPhone bool   `json:"check_phone"`
	CheckEmail bool   `json:"check_email"`
	Action     string `json:"action"` // "prevent" or "warn"
}

// GetDuplicateSettings godoc
// @Summary Get workspace duplicate prevention rules
// @Tags Leads
// @Produce json
// @Security BearerAuth
// @Success 200 {object} models.DuplicateCheckSettings
// @Router /api/leads/settings/duplicates [get]
func (h *MetadataHandler) GetDuplicateSettings(c *gin.Context) {
	settings, err := h.metaRepo.GetDuplicateSettings(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Failed to get duplicate settings"})
		return
	}
	c.JSON(http.StatusOK, settings)
}

// UpdateDuplicateSettings godoc
// @Summary Update workspace duplicate prevention rules
// @Tags Leads
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body DuplicateSettingsRequest true "Duplicate Settings"
// @Success 200 {object} models.DuplicateCheckSettings
// @Router /api/leads/settings/duplicates [put]
func (h *MetadataHandler) UpdateDuplicateSettings(c *gin.Context) {
	var req DuplicateSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid duplicate settings data"})
		return
	}

	settings, err := h.metaRepo.UpdateDuplicateSettings(c.Request.Context(), req.CheckPhone, req.CheckEmail, req.Action)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Failed to update duplicate settings"})
		return
	}
	c.JSON(http.StatusOK, settings)
}

// --- Saved Views ---

type CreateSavedViewRequest struct {
	Name      string                 `json:"name" binding:"required"`
	Filters   map[string]interface{} `json:"filters" binding:"required"`
	IsDefault bool                   `json:"is_default"`
}

// ListSavedViews godoc
// @Summary List saved views for current user
// @Tags Leads
// @Produce json
// @Security BearerAuth
// @Success 200 {array} models.SavedView
// @Router /api/leads/saved-views [get]
func (h *MetadataHandler) ListSavedViews(c *gin.Context) {
	user := middleware.GetCurrentUser(c)
	currentUserID := 1
	if user != nil {
		currentUserID = user.ID
	}

	views, err := h.metaRepo.ListSavedViews(c.Request.Context(), currentUserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Failed to list saved views"})
		return
	}
	c.JSON(http.StatusOK, views)
}

// CreateSavedView godoc
// @Summary Create a saved filter view
// @Tags Leads
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body CreateSavedViewRequest true "Saved View Details"
// @Success 201 {object} models.SavedView
// @Router /api/leads/saved-views [post]
func (h *MetadataHandler) CreateSavedView(c *gin.Context) {
	var req CreateSavedViewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid saved view data"})
		return
	}

	user := middleware.GetCurrentUser(c)
	currentUserID := 1
	if user != nil {
		currentUserID = user.ID
	}

	view, err := h.metaRepo.CreateSavedView(c.Request.Context(), currentUserID, req.Name, req.Filters, req.IsDefault)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Failed to create saved view"})
		return
	}
	c.JSON(http.StatusCreated, view)
}

// DeleteSavedView godoc
// @Summary Delete saved filter view
// @Tags Leads
// @Security BearerAuth
// @Param view_id path int true "Saved View ID"
// @Success 200 {object} map[string]interface{}
// @Router /api/leads/saved-views/{view_id} [delete]
func (h *MetadataHandler) DeleteSavedView(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("view_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid view ID"})
		return
	}

	user := middleware.GetCurrentUser(c)
	currentUserID := 1
	if user != nil {
		currentUserID = user.ID
	}

	err = h.metaRepo.DeleteSavedView(c.Request.Context(), id, currentUserID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": "Saved view not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Saved view deleted"})
}
