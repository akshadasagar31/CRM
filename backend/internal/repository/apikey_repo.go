package repository

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"crm-backend-go/internal/database"
	"crm-backend-go/internal/models"

	"github.com/jackc/pgx/v5"
)

type ApiKeyRepository struct {
	db *database.DB
}

func NewApiKeyRepository(db *database.DB) *ApiKeyRepository {
	return &ApiKeyRepository{db: db}
}

func generateSecureAPIKey() (fullKey, keyHash, maskedKey, keySuffix string, err error) {
	bytes := make([]byte, 24)
	if _, err := rand.Read(bytes); err != nil {
		return "", "", "", "", err
	}
	randomPart := hex.EncodeToString(bytes)
	fullKey = fmt.Sprintf("crm_live_%s", randomPart)

	hash := sha256.Sum256([]byte(fullKey))
	keyHash = hex.EncodeToString(hash[:])

	if len(fullKey) >= 4 {
		keySuffix = fullKey[len(fullKey)-4:]
	} else {
		keySuffix = fullKey
	}
	maskedKey = fmt.Sprintf("crm_live_...%s", keySuffix)
	return fullKey, keyHash, maskedKey, keySuffix, nil
}

func calculateExpiry(preset string, customDate *time.Time) *time.Time {
	now := time.Now().UTC()
	preset = strings.ToLower(strings.TrimSpace(preset))

	switch preset {
	case "7_days", "7d", "7 days", "7":
		t := now.AddDate(0, 0, 7)
		return &t
	case "30_days", "30d", "30 days", "30":
		t := now.AddDate(0, 0, 30)
		return &t
	case "90_days", "90d", "90 days", "90":
		t := now.AddDate(0, 0, 90)
		return &t
	case "1_year", "1y", "365_days", "365", "1 year":
		t := now.AddDate(1, 0, 0)
		return &t
	case "never", "none", "no_expiry":
		return nil
	case "custom":
		return customDate
	default:
		if customDate != nil {
			return customDate
		}
		t := now.AddDate(0, 0, 30)
		return &t
	}
}

func (r *ApiKeyRepository) Create(ctx context.Context, name string, preset string, customDate *time.Time, createdByID *int) (*models.ApiKeyCreatedResponse, error) {
	fullKey, keyHash, maskedKey, keySuffix, err := generateSecureAPIKey()
	if err != nil {
		return nil, err
	}

	expiresAt := calculateExpiry(preset, customDate)

	query := `
		INSERT INTO api_keys (name, key_hash, key_prefix, key_suffix, masked_key, status, expires_at, created_by_id, created_at, updated_at)
		VALUES ($1, $2, 'crm_live_', $3, $4, 'active', $5, $6, NOW(), NOW())
		RETURNING id, name, key_prefix, key_suffix, masked_key, status, expires_at, last_used_at, created_by_id, created_at, updated_at
	`
	var key models.ApiKey
	err = r.db.Pool.QueryRow(ctx, query, name, keyHash, keySuffix, maskedKey, expiresAt, createdByID).Scan(
		&key.ID, &key.Name, &key.KeyPrefix, &key.KeySuffix, &key.MaskedKey,
		&key.Status, &key.ExpiresAt, &key.LastUsedAt, &key.CreatedByID,
		&key.CreatedAt, &key.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	return &models.ApiKeyCreatedResponse{
		ApiKey:       key,
		PlaintextKey: fullKey,
	}, nil
}

func (r *ApiKeyRepository) List(ctx context.Context) ([]models.ApiKey, error) {
	query := `
		SELECT id, name, key_prefix, key_suffix, masked_key, status, expires_at, last_used_at, created_by_id, created_at, updated_at
		FROM api_keys
		ORDER BY created_at DESC
	`
	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var keys []models.ApiKey
	for rows.Next() {
		var k models.ApiKey
		err := rows.Scan(
			&k.ID, &k.Name, &k.KeyPrefix, &k.KeySuffix, &k.MaskedKey,
			&k.Status, &k.ExpiresAt, &k.LastUsedAt, &k.CreatedByID,
			&k.CreatedAt, &k.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}
		keys = append(keys, k)
	}
	if keys == nil {
		keys = []models.ApiKey{}
	}
	return keys, nil
}

func (r *ApiKeyRepository) GetByID(ctx context.Context, id int) (*models.ApiKey, error) {
	query := `
		SELECT id, name, key_prefix, key_suffix, masked_key, status, expires_at, last_used_at, created_by_id, created_at, updated_at
		FROM api_keys
		WHERE id = $1
	`
	var k models.ApiKey
	err := r.db.Pool.QueryRow(ctx, query, id).Scan(
		&k.ID, &k.Name, &k.KeyPrefix, &k.KeySuffix, &k.MaskedKey,
		&k.Status, &k.ExpiresAt, &k.LastUsedAt, &k.CreatedByID,
		&k.CreatedAt, &k.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &k, nil
}

func (r *ApiKeyRepository) Revoke(ctx context.Context, id int) (*models.ApiKey, error) {
	query := `
		UPDATE api_keys
		SET status = 'revoked', updated_at = NOW()
		WHERE id = $1
		RETURNING id, name, key_prefix, key_suffix, masked_key, status, expires_at, last_used_at, created_by_id, created_at, updated_at
	`
	var k models.ApiKey
	err := r.db.Pool.QueryRow(ctx, query, id).Scan(
		&k.ID, &k.Name, &k.KeyPrefix, &k.KeySuffix, &k.MaskedKey,
		&k.Status, &k.ExpiresAt, &k.LastUsedAt, &k.CreatedByID,
		&k.CreatedAt, &k.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &k, nil
}

func (r *ApiKeyRepository) Delete(ctx context.Context, id int) error {
	_, err := r.db.Pool.Exec(ctx, "DELETE FROM api_keys WHERE id = $1", id)
	return err
}

func (r *ApiKeyRepository) ValidateByRawToken(ctx context.Context, rawToken string) (*models.ApiKey, error) {
	hash := sha256.Sum256([]byte(rawToken))
	keyHash := hex.EncodeToString(hash[:])

	query := `
		SELECT id, name, key_prefix, key_suffix, masked_key, status, expires_at, last_used_at, created_by_id, created_at, updated_at
		FROM api_keys
		WHERE key_hash = $1
	`
	var k models.ApiKey
	err := r.db.Pool.QueryRow(ctx, query, keyHash).Scan(
		&k.ID, &k.Name, &k.KeyPrefix, &k.KeySuffix, &k.MaskedKey,
		&k.Status, &k.ExpiresAt, &k.LastUsedAt, &k.CreatedByID,
		&k.CreatedAt, &k.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	// Record last_used_at
	_, _ = r.db.Pool.Exec(ctx, "UPDATE api_keys SET last_used_at = NOW() WHERE id = $1", k.ID)

	return &k, nil
}
