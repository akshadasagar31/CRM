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

	// 6. Default Sales Pipeline & Stages
	var pipelineCount int
	if err := db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM pipelines WHERE workspace_id = 1").Scan(&pipelineCount); err == nil && pipelineCount == 0 {
		var pipelineID int
		err := db.Pool.QueryRow(ctx,
			`INSERT INTO pipelines (name, is_default, workspace_id) VALUES ($1, 1, 1) RETURNING id`,
			"Standard Sales Pipeline",
		).Scan(&pipelineID)
		if err == nil {
			stages := []struct {
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
			for _, st := range stages {
				_, _ = db.Pool.Exec(ctx,
					`INSERT INTO deal_stages (pipeline_id, name, stage_order, probability, color, is_won, is_lost, is_active)
					 VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
					pipelineID, st.name, st.order, st.probability, st.color, st.isWon, st.isLost,
				)
			}
			log.Println("[Database] Seeded Standard Sales Pipeline and 9 default stages")
		}
	}

	// 7. Ensure user role defaults
	_, _ = db.Pool.Exec(ctx, "UPDATE users SET role = 'sales_rep' WHERE role IS NULL OR role = ''")
	_, _ = db.Pool.Exec(ctx, "UPDATE users SET role = 'admin' WHERE id = 1 OR email IN ('akshadasagar31@gmail.com', 'akshadasagar0924@gmail.com')")

	// 8. Seed default products catalog if empty
	var prodCount int
	if err := db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM products WHERE workspace_id = 1").Scan(&prodCount); err == nil && prodCount == 0 {
		defaultProducts := []struct {
			name, sku, category, desc, unit, hsn string
			price, tax                            float64
		}{
			{"Cloud CRM Enterprise Annual License", "CRM-ENT-001", "Software", "Annual enterprise user license with full CRM & pipeline access", "License", "997331", 15000.00, 18.00},
			{"CRM Implementation & Onboarding", "SRV-SETUP-01", "Services", "Dedicated onboarding, data migration, and pipeline configuration service", "Service", "998313", 25000.00, 18.00},
			{"Dedicated Cloud Hosting Server (12M)", "SRV-HOST-12M", "Subscription", "High-performance isolated cloud infrastructure with automated backups", "Year", "998315", 36000.00, 18.00},
			{"Priority 24/7 SLA Support (Annual)", "SUP-SLA-01", "Support", "1-hour SLA response time with dedicated account manager and phone escalation", "Year", "998316", 12000.00, 18.00},
			{"Custom ERP / API Integration Consulting", "CNS-WORK-HR", "Consulting", "Expert engineering consultation for 3rd-party webhook and ERP integrations", "Hours", "998319", 2500.00, 18.00},
		}

		for _, p := range defaultProducts {
			_, _ = db.Pool.Exec(ctx, `
				INSERT INTO products (name, sku, category, description, unit, selling_price, currency, tax_rate, hsn_sac, status, workspace_id, created_at, updated_at)
				VALUES ($1, $2, $3, $4, $5, $6, 'INR', $7, $8, 'active', 1, NOW(), NOW())
			`, p.name, p.sku, p.category, p.desc, p.unit, p.price, p.tax, p.hsn)
		}
		log.Println("[Database] Seeded 5 initial catalog products")
	}

	// 9. Seed default company profile if empty
	var companyCount int
	if err := db.Pool.QueryRow(ctx, "SELECT COUNT(*) FROM company_profiles WHERE workspace_id = 1").Scan(&companyCount); err == nil && companyCount == 0 {
		_, _ = db.Pool.Exec(ctx, `
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
		log.Println("[Database] Seeded initial company profile")
	}

	return nil
}
