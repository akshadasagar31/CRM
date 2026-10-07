package handlers

import (
	"bytes"
	"encoding/csv"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"crm-backend-go/internal/middleware"
	"crm-backend-go/internal/repository"

	"github.com/gin-gonic/gin"
)

type LeadHandler struct {
	leadRepo *repository.LeadRepository
}

func NewLeadHandler(leadRepo *repository.LeadRepository) *LeadHandler {
	return &LeadHandler{leadRepo: leadRepo}
}

func getLeadNumber(c *gin.Context) string {
	raw := c.Param("number")
	if unescaped, err := url.PathUnescape(raw); err == nil && unescaped != "" {
		return strings.TrimSpace(unescaped)
	}
	return strings.TrimSpace(raw)
}

// CreateLead godoc
// @Summary Create a new lead
// @Tags Leads
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param lead body repository.CreateLeadInput true "Lead Data"
// @Success 201 {object} models.LeadResponse
// @Failure 400 {object} map[string]string
// @Failure 409 {object} map[string]string
// @Router /api/leads [post]
func (h *LeadHandler) Create(c *gin.Context) {
	var in repository.CreateLeadInput
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Validation error: " + err.Error()})
		return
	}

	user := middleware.GetCurrentUser(c)
	currentUserID := 1
	if user != nil {
		currentUserID = user.ID
	}

	lead, err := h.leadRepo.Create(c.Request.Context(), in, currentUserID)
	if err != nil {
		var confErr *repository.ConflictError
		if errors.As(err, &confErr) {
			c.JSON(http.StatusConflict, gin.H{"detail": confErr.Message})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Failed to create lead: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, lead)
}

// ListLeads godoc
// @Summary List leads with filtering, search, pagination, and saved views
// @Tags Leads
// @Produce json
// @Security BearerAuth
// @Param view query string false "Saved view (all, my, unassigned, hot, today, overdue, trash)"
// @Param search query string false "Search query"
// @Param status query string false "Filter by status"
// @Param source query string false "Filter by source"
// @Param owner_id query int false "Filter by owner ID"
// @Param tag query string false "Filter by tag"
// @Param page query int false "Page number" default(1)
// @Param limit query int false "Items per page" default(20)
// @Param sort_by query string false "Sort field" default(created_at)
// @Param sort_dir query string false "Sort direction" default(desc)
// @Success 200 {object} models.LeadListResponse
// @Router /api/leads [get]
func (h *LeadHandler) List(c *gin.Context) {
	user := middleware.GetCurrentUser(c)
	currentUserID := 1
	if user != nil {
		currentUserID = user.ID
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	sortBy := c.DefaultQuery("sort_by", "created_at")
	sortDir := c.DefaultQuery("sort_dir", "desc")

	var ownerIDPtr *int
	if ownerStr := c.Query("owner_id"); ownerStr != "" {
		if id, err := strconv.Atoi(ownerStr); err == nil {
			ownerIDPtr = &id
		}
	}

	f := repository.ListFilter{
		View:          c.Query("view"),
		Search:        c.Query("search"),
		Status:        c.Query("status"),
		Source:        c.Query("source"),
		OwnerID:       ownerIDPtr,
		Tag:           c.Query("tag"),
		Page:          page,
		Limit:         limit,
		SortBy:        sortBy,
		SortDir:       sortDir,
		CurrentUserID: currentUserID,
	}

	res, err := h.leadRepo.List(c.Request.Context(), f)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Failed to query leads: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, res)
}

// GetLead godoc
// @Summary Get lead by unique number
// @Tags Leads
// @Produce json
// @Security BearerAuth
// @Param number path string true "Lead Number"
// @Success 200 {object} models.LeadResponse
// @Failure 404 {object} map[string]string
// @Router /api/leads/{number} [get]
func (h *LeadHandler) Get(c *gin.Context) {
	number := getLeadNumber(c)
	lead, err := h.leadRepo.GetByNumber(c.Request.Context(), number)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Error finding lead: " + err.Error()})
		return
	}
	if lead == nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": fmt.Sprintf("Lead with number '%s' not found.", number)})
		return
	}

	c.JSON(http.StatusOK, lead)
}

// UpdateLead godoc
// @Summary Update lead fields
// @Tags Leads
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param number path string true "Lead Number"
// @Param update body repository.UpdateLeadInput true "Fields to update"
// @Success 200 {object} models.LeadResponse
// @Failure 404 {object} map[string]string
// @Failure 409 {object} map[string]string
// @Router /api/leads/{number} [patch]
func (h *LeadHandler) Update(c *gin.Context) {
	number := getLeadNumber(c)
	var in repository.UpdateLeadInput
	if err := c.ShouldBindJSON(&in); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid update body: " + err.Error()})
		return
	}

	user := middleware.GetCurrentUser(c)
	currentUserID := 1
	if user != nil {
		currentUserID = user.ID
	}

	lead, err := h.leadRepo.Update(c.Request.Context(), number, in, currentUserID)
	if err != nil {
		var confErr *repository.ConflictError
		if errors.As(err, &confErr) {
			c.JSON(http.StatusConflict, gin.H{"detail": confErr.Message})
			return
		}
		if err.Error() == "lead not found" {
			c.JSON(http.StatusNotFound, gin.H{"detail": fmt.Sprintf("Lead with number '%s' not found.", number)})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Failed to update lead: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, lead)
}

// DeleteLead godoc
// @Summary Delete lead (soft delete or permanent delete)
// @Tags Leads
// @Security BearerAuth
// @Param number path string true "Lead Number"
// @Param permanent query bool false "Hard delete permanently" default(false)
// @Success 200 {object} map[string]interface{}
// @Failure 404 {object} map[string]string
// @Router /api/leads/{number} [delete]
func (h *LeadHandler) Delete(c *gin.Context) {
	number := getLeadNumber(c)
	permanent := c.DefaultQuery("permanent", "false") == "true"

	user := middleware.GetCurrentUser(c)
	currentUserID := 1
	if user != nil {
		currentUserID = user.ID
	}

	err := h.leadRepo.Delete(c.Request.Context(), number, permanent, currentUserID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": fmt.Sprintf("Lead with number '%s' not found.", number)})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": fmt.Sprintf("Lead '%s' successfully deleted.", number),
	})
}

// RestoreLead godoc
// @Summary Restore soft-deleted lead from trash
// @Tags Leads
// @Security BearerAuth
// @Param number path string true "Lead Number"
// @Success 200 {object} map[string]interface{}
// @Failure 404 {object} map[string]string
// @Router /api/leads/{number}/restore [post]
func (h *LeadHandler) Restore(c *gin.Context) {
	number := getLeadNumber(c)
	user := middleware.GetCurrentUser(c)
	currentUserID := 1
	if user != nil {
		currentUserID = user.ID
	}

	err := h.leadRepo.Restore(c.Request.Context(), number, currentUserID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": fmt.Sprintf("Lead with number '%s' not found in trash.", number)})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": fmt.Sprintf("Lead '%s' restored from trash.", number),
	})
}

// AddTagsToLead godoc
// @Summary Add tags to a lead
// @Tags Leads
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param number path string true "Lead Number"
// @Param tags body []string true "Tags to append"
// @Success 200 {object} map[string]interface{}
// @Router /api/leads/{number}/tags [post]
func (h *LeadHandler) AddTags(c *gin.Context) {
	number := getLeadNumber(c)
	var tags []string
	if err := c.ShouldBindJSON(&tags); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid tags format"})
		return
	}

	user := middleware.GetCurrentUser(c)
	currentUserID := 1
	if user != nil {
		currentUserID = user.ID
	}

	_, err := h.leadRepo.BulkAction(c.Request.Context(), []string{number}, "add_tags", nil, nil, tags, nil, currentUserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Failed to add tags: " + err.Error()})
		return
	}

	lead, _ := h.leadRepo.GetByNumber(c.Request.Context(), number)
	c.JSON(http.StatusOK, gin.H{"success": true, "lead": lead})
}

// BulkActionRequest matches FastAPI schema
type BulkActionRequest struct {
	LeadNumbers []string `json:"lead_numbers" binding:"required"`
	Action      string   `json:"action" binding:"required"`
	Status      *string  `json:"status"`
	OwnerID     *int     `json:"owner_id"`
	Tags        []string `json:"tags"`
	LostReason  *string  `json:"lost_reason"`
}

// BulkAction godoc
// @Summary Perform bulk operations on multiple leads
// @Tags Leads
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body BulkActionRequest true "Bulk Action Details"
// @Success 200 {object} map[string]interface{}
// @Router /api/leads/bulk [patch]
func (h *LeadHandler) BulkAction(c *gin.Context) {
	var req BulkActionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid bulk action request: " + err.Error()})
		return
	}

	user := middleware.GetCurrentUser(c)
	currentUserID := 1
	if user != nil {
		currentUserID = user.ID
	}

	affected, err := h.leadRepo.BulkAction(c.Request.Context(), req.LeadNumbers, req.Action, req.Status, req.OwnerID, req.Tags, req.LostReason, currentUserID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":        true,
		"affected_count": affected,
		"message":        fmt.Sprintf("Bulk action '%s' successfully applied to %d leads.", req.Action, affected),
	})
}

type BulkCreateRequest struct {
	Leads []repository.CreateLeadInput `json:"leads" binding:"required"`
}

// BulkCreate godoc
// @Summary Batch insert multiple leads
// @Tags Leads
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body BulkCreateRequest true "List of leads"
// @Success 201 {object} map[string]interface{}
// @Router /api/leads/bulk [post]
func (h *LeadHandler) BulkCreate(c *gin.Context) {
	var req BulkCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid bulk create payload: " + err.Error()})
		return
	}

	user := middleware.GetCurrentUser(c)
	currentUserID := 1
	if user != nil {
		currentUserID = user.ID
	}

	inserted := 0
	skipped := 0
	errorsList := []string{}

	for _, item := range req.Leads {
		_, err := h.leadRepo.Create(c.Request.Context(), item, currentUserID)
		if err != nil {
			skipped++
			errorsList = append(errorsList, fmt.Sprintf("%s: %s", item.Number, err.Error()))
		} else {
			inserted++
		}
	}

	c.JSON(http.StatusCreated, gin.H{
		"success":  true,
		"inserted": inserted,
		"skipped":  skipped,
		"total":    len(req.Leads),
		"errors":   errorsList,
	})
}

type ImportRequest struct {
	Leads             []map[string]interface{} `json:"leads" binding:"required"`
	DuplicateStrategy string                   `json:"duplicate_strategy"` // "skip", "update", "error"
}

// ImportLeads godoc
// @Summary Import leads with configurable duplicate resolution
// @Tags Leads
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body ImportRequest true "Import payload"
// @Success 200 {object} map[string]interface{}
// @Router /api/leads/import [post]
func (h *LeadHandler) Import(c *gin.Context) {
	var req ImportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid import request: " + err.Error()})
		return
	}

	strat := strings.ToLower(strings.TrimSpace(req.DuplicateStrategy))
	if strat == "" {
		strat = "skip"
	}

	user := middleware.GetCurrentUser(c)
	currentUserID := 1
	if user != nil {
		currentUserID = user.ID
	}

	imported := 0
	skipped := 0
	updated := 0
	errList := []map[string]interface{}{}

	for idx, row := range req.Leads {
		numVal := fmt.Sprintf("%v", row["number"])
		if numVal == "" || numVal == "<nil>" {
			numVal = fmt.Sprintf("%v", row["phone"])
		}
		numVal = strings.TrimSpace(numVal)

		if numVal == "" || numVal == "<nil>" {
			errList = append(errList, map[string]interface{}{
				"row":   idx + 1,
				"error": "Missing required 'number' or 'phone' identifier",
			})
			continue
		}

		nameVal := fmt.Sprintf("%v", row["name"])
		if nameVal == "" || nameVal == "<nil>" {
			nameVal = "Lead " + numVal
		}

		emailVal := fmt.Sprintf("%v", row["email"])
		if emailVal == "" || emailVal == "<nil>" {
			emailVal = fmt.Sprintf("lead_%s@example.com", numVal)
		}

		reqVal := fmt.Sprintf("%v", row["requirement"])
		if reqVal == "" || reqVal == "<nil>" {
			reqVal = "Imported Lead"
		}

		cityVal := fmt.Sprintf("%v", row["city"])
		if cityVal == "" || cityVal == "<nil>" {
			cityVal = "Online"
		}

		sourceVal := fmt.Sprintf("%v", row["source"])
		if sourceVal == "" || sourceVal == "<nil>" {
			sourceVal = "Import"
		}

		statusVal := fmt.Sprintf("%v", row["status"])
		if statusVal == "" || statusVal == "<nil>" {
			statusVal = "New"
		}

		in := repository.CreateLeadInput{
			Number:       numVal,
			Name:         nameVal,
			Email:        emailVal,
			Phone:        &numVal,
			Requirement:  reqVal,
			Source:       sourceVal,
			City:         cityVal,
			Status:       statusVal,
			CustomFields: make(map[string]interface{}),
		}

		// Check if exists
		existing, _ := h.leadRepo.GetByNumber(c.Request.Context(), numVal)
		if existing != nil {
			if strat == "skip" {
				skipped++
				continue
			} else if strat == "update" {
				upIn := repository.UpdateLeadInput{
					Name:        &nameVal,
					Email:       &emailVal,
					Requirement: &reqVal,
					City:        &cityVal,
					Status:      &statusVal,
				}
				_, err := h.leadRepo.Update(c.Request.Context(), numVal, upIn, currentUserID)
				if err != nil {
					errList = append(errList, map[string]interface{}{"row": idx + 1, "error": err.Error()})
				} else {
					updated++
				}
				continue
			} else if strat == "error" {
				errList = append(errList, map[string]interface{}{
					"row":   idx + 1,
					"error": fmt.Sprintf("Lead '%s' already exists", numVal),
				})
				continue
			}
		}

		_, err := h.leadRepo.Create(c.Request.Context(), in, currentUserID)
		if err != nil {
			var confErr *repository.ConflictError
			if errors.As(err, &confErr) && strat == "skip" {
				skipped++
			} else {
				errList = append(errList, map[string]interface{}{"row": idx + 1, "error": err.Error()})
			}
		} else {
			imported++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success":         true,
		"total_processed": len(req.Leads),
		"imported_count":  imported,
		"skipped_count":   skipped,
		"updated_count":   updated,
		"errors":          errList,
	})
}

// ExportLeads godoc
// @Summary Export leads to CSV file respecting active filters
// @Tags Leads
// @Produce text/csv
// @Security BearerAuth
// @Router /api/leads/export [get]
func (h *LeadHandler) Export(c *gin.Context) {
	user := middleware.GetCurrentUser(c)
	currentUserID := 1
	if user != nil {
		currentUserID = user.ID
	}

	var ownerIDPtr *int
	if ownerStr := c.Query("owner_id"); ownerStr != "" {
		if id, err := strconv.Atoi(ownerStr); err == nil {
			ownerIDPtr = &id
		}
	}

	f := repository.ListFilter{
		View:          c.Query("view"),
		Search:        c.Query("search"),
		Status:        c.Query("status"),
		Source:        c.Query("source"),
		OwnerID:       ownerIDPtr,
		Tag:           c.Query("tag"),
		Page:          1,
		Limit:         5000,
		SortBy:        "created_at",
		SortDir:       "desc",
		CurrentUserID: currentUserID,
	}

	res, err := h.leadRepo.List(c.Request.Context(), f)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Failed to fetch leads for export: " + err.Error()})
		return
	}

	b := &bytes.Buffer{}
	w := csv.NewWriter(b)

	header := []string{"Lead Number", "Name", "Email", "Phone", "Requirement", "Source", "City", "Status", "Owner", "Score", "Tags", "Created At"}
	_ = w.Write(header)

	for _, item := range res.Items {
		phoneStr := item.Number
		if item.Phone != nil {
			phoneStr = *item.Phone
		}
		ownerName := ""
		if item.Owner != nil {
			ownerName = item.Owner.Name
		}
		tagsStr := strings.Join(item.Tags, ", ")

		row := []string{
			item.Number,
			item.Name,
			item.Email,
			phoneStr,
			item.Requirement,
			item.Source,
			item.City,
			item.Status,
			ownerName,
			strconv.Itoa(item.Score),
			tagsStr,
			item.CreatedAt.Format(time.RFC3339),
		}
		_ = w.Write(row)
	}
	w.Flush()

	filename := fmt.Sprintf("leads_export_%s.csv", time.Now().Format("20060102_150405"))
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	c.Data(http.StatusOK, "text/csv; charset=utf-8", b.Bytes())
}
