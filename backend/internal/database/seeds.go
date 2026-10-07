package database

import (
	"context"
	"log"
	"time"
)

func (db *DB) Seed() error {
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	// 1. Statuses
	var statusCount int
	if err := db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM lead_statuses").Scan(&statusCount); err == nil && statusCount == 0 {
		statuses := []struct {
			name      string
			color     string
			order     int
			isDefault int
		}{
			{"New", "#0D9488", 1, 1},
			{"Contacted", "#2563EB", 2, 0},
			{"Follow-up", "#D97706", 3, 0},
			{"Qualified", "#7C3AED", 4, 0},
			{"Won", "#059669", 5, 0},
			{"Lost", "#DC2626", 6, 0},
		}
		for _, s := range statuses {
			_, _ = db.Pool.Exec(ctx,
				`INSERT INTO lead_statuses (name, color, "order", is_default, workspace_id) VALUES ($1, $2, $3, $4, 1)`,
				s.name, s.color, s.order, s.isDefault,
			)
		}
		log.Println("[Database] Seeded initial lead statuses")
	}

	// 2. Sources
	var sourceCount int
	if err := db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM lead_sources").Scan(&sourceCount); err == nil && sourceCount == 0 {
		sources := []struct {
			name      string
			isDefault int
		}{
			{"Website", 1},
			{"Social Media", 0},
			{"WhatsApp", 0},
			{"Google Sheets", 0},
			{"Manual", 0},
			{"Ads", 0},
			{"Referral", 0},
			{"Instagram", 0},
			{"API", 0},
		}
		for _, s := range sources {
			_, _ = db.Pool.Exec(ctx,
				`INSERT INTO lead_sources (name, is_default, workspace_id) VALUES ($1, $2, 1)`,
				s.name, s.isDefault,
			)
		}
		log.Println("[Database] Seeded initial lead sources")
	}

	// 3. Tags
	var tagCount int
	if err := db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM tags").Scan(&tagCount); err == nil && tagCount == 0 {
		tags := []struct {
			name  string
			color string
		}{
			{"VIP", "#E11D48"},
			{"Hot Lead", "#F97316"},
			{"High Budget", "#10B981"},
			{"Decision Maker", "#8B5CF6"},
			{"Enterprise", "#3B82F6"},
			{"Urgent", "#EF4444"},
		}
		for _, t := range tags {
			_, _ = db.Pool.Exec(ctx,
				`INSERT INTO tags (name, color, workspace_id) VALUES ($1, $2, 1)`,
				t.name, t.color,
			)
		}
		log.Println("[Database] Seeded initial tags")
	}

	// 4. Duplicate Check Settings
	var dupCount int
	if err := db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM duplicate_check_settings WHERE workspace_id = 1").Scan(&dupCount); err == nil && dupCount == 0 {
		_, _ = db.Pool.Exec(ctx,
			`INSERT INTO duplicate_check_settings (workspace_id, check_phone, check_email, action) VALUES (1, 1, 1, 'prevent')`,
		)
		log.Println("[Database] Seeded default duplicate check settings")
	}

	// 5. Default Custom Field Definitions if none exist
	var cfCount int
	if err := db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM custom_field_definitions WHERE workspace_id = 1").Scan(&cfCount); err == nil && cfCount == 0 {
		cfs := []struct {
			key, label, fType, options, section string
			req, vis, ord                       int
		}{
			{"budget", "Budget Range", "Currency", "[]", "Financial", 0, 1, 1},
			{"company_size", "Company Size", "Dropdown", `["1-10", "11-50", "51-200", "201-500", "500+"]`, "Business Info", 0, 1, 2},
			{"preferred_contact_method", "Preferred Contact Method", "Dropdown", `["Phone", "Email", "WhatsApp"]`, "Preferences", 0, 1, 3},
		}
		for _, cf := range cfs {
			_, _ = db.Pool.Exec(ctx,
				`INSERT INTO custom_field_definitions (field_key, field_label, field_type, options, required, visibility, field_order, section, workspace_id)
				 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1)`,
				cf.key, cf.label, cf.fType, cf.options, cf.req, cf.vis, cf.ord, cf.section,
			)
		}
		log.Println("[Database] Seeded default custom field definitions")
	}

	return nil
}
