package database

import (
	"context"
	"fmt"
	"log"
	"strings"
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

		// 15. User Role Migration
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'sales_rep' NOT NULL;`,

		// 16. Customers table
		`CREATE TABLE IF NOT EXISTS customers (
			id SERIAL PRIMARY KEY,
			name VARCHAR(255) NOT NULL,
			email VARCHAR(255),
			phone VARCHAR(50),
			company VARCHAR(255),
			website VARCHAR(255),
			address TEXT,
			workspace_id INTEGER NOT NULL DEFAULT 1,
			created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);`,

		// 17. Pipelines table
		`CREATE TABLE IF NOT EXISTS pipelines (
			id SERIAL PRIMARY KEY,
			name VARCHAR(100) NOT NULL,
			is_default INTEGER NOT NULL DEFAULT 0,
			workspace_id INTEGER NOT NULL DEFAULT 1,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);`,

		// 18. Deal Stages table
		`CREATE TABLE IF NOT EXISTS deal_stages (
			id SERIAL PRIMARY KEY,
			pipeline_id INTEGER NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
			name VARCHAR(100) NOT NULL,
			stage_order INTEGER NOT NULL DEFAULT 0,
			probability INTEGER NOT NULL DEFAULT 10,
			color VARCHAR(50) NOT NULL DEFAULT '#0D9488',
			is_won INTEGER NOT NULL DEFAULT 0,
			is_lost INTEGER NOT NULL DEFAULT 0,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);`,

		// 19. Deals table
		`CREATE TABLE IF NOT EXISTS deals (
			id SERIAL PRIMARY KEY,
			deal_number VARCHAR(50) UNIQUE NOT NULL,
			name VARCHAR(255) NOT NULL,
			customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
			lead_number VARCHAR(50) REFERENCES leads(number) ON DELETE SET NULL,
			pipeline_id INTEGER NOT NULL REFERENCES pipelines(id) ON DELETE RESTRICT,
			stage_id INTEGER NOT NULL REFERENCES deal_stages(id) ON DELETE RESTRICT,
			owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
			value NUMERIC(15, 2) NOT NULL DEFAULT 0,
			currency VARCHAR(10) NOT NULL DEFAULT 'USD',
			priority VARCHAR(50) NOT NULL DEFAULT 'Medium',
			expected_close_date TIMESTAMP WITH TIME ZONE,
			requirement TEXT,
			status VARCHAR(50) NOT NULL DEFAULT 'open',
			lost_reason TEXT,
			workspace_id INTEGER NOT NULL DEFAULT 1,
			created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);`,

		// 20. Deal Notes
		`CREATE TABLE IF NOT EXISTS deal_notes (
			id SERIAL PRIMARY KEY,
			deal_id INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
			user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
			content TEXT NOT NULL,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);`,

		// 21. Deal Activities Timeline
		`CREATE TABLE IF NOT EXISTS deal_activities (
			id SERIAL PRIMARY KEY,
			deal_id INTEGER NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
			user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
			activity_type VARCHAR(50) NOT NULL,
			title VARCHAR(255) NOT NULL,
			description TEXT,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);`,

		// 22. Follow-ups deal linkage
		`ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS deal_id INTEGER REFERENCES deals(id) ON DELETE CASCADE;`,
		`ALTER TABLE follow_ups ALTER COLUMN lead_number DROP NOT NULL;`,

		// 23. Products Catalog table
		`CREATE TABLE IF NOT EXISTS products (
			id SERIAL PRIMARY KEY,
			name VARCHAR(255) NOT NULL,
			sku VARCHAR(100) NOT NULL,
			category VARCHAR(100) NOT NULL DEFAULT 'General',
			description TEXT,
			unit VARCHAR(50) NOT NULL DEFAULT 'Unit',
			selling_price NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
			currency VARCHAR(10) NOT NULL DEFAULT 'INR',
			tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
			hsn_sac VARCHAR(50),
			status VARCHAR(20) NOT NULL DEFAULT 'active',
			workspace_id INTEGER NOT NULL DEFAULT 1,
			created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			deleted_at TIMESTAMP WITH TIME ZONE
		);`,
		`CREATE INDEX IF NOT EXISTS idx_products_workspace ON products(workspace_id);`,
		`CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);`,
		`CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);`,
		`CREATE INDEX IF NOT EXISTS idx_products_deleted_at ON products(deleted_at);`,
		`CREATE UNIQUE INDEX IF NOT EXISTS uq_products_sku_active ON products(sku, workspace_id) WHERE deleted_at IS NULL;`,

		// 24. Quotations table
		`CREATE TABLE IF NOT EXISTS quotations (
			id SERIAL PRIMARY KEY,
			quotation_number VARCHAR(50) UNIQUE NOT NULL,
			title VARCHAR(255) NOT NULL,
			deal_id INTEGER NOT NULL REFERENCES deals(id) ON DELETE RESTRICT,
			customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
			lead_number VARCHAR(50) REFERENCES leads(number) ON DELETE SET NULL,
			status VARCHAR(50) NOT NULL DEFAULT 'Draft',
			currency VARCHAR(10) NOT NULL DEFAULT 'USD',
			subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
			discount_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
			discount_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
			tax_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
			tax_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
			total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
			valid_until TIMESTAMP WITH TIME ZONE,
			terms_and_conditions TEXT,
			notes TEXT,
			workspace_id INTEGER NOT NULL DEFAULT 1,
			created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);`,
		`CREATE INDEX IF NOT EXISTS idx_quotations_workspace ON quotations(workspace_id);`,
		`CREATE INDEX IF NOT EXISTS idx_quotations_deal ON quotations(deal_id);`,
		`CREATE INDEX IF NOT EXISTS idx_quotations_customer ON quotations(customer_id);`,
		`CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status);`,

		// 25. Quotation Line Items table
		`CREATE TABLE IF NOT EXISTS quotation_items (
			id SERIAL PRIMARY KEY,
			quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
			product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
			product_name VARCHAR(255) NOT NULL,
			sku VARCHAR(100),
			description TEXT,
			quantity NUMERIC(12, 2) NOT NULL DEFAULT 1.00,
			unit_price NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
			discount_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
			tax_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
			line_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);`,
		`CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation ON quotation_items(quotation_id);`,

		// 26. Company Profiles table
		`CREATE TABLE IF NOT EXISTS company_profiles (
			id SERIAL PRIMARY KEY,
			workspace_id INTEGER NOT NULL DEFAULT 1,
			company_name VARCHAR(255) NOT NULL DEFAULT 'BizCopilot Technologies',
			logo_data BYTEA,
			logo_mime_type VARCHAR(100),
			gst_number VARCHAR(50),
			pan_number VARCHAR(50),
			email VARCHAR(255),
			phone VARCHAR(50),
			website VARCHAR(255),
			address TEXT,
			city VARCHAR(100),
			state VARCHAR(100),
			country VARCHAR(100) DEFAULT 'India',
			pincode VARCHAR(20),
			default_currency VARCHAR(10) NOT NULL DEFAULT 'INR',
			updated_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);`,
		`CREATE INDEX IF NOT EXISTS idx_company_profiles_workspace ON company_profiles(workspace_id);`,

		// 27. Customer GST and State columns
		`ALTER TABLE customers ADD COLUMN IF NOT EXISTS state VARCHAR(100);`,
		`ALTER TABLE customers ADD COLUMN IF NOT EXISTS gstin VARCHAR(50);`,
		`ALTER TABLE customers ADD COLUMN IF NOT EXISTS city VARCHAR(100);`,
		`ALTER TABLE customers ADD COLUMN IF NOT EXISTS pincode VARCHAR(20);`,

		// 28. Quotations GST Breakdown and Snapshot columns
		`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS company_name VARCHAR(255);`,
		`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS company_gstin VARCHAR(50);`,
		`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS company_state VARCHAR(100);`,
		`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS company_pan VARCHAR(50);`,
		`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS company_address TEXT;`,
		`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS customer_state VARCHAR(100);`,
		`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS customer_gstin VARCHAR(50);`,
		`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS is_inter_state BOOLEAN DEFAULT false;`,
		`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS taxable_amount NUMERIC(15, 2) DEFAULT 0.00;`,
		`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(15, 2) DEFAULT 0.00;`,
		`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(15, 2) DEFAULT 0.00;`,
		`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS igst_amount NUMERIC(15, 2) DEFAULT 0.00;`,
		`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS total_gst_amount NUMERIC(15, 2) DEFAULT 0.00;`,
		`ALTER TABLE quotations ADD COLUMN IF NOT EXISTS round_off_amount NUMERIC(15, 2) DEFAULT 0.00;`,

		// 29. Quotation Items GST Breakdown columns
		`ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS hsn_sac VARCHAR(50);`,
		`ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS taxable_amount NUMERIC(15, 2) DEFAULT 0.00;`,
		`ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(5, 2) DEFAULT 0.00;`,
		`ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS gst_amount NUMERIC(15, 2) DEFAULT 0.00;`,
		`ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS cgst_rate NUMERIC(5, 2) DEFAULT 0.00;`,
		`ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS cgst_amount NUMERIC(15, 2) DEFAULT 0.00;`,
		`ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS sgst_rate NUMERIC(5, 2) DEFAULT 0.00;`,
		`ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS sgst_amount NUMERIC(15, 2) DEFAULT 0.00;`,
		`ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS igst_rate NUMERIC(5, 2) DEFAULT 0.00;`,
		`ALTER TABLE quotation_items ADD COLUMN IF NOT EXISTS igst_amount NUMERIC(15, 2) DEFAULT 0.00;`,

		// 30. Deal Stages is_active column
		`ALTER TABLE deal_stages ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;`,

		// 31. Orders table
		`CREATE TABLE IF NOT EXISTS orders (
			id SERIAL PRIMARY KEY,
			order_number VARCHAR(50) UNIQUE NOT NULL,
			title VARCHAR(255) NOT NULL,
			customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
			deal_id INTEGER REFERENCES deals(id) ON DELETE SET NULL,
			quotation_id INTEGER REFERENCES quotations(id) ON DELETE SET NULL,
			stage VARCHAR(50) NOT NULL DEFAULT 'Not Started',
			payment_status VARCHAR(50) NOT NULL DEFAULT 'Unpaid',
			invoice_status VARCHAR(50) NOT NULL DEFAULT 'Not Invoiced',
			total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
			currency VARCHAR(10) NOT NULL DEFAULT 'INR',
			start_date DATE,
			delivery_date DATE,
			notes TEXT,
			owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
			workspace_id INTEGER NOT NULL DEFAULT 1,
			created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);`,
		`CREATE INDEX IF NOT EXISTS idx_orders_workspace ON orders(workspace_id);`,
		`CREATE INDEX IF NOT EXISTS idx_orders_deal ON orders(deal_id);`,
		`CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);`,
		`CREATE INDEX IF NOT EXISTS idx_orders_stage ON orders(stage);`,

		// 32. Order Items table
		`CREATE TABLE IF NOT EXISTS order_items (
			id SERIAL PRIMARY KEY,
			order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
			product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
			name VARCHAR(255) NOT NULL,
			description TEXT,
			quantity NUMERIC(10, 2) NOT NULL DEFAULT 1.00,
			unit_price NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
			gst_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
			taxable_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
			tax_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
			total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);`,
		`CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);`,

		// 33. Order Activities table
		`CREATE TABLE IF NOT EXISTS order_activities (
			id SERIAL PRIMARY KEY,
			order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
			user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
			activity_type VARCHAR(50) NOT NULL,
			title VARCHAR(255) NOT NULL,
			description TEXT,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);`,
		`CREATE INDEX IF NOT EXISTS idx_order_activities_order ON order_activities(order_id);`,

		// 34. Invoices table
		`CREATE TABLE IF NOT EXISTS invoices (
			id SERIAL PRIMARY KEY,
			invoice_number VARCHAR(50) UNIQUE NOT NULL,
			customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
			order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
			quotation_id INTEGER REFERENCES quotations(id) ON DELETE SET NULL,
			deal_id INTEGER REFERENCES deals(id) ON DELETE SET NULL,
			status VARCHAR(50) NOT NULL DEFAULT 'Draft',
			invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
			due_date DATE,
			currency VARCHAR(10) NOT NULL DEFAULT 'INR',
			subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
			discount_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
			discount_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
			taxable_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
			cgst_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
			sgst_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
			igst_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
			total_tax NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
			round_off_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
			grand_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
			amount_paid NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
			payment_method VARCHAR(50),
			payment_notes TEXT,
			notes TEXT,
			terms_and_conditions TEXT,
			company_name TEXT,
			company_gstin VARCHAR(50),
			company_pan VARCHAR(50),
			company_state VARCHAR(100),
			company_address TEXT,
			customer_state VARCHAR(100),
			customer_gstin VARCHAR(50),
			is_inter_state BOOLEAN NOT NULL DEFAULT FALSE,
			workspace_id INTEGER NOT NULL DEFAULT 1,
			created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);`,
		`CREATE INDEX IF NOT EXISTS idx_invoices_workspace ON invoices(workspace_id);`,
		`CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);`,
		`CREATE INDEX IF NOT EXISTS idx_invoices_order ON invoices(order_id);`,
		`CREATE INDEX IF NOT EXISTS idx_invoices_quotation ON invoices(quotation_id);`,
		`CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);`,

		// 35. Invoice Items table
		`CREATE TABLE IF NOT EXISTS invoice_items (
			id SERIAL PRIMARY KEY,
			invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
			product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
			product_name VARCHAR(255) NOT NULL,
			sku VARCHAR(100),
			hsn_sac VARCHAR(50),
			description TEXT,
			quantity NUMERIC(10, 2) NOT NULL DEFAULT 1.00,
			unit_price NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
			discount_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
			tax_percentage NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
			taxable_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
			gst_rate NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
			gst_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
			cgst_rate NUMERIC(5, 2) NOT NULL DEFAULT 9.00,
			cgst_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
			sgst_rate NUMERIC(5, 2) NOT NULL DEFAULT 9.00,
			sgst_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
			igst_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
			igst_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
			line_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);`,
		`CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);`,

		// 36. Invoice Payments table
		`CREATE TABLE IF NOT EXISTS invoice_payments (
			id SERIAL PRIMARY KEY,
			invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
			amount NUMERIC(15, 2) NOT NULL,
			payment_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
			payment_method VARCHAR(50) NOT NULL DEFAULT 'Bank Transfer',
			reference_number VARCHAR(100),
			notes TEXT,
			recorded_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
		);`,
		`CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON invoice_payments(invoice_id);`,
	}

	for _, query := range queries {
		if _, err := db.Pool.Exec(ctx, query); err != nil {
			return fmt.Errorf("migration query error: %w (SQL: %s)", err, query)
		}
	}

	if err := db.syncDefaultPipelineStagesAndBackfill(ctx); err != nil {
		log.Printf("[Database] Notice: sync stages and backfill completed with note: %v", err)
	}

	log.Println("[Database] Migrations verified and executed successfully")
	return nil
}

func (db *DB) syncDefaultPipelineStagesAndBackfill(ctx context.Context) error {
	// Standard 9 stages
	standardStages := []struct {
		name        string
		order       int
		probability int
		color       string
		isWon       int
		isLost      int
	}{
		{"New Opportunity", 1, 10, "#3B82F6", 0, 0},
		{"Requirement Discussion", 2, 25, "#6366F1", 0, 0},
		{"Quotation Preparation", 3, 40, "#8B5CF6", 0, 0},
		{"Quotation Sent", 4, 55, "#06B6D4", 0, 0},
		{"Negotiation", 5, 70, "#F59E0B", 0, 0},
		{"Quotation Accepted", 6, 85, "#14B8A6", 0, 0},
		{"Final Amount Confirmed", 7, 95, "#10B981", 0, 0},
		{"Won", 8, 100, "#059669", 1, 0},
		{"Lost", 9, 0, "#EF4444", 0, 1},
	}

	// 1. Ensure default pipeline exists
	var pipelineID int
	err := db.Pool.QueryRow(ctx, "SELECT id FROM pipelines WHERE workspace_id = 1 ORDER BY is_default DESC, id ASC LIMIT 1").Scan(&pipelineID)
	if err != nil {
		_ = db.Pool.QueryRow(ctx, "INSERT INTO pipelines (name, is_default, workspace_id) VALUES ('Sales Pipeline', 1, 1) RETURNING id").Scan(&pipelineID)
	}

	if pipelineID > 0 {
		// Sync each standard stage
		for _, st := range standardStages {
			var stageID int
			errCheck := db.Pool.QueryRow(ctx, "SELECT id FROM deal_stages WHERE pipeline_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2)) LIMIT 1", pipelineID, st.name).Scan(&stageID)
			if errCheck == nil && stageID > 0 {
				_, _ = db.Pool.Exec(ctx, `
					UPDATE deal_stages 
					SET stage_order = $1, probability = $2, color = $3, is_won = $4, is_lost = $5, is_active = true 
					WHERE id = $6`,
					st.order, st.probability, st.color, st.isWon, st.isLost, stageID,
				)
			} else {
				_, _ = db.Pool.Exec(ctx, `
					INSERT INTO deal_stages (pipeline_id, name, stage_order, probability, color, is_won, is_lost, is_active)
					VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
					pipelineID, st.name, st.order, st.probability, st.color, st.isWon, st.isLost,
				)
			}
		}
	}

	// 2. Backfill deals for existing leads without a deal
	leadRows, err := db.Pool.Query(ctx, `
		SELECT l.number, COALESCE(l.name, 'Lead'), COALESCE(l.email, ''), COALESCE(l.phone, ''), 
		       COALESCE(l.status, 'New'), l.owner_id, l.workspace_id, COALESCE(l.requirement, '')
		FROM leads l
		WHERE l.deleted_at IS NULL
		  AND NOT EXISTS (
		      SELECT 1 FROM deals d 
		      WHERE d.lead_number = l.number AND d.workspace_id = l.workspace_id
		  )
	`)
	if err == nil {
		type unlinkedLead struct {
			number      string
			name        string
			email       string
			phone       string
			status      string
			ownerID     *int
			workspaceID int
			requirement string
		}
		var leadsToBackfill []unlinkedLead
		for leadRows.Next() {
			var ul unlinkedLead
			if errScan := leadRows.Scan(&ul.number, &ul.name, &ul.email, &ul.phone, &ul.status, &ul.ownerID, &ul.workspaceID, &ul.requirement); errScan == nil {
				leadsToBackfill = append(leadsToBackfill, ul)
			}
		}
		leadRows.Close()

		for _, ul := range leadsToBackfill {
			// Find or create customer
			var custID int
			errCust := db.Pool.QueryRow(ctx, `
				SELECT id FROM customers 
				WHERE workspace_id = $1 AND ((email = $2 AND email != '') OR (phone = $3 AND phone != '')) 
				LIMIT 1`,
				ul.workspaceID, ul.email, ul.phone,
			).Scan(&custID)

			if errCust != nil || custID == 0 {
				_ = db.Pool.QueryRow(ctx, `
					INSERT INTO customers (name, email, phone, company, workspace_id, created_at, updated_at)
					VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
					RETURNING id`,
					ul.name, ul.email, ul.phone, ul.name, ul.workspaceID,
				).Scan(&custID)
			}

			if custID > 0 {
				// Map status to stage name
				targetStageName := "New Opportunity"
				normStatus := strings.ToLower(strings.TrimSpace(ul.status))
				switch normStatus {
				case "contacted", "follow-up":
					targetStageName = "Requirement Discussion"
				case "qualified":
					targetStageName = "Quotation Preparation"
				case "won":
					targetStageName = "Won"
				case "lost":
					targetStageName = "Lost"
				default:
					targetStageName = "New Opportunity"
				}

				var mappedStageID int
				_ = db.Pool.QueryRow(ctx, `
					SELECT id FROM deal_stages 
					WHERE pipeline_id = $1 AND LOWER(TRIM(name)) = LOWER(TRIM($2)) 
					LIMIT 1`,
					pipelineID, targetStageName,
				).Scan(&mappedStageID)

				if mappedStageID == 0 {
					_ = db.Pool.QueryRow(ctx, `
						SELECT id FROM deal_stages WHERE pipeline_id = $1 ORDER BY stage_order ASC LIMIT 1`,
						pipelineID,
					).Scan(&mappedStageID)
				}

				if mappedStageID > 0 {
					dealName := fmt.Sprintf("%s - Opportunity", ul.name)
					var newDealID int
					errDeal := db.Pool.QueryRow(ctx, `
						INSERT INTO deals (
							deal_number, name, customer_id, lead_number, pipeline_id, stage_id,
							owner_id, value, currency, priority, requirement, workspace_id,
							created_at, updated_at
						) VALUES (
							CONCAT('DEAL-', LPAD(nextval('deals_id_seq')::text, 4, '0')),
							$1, $2, $3, $4, $5,
							$6, 0, 'INR', 'Medium', $7, $8,
							NOW(), NOW()
						) RETURNING id`,
						dealName, custID, ul.number, pipelineID, mappedStageID,
						ul.ownerID, ul.requirement, ul.workspaceID,
					).Scan(&newDealID)

					if errDeal == nil && newDealID > 0 {
						// Log timeline events
						_, _ = db.Pool.Exec(ctx, `
							INSERT INTO deal_activities (deal_id, user_id, activity_type, title, description, created_at)
							VALUES ($1, $2, 'deal_created', 'Deal Created', CONCAT('Auto-created deal from lead ', $3), NOW())`,
							newDealID, ul.ownerID, ul.number,
						)
						_, _ = db.Pool.Exec(ctx, `
							INSERT INTO lead_activities (lead_number, user_id, activity_type, title, description, created_at)
							VALUES ($1, $2, 'converted_to_deal', 'Linked to Deal', CONCAT('Opportunity created in ', $3), NOW())`,
							ul.number, ul.ownerID, targetStageName,
						)
					}
				}
			}
		}
	}

	return nil
}
