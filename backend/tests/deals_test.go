package tests

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"testing"
	"time"
)

func TestDealsAndPipelineModule(t *testing.T) {
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

	// 2. Fetch Pipelines & Stages
	var pipelineID int
	var stageID int
	var wonStageID int
	var lostStageID int

	t.Run("GetPipelines", func(t *testing.T) {
		status, _ := doJSON(t, client, "GET", baseURL+"/api/pipelines", nil, authHeaders)
		if status != http.StatusOK {
			t.Fatalf("Expected 200, got %d", status)
		}
	})

	// 3. Create a Customer
	var customerID int
	t.Run("CreateCustomer", func(t *testing.T) {
		code, cRes := doJSON(t, client, "POST", baseURL+"/api/customers", map[string]interface{}{
			"name":    "Acme Corp",
			"email":   fmt.Sprintf("acme-%d@example.com", time.Now().UnixNano()),
			"phone":   "+1555019999",
			"company": "Acme Industries",
		}, authHeaders)
		if code != http.StatusCreated {
			t.Fatalf("Expected 201 Created, got %d (res: %v)", code, cRes)
		}
		if idVal, ok := cRes["id"].(float64); ok {
			customerID = int(idVal)
		} else {
			t.Fatalf("Missing customer id in response: %v", cRes)
		}
	})

	// 4. Create Pipeline if needed and fetch default stages
	t.Run("EnsurePipelineAndStages", func(t *testing.T) {
		req, _ := http.NewRequest("GET", baseURL+"/api/pipelines", nil)
		for k, v := range authHeaders {
			req.Header.Set(k, v)
		}
		resp, err := client.Do(req)
		if err != nil || resp.StatusCode != http.StatusOK {
			t.Fatalf("Failed to fetch pipelines: %v", err)
		}
		defer resp.Body.Close()

		var pipelines []map[string]interface{}
		_ = decodeJSONArray(resp.Body, &pipelines)
		if len(pipelines) > 0 {
			pipelineID = int(pipelines[0]["id"].(float64))
			stages := pipelines[0]["stages"].([]interface{})
			if len(stages) > 0 {
				stageID = int(stages[0].(map[string]interface{})["id"].(float64))
			}
			for _, st := range stages {
				stMap := st.(map[string]interface{})
				if stMap["is_won"] == true {
					wonStageID = int(stMap["id"].(float64))
				}
				if stMap["is_lost"] == true {
					lostStageID = int(stMap["id"].(float64))
				}
			}
		}
		if pipelineID == 0 || stageID == 0 {
			t.Fatalf("No pipelines or stages found")
		}
	})

	// 5. Create Deal
	var dealID int
	t.Run("CreateDeal", func(t *testing.T) {
		code, dRes := doJSON(t, client, "POST", baseURL+"/api/deals", map[string]interface{}{
			"name":        "Enterprise ERP License",
			"customer_id": customerID,
			"pipeline_id": pipelineID,
			"stage_id":    stageID,
			"value":       125000.0,
			"priority":    "High",
			"requirement": "Requires multi-tenant SSO and custom integrations",
		}, authHeaders)

		if code != http.StatusCreated {
			t.Fatalf("Expected 201 Created, got %d (%v)", code, dRes)
		}
		dealID = int(dRes["id"].(float64))
		if dRes["deal_number"] == nil || dRes["deal_number"] == "" {
			t.Fatalf("Expected deal_number to be generated, got %v", dRes["deal_number"])
		}
	})

	// 6. List Deals with Filter
	t.Run("ListDeals", func(t *testing.T) {
		url := fmt.Sprintf("%s/api/deals?pipeline_id=%d&priority=High", baseURL, pipelineID)
		code, lRes := doJSON(t, client, "GET", url, nil, authHeaders)
		if code != http.StatusOK {
			t.Fatalf("Expected 200, got %d", code)
		}
		items := lRes["items"].([]interface{})
		if len(items) == 0 {
			t.Fatalf("Expected at least 1 deal returned")
		}
	})

	// 7. Transition Stage to Closed Won
	t.Run("TransitionToWon", func(t *testing.T) {
		if wonStageID == 0 {
			t.Skip("No won stage found")
		}
		url := fmt.Sprintf("%s/api/deals/%d/stage", baseURL, dealID)
		code, res := doJSON(t, client, "POST", url, map[string]interface{}{
			"stage_id": wonStageID,
		}, authHeaders)
		if code != http.StatusOK {
			t.Fatalf("Expected 200, got %d (%v)", code, res)
		}
		if res["status"] != "won" {
			t.Fatalf("Expected status=won, got %v", res["status"])
		}
	})

	// 7b. Transition Stage to Closed Lost
	t.Run("TransitionToLost", func(t *testing.T) {
		if lostStageID == 0 {
			t.Skip("No lost stage found")
		}
		url := fmt.Sprintf("%s/api/deals/%d/stage", baseURL, dealID)
		code, res := doJSON(t, client, "POST", url, map[string]interface{}{
			"stage_id":    lostStageID,
			"lost_reason": "Budget cut in Q3",
		}, authHeaders)
		if code != http.StatusOK {
			t.Fatalf("Expected 200, got %d (%v)", code, res)
		}
		if res["status"] != "lost" {
			t.Fatalf("Expected status=lost, got %v", res["status"])
		}
	})

	// 8. Add Deal Note & Timeline Activity
	t.Run("DealNotesAndActivities", func(t *testing.T) {
		noteURL := fmt.Sprintf("%s/api/deals/%d/notes", baseURL, dealID)
		code, nRes := doJSON(t, client, "POST", noteURL, map[string]string{
			"content": "Contract signed by VP of Engineering.",
		}, authHeaders)
		if code != http.StatusCreated {
			t.Fatalf("Expected 201 for note creation, got %d", code)
		}
		if nRes["content"] != "Contract signed by VP of Engineering." {
			t.Fatalf("Unexpected note content: %v", nRes)
		}

		actURL := fmt.Sprintf("%s/api/deals/%d/activities", baseURL, dealID)
		req, _ := http.NewRequest("GET", actURL, nil)
		for k, v := range authHeaders {
			req.Header.Set(k, v)
		}
		resp, err := client.Do(req)
		if err != nil || resp.StatusCode != http.StatusOK {
			t.Fatalf("Failed to fetch deal activities: %v", err)
		}
		defer resp.Body.Close()
	})

	// 9. Lead to Customer + Deal Conversion
	t.Run("LeadConversion", func(t *testing.T) {
		// First create a new lead
		leadNum := fmt.Sprintf("CONV-%d", time.Now().UnixNano()%100000)
		uniquePhone := fmt.Sprintf("+15550%05d", time.Now().UnixNano()%100000)
		code, lRes := doJSON(t, client, "POST", baseURL+"/api/leads", map[string]interface{}{
			"number":      leadNum,
			"name":        "Samantha Miller",
			"email":       fmt.Sprintf("samantha.%d@globaltech.io", time.Now().UnixNano()),
			"phone":       uniquePhone,
			"city":        "Chicago",
			"requirement": "Cloud Migration Services for 500 servers",
		}, authHeaders)
		if code != http.StatusCreated {
			t.Fatalf("Failed to create test lead: %d (%v)", code, lRes)
		}

		// Convert Lead
		convURL := fmt.Sprintf("%s/api/leads/%s/convert", baseURL, leadNum)
		code, convRes := doJSON(t, client, "POST", convURL, map[string]interface{}{
			"deal_name":        "GlobalTech Cloud Migration",
			"deal_value":       85000.0,
			"pipeline_id":      pipelineID,
			"stage_id":         stageID,
			"priority":         "High",
			"customer_name":    "Samantha Miller",
			"customer_company": "GlobalTech Solutions",
		}, authHeaders)

		if code != http.StatusOK {
			t.Fatalf("Lead conversion failed: %d (%v)", code, convRes)
		}
		if convRes["success"] != true {
			t.Fatalf("Expected success=true, got %v", convRes)
		}

		// Verify Lead status updated to Converted
		code, leadCheck := doJSON(t, client, "GET", baseURL+"/api/leads/"+leadNum, nil, authHeaders)
		if code != http.StatusOK {
			t.Fatalf("Failed to get converted lead: %d", code)
		}
		if leadCheck["status"] != "Converted" {
			t.Fatalf("Expected lead status 'Converted', got %v", leadCheck["status"])
		}
	})
}

func decodeJSONArray(r io.Reader, target interface{}) error {
	return json.NewDecoder(r).Decode(target)
}
