package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL  string
	JWTSecretKey string
	Port         string
	FrontendURL  string
}

func LoadConfig() *Config {
	// Try loading .env from current directory or parent directory
	_ = godotenv.Load(".env")
	_ = godotenv.Load("../.env")

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgresql://postgres:postgres@localhost:5432/crm_db"
	}

	jwtSecret := os.Getenv("JWT_SECRET_KEY")
	if jwtSecret == "" {
		jwtSecret = "crm_secret_jwt_key_super_secure_2026_dev"
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8001"
	}

	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		frontendURL = "http://localhost:3000"
	}

	log.Printf("[Config] Loaded: PORT=%s, FRONTEND_URL=%s", port, frontendURL)

	return &Config{
		DatabaseURL:  dbURL,
		JWTSecretKey: jwtSecret,
		Port:         port,
		FrontendURL:  frontendURL,
	}
}
