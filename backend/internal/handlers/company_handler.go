package handlers

import (
	"fmt"
	"io"
	"net/http"
	"strings"

	"crm-backend-go/internal/middleware"
	"crm-backend-go/internal/models"
	"crm-backend-go/internal/repository"

	"github.com/gin-gonic/gin"
)

type CompanyHandler struct {
	companyRepo *repository.CompanyRepository
}

func NewCompanyHandler(companyRepo *repository.CompanyRepository) *CompanyHandler {
	return &CompanyHandler{companyRepo: companyRepo}
}

// GetCompanyProfile returns company details
// GET /api/company
func (h *CompanyHandler) GetCompanyProfile(c *gin.Context) {
	profile, err := h.companyRepo.GetProfile(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": fmt.Sprintf("Failed to load company profile: %v", err)})
		return
	}
	c.JSON(http.StatusOK, profile)
}

// UpdateCompanyProfile updates company details (Admin only)
// PUT /api/company
func (h *CompanyHandler) UpdateCompanyProfile(c *gin.Context) {
	var input models.CompanyProfileUpdateInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": fmt.Sprintf("Invalid company profile input: %v", err)})
		return
	}

	user := middleware.GetCurrentUser(c)
	userID := 1
	if user != nil {
		userID = user.ID
	}

	updated, err := h.companyRepo.UpdateProfile(c.Request.Context(), input, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": fmt.Sprintf("Failed to update company profile: %v", err)})
		return
	}

	c.JSON(http.StatusOK, updated)
}

// GetCompanyLogo serves the binary logo image from PostgreSQL BYTEA column
// GET /api/company/logo
func (h *CompanyHandler) GetCompanyLogo(c *gin.Context) {
	data, mimeType, err := h.companyRepo.GetLogo(c.Request.Context())
	if err != nil || len(data) == 0 {
		c.JSON(http.StatusNotFound, gin.H{"detail": "No company logo found"})
		return
	}

	if mimeType == "" {
		mimeType = http.DetectContentType(data)
	}

	c.Header("Cache-Control", "no-cache, private")
	c.Data(http.StatusOK, mimeType, data)
}

// UploadCompanyLogo receives a file upload, converts to binary bytes, and stores in PostgreSQL BYTEA
// POST /api/company/logo
func (h *CompanyHandler) UploadCompanyLogo(c *gin.Context) {
	fileHeader, err := c.FormFile("logo")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Please provide a valid logo file in the 'logo' field"})
		return
	}

	// 5MB max logo size
	const maxLogoBytes = 5 * 1024 * 1024
	if fileHeader.Size > maxLogoBytes {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Logo file size must not exceed 5MB"})
		return
	}

	file, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": fmt.Sprintf("Failed to open uploaded logo: %v", err)})
		return
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": fmt.Sprintf("Failed to read logo data: %v", err)})
		return
	}

	// Detect or obtain MIME type
	mimeType := fileHeader.Header.Get("Content-Type")
	if mimeType == "" || mimeType == "application/octet-stream" {
		mimeType = http.DetectContentType(data)
	}

	// Validate allowed image mime types
	allowed := strings.HasPrefix(mimeType, "image/")
	if !allowed {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Only image files (PNG, JPEG, WebP, SVG) are allowed for the logo"})
		return
	}

	user := middleware.GetCurrentUser(c)
	userID := 1
	if user != nil {
		userID = user.ID
	}

	if err := h.companyRepo.UpdateLogo(c.Request.Context(), data, mimeType, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": fmt.Sprintf("Failed to save logo in database: %v", err)})
		return
	}

	profile, err := h.companyRepo.GetProfile(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "Logo uploaded successfully", "logo_url": "/api/company/logo"})
		return
	}

	c.JSON(http.StatusOK, profile)
}

// DeleteCompanyLogo clears the logo from PostgreSQL
// DELETE /api/company/logo
func (h *CompanyHandler) DeleteCompanyLogo(c *gin.Context) {
	user := middleware.GetCurrentUser(c)
	userID := 1
	if user != nil {
		userID = user.ID
	}

	if err := h.companyRepo.DeleteLogo(c.Request.Context(), userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": fmt.Sprintf("Failed to delete company logo: %v", err)})
		return
	}

	profile, err := h.companyRepo.GetProfile(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "Logo removed successfully"})
		return
	}

	c.JSON(http.StatusOK, profile)
}
