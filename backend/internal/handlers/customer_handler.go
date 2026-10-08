package handlers

import (
	"net/http"
	"strconv"

	"crm-backend-go/internal/middleware"
	"crm-backend-go/internal/models"
	"crm-backend-go/internal/repository"

	"github.com/gin-gonic/gin"
)

type CustomerHandler struct {
	repo *repository.CustomerRepository
}

func NewCustomerHandler(repo *repository.CustomerRepository) *CustomerHandler {
	return &CustomerHandler{repo: repo}
}

func (h *CustomerHandler) List(c *gin.Context) {
	search := c.Query("search")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	if limit < 1 || limit > 200 {
		limit = 50
	}
	if page < 1 {
		page = 1
	}
	offset := (page - 1) * limit

	workspaceID := 1 // single workspace default

	customers, total, err := h.repo.List(c.Request.Context(), search, workspaceID, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}

	pages := (total + limit - 1) / limit
	c.JSON(http.StatusOK, gin.H{
		"items": customers,
		"total": total,
		"page":  page,
		"limit": limit,
		"pages": pages,
	})
}

func (h *CustomerHandler) Get(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid customer ID"})
		return
	}

	workspaceID := 1
	customer, err := h.repo.GetByID(c.Request.Context(), id, workspaceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}
	if customer == nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": "Customer not found"})
		return
	}

	c.JSON(http.StatusOK, customer)
}

func (h *CustomerHandler) Create(c *gin.Context) {
	var input models.CustomerCreateInput
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

	customer, err := h.repo.Create(c.Request.Context(), input, userID, workspaceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, customer)
}
