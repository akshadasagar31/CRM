package database

import (
	"context"
	"fmt"
	"log"
	"time"
)

func (db *DB) Migrate() error {
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	queries := []string{
		// 1. Users table
		`CREATE TABLE IF NOT EXISTS users (
			id SERIAL PRIMARY KEY,
			email VARCHAR(255) UNIQUE NOT NULL,
			name VARCHAR(255) NOT NULL,
			hashed_password VARCHAR(255) NOT NULL,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);`,

		// 2. Leads table
		`CREATE TABLE IF NOT EXISTS leads (
			number VARCHAR(50) PRIMARY KEY,
			name VARCHAR(255) NOT NULL,
			email VARCHAR(255) NOT NULL,
			phone VARCHAR(50),
			requirement TEXT NOT NULL,
			source VARCHAR(50) NOT NULL DEFAULT 'Website',
			city VARCHAR(100) NOT NULL,
			status VARCHAR(50) NOT NULL DEFAULT 'New',
			owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
			tags TEXT NOT NULL DEFAULT '[]',
			score INTEGER NOT NULL DEFAULT 50,
			lost_reason TEXT,
			follow_up_date TIMESTAMP WITH TIME ZONE,
			follow_up_type VARCHAR(50),
			follow_up_notes TEXT,
			follow_up_completed INTEGER NOT NULL DEFAULT 0,
			last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			deleted_at TIMESTAMP WITH TIME ZONE,
			workspace_id INTEGER NOT NULL DEFAULT 1,
			created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);`,

		// Safe non-destructive column migrations
		`ALTER TABLE leads ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'New' NOT NULL;`,
		`ALTER TABLE leads ADD COLUMN IF NOT EXISTS owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL;`,
		`ALTER TABLE leads ADD COLUMN IF NOT EXISTS tags TEXT DEFAULT '[]' NOT NULL;`,
		`ALTER TABLE leads ADD COLUMN IF NOT EXISTS follow_up_date TIMESTAMP WITH TIME ZONE;`,
		`ALTER TABLE leads ADD COLUMN IF NOT EXISTS follow_up_type VARCHAR(50);`,
		`ALTER TABLE leads ADD COLUMN IF NOT EXISTS follow_up_notes TEXT;`,
		`ALTER TABLE leads ADD COLUMN IF NOT EXISTS follow_up_completed INTEGER DEFAULT 0 NOT NULL;`,
		`ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone VARCHAR(50);`,
		`ALTER TABLE leads ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT 50 NOT NULL;`,
		`ALTER TABLE leads ADD COLUMN IF NOT EXISTS lost_reason TEXT;`,
		`ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();`,
		`ALTER TABLE leads ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;`,
		`ALTER TABLE leads ADD COLUMN IF NOT EXISTS workspace_id INTEGER DEFAULT 1 NOT NULL;`,

		// 3. Lead Notes
		`CREATE TABLE IF NOT EXISTS lead_notes (
			id SERIAL PRIMARY KEY,
			lead_number VARCHAR(50) NOT NULL REFERENCES leads(number) ON DELETE CASCADE,
			user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
			content TEXT NOT NULL,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);`,

		// 4. Lead Activities
		`CREATE TABLE IF NOT EXISTS lead_activities (
			id SERIAL PRIMARY KEY,
			lead_number VARCHAR(50) NOT NULL REFERENCES leads(number) ON DELETE CASCADE,
			user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
			activity_type VARCHAR(50) NOT NULL,
			title VARCHAR(255) NOT NULL,
			description TEXT,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);`,

		// 5. Custom Field Definitions
		`CREATE TABLE IF NOT EXISTS custom_field_definitions (
			id SERIAL PRIMARY KEY,
			field_key VARCHAR(100) NOT NULL,
			field_label VARCHAR(255) NOT NULL,
			field_type VARCHAR(50) NOT NULL,
			options TEXT NOT NULL DEFAULT '[]',
			required INTEGER NOT NULL DEFAULT 0,
			visibility INTEGER NOT NULL DEFAULT 1,
			field_order INTEGER NOT NULL DEFAULT 0,
			section VARCHAR(100) NOT NULL DEFAULT 'Custom Details',
			workspace_id INTEGER NOT NULL DEFAULT 1,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);`,

		// 6. Lead Custom Field Values
		`CREATE TABLE IF NOT EXISTS lead_custom_field_values (
			id SERIAL PRIMARY KEY,
			lead_number VARCHAR(50) NOT NULL REFERENCES leads(number) ON DELETE CASCADE,
			custom_field_id INTEGER NOT NULL REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
			value TEXT,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);`,

		// 7. Follow Ups
		`CREATE TABLE IF NOT EXISTS follow_ups (
			id SERIAL PRIMARY KEY,
			lead_number VARCHAR(50) NOT NULL REFERENCES leads(number) ON DELETE CASCADE,
			user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
			title VARCHAR(255) NOT NULL,
			follow_up_type VARCHAR(50) NOT NULL DEFAULT 'Call',
			due_date TIMESTAMP WITH TIME ZONE NOT NULL,
			completed INTEGER NOT NULL DEFAULT 0,
			completed_at TIMESTAMP WITH TIME ZONE,
			notes TEXT,
			reminder_state VARCHAR(50) NOT NULL DEFAULT 'pending',
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);`,

		// 8. Lead Assignments
		`CREATE TABLE IF NOT EXISTS lead_assignments (
			id SERIAL PRIMARY KEY,
			lead_number VARCHAR(50) NOT NULL REFERENCES leads(number) ON DELETE CASCADE,
			from_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
			to_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
			assigned_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
			reason VARCHAR(255),
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);`,

		// 9. Lead Statuses
		`CREATE TABLE IF NOT EXISTS lead_statuses (
			id SERIAL PRIMARY KEY,
			name VARCHAR(100) NOT NULL,
			color VARCHAR(50) NOT NULL DEFAULT '#0D9488',
			"order" INTEGER NOT NULL DEFAULT 0,
			is_default INTEGER NOT NULL DEFAULT 0,
			workspace_id INTEGER NOT NULL DEFAULT 1,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);`,

		// 10. Lead Sources
		`CREATE TABLE IF NOT EXISTS lead_sources (
			id SERIAL PRIMARY KEY,
			name VARCHAR(100) NOT NULL,
			is_default INTEGER NOT NULL DEFAULT 0,
			workspace_id INTEGER NOT NULL DEFAULT 1,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);`,

		// 11. Tags
		`CREATE TABLE IF NOT EXISTS tags (
			id SERIAL PRIMARY KEY,
			name VARCHAR(100) NOT NULL,
			color VARCHAR(50) NOT NULL DEFAULT '#6366F1',
			workspace_id INTEGER NOT NULL DEFAULT 1,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);`,

		// 12. Duplicate Check Settings
		`CREATE TABLE IF NOT EXISTS duplicate_check_settings (
			id SERIAL PRIMARY KEY,
			workspace_id INTEGER UNIQUE NOT NULL DEFAULT 1,
			check_phone INTEGER NOT NULL DEFAULT 1,
			check_email INTEGER NOT NULL DEFAULT 1,
			action VARCHAR(50) NOT NULL DEFAULT 'prevent',
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);`,

		// 13. Saved Views
		`CREATE TABLE IF NOT EXISTS saved_views (
			id SERIAL PRIMARY KEY,
			user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			name VARCHAR(100) NOT NULL,
			filters TEXT NOT NULL,
			is_default INTEGER NOT NULL DEFAULT 0,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);`,

		// 14. API Keys
		`CREATE TABLE IF NOT EXISTS api_keys (
			id SERIAL PRIMARY KEY,
			name VARCHAR(255) NOT NULL,
			key_hash VARCHAR(64) UNIQUE NOT NULL,
			key_prefix VARCHAR(20) NOT NULL DEFAULT 'crm_live_',
			key_suffix VARCHAR(10) NOT NULL,
			masked_key VARCHAR(50) NOT NULL,
			status VARCHAR(20) NOT NULL DEFAULT 'active',
			expires_at TIMESTAMP WITH TIME ZONE,
			last_used_at TIMESTAMP WITH TIME ZONE,
			created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);`,
	}

	for _, query := range queries {
		if _, err := db.Pool.Exec(ctx, query); err != nil {
			return fmt.Errorf("migration query error: %w (SQL: %s)", err, query)
		}
	}

	log.Println("[Database] Migrations verified and executed successfully")
	return nil
}
