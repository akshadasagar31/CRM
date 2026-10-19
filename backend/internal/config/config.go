package config

import (
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL  string
	JWTSecretKey string
	Port         string
	FrontendURL  string
	SMTPHost     string
	SMTPPort     int
	SMTPUsername string
	SMTPPassword string
	SMTPFromEmail string
	SMTPFromName string
	SMTPEncryption string
	SMTPMockMode bool
}

func LoadConfig() *Config {
	// Try loading .env from current directory, backend subfolder, or parent directories
	_ = godotenv.Load(".env")
	_ = godotenv.Load("backend/.env")
	_ = godotenv.Load("../.env")
	_ = godotenv.Load("../backend/.env")

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

	smtpHost := strings.TrimSpace(os.Getenv("SMTP_HOST"))
	smtpPortStr := strings.TrimSpace(os.Getenv("SMTP_PORT"))
	smtpPort := 587
	if smtpPortStr != "" {
		if p, err := strconv.Atoi(smtpPortStr); err == nil && p > 0 {
			smtpPort = p
		}
	}
	smtpUser := strings.TrimSpace(os.Getenv("SMTP_USERNAME"))
	rawPass := os.Getenv("SMTP_PASSWORD")
	// Google App Passwords are often copied with spaces (e.g. "abcd efgh ijkl mnop").
	// Strip spaces and surrounding whitespace so SMTP authentication succeeds.
	smtpPass := strings.ReplaceAll(strings.TrimSpace(rawPass), " ", "")

	smtpFromEmail := strings.TrimSpace(os.Getenv("SMTP_FROM_EMAIL"))
	if smtpFromEmail == "" {
		smtpFromEmail = strings.TrimSpace(os.Getenv("SMTP_FROM"))
	}
	if smtpFromEmail == "" && smtpUser != "" {
		smtpFromEmail = smtpUser
	}
	if smtpFromEmail == "" {
		smtpFromEmail = "notifications@bizcopilot.com"
	}

	smtpFromName := strings.TrimSpace(os.Getenv("SMTP_FROM_NAME"))
	if smtpFromName == "" {
		smtpFromName = "BizCopilot CRM"
	}
	smtpEnc := strings.TrimSpace(os.Getenv("SMTP_ENCRYPTION"))
	if smtpEnc == "" {
		smtpEnc = "starttls"
	}
	mockMode := smtpHost == "" || smtpHost == "mock" || smtpHost == "console"

	log.Printf("[Config] Loaded: PORT=%s, FRONTEND_URL=%s, SMTP_HOST=%s, SMTP_FROM=%s (MockMode=%v)", port, frontendURL, smtpHost, smtpFromEmail, mockMode)

	return &Config{
		DatabaseURL:    dbURL,
		JWTSecretKey:   jwtSecret,
		Port:           port,
		FrontendURL:    frontendURL,
		SMTPHost:       smtpHost,
		SMTPPort:       smtpPort,
		SMTPUsername:   smtpUser,
		SMTPPassword:   smtpPass,
		SMTPFromEmail:  smtpFromEmail,
		SMTPFromName:   smtpFromName,
		SMTPEncryption: smtpEnc,
		SMTPMockMode:   mockMode,
	}
}
