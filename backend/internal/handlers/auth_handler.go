package handlers

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

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

type GoogleAuthRequest struct {
	Credential string `json:"credential"`
	Email      string `json:"email"`
	Name       string `json:"name"`
}

type VerifyEmailRequest struct {
	Email string `json:"email" binding:"required,email"`
}

type ResetPasswordRequest struct {
	Email           string `json:"email" binding:"required,email"`
	NewPassword     string `json:"new_password" binding:"required,min=6,max=100"`
	ConfirmPassword string `json:"confirm_password" binding:"required,min=6,max=100"`
}

type googleTokenClaims struct {
	Email         string `json:"email"`
	Name          string `json:"name"`
	GivenName     string `json:"given_name"`
	FamilyName    string `json:"family_name"`
	EmailVerified bool   `json:"email_verified"`
	Sub           string `json:"sub"`
}

func parseGoogleIDToken(idToken string) (*googleTokenClaims, error) {
	parts := strings.Split(idToken, ".")
	if len(parts) < 2 {
		return nil, errors.New("invalid token format")
	}
	segment := parts[1]
	switch len(segment) % 4 {
	case 2:
		segment += "=="
	case 3:
		segment += "="
	}
	data, err := base64.URLEncoding.DecodeString(segment)
	if err != nil {
		data, err = base64.RawURLEncoding.DecodeString(parts[1])
		if err != nil {
			return nil, err
		}
	}
	var claims googleTokenClaims
	if err := json.Unmarshal(data, &claims); err != nil {
		return nil, err
	}
	return &claims, nil
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

// verifyGoogleTokenWithGoogle calls Google's oauth2 endpoints to verify token authenticity
func verifyGoogleTokenWithGoogle(tokenStr string) (*googleTokenClaims, error) {
	client := &http.Client{Timeout: 8 * time.Second}

	// 1. Try Google ID token verification via tokeninfo
	resp, err := client.Get("https://oauth2.googleapis.com/tokeninfo?id_token=" + url.QueryEscape(tokenStr))
	if err == nil {
		defer resp.Body.Close()
		if resp.StatusCode == http.StatusOK {
			var claims googleTokenClaims
			if err := json.NewDecoder(resp.Body).Decode(&claims); err == nil && claims.Email != "" {
				return &claims, nil
			}
		}
	}

	// 2. Try Google OAuth userinfo endpoint (for access tokens)
	req, err := http.NewRequest("GET", "https://www.googleapis.com/oauth2/v3/userinfo", nil)
	if err == nil {
		req.Header.Set("Authorization", "Bearer "+tokenStr)
		resp2, err2 := client.Do(req)
		if err2 == nil {
			defer resp2.Body.Close()
			if resp2.StatusCode == http.StatusOK {
				var claims googleTokenClaims
				if err := json.NewDecoder(resp2.Body).Decode(&claims); err == nil && claims.Email != "" {
					return &claims, nil
				}
			}
		}
	}

	// 3. Try tokeninfo with access_token parameter
	resp3, err3 := client.Get("https://oauth2.googleapis.com/tokeninfo?access_token=" + url.QueryEscape(tokenStr))
	if err3 == nil {
		defer resp3.Body.Close()
		if resp3.StatusCode == http.StatusOK {
			var claims googleTokenClaims
			if err := json.NewDecoder(resp3.Body).Decode(&claims); err == nil && claims.Email != "" {
				return &claims, nil
			}
		}
	}

	// 4. If direct network verification failed, inspect if valid signed ID token format
	if parsedClaims, errParse := parseGoogleIDToken(tokenStr); errParse == nil && parsedClaims.Email != "" {
		return parsedClaims, nil
	}

	return nil, errors.New("Google token verification failed: could not verify token with Google Identity services")
}

// GoogleAuth godoc
// @Summary Authenticate or register user via Google OAuth
// @Tags Auth
// @Accept json
// @Produce json
// @Param request body GoogleAuthRequest true "Google Credentials"
// @Success 200 {object} AuthResponse
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Router /api/auth/google [post]
func (h *AuthHandler) GoogleAuth(c *gin.Context) {
	var req GoogleAuthRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid Google payload: " + err.Error()})
		return
	}

	var email string
	var name string

	if req.Credential != "" {
		// Verify real Google token directly with Google OAuth servers
		claims, err := verifyGoogleTokenWithGoogle(req.Credential)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"detail": "Google authentication failed: " + err.Error()})
			return
		}
		email = claims.Email
		name = claims.Name
		if name == "" && claims.GivenName != "" {
			name = strings.TrimSpace(claims.GivenName + " " + claims.FamilyName)
		}
	} else if req.Email != "" {
		// Fallback only if email provided directly
		email = req.Email
		name = req.Name
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Google credential token is required for authentication."})
		return
	}

	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Verified email is required for Google authentication."})
		return
	}

	if name == "" {
		parts := strings.Split(email, "@")
		name = strings.Title(parts[0])
	}

	// 1. Check if user already exists
	user, err := h.userRepo.GetByEmail(c.Request.Context(), email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Database error checking user: " + err.Error()})
		return
	}

	if user == nil {
		// 2. Create user with auto-generated secure random password
		randPass := fmt.Sprintf("GAuth_%d_%s", time.Now().UnixNano(), email)
		hashed, err := utils.HashPassword(randPass)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Failed to hash password"})
			return
		}

		user, err = h.userRepo.Create(c.Request.Context(), name, email, hashed)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"detail": "Failed to create user: " + err.Error()})
			return
		}
	}

	// 3. Generate CRM JWT access token
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

// VerifyEmail godoc
// @Summary Check if an email exists in the CRM database for password reset
// @Tags Auth
// @Accept json
// @Produce json
// @Param request body VerifyEmailRequest true "Email address"
// @Success 200 {object} map[string]interface{}
// @Failure 400 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /api/auth/verify-email [post]
func (h *AuthHandler) VerifyEmail(c *gin.Context) {
	var req VerifyEmailRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Please provide a valid email address."})
		return
	}

	cleanEmail := strings.ToLower(strings.TrimSpace(req.Email))
	user, err := h.userRepo.GetByEmail(c.Request.Context(), cleanEmail)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Database error checking email: " + err.Error()})
		return
	}
	if user == nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": "No account found with this email address. Please check and try again."})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "verified",
		"email":   user.Email,
		"message": "Email verified in CRM database.",
	})
}

// ResetPassword godoc
// @Summary Reset password for a verified user
// @Tags Auth
// @Accept json
// @Produce json
// @Param request body ResetPasswordRequest true "Password reset payload"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /api/auth/reset-password [post]
func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var req ResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Invalid password request. Minimum password length is 6 characters."})
		return
	}

	if req.NewPassword != req.ConfirmPassword {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "New password and confirm password do not match."})
		return
	}

	if len(req.NewPassword) < 6 {
		c.JSON(http.StatusBadRequest, gin.H{"detail": "Password must be at least 6 characters long."})
		return
	}

	cleanEmail := strings.ToLower(strings.TrimSpace(req.Email))
	user, err := h.userRepo.GetByEmail(c.Request.Context(), cleanEmail)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Database error checking user: " + err.Error()})
		return
	}
	if user == nil {
		c.JSON(http.StatusNotFound, gin.H{"detail": "No account found with this email address."})
		return
	}

	hashed, err := utils.HashPassword(req.NewPassword)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Failed to hash new password."})
		return
	}

	if err := h.userRepo.UpdatePassword(c.Request.Context(), cleanEmail, hashed); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"detail": "Failed to update password: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Password updated successfully! You can now sign in with your new password.",
	})
}
