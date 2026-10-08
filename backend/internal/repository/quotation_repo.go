package repository

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"

	"crm-backend-go/internal/database"
	"crm-backend-go/internal/models"

	"github.com/jackc/pgx/v5"
)

type QuotationRepository struct {
	db       *database.DB
	dealRepo *DealRepository
	pipeRepo *PipelineRepository
}

func NewQuotationRepository(db *database.DB, dealRepo *DealRepository, pipeRepo *PipelineRepository) *QuotationRepository {
	return &QuotationRepository{
		db:       db,
		dealRepo: dealRepo,
		pipeRepo: pipeRepo,
	}
}

type QuotationFilter struct {
	DealID     *int
	CustomerID *int
	Status     string
	Search     string
	Page       int
	Limit      int
}

func (r *QuotationRepository) generateQuotationNumber(ctx context.Context, workspaceID int) (string, error) {
	var maxID int
	_ = r.db.Pool.QueryRow(ctx, "SELECT COALESCE(MAX(id), 0) + 1 FROM quotations").Scan(&maxID)
	return fmt.Sprintf("QTN-%04d", maxID), nil
}

func (r *QuotationRepository) Create(ctx context.Context, input models.QuotationCreateInput, createdByID *int, workspaceID int) (*models.Quotation, error) {
	if input.DealID <= 0 {
		return nil, errors.New("a valid Deal is required to create a quotation")
	}

	// 1. Verify Deal exists in workspace and fetch linked Customer and Lead
	deal, err := r.dealRepo.GetByID(ctx, input.DealID, workspaceID)
	if err != nil || deal == nil {
		return nil, errors.New("selected Deal does not exist in this workspace")
	}

	customerID := deal.CustomerID
	leadNumber := deal.LeadNumber

	title := strings.TrimSpace(input.Title)
	if title == "" {
		title = fmt.Sprintf("Quote for %s", deal.Name)
	}

	currency := input.Currency
	if currency == "" {
		currency = deal.Currency
	}
	if currency == "" {
		currency = "INR"
	}

	if len(input.Items) == 0 {
		return nil, errors.New("quotation must contain at least one line item")
	}

	// 2. Fetch Company Profile Snapshot for GST details
	var compName, compGST, compPAN, compState, compAddr string
	_ = r.db.Pool.QueryRow(ctx, `
		SELECT COALESCE(company_name, 'Company'), COALESCE(gst_number, ''), COALESCE(pan_number, ''),
		       COALESCE(state, 'Maharashtra'), COALESCE(address, '')
		FROM company_profiles WHERE workspace_id = $1 LIMIT 1
	`, workspaceID).Scan(&compName, &compGST, &compPAN, &compState, &compAddr)
	if compName == "" {
		compName = "Company"
	}
	if compState == "" {
		compState = "Maharashtra"
	}

	// 3. Resolve Customer State & GSTIN (Place of Supply)
	custState := ""
	if input.CustomerState != nil {
		custState = strings.TrimSpace(*input.CustomerState)
	}
	custGSTIN := ""
	if input.CustomerGSTIN != nil {
		custGSTIN = strings.TrimSpace(*input.CustomerGSTIN)
	}
	if custState == "" || custGSTIN == "" {
		var dbCustState, dbCustGSTIN *string
		_ = r.db.Pool.QueryRow(ctx, "SELECT state, gstin FROM customers WHERE id = $1", customerID).Scan(&dbCustState, &dbCustGSTIN)
		if custState == "" && dbCustState != nil {
			custState = *dbCustState
		}
		if custGSTIN == "" && dbCustGSTIN != nil {
			custGSTIN = *dbCustGSTIN
		}
	}
	if custState == "" {
		// Default to company state (Intra-state) if not specified
		custState = compState
	}

	// Determine Inter-State vs Intra-State supply
	cleanCompState := strings.ToLower(strings.TrimSpace(compState))
	cleanCustState := strings.ToLower(strings.TrimSpace(custState))
	isInterState := (cleanCompState != "" && cleanCustState != "" && cleanCompState != cleanCustState)

	// 4. Calculate item totals with GST breakdown
	type calculatedItem struct {
		productID   *int
		productName string
		sku         *string
		hsnSac      *string
		desc        *string
		qty         float64
		price       float64
		discPct     float64
		taxableAmt  float64
		gstRate     float64
		gstAmt      float64
		cgstRate    float64
		cgstAmt     float64
		sgstRate    float64
		sgstAmt     float64
		igstRate    float64
		igstAmt     float64
		lineTotal   float64
	}

	var subtotal float64
	var totalTaxable, totalCGST, totalSGST, totalIGST, totalGST float64
	calcItems := make([]calculatedItem, 0, len(input.Items))

	for _, it := range input.Items {
		pName := strings.TrimSpace(it.ProductName)
		if pName == "" {
			return nil, errors.New("each line item must have a product name")
		}
		qty := it.Quantity
		if qty <= 0 {
			qty = 1.0
		}
		price := it.UnitPrice
		if price < 0 {
			price = 0
		}
		discPct := it.DiscountPercentage
		if discPct < 0 {
			discPct = 0
		} else if discPct > 100 {
			discPct = 100
		}
		gstRate := it.TaxPercentage
		if gstRate < 0 {
			gstRate = 0
		}

		hsnSac := it.HSNSAC
		if (hsnSac == nil || *hsnSac == "") && it.ProductID != nil {
			var prodHsn *string
			var prodTax *float64
			_ = r.db.Pool.QueryRow(ctx, "SELECT hsn_sac, tax_rate FROM products WHERE id = $1", *it.ProductID).Scan(&prodHsn, &prodTax)
			if prodHsn != nil && *prodHsn != "" {
				hsnSac = prodHsn
			}
			if gstRate == 0 && prodTax != nil && *prodTax > 0 {
				gstRate = *prodTax
			}
		}
		if gstRate == 0 && input.TaxPercentage > 0 {
			gstRate = input.TaxPercentage
		}

		taxableAmt := qty * price * (1.0 - (discPct / 100.0))
		gstAmt := taxableAmt * (gstRate / 100.0)

		var cgstRate, cgstAmt, sgstRate, sgstAmt, igstRate, igstAmt float64
		if isInterState {
			igstRate = gstRate
			igstAmt = gstAmt
		} else {
			cgstRate = gstRate / 2.0
			cgstAmt = gstAmt / 2.0
			sgstRate = gstRate / 2.0
			sgstAmt = gstAmt / 2.0
		}

		lineTotal := taxableAmt + gstAmt
		subtotal += (qty * price)

		totalTaxable += taxableAmt
		totalCGST += cgstAmt
		totalSGST += sgstAmt
		totalIGST += igstAmt
		totalGST += gstAmt

		calcItems = append(calcItems, calculatedItem{
			productID:   it.ProductID,
			productName: pName,
			sku:         it.SKU,
			hsnSac:      hsnSac,
			desc:        it.Description,
			qty:         qty,
			price:       price,
			discPct:     discPct,
			taxableAmt:  taxableAmt,
			gstRate:     gstRate,
			gstAmt:      gstAmt,
			cgstRate:    cgstRate,
			cgstAmt:     cgstAmt,
			sgstRate:    sgstRate,
			sgstAmt:     sgstAmt,
			igstRate:    igstRate,
			igstAmt:     igstAmt,
			lineTotal:   lineTotal,
		})
	}

	discPct := input.DiscountPercentage
	if discPct < 0 {
		discPct = 0
	} else if discPct > 100 {
		discPct = 100
	}
	discAmount := totalTaxable * (discPct / 100.0)
	if discPct > 0 {
		factor := 1.0 - (discPct / 100.0)
		totalTaxable = totalTaxable * factor
		totalCGST = totalCGST * factor
		totalSGST = totalSGST * factor
		totalIGST = totalIGST * factor
		totalGST = totalGST * factor
	}

	rawTotal := totalTaxable + totalGST
	roundOff := 0.0
	if input.RoundOffAmount != nil {
		roundOff = *input.RoundOffAmount
	} else {
		// Auto round off to nearest rupee/whole unit
		roundOff = math.Round(rawTotal) - rawTotal
	}
	totalAmount := rawTotal + roundOff

	qNum := strings.TrimSpace(input.QuotationNumber)
	if qNum == "" {
		var errGen error
		qNum, errGen = r.generateQuotationNumber(ctx, workspaceID)
		if errGen != nil {
			return nil, errGen
		}
	}

	// 5. Insert Quotation with Company Profile & GST Snapshot
	var qID int
	query := `
		INSERT INTO quotations (
			quotation_number, title, deal_id, customer_id, lead_number, status,
			currency, subtotal, discount_percentage, discount_amount, tax_percentage,
			tax_amount, total_amount, valid_until, terms_and_conditions, notes,
			company_name, company_gstin, company_pan, company_state, company_address,
			customer_state, customer_gstin, is_inter_state,
			taxable_amount, cgst_amount, sgst_amount, igst_amount, total_gst_amount, round_off_amount,
			workspace_id, created_by_id, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, 'Draft',
			$6, $7, $8, $9, $10,
			$11, $12, $13, $14, $15,
			$16, $17, $18, $19, $20,
			$21, $22, $23,
			$24, $25, $26, $27, $28, $29,
			$30, $31, NOW(), NOW()
		) RETURNING id
	`

	err = r.db.Pool.QueryRow(ctx, query,
		qNum, title, deal.ID, customerID, leadNumber,
		currency, subtotal, discPct, discAmount, input.TaxPercentage,
		totalGST, totalAmount, input.ValidUntil, input.TermsAndConditions, input.Notes,
		compName, compGST, compPAN, compState, compAddr,
		custState, custGSTIN, isInterState,
		totalTaxable, totalCGST, totalSGST, totalIGST, totalGST, roundOff,
		workspaceID, createdByID,
	).Scan(&qID)
	if err != nil {
		return nil, fmt.Errorf("failed to insert quotation: %w", err)
	}

	// 6. Insert Line Items with GST details
	itemQuery := `
		INSERT INTO quotation_items (
			quotation_id, product_id, product_name, sku, hsn_sac, description,
			quantity, unit_price, discount_percentage, tax_percentage,
			taxable_amount, gst_rate, gst_amount, cgst_rate, cgst_amount,
			sgst_rate, sgst_amount, igst_rate, igst_amount, line_total, created_at
		) VALUES (
			$1, $2, $3, $4, $5, $6,
			$7, $8, $9, $10,
			$11, $12, $13, $14, $15,
			$16, $17, $18, $19, $20, NOW()
		)
	`
	for _, ci := range calcItems {
		_, err := r.db.Pool.Exec(ctx, itemQuery,
			qID, ci.productID, ci.productName, ci.sku, ci.hsnSac, ci.desc,
			ci.qty, ci.price, ci.discPct, ci.gstRate,
			ci.taxableAmt, ci.gstRate, ci.gstAmt, ci.cgstRate, ci.cgstAmt,
			ci.sgstRate, ci.sgstAmt, ci.igstRate, ci.igstAmt, ci.lineTotal,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to insert quotation item: %w", err)
		}
	}

	// 5. Automatically advance Deal pipeline stage to "Quotation Preparation" if in early stage
	if deal.Stage != nil {
		curStageName := strings.ToLower(strings.TrimSpace(deal.Stage.Name))
		if curStageName == "new opportunity" || curStageName == "requirement discussion" || curStageName == "lead in" || curStageName == "contact made" {
			// Find "Quotation Preparation" stage in this pipeline
			var prepStageID int
			err := r.db.Pool.QueryRow(ctx, `
				SELECT id FROM deal_stages
				WHERE pipeline_id = $1 AND LOWER(TRIM(name)) = 'quotation preparation'
				LIMIT 1
			`, deal.PipelineID).Scan(&prepStageID)
			if err == nil && prepStageID > 0 {
				_, _ = r.dealRepo.ChangeStage(ctx, deal.ID, prepStageID, nil, createdByID, workspaceID)
			}
		}
	}

	// 6. Update Deal Value to match the Quotation total
	if totalAmount > 0 {
		_, _ = r.db.Pool.Exec(ctx, `
			UPDATE deals SET value = $1, updated_at = NOW() WHERE id = $2 AND workspace_id = $3
		`, totalAmount, deal.ID, workspaceID)
	}

	// 7. Timeline events on Deal and Lead
	dealActivityDesc := fmt.Sprintf("Quotation %s (%s) created with %d line item(s) for %s %.2f", qNum, title, len(calcItems), currency, totalAmount)
	_ = r.dealRepo.CreateActivity(ctx, deal.ID, createdByID, "quotation_created", "Quotation Created", dealActivityDesc)

	if leadNumber != nil && *leadNumber != "" {
		leadDesc := fmt.Sprintf("Quotation %s created for Deal %s (%s): %s %.2f", qNum, deal.DealNumber, deal.Name, currency, totalAmount)
		_, _ = r.db.Pool.Exec(ctx, `
			INSERT INTO lead_activities (lead_number, user_id, activity_type, title, description, created_at)
			VALUES ($1, $2, 'quotation_created', 'Quotation Created', $3, NOW())
		`, *leadNumber, createdByID, leadDesc)
	}

	return r.GetByID(ctx, qID, workspaceID)
}

func (r *QuotationRepository) GetByID(ctx context.Context, id int, workspaceID int) (*models.Quotation, error) {
	query := `
		SELECT q.id, q.quotation_number, q.title, q.deal_id, q.customer_id, q.lead_number, q.status,
		       q.currency, q.subtotal, q.discount_percentage, q.discount_amount, q.tax_percentage,
		       q.tax_amount, q.total_amount, q.valid_until, q.terms_and_conditions, q.notes,
		       q.company_name, q.company_gstin, q.company_pan, q.company_state, q.company_address,
		       q.customer_state, q.customer_gstin, COALESCE(q.is_inter_state, false),
		       COALESCE(q.taxable_amount, q.subtotal), COALESCE(q.cgst_amount, 0), COALESCE(q.sgst_amount, 0),
		       COALESCE(q.igst_amount, 0), COALESCE(q.total_gst_amount, q.tax_amount), COALESCE(q.round_off_amount, 0),
		       q.workspace_id, q.created_by_id, q.created_at, q.updated_at,
		       d.id, d.deal_number, d.name, d.value, d.currency, d.requirement, d.pipeline_id, d.stage_id,
		       c.id, c.name, c.email, c.phone, c.company, c.city, c.state, c.pincode, c.gstin,
		       u.id, u.name, u.email
		FROM quotations q
		JOIN deals d ON q.deal_id = d.id
		JOIN customers c ON q.customer_id = c.id
		LEFT JOIN users u ON q.created_by_id = u.id
		WHERE q.id = $1 AND q.workspace_id = $2
	`

	var q models.Quotation
	var dID int
	var dNum, dName string
	var dVal float64
	var dCurr, dReq string
	var dPipeID, dStageID int
	var cID int
	var cName string
	var cEmail, cPhone, cCompany, cCity, cState, cPincode, cGSTIN *string
	var uID *int
	var uName, uEmail *string

	err := r.db.Pool.QueryRow(ctx, query, id, workspaceID).Scan(
		&q.ID, &q.QuotationNumber, &q.Title, &q.DealID, &q.CustomerID, &q.LeadNumber, &q.Status,
		&q.Currency, &q.Subtotal, &q.DiscountPercentage, &q.DiscountAmount, &q.TaxPercentage,
		&q.TaxAmount, &q.TotalAmount, &q.ValidUntil, &q.TermsAndConditions, &q.Notes,
		&q.CompanyName, &q.CompanyGSTIN, &q.CompanyPAN, &q.CompanyState, &q.CompanyAddress,
		&q.CustomerState, &q.CustomerGSTIN, &q.IsInterState,
		&q.TaxableAmount, &q.CGSTAmount, &q.SGSTAmount,
		&q.IGSTAmount, &q.TotalGSTAmount, &q.RoundOffAmount,
		&q.WorkspaceID, &q.CreatedByID, &q.CreatedAt, &q.UpdatedAt,
		&dID, &dNum, &dName, &dVal, &dCurr, &dReq, &dPipeID, &dStageID,
		&cID, &cName, &cEmail, &cPhone, &cCompany, &cCity, &cState, &cPincode, &cGSTIN,
		&uID, &uName, &uEmail,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	q.Deal = &models.Deal{
		ID:          dID,
		DealNumber:  dNum,
		Name:        dName,
		Value:       dVal,
		Currency:    dCurr,
		Requirement: dReq,
		PipelineID:  dPipeID,
		StageID:     dStageID,
	}

	// Fetch Deal Stage details if possible
	if stage, _ := r.pipeRepo.GetStageByID(ctx, dStageID); stage != nil {
		q.Deal.Stage = stage
	}

	q.Customer = &models.Customer{
		ID:      cID,
		Name:    cName,
		Email:   cEmail,
		Phone:   cPhone,
		Company: cCompany,
		City:    cCity,
		State:   cState,
		Pincode: cPincode,
		GSTIN:   cGSTIN,
	}

	if uID != nil && uName != nil && uEmail != nil {
		q.Creator = &models.UserSummary{ID: *uID, Name: *uName, Email: *uEmail}
	}

	// Fetch originating Lead if present
	if q.LeadNumber != nil && *q.LeadNumber != "" {
		var l models.Lead
		err := r.db.Pool.QueryRow(ctx, `
			SELECT number, name, email, phone, requirement, source, city, status
			FROM leads WHERE number = $1 AND workspace_id = $2
		`, *q.LeadNumber, workspaceID).Scan(
			&l.Number, &l.Name, &l.Email, &l.Phone, &l.Requirement, &l.Source, &l.City, &l.Status,
		)
		if err == nil {
			q.Lead = &l
		}
	}

	// Fetch items
	itemRows, err := r.db.Pool.Query(ctx, `
		SELECT id, quotation_id, product_id, product_name, sku, hsn_sac, description,
		       quantity, unit_price, discount_percentage, tax_percentage,
		       COALESCE(taxable_amount, line_total), COALESCE(gst_rate, tax_percentage),
		       COALESCE(gst_amount, 0), COALESCE(cgst_rate, 0), COALESCE(cgst_amount, 0),
		       COALESCE(sgst_rate, 0), COALESCE(sgst_amount, 0), COALESCE(igst_rate, 0),
		       COALESCE(igst_amount, 0), line_total, created_at
		FROM quotation_items
		WHERE quotation_id = $1
		ORDER BY id ASC
	`, q.ID)
	if err == nil {
		defer itemRows.Close()
		var items []models.QuotationItem
		for itemRows.Next() {
			var it models.QuotationItem
			if err := itemRows.Scan(
				&it.ID, &it.QuotationID, &it.ProductID, &it.ProductName, &it.SKU, &it.HSNSAC, &it.Description,
				&it.Quantity, &it.UnitPrice, &it.DiscountPercentage, &it.TaxPercentage,
				&it.TaxableAmount, &it.GSTRate, &it.GSTAmount,
				&it.CGSTRate, &it.CGSTAmount,
				&it.SGSTRate, &it.SGSTAmount,
				&it.IGSTRate, &it.IGSTAmount,
				&it.LineTotal, &it.CreatedAt,
			); err == nil {
				items = append(items, it)
			}
		}
		q.Items = items
	}

	if q.Items == nil {
		q.Items = []models.QuotationItem{}
	}

	return &q, nil
}

func (r *QuotationRepository) List(ctx context.Context, filter QuotationFilter, workspaceID int) (*models.QuotationListResponse, error) {
	if filter.Page < 1 {
		filter.Page = 1
	}
	if filter.Limit < 1 || filter.Limit > 200 {
		filter.Limit = 50
	}
	offset := (filter.Page - 1) * filter.Limit

	whereClauses := []string{"q.workspace_id = $1"}
	args := []interface{}{workspaceID}
	idx := 2

	if filter.DealID != nil && *filter.DealID > 0 {
		whereClauses = append(whereClauses, "q.deal_id = $"+strconv.Itoa(idx))
		args = append(args, *filter.DealID)
		idx++
	}

	if filter.CustomerID != nil && *filter.CustomerID > 0 {
		whereClauses = append(whereClauses, "q.customer_id = $"+strconv.Itoa(idx))
		args = append(args, *filter.CustomerID)
		idx++
	}

	if filter.Status != "" && filter.Status != "all" {
		whereClauses = append(whereClauses, "LOWER(q.status) = LOWER($"+strconv.Itoa(idx)+")")
		args = append(args, filter.Status)
		idx++
	}

	if strings.TrimSpace(filter.Search) != "" {
		searchTerm := "%" + strings.TrimSpace(filter.Search) + "%"
		whereClauses = append(whereClauses, "(q.title ILIKE $"+strconv.Itoa(idx)+" OR q.quotation_number ILIKE $"+strconv.Itoa(idx)+" OR d.name ILIKE $"+strconv.Itoa(idx)+" OR d.deal_number ILIKE $"+strconv.Itoa(idx)+" OR c.name ILIKE $"+strconv.Itoa(idx)+" OR c.company ILIKE $"+strconv.Itoa(idx)+")")
		args = append(args, searchTerm)
		idx++
	}

	whereSQL := " WHERE " + strings.Join(whereClauses, " AND ")

	// Summary counts & Total Value
	summaryQuery := `
		SELECT COUNT(*), COALESCE(SUM(q.total_amount), 0.0),
		       COUNT(*) FILTER (WHERE LOWER(q.status) = 'draft'),
		       COUNT(*) FILTER (WHERE LOWER(q.status) = 'sent'),
		       COUNT(*) FILTER (WHERE LOWER(q.status) = 'accepted'),
		       COUNT(*) FILTER (WHERE LOWER(q.status) = 'rejected')
		FROM quotations q
		JOIN deals d ON q.deal_id = d.id
		JOIN customers c ON q.customer_id = c.id
		` + whereSQL

	var total int
	var totalVal float64
	var draftCnt, sentCnt, acceptedCnt, rejectedCnt int
	err := r.db.Pool.QueryRow(ctx, summaryQuery, args...).Scan(
		&total, &totalVal, &draftCnt, &sentCnt, &acceptedCnt, &rejectedCnt,
	)
	if err != nil {
		return nil, err
	}

	// Fetch items
	listQuery := `
		SELECT q.id, q.quotation_number, q.title, q.deal_id, q.customer_id, q.lead_number, q.status,
		       q.currency, q.subtotal, q.discount_percentage, q.discount_amount, q.tax_percentage,
		       q.tax_amount, q.total_amount, q.valid_until, q.terms_and_conditions, q.notes,
		       q.company_name, q.company_gstin, q.company_pan, q.company_state, q.company_address,
		       q.customer_state, q.customer_gstin, COALESCE(q.is_inter_state, false),
		       COALESCE(q.taxable_amount, q.subtotal), COALESCE(q.cgst_amount, 0), COALESCE(q.sgst_amount, 0),
		       COALESCE(q.igst_amount, 0), COALESCE(q.total_gst_amount, q.tax_amount), COALESCE(q.round_off_amount, 0),
		       q.workspace_id, q.created_by_id, q.created_at, q.updated_at,
		       d.id, d.deal_number, d.name, d.value, d.currency, d.requirement, d.pipeline_id, d.stage_id,
		       c.id, c.name, c.email, c.phone, c.company, c.city, c.state, c.pincode, c.gstin,
		       u.id, u.name, u.email
		FROM quotations q
		JOIN deals d ON q.deal_id = d.id
		JOIN customers c ON q.customer_id = c.id
		LEFT JOIN users u ON q.created_by_id = u.id
		` + whereSQL + `
		ORDER BY q.created_at DESC
		LIMIT $` + strconv.Itoa(idx) + ` OFFSET $` + strconv.Itoa(idx+1)

	args = append(args, filter.Limit, offset)

	rows, err := r.db.Pool.Query(ctx, listQuery, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.Quotation
	for rows.Next() {
		var q models.Quotation
		var dID int
		var dNum, dName string
		var dVal float64
		var dCurr, dReq string
		var dPipeID, dStageID int
		var cID int
		var cName string
		var cEmail, cPhone, cCompany, cCity, cState, cPincode, cGSTIN *string
		var uID *int
		var uName, uEmail *string

		if err := rows.Scan(
			&q.ID, &q.QuotationNumber, &q.Title, &q.DealID, &q.CustomerID, &q.LeadNumber, &q.Status,
			&q.Currency, &q.Subtotal, &q.DiscountPercentage, &q.DiscountAmount, &q.TaxPercentage,
			&q.TaxAmount, &q.TotalAmount, &q.ValidUntil, &q.TermsAndConditions, &q.Notes,
			&q.CompanyName, &q.CompanyGSTIN, &q.CompanyPAN, &q.CompanyState, &q.CompanyAddress,
			&q.CustomerState, &q.CustomerGSTIN, &q.IsInterState,
			&q.TaxableAmount, &q.CGSTAmount, &q.SGSTAmount,
			&q.IGSTAmount, &q.TotalGSTAmount, &q.RoundOffAmount,
			&q.WorkspaceID, &q.CreatedByID, &q.CreatedAt, &q.UpdatedAt,
			&dID, &dNum, &dName, &dVal, &dCurr, &dReq, &dPipeID, &dStageID,
			&cID, &cName, &cEmail, &cPhone, &cCompany, &cCity, &cState, &cPincode, &cGSTIN,
			&uID, &uName, &uEmail,
		); err != nil {
			return nil, err
		}

		q.Deal = &models.Deal{
			ID:          dID,
			DealNumber:  dNum,
			Name:        dName,
			Value:       dVal,
			Currency:    dCurr,
			Requirement: dReq,
			PipelineID:  dPipeID,
			StageID:     dStageID,
		}
		q.Customer = &models.Customer{
			ID:      cID,
			Name:    cName,
			Email:   cEmail,
			Phone:   cPhone,
			Company: cCompany,
			City:    cCity,
			State:   cState,
			Pincode: cPincode,
			GSTIN:   cGSTIN,
		}
		if uID != nil && uName != nil && uEmail != nil {
			q.Creator = &models.UserSummary{ID: *uID, Name: *uName, Email: *uEmail}
		}

		items = append(items, q)
	}

	if items == nil {
		items = []models.Quotation{}
	}

	pages := 0
	if filter.Limit > 0 {
		pages = (total + filter.Limit - 1) / filter.Limit
	}

	return &models.QuotationListResponse{
		Items:         items,
		Total:         total,
		Page:          filter.Page,
		Limit:         filter.Limit,
		Pages:         pages,
		TotalValue:    totalVal,
		DraftCount:    draftCnt,
		SentCount:     sentCnt,
		AcceptedCount: acceptedCnt,
		RejectedCount: rejectedCnt,
	}, nil
}

func (r *QuotationRepository) Update(ctx context.Context, id int, input models.QuotationUpdateInput, updatedByID *int, workspaceID int) (*models.Quotation, error) {
	current, err := r.GetByID(ctx, id, workspaceID)
	if err != nil || current == nil {
		return nil, errors.New("quotation not found")
	}

	qNumber := current.QuotationNumber
	if input.QuotationNumber != nil && strings.TrimSpace(*input.QuotationNumber) != "" {
		trimmedQNum := strings.TrimSpace(*input.QuotationNumber)
		if !strings.EqualFold(trimmedQNum, current.QuotationNumber) {
			var existingID int
			errCheck := r.db.Pool.QueryRow(ctx, "SELECT id FROM quotations WHERE quotation_number = $1 AND id != $2 AND workspace_id = $3", trimmedQNum, id, workspaceID).Scan(&existingID)
			if errCheck == nil && existingID > 0 {
				return nil, fmt.Errorf("quotation number '%s' is already in use", trimmedQNum)
			}
			qNumber = trimmedQNum
		}
	}

	dealID := current.DealID
	customerID := current.CustomerID
	leadNumber := current.LeadNumber
	if input.DealID != nil && *input.DealID > 0 && *input.DealID != current.DealID {
		newDeal, errDeal := r.dealRepo.GetByID(ctx, *input.DealID, workspaceID)
		if errDeal != nil || newDeal == nil {
			return nil, errors.New("selected deal does not exist")
		}
		dealID = newDeal.ID
		customerID = newDeal.CustomerID
		leadNumber = newDeal.LeadNumber
	}

	title := current.Title
	if input.Title != nil && strings.TrimSpace(*input.Title) != "" {
		title = strings.TrimSpace(*input.Title)
	}

	status := current.Status
	oldStatus := current.Status
	if input.Status != nil && strings.TrimSpace(*input.Status) != "" {
		status = strings.TrimSpace(*input.Status)
	}

	currency := current.Currency
	if input.Currency != nil && strings.TrimSpace(*input.Currency) != "" {
		currency = strings.TrimSpace(*input.Currency)
	}

	discPct := current.DiscountPercentage
	if input.DiscountPercentage != nil {
		discPct = *input.DiscountPercentage
	}

	taxPct := current.TaxPercentage
	if input.TaxPercentage != nil {
		taxPct = *input.TaxPercentage
	}

	validUntil := current.ValidUntil
	if input.ValidUntil != nil {
		validUntil = input.ValidUntil
	}

	terms := current.TermsAndConditions
	if input.TermsAndConditions != nil {
		terms = input.TermsAndConditions
	}

	notes := current.Notes
	if input.Notes != nil {
		notes = input.Notes
	}

	// Handle Customer State & GSTIN
	custState := ""
	if current.CustomerState != nil {
		custState = *current.CustomerState
	}
	if input.CustomerState != nil {
		custState = strings.TrimSpace(*input.CustomerState)
	}

	custGSTIN := ""
	if current.CustomerGSTIN != nil {
		custGSTIN = *current.CustomerGSTIN
	}
	if input.CustomerGSTIN != nil {
		custGSTIN = strings.TrimSpace(*input.CustomerGSTIN)
	}

	compState := "Maharashtra"
	if current.CompanyState != nil && *current.CompanyState != "" {
		compState = *current.CompanyState
	} else {
		_ = r.db.Pool.QueryRow(ctx, "SELECT COALESCE(state, 'Maharashtra') FROM company_profiles WHERE workspace_id = $1 LIMIT 1", workspaceID).Scan(&compState)
	}

	cleanCompState := strings.ToLower(strings.TrimSpace(compState))
	cleanCustState := strings.ToLower(strings.TrimSpace(custState))
	isInterState := (cleanCompState != "" && cleanCustState != "" && cleanCompState != cleanCustState)

	// Items and totals recalculation
	subtotal := current.Subtotal
	taxableAmount := current.TaxableAmount
	cgstAmount := current.CGSTAmount
	sgstAmount := current.SGSTAmount
	igstAmount := current.IGSTAmount
	totalGSTAmount := current.TotalGSTAmount
	roundOffAmount := current.RoundOffAmount
	totalAmount := current.TotalAmount
	discAmount := current.DiscountAmount

	if input.Items != nil && len(input.Items) > 0 {
		subtotal = 0
		taxableAmount = 0
		cgstAmount = 0
		sgstAmount = 0
		igstAmount = 0
		totalGSTAmount = 0

		// Delete old items
		_, _ = r.db.Pool.Exec(ctx, "DELETE FROM quotation_items WHERE quotation_id = $1", id)

		itemQuery := `
			INSERT INTO quotation_items (
				quotation_id, product_id, product_name, sku, hsn_sac, description,
				quantity, unit_price, discount_percentage, tax_percentage,
				taxable_amount, gst_rate, gst_amount, cgst_rate, cgst_amount,
				sgst_rate, sgst_amount, igst_rate, igst_amount, line_total, created_at
			) VALUES (
				$1, $2, $3, $4, $5, $6,
				$7, $8, $9, $10,
				$11, $12, $13, $14, $15,
				$16, $17, $18, $19, $20, NOW()
			)
		`
		for _, it := range input.Items {
			pName := strings.TrimSpace(it.ProductName)
			if pName == "" {
				continue
			}
			qty := it.Quantity
			if qty <= 0 {
				qty = 1.0
			}
			price := it.UnitPrice
			if price < 0 {
				price = 0
			}
			iDisc := it.DiscountPercentage
			if iDisc < 0 {
				iDisc = 0
			} else if iDisc > 100 {
				iDisc = 100
			}
			gstRate := it.TaxPercentage
			if gstRate < 0 {
				gstRate = 0
			}

			hsnSac := it.HSNSAC
			if (hsnSac == nil || *hsnSac == "") && it.ProductID != nil {
				var prodHsn *string
				var prodTax *float64
				_ = r.db.Pool.QueryRow(ctx, "SELECT hsn_sac, tax_rate FROM products WHERE id = $1", *it.ProductID).Scan(&prodHsn, &prodTax)
				if prodHsn != nil && *prodHsn != "" {
					hsnSac = prodHsn
				}
				if gstRate == 0 && prodTax != nil && *prodTax > 0 {
					gstRate = *prodTax
				}
			}
			if gstRate == 0 && taxPct > 0 {
				gstRate = taxPct
			}

			itemTaxable := qty * price * (1.0 - (iDisc / 100.0))
			itemGST := itemTaxable * (gstRate / 100.0)

			var cgstR, cgstA, sgstR, sgstA, igstR, igstA float64
			if isInterState {
				igstR = gstRate
				igstA = itemGST
			} else {
				cgstR = gstRate / 2.0
				cgstA = itemGST / 2.0
				sgstR = gstRate / 2.0
				sgstA = itemGST / 2.0
			}

			lineTotal := itemTaxable + itemGST
			subtotal += (qty * price)
			taxableAmount += itemTaxable
			cgstAmount += cgstA
			sgstAmount += sgstA
			igstAmount += igstA
			totalGSTAmount += itemGST

			_, _ = r.db.Pool.Exec(ctx, itemQuery,
				id, it.ProductID, pName, it.SKU, hsnSac, it.Description,
				qty, price, iDisc, gstRate,
				itemTaxable, gstRate, itemGST, cgstR, cgstA,
				sgstR, sgstA, igstR, igstA, lineTotal,
			)
		}

		discAmount = taxableAmount * (discPct / 100.0)
		if discPct > 0 {
			factor := 1.0 - (discPct / 100.0)
			taxableAmount = taxableAmount * factor
			cgstAmount = cgstAmount * factor
			sgstAmount = sgstAmount * factor
			igstAmount = igstAmount * factor
			totalGSTAmount = totalGSTAmount * factor
		}

		rawTotal := taxableAmount + totalGSTAmount
		if input.RoundOffAmount != nil {
			roundOffAmount = *input.RoundOffAmount
		} else {
			roundOffAmount = math.Round(rawTotal) - rawTotal
		}
		totalAmount = rawTotal + roundOffAmount
	} else if input.RoundOffAmount != nil {
		roundOffAmount = *input.RoundOffAmount
		totalAmount = taxableAmount + totalGSTAmount + roundOffAmount
	}

	updateQuery := `
		UPDATE quotations
		SET quotation_number = $1, title = $2, deal_id = $3, customer_id = $4, lead_number = $5,
		    status = $6, currency = $7, subtotal = $8,
		    discount_percentage = $9, discount_amount = $10, tax_percentage = $11,
		    tax_amount = $12, total_amount = $13, valid_until = $14,
		    terms_and_conditions = $15, notes = $16,
		    customer_state = $17, customer_gstin = $18, is_inter_state = $19,
		    taxable_amount = $20, cgst_amount = $21, sgst_amount = $22,
		    igst_amount = $23, total_gst_amount = $24, round_off_amount = $25,
		    updated_at = NOW()
		WHERE id = $26 AND workspace_id = $27
	`
	_, err = r.db.Pool.Exec(ctx, updateQuery,
		qNumber, title, dealID, customerID, leadNumber,
		status, currency, subtotal,
		discPct, discAmount, taxPct,
		totalGSTAmount, totalAmount, validUntil,
		terms, notes,
		custState, custGSTIN, isInterState,
		taxableAmount, cgstAmount, sgstAmount,
		igstAmount, totalGSTAmount, roundOffAmount,
		id, workspaceID,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update quotation: %w", err)
	}

	// If status changed or deal changed, synchronize Deal Stage and timeline
	if !strings.EqualFold(status, oldStatus) || dealID != current.DealID {
		r.syncDealStageFromQuotationStatus(ctx, dealID, status, totalAmount, updatedByID, workspaceID)
	}

	return r.GetByID(ctx, id, workspaceID)
}

func (r *QuotationRepository) ChangeStatus(ctx context.Context, id int, newStatus string, updatedByID *int, workspaceID int) (*models.Quotation, error) {
	current, err := r.GetByID(ctx, id, workspaceID)
	if err != nil || current == nil {
		return nil, errors.New("quotation not found")
	}

	cleanStatus := strings.TrimSpace(newStatus)
	if cleanStatus == "" {
		return nil, errors.New("status cannot be empty")
	}

	_, err = r.db.Pool.Exec(ctx, `
		UPDATE quotations SET status = $1, updated_at = NOW() WHERE id = $2 AND workspace_id = $3
	`, cleanStatus, id, workspaceID)
	if err != nil {
		return nil, err
	}

	r.syncDealStageFromQuotationStatus(ctx, current.DealID, cleanStatus, current.TotalAmount, updatedByID, workspaceID)

	return r.GetByID(ctx, id, workspaceID)
}

func (r *QuotationRepository) syncDealStageFromQuotationStatus(ctx context.Context, dealID int, quotStatus string, quotTotal float64, updatedByID *int, workspaceID int) {
	deal, err := r.dealRepo.GetByID(ctx, dealID, workspaceID)
	if err != nil || deal == nil {
		return
	}

	var targetStageName string
	switch strings.ToLower(quotStatus) {
	case "sent":
		targetStageName = "quotation sent"
	case "negotiating", "negotiation", "revised":
		targetStageName = "negotiation"
	case "accepted":
		targetStageName = "quotation accepted"
	case "final", "final amount confirmed", "confirmed":
		targetStageName = "final amount confirmed"
	case "rejected":
		targetStageName = "lost"
	}

	if targetStageName != "" {
		var targetStageID int
		err := r.db.Pool.QueryRow(ctx, `
			SELECT id FROM deal_stages
			WHERE pipeline_id = $1 AND LOWER(TRIM(name)) = $2
			LIMIT 1
		`, deal.PipelineID, targetStageName).Scan(&targetStageID)
		if err == nil && targetStageID > 0 && targetStageID != deal.StageID {
			_, _ = r.dealRepo.ChangeStage(ctx, deal.ID, targetStageID, nil, updatedByID, workspaceID)
		}
	}

	// If quotation accepted, ensure Deal value is updated
	if strings.EqualFold(quotStatus, "accepted") && quotTotal > 0 {
		_, _ = r.db.Pool.Exec(ctx, `
			UPDATE deals SET value = $1, updated_at = NOW() WHERE id = $2 AND workspace_id = $3
		`, quotTotal, deal.ID, workspaceID)
	}

	// Timeline activity
	actDesc := fmt.Sprintf("Quotation status changed to %s", quotStatus)
	_ = r.dealRepo.CreateActivity(ctx, deal.ID, updatedByID, "quotation_status_changed", "Quotation Status Updated", actDesc)
}

func (r *QuotationRepository) Delete(ctx context.Context, id int, workspaceID int) error {
	_, err := r.db.Pool.Exec(ctx, "DELETE FROM quotations WHERE id = $1 AND workspace_id = $2", id, workspaceID)
	return err
}
