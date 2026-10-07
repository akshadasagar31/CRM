package utils

import (
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type JWTClaims struct {
	jwt.RegisteredClaims
}

// GenerateToken creates an HS256 signed JWT token for a given user ID
func GenerateToken(userID int, secret string, expireMinutes int) (string, error) {
	if expireMinutes <= 0 {
		expireMinutes = 1440 // 24 hours default
	}

	claims := JWTClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   strconv.Itoa(userID),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(expireMinutes) * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// ValidateToken parses and validates JWT, returning the user ID
func ValidateToken(tokenString string, secret string) (int, error) {
	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(secret), nil
	})

	if err != nil {
		return 0, err
	}

	if claims, ok := token.Claims.(*JWTClaims); ok && token.Valid {
		if claims.Subject == "" {
			return 0, errors.New("missing subject in token")
		}
		userID, err := strconv.Atoi(claims.Subject)
		if err != nil {
			return 0, errors.New("invalid subject in token")
		}
		return userID, nil
	}

	return 0, errors.New("invalid token")
}
