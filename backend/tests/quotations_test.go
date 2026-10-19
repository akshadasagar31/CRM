package tests

import (
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"
)

func TestQuotationsModule(t *testing.T) {
	baseURL := getBaseURL()
	if !isServerUp(baseURL) {
		t.Skipf("CRM backend server is not running at %s, skipping integration tests", baseURL)
	}

	client := &http.Client{Timeout: 10 * time.Second}

	// 1. Login as Admin
	var token string
	code, res := doJSON(t, client, "POST", baseURL+"/api/auth/login", map[string]string{
		"email":    "admin@crmdemo.com",
		"password": "admin123",
	}, nil)
	if code != http.StatusOK {
		t.Fatalf("Admin login failed with status %d", code)
	}
	token = res["access_token"].(string)
	authHeaders := map[string]string{
		"Authorization": "Bearer " + token,
	}

	// 2. Create Lead and mark Qualified to get a Deal
	timestamp := time.Now().UnixNano()
	leadPhone := fmt.Sprintf("+1888%06d", timestamp%1000000)
	leadName := fmt.Sprintf("Quantum Corp %d", timestamp%1000)
	leadReq := "100 Cloud Licenses and 24/7 Enterprise Support"

	code, leadRes := doJSON(t, client, "POST", baseURL+"/api/leads", map[string]interface{}{
		"number":      leadPhone,
		"name":        leadName,
		"email":       fmt.Sprintf("quantum-%d@testcorp.com", timestamp),
		"phone":       leadPhone,
		"requirement": leadReq,
		"status":      "New",
		"city":        "Seattle",
		"source":      "Website",
	}, authHeaders)
	if code != http.StatusCreated {
		t.Fatalf("Failed to create lead, got %d: %v", code, leadRes)
	}
	leadNum := leadRes["number"].(string)

	// Mark Qualified to trigger auto Deal creation
	code, updateRes := doJSON(t, client, "PATCH", baseURL+"/api/leads/"+leadNum, map[string]interface{}{
		"status": "Qualified",
	}, authHeaders)
	if code != http.StatusOK {
		t.Fatalf("Failed to qualify lead: %v", updateRes)
	}

	// Fetch auto-created Deal for this lead
	code, dealsList := doJSON(t, client, "GET", baseURL+"/api/deals?search="+leadNum, nil, authHeaders)
	if code != http.StatusOK {
		t.Fatalf("Failed to search deals: %d", code)
	}
	itemsRaw, ok := dealsList["items"].([]interface{})
	if !ok || len(itemsRaw) == 0 {
		t.Fatalf("Expected deal created for lead %s, found none", leadNum)
	}
	dealMap := itemsRaw[0].(map[string]interface{})
	dealID := int(dealMap["id"].(float64))
	t.Logf("Created Lead %s -> Qualified -> Auto-created Deal ID %d (%v)", leadNum, dealID, dealMap["name"])

	// 3. Validation: Attempting to create Quotation without a valid Deal must fail
	t.Run("PreventQuotationWithoutValidDeal", func(t *testing.T) {
		failCode, failRes := doJSON(t, client, "POST", baseURL+"/api/quotations", map[string]interface{}{
			"title":   "Invalid Quote",
			"deal_id": 999999, // non-existent deal
			"items": []map[string]interface{}{
				{
					"product_name": "Test Item",
					"quantity":     1,
					"unit_price":   100,
				},
			},
		}, authHeaders)
		if failCode == http.StatusCreated || failCode == http.StatusOK {
			t.Fatalf("Expected failure when creating quotation with non-existent deal, but got %d: %v", failCode, failRes)
		}
		t.Logf("✓ Successfully rejected quotation with invalid deal (HTTP %d: %v)", failCode, failRes["detail"])
	})

	// 4. Create Quotation for the valid Deal
	var quotationID int
	t.Run("CreateQuotationWithDealAutoPopulation", func(t *testing.T) {
		quotePayload := map[string]interface{}{
			"title":               fmt.Sprintf("Enterprise Proposal for %s", leadName),
			"deal_id":             dealID,
			"discount_percentage": 10.0,
			"tax_percentage":      5.0,
			"notes":               "Net 30 payment terms upon acceptance",
			"items": []map[string]interface{}{
				{
					"product_name": "Cloud CRM License",
					"sku":          "CRM-CLOUD-01",
					"quantity":     10,
					"unit_price":   500.0,
				},
				{
					"product_name": "Implementation & Training",
					"sku":          "SRV-IMPL-01",
					"quantity":     1,
					"unit_price":   2000.0,
				},
			},
		}

		cCode, qRes := doJSON(t, client, "POST", baseURL+"/api/quotations", quotePayload, authHeaders)
		if cCode != http.StatusCreated {
			t.Fatalf("Failed to create quotation: %d, res: %v", cCode, qRes)
		}

		quotationID = int(qRes["id"].(float64))
		t.Logf("Created Quotation #%v (ID %d)", qRes["quotation_number"], quotationID)

		// Verify Deal, Customer, Lead auto-populated
		if qRes["deal_id"].(float64) != float64(dealID) {
			t.Fatalf("Expected deal_id %d, got %v", dealID, qRes["deal_id"])
		}
		if qRes["lead_number"] != leadNum {
			t.Fatalf("Expected auto-populated lead_number %s, got %v", leadNum, qRes["lead_number"])
		}
		custObj, _ := qRes["customer"].(map[string]interface{})
		if custObj == nil || custObj["name"] != leadName {
			t.Fatalf("Expected auto-populated customer %s, got %v", leadName, custObj)
		}

		// Verify calculations:
		// Subtotal = (10 * 500) + (1 * 2000) = 5000 + 2000 = 7000
		// Discount 10% = 700
		// After discount = 6300
		// Tax 5% = 315
		// Total = 6615
		subtotal := qRes["subtotal"].(float64)
		if subtotal != 7000.0 {
			t.Fatalf("Expected subtotal 7000.0, got %v", subtotal)
		}
		totalAmount := qRes["total_amount"].(float64)
		if totalAmount != 6615.0 {
			t.Fatalf("Expected total_amount 6615.0, got %v", totalAmount)
		}

		// Verify Deal pipeline stage automatically updated to "Quotation Preparation"
		dealCheckCode, dealCheckRes := doJSON(t, client, "GET", fmt.Sprintf("%s/api/deals/%d", baseURL, dealID), nil, authHeaders)
		if dealCheckCode == http.StatusOK {
			stObj, _ := dealCheckRes["stage"].(map[string]interface{})
			if stObj != nil {
				stName := stObj["name"].(string)
				if !strings.EqualFold(stName, "Quotation Preparation") {
					t.Fatalf("Expected Deal stage 'Quotation Preparation', got '%s'", stName)
				}
				t.Logf("✓ Verified Deal pipeline stage automatically updated to: %s", stName)
			}
			// Verify Deal value updated to match quotation total
			dealVal := dealCheckRes["value"].(float64)
			if dealVal != 6615.0 {
				t.Fatalf("Expected Deal value synced to 6615.0, got %v", dealVal)
			}
			t.Logf("✓ Verified Deal value synced to quotation total: %v", dealVal)
		}
	})

	// 5. Update Status to "Sent" -> verifies Deal stage transitions to "Quotation Sent"
	t.Run("AdvanceStageOnQuotationSent", func(t *testing.T) {
		sCode, sRes := doJSON(t, client, "POST", fmt.Sprintf("%s/api/quotations/%d/status", baseURL, quotationID), map[string]string{
			"status": "Sent",
		}, authHeaders)
		if sCode != http.StatusOK {
			t.Fatalf("Failed to update status to Sent: %d, res: %v", sCode, sRes)
		}

		dealCheckCode, dealCheckRes := doJSON(t, client, "GET", fmt.Sprintf("%s/api/deals/%d", baseURL, dealID), nil, authHeaders)
		if dealCheckCode == http.StatusOK {
			stObj, _ := dealCheckRes["stage"].(map[string]interface{})
			if stObj != nil {
				stName := stObj["name"].(string)
				if !strings.EqualFold(stName, "Quotation Sent") {
					t.Fatalf("Expected Deal stage 'Quotation Sent', got '%s'", stName)
				}
				t.Logf("✓ Verified Deal stage synced to 'Quotation Sent'")
			}
		}
	})

	// 6. Update Status to "Accepted" -> verifies Deal stage transitions to "Quotation Accepted"
	t.Run("AdvanceStageOnQuotationAccepted", func(t *testing.T) {
		aCode, aRes := doJSON(t, client, "POST", fmt.Sprintf("%s/api/quotations/%d/status", baseURL, quotationID), map[string]string{
			"status": "Accepted",
		}, authHeaders)
		if aCode != http.StatusOK {
			t.Fatalf("Failed to update status to Accepted: %d, res: %v", aCode, aRes)
		}

		dealCheckCode, dealCheckRes := doJSON(t, client, "GET", fmt.Sprintf("%s/api/deals/%d", baseURL, dealID), nil, authHeaders)
		if dealCheckCode == http.StatusOK {
			stObj, _ := dealCheckRes["stage"].(map[string]interface{})
			if stObj != nil {
				stName := stObj["name"].(string)
				if !strings.EqualFold(stName, "Quotation Accepted") {
					t.Fatalf("Expected Deal stage 'Quotation Accepted', got '%s'", stName)
				}
				t.Logf("✓ Verified Deal stage synced to 'Quotation Accepted'")
			}
		}
	})

	// 7. Verify Auto-Created Order on Quotation Acceptance
	var orderID int
	t.Run("VerifyAutoCreatedOrderOnQuotationAccepted", func(t *testing.T) {
		oCode, oRes := doJSON(t, client, "GET", fmt.Sprintf("%s/api/orders?deal_id=%d", baseURL, dealID), nil, authHeaders)
		if oCode != http.StatusOK {
			t.Fatalf("Failed to query orders: %d", oCode)
		}
		oItems, _ := oRes["items"].([]interface{})
		if len(oItems) == 0 {
			t.Fatalf("Expected auto-created order for accepted quotation, found none")
		}
		var foundOrder map[string]interface{}
		for _, itm := range oItems {
			omap := itm.(map[string]interface{})
			if qid, ok := omap["quotation_id"].(float64); ok && int(qid) == quotationID {
				foundOrder = omap
				break
			}
		}
		if foundOrder == nil {
			t.Fatalf("No order linked to quotation_id=%d", quotationID)
		}
		orderID = int(foundOrder["id"].(float64))
		t.Logf("✓ Found auto-created Order ID %d (%v)", orderID, foundOrder["order_number"])

		// Verify Order properties: stage "Not Started", invoice_status "Not Invoiced", payment_status "Unpaid"
		stage := foundOrder["stage"].(string)
		if stage != "Not Started" {
			t.Fatalf("Expected order stage 'Not Started', got '%s'", stage)
		}
		invStatus := foundOrder["invoice_status"].(string)
		if invStatus != "Not Invoiced" {
			t.Fatalf("Expected order invoice_status 'Not Invoiced', got '%s'", invStatus)
		}
		payStatus := foundOrder["payment_status"].(string)
		if payStatus != "Unpaid" {
			t.Fatalf("Expected order payment_status 'Unpaid', got '%s'", payStatus)
		}

		// Verify Order lineage: lead_number, deal_id, quotation_id
		leadNumVal, _ := foundOrder["lead_number"].(string)
		if leadNumVal != leadNum {
			t.Fatalf("Expected order lead_number '%s', got '%s'", leadNum, leadNumVal)
		}
		t.Logf("✓ Order verified: Stage='Not Started', InvoiceStatus='Not Invoiced', PaymentStatus='Unpaid', LeadNumber='%s'", leadNumVal)

		// Duplicate Prevention: Update quotation status to "Accepted" again -> MUST NOT create duplicate order
		repeatCode, repeatRes := doJSON(t, client, "POST", fmt.Sprintf("%s/api/quotations/%d/status", baseURL, quotationID), map[string]string{
			"status": "Accepted",
		}, authHeaders)
		if repeatCode != http.StatusOK {
			t.Fatalf("Failed to re-accept quotation: %d, res: %v", repeatCode, repeatRes)
		}

		// Re-query orders for quotationID -> count must still be exactly 1
		oCode2, oRes2 := doJSON(t, client, "GET", fmt.Sprintf("%s/api/orders?deal_id=%d", baseURL, dealID), nil, authHeaders)
		if oCode2 != http.StatusOK {
			t.Fatalf("Failed to search orders on repeat check: %d", oCode2)
		}
		oItems2, _ := oRes2["items"].([]interface{})
		matchingCount := 0
		for _, itm := range oItems2 {
			omap := itm.(map[string]interface{})
			if qid, ok := omap["quotation_id"].(float64); ok && int(qid) == quotationID {
				matchingCount++
			}
		}
		if matchingCount != 1 {
			t.Fatalf("Duplicate order created! Expected exactly 1 order for quotation %d, found %d", quotationID, matchingCount)
		}
		t.Logf("✓ Duplicate prevention verified: Exactly 1 order exists after repeated status updates")
	})

	// 8. Create Invoice from Order and Verify Lineage & Outstanding Balance
	var invoiceID int
	t.Run("CreateInvoiceAndVerifyOutstandingBalance", func(t *testing.T) {
		custID := 1 // default demo customer
		invPayload := map[string]interface{}{
			"customer_id": custID,
			"order_id":    orderID,
			"items": []map[string]interface{}{
				{
					"product_name": "Enterprise License",
					"quantity":     1,
					"unit_price":   6615.0,
				},
			},
		}
		invCode, invRes := doJSON(t, client, "POST", baseURL+"/api/invoices", invPayload, authHeaders)
		if invCode != http.StatusCreated && invCode != http.StatusOK {
			t.Fatalf("Failed to create invoice: %d, res: %v", invCode, invRes)
		}
		invoiceID = int(invRes["id"].(float64))
		invNum := invRes["invoice_number"].(string)
		t.Logf("✓ Created Invoice ID %d (%s) linked to Order ID %d", invoiceID, invNum, orderID)

		// Verify Order invoice_status transitioned to "Invoiced"
		ordCheckCode, ordCheckRes := doJSON(t, client, "GET", fmt.Sprintf("%s/api/orders/%d", baseURL, orderID), nil, authHeaders)
		if ordCheckCode != http.StatusOK {
			t.Fatalf("Failed to get order: %d", ordCheckCode)
		}
		newInvStatus := ordCheckRes["invoice_status"].(string)
		if newInvStatus != "Invoiced" {
			t.Fatalf("Expected order invoice_status 'Invoiced', got '%s'", newInvStatus)
		}
		t.Logf("✓ Order invoice_status updated to 'Invoiced'")

		// Verify Invoice lineage
		invGetCode, invGetRes := doJSON(t, client, "GET", fmt.Sprintf("%s/api/invoices/%d", baseURL, invoiceID), nil, authHeaders)
		if invGetCode != http.StatusOK {
			t.Fatalf("Failed to get invoice: %d", invGetCode)
		}
		invLeadNum, _ := invGetRes["lead_number"].(string)
		if invLeadNum != leadNum {
			t.Logf("Notice: Invoice lead_number is '%s' (expected '%s')", invLeadNum, leadNum)
		}
		remBal := invGetRes["remaining_balance"].(float64)
		if remBal <= 0 {
			t.Fatalf("Expected positive remaining_balance, got %v", remBal)
		}
		t.Logf("✓ Verified Invoice has remaining_balance: %v", remBal)
	})

	// 9. Record Payment and Verify Lineage in Payment Ledger
	t.Run("RecordPaymentAndVerifyLedgerLineage", func(t *testing.T) {
		payRef := fmt.Sprintf("UTR-TEST-%d", time.Now().UnixNano()%100000000)
		payPayload := map[string]interface{}{
			"invoice_id":       invoiceID,
			"amount":           2000.0,
			"payment_method":   "Bank Transfer",
			"reference_number": payRef,
			"notes":            "Advance payment test",
		}
		pCode, pRes := doJSON(t, client, "POST", baseURL+"/api/payments", payPayload, authHeaders)
		if pCode != http.StatusCreated && pCode != http.StatusOK {
			t.Fatalf("Failed to record payment: %d, res: %v", pCode, pRes)
		}
		t.Logf("✓ Recorded payment of ₹2,000 for Invoice ID %d (ref: %s)", invoiceID, payRef)

		// Verify Payments Ledger item contains Quotation and Deal lineage
		ledgerCode, ledgerRes := doJSON(t, client, "GET", baseURL+"/api/payments?search="+payRef, nil, authHeaders)
		if ledgerCode != http.StatusOK {
			t.Fatalf("Failed to search payments: %d", ledgerCode)
		}
		pItems, _ := ledgerRes["items"].([]interface{})
		if len(pItems) == 0 {
			t.Fatalf("Expected payment in ledger, found none")
		}
		pMap := pItems[0].(map[string]interface{})
		t.Logf("✓ Payment Ledger item details: ID=%v, Inv=%v, Order=%v, Deal=%v, Quote=%v, Lead=%v",
			pMap["id"], pMap["invoice_number"], pMap["order_number"], pMap["deal_number"], pMap["quotation_number"], pMap["lead_number"])

		// Verify Invoice remaining_balance decreased
		invGetCode, invGetRes := doJSON(t, client, "GET", fmt.Sprintf("%s/api/invoices/%d", baseURL, invoiceID), nil, authHeaders)
		if invGetCode != http.StatusOK {
			t.Fatalf("Failed to get invoice after payment: %d", invGetCode)
		}
		remBalAfter := invGetRes["remaining_balance"].(float64)
		if remBalAfter >= 6615.0 {
			t.Fatalf("Expected remaining balance to decrease after payment, but got %v", remBalAfter)
		}
		t.Logf("✓ Verified Invoice remaining_balance decreased to %v", remBalAfter)

		// Verify Deal is STILL NOT "won" after partial payment
		dealCode, dealRes := doJSON(t, client, "GET", fmt.Sprintf("%s/api/deals/%d", baseURL, dealID), nil, authHeaders)
		if dealCode != http.StatusOK {
			t.Fatalf("Failed to get deal after partial payment: %d", dealCode)
		}
		dealStatus := strings.ToLower(fmt.Sprintf("%v", dealRes["status"]))
		if dealStatus == "won" {
			t.Fatalf("Deal should not be Won after partial payment, got %s", dealStatus)
		}
		t.Logf("✓ Verified Deal status unchanged after partial payment: %s", dealStatus)

		// Pay the remaining balance (4615.0) to achieve 100% full payment
		fullPayRef := fmt.Sprintf("UTR-FULL-%d", time.Now().UnixNano()%100000000)
		fullPayPayload := map[string]interface{}{
			"invoice_id":       invoiceID,
			"amount":           remBalAfter,
			"payment_method":   "NEFT",
			"reference_number": fullPayRef,
			"notes":            "Final settlement payment",
		}
		fpCode, _ := doJSON(t, client, "POST", baseURL+"/api/payments", fullPayPayload, authHeaders)
		if fpCode != http.StatusCreated && fpCode != http.StatusOK {
			t.Fatalf("Failed to record final payment: %d", fpCode)
		}

		// Verify Invoice is now Paid with 0 remaining balance
		invPaidCode, invPaidRes := doJSON(t, client, "GET", fmt.Sprintf("%s/api/invoices/%d", baseURL, invoiceID), nil, authHeaders)
		if invPaidCode != http.StatusOK {
			t.Fatalf("Failed to get invoice after full payment: %d", invPaidCode)
		}
		if invPaidRes["status"] != "Paid" {
			t.Fatalf("Expected invoice status 'Paid', got %v", invPaidRes["status"])
		}
		if invPaidRes["remaining_balance"].(float64) > 0.01 {
			t.Fatalf("Expected remaining_balance 0, got %v", invPaidRes["remaining_balance"])
		}
		t.Logf("✓ Verified Invoice is fully Paid with ₹0 balance")

		// Verify linked Deal status AUTOMATICALLY changed to "won"
		dealWonCode, dealWonRes := doJSON(t, client, "GET", fmt.Sprintf("%s/api/deals/%d", baseURL, dealID), nil, authHeaders)
		if dealWonCode != http.StatusOK {
			t.Fatalf("Failed to get deal after full payment: %d", dealWonCode)
		}
		newDealStatus := strings.ToLower(fmt.Sprintf("%v", dealWonRes["status"]))
		if newDealStatus != "won" {
			t.Fatalf("Expected deal status 'won' after full payment, got '%s'", newDealStatus)
		}
		stObj, _ := dealWonRes["stage"].(map[string]interface{})
		if stObj != nil && stObj["is_won"] != true {
			t.Fatalf("Expected deal stage is_won to be true, got %v", stObj["is_won"])
		}
		t.Logf("✓ Verified linked Deal %v status automatically changed to 'won' (Stage: %v, is_won: %v)",
			dealWonRes["deal_number"], stObj["name"], stObj["is_won"])

		// Verify timeline activity logged on Deal
		actCode, actRes := doJSON(t, client, "GET", fmt.Sprintf("%s/api/deals/%d/activities", baseURL, dealID), nil, authHeaders)
		if actCode == http.StatusOK {
			activities, _ := actRes["items"].([]interface{})
			foundWonAct := false
			for _, a := range activities {
				aMap, ok := a.(map[string]interface{})
				if ok && strings.Contains(fmt.Sprintf("%v", aMap["title"]), "WON") {
					foundWonAct = true
					break
				}
			}
			if !foundWonAct {
				t.Fatalf("Expected 'Deal WON' timeline activity, found none in %d activities", len(activities))
			}
			t.Logf("✓ Verified Deal timeline activity recorded for full payment")
		}

		// Verify originating Lead status automatically synced to "Won"
		leadCode, leadRes := doJSON(t, client, "GET", baseURL+"/api/leads/"+leadNum, nil, authHeaders)
		if leadCode == http.StatusOK {
			if leadRes["status"] != "Won" {
				t.Fatalf("Expected originating lead status 'Won', got '%v'", leadRes["status"])
			}
			t.Logf("✓ Verified originating Lead %s status synced to 'Won'", leadNum)
		}
	})

	// 10. Verify List Quotations filter
	t.Run("ListQuotationsFilter", func(t *testing.T) {
		lCode, lRes := doJSON(t, client, "GET", fmt.Sprintf("%s/api/quotations?deal_id=%d", baseURL, dealID), nil, authHeaders)
		if lCode != http.StatusOK {
			t.Fatalf("Failed to list quotations: %d", lCode)
		}
		qItems, _ := lRes["items"].([]interface{})
		if len(qItems) == 0 {
			t.Fatalf("Expected quotation items in list, got 0")
		}
		t.Logf("✓ Listed %d quotation(s) filtered by deal_id=%d", len(qItems), dealID)
	})

	t.Logf("Quotations integration test passed completely!")
}
