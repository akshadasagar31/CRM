package middleware

import (
	"context"
	"net/http"
	"strings"
	"time"

	"crm-backend-go/internal/database"
	"crm-backend-go/internal/models"
	"crm-backend-go/internal/utils"

	"github.com/gin-gonic/gin"
)

func AuthMiddleware(db *database.DB, jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"detail": "Authentication required. Please provide a Bearer token.",
			})
			return
		}

		tokenString := ""
		if strings.HasPrefix(authHeader, "Bearer ") {
			tokenString = strings.TrimSpace(authHeader[7:])
		} else {
			tokenString = strings.TrimSpace(authHeader)
		}

		if tokenString == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"detail": "Authentication required. Please provide a Bearer token.",
			})
			return
		}

		userID, err := utils.ValidateToken(tokenString, jwtSecret)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"detail": "Could not validate credentials.",
			})
			return
		}

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		var user models.User
		err = db.Pool.QueryRow(ctx,
			"SELECT id, email, name, hashed_password, created_at, COALESCE(role, 'sales_rep') FROM users WHERE id = $1",
			userID,
		).Scan(&user.ID, &user.Email, &user.Name, &user.HashedPassword, &user.CreatedAt, &user.Role)

		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"detail": "User associated with token no longer exists.",
			})
			return
		}

		c.Set("user", &user)
		c.Set("user_id", user.ID)
		c.Next()
	}
}

// RequireRole checks if the authenticated user has one of the allowed roles
func RequireRole(allowedRoles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		user := GetCurrentUser(c)
		if user == nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"detail": "Authentication required."})
			return
		}

		for _, r := range allowedRoles {
			if strings.EqualFold(user.Role, r) {
				c.Next()
				return
			}
		}

		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
			"detail": "Access denied: insufficient permissions.",
		})
	}
}

// GetCurrentUser helper to retrieve authenticated user from context
func GetCurrentUser(c *gin.Context) *models.User {
	val, exists := c.Get("user")
	if !exists {
		return nil
	}
	if user, ok := val.(*models.User); ok {
		return user
	}
	return nil
}
