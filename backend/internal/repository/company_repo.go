package repository

import (
	"context"
	"errors"
	"fmt"

	"crm-backend-go/internal/database"
	"crm-backend-go/internal/models"

	"github.com/jackc/pgx/v5"
)

type CompanyRepository struct {
	db *database.DB
}

func NewCompanyRepository(db *database.DB) *CompanyRepository {
	return &CompanyRepository{db: db}
}

// EnsureDefaultProfile ensures at least one company profile record exists for workspace 1
func (r *CompanyRepository) EnsureDefaultProfile(ctx context.Context) error {
	var count int
	err := r.db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM company_profiles WHERE workspace_id = 1").Scan(&count)
	if err != nil {
		return err
	}
	if count == 0 {
		_, err = r.db.Pool.Exec(ctx, `
			INSERT INTO company_profiles (
				workspace_id, company_name, gst_number, pan_number, email, phone, website,
				address, city, state, country, pincode, default_currency, created_at, updated_at
			) VALUES (
				1, 'BizCopilot Technologies Pvt. Ltd.', '27ABCDE1234F1Z5', 'ABCDE1234F',
				'billing@bizcopilot.com', '+91 98765 43210', 'https://www.bizcopilot.com',
				'Level 4, TechHub Towers, Cyber City', 'Pune', 'Maharashtra', 'India',
				'411001', 'INR', NOW(), NOW()
			)
		`)
		return err
	}
	return nil
}

// GetProfile fetches the active company profile
func (r *CompanyRepository) GetProfile(ctx context.Context) (*models.CompanyProfile, error) {
	if err := r.EnsureDefaultProfile(ctx); err != nil {
		return nil, fmt.Errorf("failed to ensure company profile: %w", err)
	}

	query := `
		SELECT 
			id, workspace_id, company_name, 
			(logo_data IS NOT NULL AND LENGTH(logo_data) > 0) AS has_logo,
			logo_mime_type, gst_number, pan_number, email, phone, website,
			address, city, state, country, pincode, default_currency,
			updated_by_id, created_at, updated_at
		FROM company_profiles
		WHERE workspace_id = 1
		ORDER BY id ASC
		LIMIT 1
	`

	var p models.CompanyProfile
	var hasLogo bool
	var logoMime *string
	var gst, pan, email, phone, website, address, city, state, country, pincode *string

	err := r.db.Pool.QueryRow(ctx, query).Scan(
		&p.ID,
		&p.WorkspaceID,
		&p.CompanyName,
		&hasLogo,
		&logoMime,
		&gst,
		&pan,
		&email,
		&phone,
		&website,
		&address,
		&city,
		&state,
		&country,
		&pincode,
		&p.DefaultCurrency,
		&p.UpdatedByID,
		&p.CreatedAt,
		&p.UpdatedAt,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to scan company profile: %w", err)
	}

	p.HasLogo = hasLogo
	p.LogoMimeType = logoMime
	if hasLogo {
		p.LogoURL = "/api/company/logo"
	} else {
		p.LogoURL = ""
	}

	if gst != nil {
		p.GSTNumber = *gst
	}
	if pan != nil {
		p.PANNumber = *pan
	}
	if email != nil {
		p.Email = *email
	}
	if phone != nil {
		p.Phone = *phone
	}
	if website != nil {
		p.Website = *website
	}
	if address != nil {
		p.Address = *address
	}
	if city != nil {
		p.City = *city
	}
	if state != nil {
		p.State = *state
	}
	if country != nil {
		p.Country = *country
	}
	if pincode != nil {
		p.Pincode = *pincode
	}

	return &p, nil
}

// UpdateProfile updates all company details (excluding logo)
func (r *CompanyRepository) UpdateProfile(ctx context.Context, input models.CompanyProfileUpdateInput, updatedByID int) (*models.CompanyProfile, error) {
	if err := r.EnsureDefaultProfile(ctx); err != nil {
		return nil, fmt.Errorf("failed to ensure company profile: %w", err)
	}

	currency := input.DefaultCurrency
	if currency == "" {
		currency = "INR"
	}

	query := `
		UPDATE company_profiles SET
			company_name = $1,
			gst_number = $2,
			pan_number = $3,
			email = $4,
			phone = $5,
			website = $6,
			address = $7,
			city = $8,
			state = $9,
			country = $10,
			pincode = $11,
			default_currency = $12,
			updated_by_id = $13,
			updated_at = NOW()
		WHERE workspace_id = 1
	`

	_, err := r.db.Pool.Exec(ctx, query,
		input.CompanyName,
		input.GSTNumber,
		input.PANNumber,
		input.Email,
		input.Phone,
		input.Website,
		input.Address,
		input.City,
		input.State,
		input.Country,
		input.Pincode,
		currency,
		updatedByID,
	)

	if err != nil {
		return nil, fmt.Errorf("failed to update company profile: %w", err)
	}

	return r.GetProfile(ctx)
}

// GetLogo retrieves the raw binary logo bytes and mime type
func (r *CompanyRepository) GetLogo(ctx context.Context) ([]byte, string, error) {
	query := `
		SELECT logo_data, COALESCE(logo_mime_type, 'image/png')
		FROM company_profiles
		WHERE workspace_id = 1 AND logo_data IS NOT NULL AND LENGTH(logo_data) > 0
		LIMIT 1
	`

	var data []byte
	var mimeType string

	err := r.db.Pool.QueryRow(ctx, query).Scan(&data, &mimeType)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, "", fmt.Errorf("no logo found")
		}
		return nil, "", err
	}

	return data, mimeType, nil
}

// UpdateLogo stores binary logo data and MIME type in BYTEA column
func (r *CompanyRepository) UpdateLogo(ctx context.Context, data []byte, mimeType string, updatedByID int) error {
	if err := r.EnsureDefaultProfile(ctx); err != nil {
		return fmt.Errorf("failed to ensure company profile: %w", err)
	}

	query := `
		UPDATE company_profiles SET
			logo_data = $1,
			logo_mime_type = $2,
			updated_by_id = $3,
			updated_at = NOW()
		WHERE workspace_id = 1
	`

	_, err := r.db.Pool.Exec(ctx, query, data, mimeType, updatedByID)
	if err != nil {
		return fmt.Errorf("failed to update company logo: %w", err)
	}

	return nil
}

// DeleteLogo removes company logo from database
func (r *CompanyRepository) DeleteLogo(ctx context.Context, updatedByID int) error {
	query := `
		UPDATE company_profiles SET
			logo_data = NULL,
			logo_mime_type = NULL,
			updated_by_id = $1,
			updated_at = NOW()
		WHERE workspace_id = 1
	`

	_, err := r.db.Pool.Exec(ctx, query, updatedByID)
	if err != nil {
		return fmt.Errorf("failed to delete company logo: %w", err)
	}

	return nil
}
