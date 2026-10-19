package repository

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// SyncDealOnInvoiceFullPaymentTx updates the linked deal to "Won" within an existing database transaction.
// It resolves the deal from direct invoices.deal_id, orders.deal_id, or quotations.deal_id.
// It also logs a timeline activity on the deal and reverse-syncs to the originating lead.
func SyncDealOnInvoiceFullPaymentTx(ctx context.Context, tx pgx.Tx, invoiceID int, invoiceNumber string, recordedByID *int) {
	// 1. Resolve linked Deal ID: direct deal_id, order.deal_id, or quotation.deal_id
	var resolvedDealID *int
	var invNumFromDB string
	err := tx.QueryRow(ctx, `
		SELECT 
			COALESCE(i.deal_id, o.deal_id, q.deal_id) AS resolved_deal_id,
			i.invoice_number
		FROM invoices i
		LEFT JOIN orders o ON i.order_id = o.id
		LEFT JOIN quotations q ON i.quotation_id = q.id
		WHERE i.id = $1
	`, invoiceID).Scan(&resolvedDealID, &invNumFromDB)
	if err != nil || resolvedDealID == nil || *resolvedDealID <= 0 {
		return
	}

	dealID := *resolvedDealID
	if strings.TrimSpace(invoiceNumber) == "" {
		invoiceNumber = invNumFromDB
	}

	// 2. Fetch current deal status, stage, pipeline_id, and lead_number
	var pipelineID, currentStageID int
	var currentStatus string
	var leadNumber *string
	err = tx.QueryRow(ctx, `
		SELECT pipeline_id, stage_id, LOWER(TRIM(status)), lead_number
		FROM deals
		WHERE id = $1
	`, dealID).Scan(&pipelineID, &currentStageID, &currentStatus, &leadNumber)
	if err != nil {
		return
	}

	// If the deal is already won, avoid duplicate updates
	if currentStatus == "won" {
		return
	}

	// 3. Find the pipeline's "Won" stage (is_won = 1 or name = 'won')
	var wonStageID int
	err = tx.QueryRow(ctx, `
		SELECT id
		FROM deal_stages
		WHERE pipeline_id = $1 AND (is_won = 1 OR LOWER(TRIM(name)) = 'won')
		ORDER BY is_won DESC, stage_order DESC, id ASC
		LIMIT 1
	`, pipelineID).Scan(&wonStageID)
	if err != nil {
		// Fallback: search for any stage containing 'won'
		err = tx.QueryRow(ctx, `
			SELECT id FROM deal_stages
			WHERE pipeline_id = $1 AND LOWER(name) LIKE '%won%'
			ORDER BY stage_order DESC, id ASC
			LIMIT 1
		`, pipelineID).Scan(&wonStageID)
		if err != nil {
			wonStageID = currentStageID
		}
	}

	// 4. Update deal to Won stage and 'won' status
	_, err = tx.Exec(ctx, `
		UPDATE deals
		SET stage_id = $1, status = 'won', updated_at = NOW()
		WHERE id = $2
	`, wonStageID, dealID)
	if err != nil {
		return
	}

	// 5. Insert timeline activity in deal_activities
	actDesc := fmt.Sprintf("Invoice %s was fully paid (outstanding balance: ₹0). Deal automatically marked as WON.", invoiceNumber)
	_, _ = tx.Exec(ctx, `
		INSERT INTO deal_activities (deal_id, user_id, activity_type, title, description, created_at)
		VALUES ($1, $2, 'deal_won_payment', 'Deal WON! 🎉', $3, NOW())
	`, dealID, recordedByID, actDesc)

	// 6. Reverse sync to originating lead if present
	if leadNumber != nil && strings.TrimSpace(*leadNumber) != "" {
		_, _ = tx.Exec(ctx, `
			UPDATE leads
			SET status = 'Won', updated_at = NOW()
			WHERE number = $1
		`, strings.TrimSpace(*leadNumber))
	}
}

// SyncDealOnInvoiceFullPaymentPool begins a transaction and executes SyncDealOnInvoiceFullPaymentTx.
func SyncDealOnInvoiceFullPaymentPool(ctx context.Context, pool *pgxpool.Pool, invoiceID int, invoiceNumber string, recordedByID *int) {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return
	}
	defer tx.Rollback(ctx)

	SyncDealOnInvoiceFullPaymentTx(ctx, tx, invoiceID, invoiceNumber, recordedByID)
	_ = tx.Commit(ctx)
}
