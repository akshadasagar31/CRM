package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"crm-backend-go/internal/middleware"
	"crm-backend-go/internal/repository"

	"github.com/gin-gonic/gin"
)

type ApiKeyHandler struct {
	apiKeyRepo *repository.ApiKeyRepository
}

func NewApiKeyHandler(apiKeyRepo *repository.ApiKeyRepository) *ApiKeyHandler {
	return &ApiKeyHandler{apiKeyRepo: apiKeyRepo}
}

type CreateApiKeyRequest struct {
	Name             string     `json:"name" binding:"required,min=1,max=255"`
	Expiry           string     `json:"expiry"`
	CustomExpiryDate *time.Time `json:"custom_expiry_date"`
}

// CreateApiKey godoc
// @Summary Generate a new programmatic API key
// @Tags API Keys
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body CreateApiKeyRequest true "API Key Details"
// @Success 201 {object} models.ApiKeyCreatedResponse
// @Router /api/api-keys [post]
func (h *ApiKeyHandler) Create(c *gin.Context) {
	var req CreateApiKeyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid API key request: " + err.Error()})
		return
	}

	user := middleware.GetCurrentUser(c)
	var createdByID *int
	if user != nil {
		createdByID = &user.ID
	}

	res, err := h.apiKeyRepo.Create(c.Request.Context(), req.Name, req.Expiry, req.CustomExpiryDate, createdByID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Failed to create API key: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, res)
}

// ListApiKeys godoc
// @Summary List all generated API keys
// @Tags API Keys
// @Produce json
// @Security BearerAuth
// @Success 200 {array} models.ApiKey
// @Router /api/api-keys [get]
func (h *ApiKeyHandler) List(c *gin.Context) {
	keys, err := h.apiKeyRepo.List(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Failed to list API keys: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, keys)
}

// GetApiKey godoc
// @Summary Get API key metadata by ID
// @Tags API Keys
// @Produce json
// @Security BearerAuth
// @Param key_id path int true "Key ID"
// @Success 200 {object} models.ApiKey
// @Router /api/api-keys/{key_id} [get]
func (h *ApiKeyHandler) Get(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("key_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid key ID"})
		return
	}

	key, err := h.apiKeyRepo.GetByID(c.Request.Context(), id)
	if err != nil || key == nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": fmt.Sprintf("API key with ID %d not found.", id)})
		return
	}

	c.JSON(http.StatusOK, key)
}

// RevokeApiKey godoc
// @Summary Revoke an active API key
// @Tags API Keys
// @Produce json
// @Security BearerAuth
// @Param key_id path int true "Key ID"
// @Success 200 {object} models.ApiKey
// @Router /api/api-keys/{key_id}/revoke [post]
func (h *ApiKeyHandler) Revoke(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("key_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid key ID"})
		return
	}

	key, err := h.apiKeyRepo.Revoke(c.Request.Context(), id)
	if err != nil || key == nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": fmt.Sprintf("API key with ID %d not found.", id)})
		return
	}

	c.JSON(http.StatusOK, key)
}

// DeleteApiKey godoc
// @Summary Delete an API key
// @Tags API Keys
// @Security BearerAuth
// @Param key_id path int true "Key ID"
// @Success 200 {object} map[string]interface{}
// @Router /api/api-keys/{key_id} [delete]
func (h *ApiKeyHandler) Delete(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("key_id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid key ID"})
		return
	}

	err = h.apiKeyRepo.Delete(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Failed to delete key"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "API key deleted"})
}
