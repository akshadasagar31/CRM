package handlers

import (
	"net/http"
	"strconv"

	"crm-backend-go/internal/middleware"
	"crm-backend-go/internal/models"
	"crm-backend-go/internal/repository"

	"github.com/gin-gonic/gin"
)

type ProductHandler struct {
	repo *repository.ProductRepository
}

func NewProductHandler(repo *repository.ProductRepository) *ProductHandler {
	return &ProductHandler{repo: repo}
}

// List handles GET /api/products
func (h *ProductHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	search := c.Query("search")
	category := c.Query("category")
	status := c.Query("status")
	sortBy := c.DefaultQuery("sort_by", "created_at")
	sortOrder := c.DefaultQuery("sort_order", "desc")

	filter := repository.ProductFilter{
		Search:    search,
		Category:  category,
		Status:    status,
		SortBy:    sortBy,
		SortOrder: sortOrder,
		Page:      page,
		Limit:     limit,
	}

	workspaceID := 1
	res, err := h.repo.List(c.Request.Context(), filter, workspaceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, res)
}

// Get handles GET /api/products/:id
func (h *ProductHandler) Get(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid product ID"})
		return
	}

	workspaceID := 1
	product, err := h.repo.GetByID(c.Request.Context(), id, workspaceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	if product == nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": "Product not found"})
		return
	}

	c.JSON(http.StatusOK, product)
}

// Create handles POST /api/products (Admin / Manager only)
func (h *ProductHandler) Create(c *gin.Context) {
	var input models.ProductCreateInput
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

	product, err := h.repo.Create(c.Request.Context(), input, userID, workspaceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, product)
}

// Update handles PATCH /api/products/:id (Admin / Manager only)
func (h *ProductHandler) Update(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid product ID"})
		return
	}

	var input models.ProductUpdateInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}

	workspaceID := 1
	product, err := h.repo.Update(c.Request.Context(), id, input, workspaceID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}
	if product == nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": "Product not found"})
		return
	}

	c.JSON(http.StatusOK, product)
}

// Delete handles DELETE /api/products/:id (Admin / Manager only)
func (h *ProductHandler) Delete(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid product ID"})
		return
	}

	workspaceID := 1
	if err := h.repo.Delete(c.Request.Context(), id, workspaceID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Product archived successfully"})
}

// ListCategories handles GET /api/products/categories
func (h *ProductHandler) ListCategories(c *gin.Context) {
	workspaceID := 1
	categories, err := h.repo.ListCategories(c.Request.Context(), workspaceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusOK, categories)
}
