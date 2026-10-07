package handlers

import (
	"net/http"
	"strings"

	"crm-backend-go/internal/middleware"
	"crm-backend-go/internal/models"
	"crm-backend-go/internal/repository"
	"crm-backend-go/internal/utils"

	"github.com/gin-gonic/gin"
)

type AuthHandler struct {
	userRepo  *repository.UserRepository
	jwtSecret string
}

func NewAuthHandler(userRepo *repository.UserRepository, jwtSecret string) *AuthHandler {
	return &AuthHandler{
		userRepo:  userRepo,
		jwtSecret: jwtSecret,
	}
}

type RegisterRequest struct {
	Name     string `json:"name" binding:"required,min=2,max=100"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6,max=100"`
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type AuthResponse struct {
	AccessToken string       `json:"access_token"`
	TokenType   string       `json:"token_type"`
	User        *models.User `json:"user"`
}

// Register godoc
// @Summary Register a new CRM user
// @Tags Auth
// @Accept json
// @Produce json
// @Param request body RegisterRequest true "Register Credentials"
// @Success 201 {object} AuthResponse
// @Failure 400 {object} map[string]string
// @Failure 409 {object} map[string]string
// @Router /api/register [post]
func (h *AuthHandler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid input: " + err.Error()})
		return
	}

	cleanEmail := strings.ToLower(strings.TrimSpace(req.Email))
	existing, err := h.userRepo.GetByEmail(c.Request.Context(), cleanEmail)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Database error checking email"})
		return
	}
	if existing != nil {
		c.JSON(http.StatusConflict, gin.H{"detail": "A user with this email address already exists."})
		return
	}

	hashedPassword, err := utils.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Error hashing password"})
		return
	}

	user, err := h.userRepo.Create(c.Request.Context(), req.Name, cleanEmail, hashedPassword)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Failed to create user"})
		return
	}

	token, err := utils.GenerateToken(user.ID, h.jwtSecret, 1440)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusCreated, AuthResponse{
		AccessToken: token,
		TokenType:   "bearer",
		User:        user,
	})
}

// Login godoc
// @Summary User login
// @Tags Auth
// @Accept json
// @Produce json
// @Param request body LoginRequest true "Login Credentials"
// @Success 200 {object} AuthResponse
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Router /api/login [post]
func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid credentials format"})
		return
	}

	cleanEmail := strings.ToLower(strings.TrimSpace(req.Email))
	user, err := h.userRepo.GetByEmail(c.Request.Context(), cleanEmail)
	if err != nil || user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"detail": "Incorrect email or password."})
		return
	}

	if !utils.VerifyPassword(req.Password, user.HashedPassword) {
		c.JSON(http.StatusUnauthorized, gin.H{"detail": "Incorrect email or password."})
		return
	}

	token, err := utils.GenerateToken(user.ID, h.jwtSecret, 1440)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, AuthResponse{
		AccessToken: token,
		TokenType:   "bearer",
		User:        user,
	})
}

// GetMe godoc
// @Summary Get currently authenticated user profile
// @Tags Auth
// @Produce json
// @Security BearerAuth
// @Success 200 {object} models.User
// @Failure 401 {object} map[string]string
// @Router /api/me [get]
func (h *AuthHandler) GetMe(c *gin.Context) {
	user := middleware.GetCurrentUser(c)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"detail": "Authentication required"})
		return
	}
	c.JSON(http.StatusOK, user)
}

// ListUsers godoc
// @Summary List all active users for assignment
// @Tags Auth
// @Produce json
// @Security BearerAuth
// @Success 200 {array} models.UserSummary
// @Router /api/users [get]
func (h *AuthHandler) ListUsers(c *gin.Context) {
	users, err := h.userRepo.ListSummaries(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Failed to retrieve user list"})
		return
	}
	c.JSON(http.StatusOK, users)
}
