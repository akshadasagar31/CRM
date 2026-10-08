package tests

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"
)

func TestLeadToDealFlow(t *testing.T) {
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

	// 2. Create a fresh Lead with status "New"
	leadEmail := fmt.Sprintf("qualified-lead-%d@testcorp.com", time.Now().UnixNano())
	leadPhone := fmt.Sprintf("+1%010d", time.Now().UnixNano()%10000000000)
	leadName := "Apex Solutions Contact"
	leadReq := "Need 250 enterprise CRM licenses and cloud migration"

	code, leadRes := doJSON(t, client, "POST", baseURL+"/api/leads", map[string]interface{}{
		"number":      leadPhone,
		"name":        leadName,
		"email":       leadEmail,
		"phone":       leadPhone,
		"requirement": leadReq,
		"status":      "New",
		"city":        "San Francisco",
		"source":      "Website",
	}, authHeaders)
	if code != http.StatusCreated {
		t.Fatalf("Failed to create lead, got %d: %v", code, leadRes)
	}

	leadNumber := leadRes["number"].(string)
	t.Logf("Created lead %s (%s)", leadNumber, leadName)

	// 3. Update Lead status to "Qualified"
	code, updateRes := doJSON(t, client, "PATCH", baseURL+"/api/leads/"+leadNumber, map[string]interface{}{
		"status": "Qualified",
	}, authHeaders)
	if code != http.StatusOK {
		t.Fatalf("Failed to update lead status to Qualified, got %d: %v", code, updateRes)
	}

	// Verify original lead data is preserved and status is Qualified (NOT overwritten to Converted)
	if updateRes["status"] != "Qualified" {
		t.Fatalf("Expected lead status 'Qualified', got %v", updateRes["status"])
	}
	if updateRes["requirement"] != leadReq {
		t.Fatalf("Expected lead requirement preserved, got %v", updateRes["requirement"])
	}
	if updateRes["email"] != strings.ToLower(leadEmail) {
		t.Fatalf("Expected lead email preserved, got %v", updateRes["email"])
	}

	// 4. Verify a Deal was automatically created for this lead
	code, dealsListRes := doJSON(t, client, "GET", baseURL+"/api/deals?search="+leadNumber, nil, authHeaders)
	if code != http.StatusOK {
		t.Fatalf("Failed to fetch deals, got %d", code)
	}

	dealsRaw, ok := dealsListRes["items"].([]interface{})
	if !ok || len(dealsRaw) == 0 {
		t.Fatalf("Expected deal to be automatically created for lead %s, but found none: %v", leadNumber, dealsListRes)
	}

	firstDeal := dealsRaw[0].(map[string]interface{})
	t.Logf("Found auto-created deal: ID %v, Name: %v, LeadNumber: %v", firstDeal["id"], firstDeal["name"], firstDeal["lead_number"])

	if firstDeal["lead_number"] != leadNumber {
		t.Fatalf("Expected deal lead_number %s, got %v", leadNumber, firstDeal["lead_number"])
	}

	stageObj, _ := firstDeal["stage"].(map[string]interface{})
	if stageObj != nil {
		stageName, _ := stageObj["name"].(string)
		if !strings.EqualFold(stageName, "New Opportunity") {
			t.Fatalf("Expected deal stage 'New Opportunity', got '%s'", stageName)
		}
	}

	// Verify Customer was linked/created
	customerObj, _ := firstDeal["customer"].(map[string]interface{})
	if customerObj == nil {
		t.Fatalf("Expected deal customer to be populated")
	}
	if customerObj["name"] != leadName {
		t.Fatalf("Expected customer name '%s', got '%v'", leadName, customerObj["name"])
	}

	dealID := int(firstDeal["id"].(float64))

	// 5. Test Duplicate Prevention: updating the lead again to "Qualified" must NOT create a 2nd deal
	code, _ = doJSON(t, client, "PATCH", baseURL+"/api/leads/"+leadNumber, map[string]interface{}{
		"status": "Qualified",
	}, authHeaders)
	if code != http.StatusOK {
		t.Fatalf("Failed second update")
	}

	code, dealsListRes2 := doJSON(t, client, "GET", baseURL+"/api/deals?search="+leadNumber, nil, authHeaders)
	if code != http.StatusOK {
		t.Fatalf("Failed to fetch deals second time")
	}
	dealsRaw2, _ := dealsListRes2["items"].([]interface{})
	matchingCount := 0
	for _, d := range dealsRaw2 {
		dm := d.(map[string]interface{})
		if dm["lead_number"] == leadNumber {
			matchingCount++
		}
	}
	if matchingCount != 1 {
		t.Fatalf("Duplicate deal created! Expected 1 deal for lead %s, found %d", leadNumber, matchingCount)
	}

	// 6. Verify Timeline activities on Lead
	leadActs := doJSONArray(t, client, "GET", baseURL+"/api/leads/"+leadNumber+"/activities", authHeaders)
	hasConvertedActivity := false
	for _, act := range leadActs {
		if act["activity_type"] == "converted_to_deal" {
			hasConvertedActivity = true
			break
		}
	}
	if !hasConvertedActivity {
		t.Fatalf("Expected 'converted_to_deal' activity on lead %s, got: %v", leadNumber, leadActs)
	}
	t.Logf("Verified lead timeline contains 'converted_to_deal' event")

	// 7. Verify Timeline activities on Deal
	dealActs := doJSONArray(t, client, "GET", fmt.Sprintf("%s/api/deals/%d/activities", baseURL, dealID), authHeaders)
	hasLeadConverted := false
	for _, act := range dealActs {
		if act["activity_type"] == "lead_converted" {
			hasLeadConverted = true
			break
		}
	}
	if !hasLeadConverted {
		t.Fatalf("Expected 'lead_converted' activity on deal %d, got: %v", dealID, dealActs)
	}
	t.Logf("Verified deal timeline contains 'lead_converted' event")

	t.Logf("Lead -> Deal flow integration test passed successfully with all verifications!")
}

func doJSONArray(t *testing.T, client *http.Client, method, url string, headers map[string]string) []map[string]interface{} {
	t.Helper()
	req, err := http.NewRequest(method, url, nil)
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("Request failed: %v", err)
	}
	defer resp.Body.Close()

	var arr []map[string]interface{}
	_ = json.NewDecoder(resp.Body).Decode(&arr)
	return arr
}
