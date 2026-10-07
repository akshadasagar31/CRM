package tests

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"
)

func getBaseURL() string {
	url := os.Getenv("TEST_API_URL")
	if url == "" {
		url = "http://localhost:8001"
	}
	return strings.TrimRight(url, "/")
}

func isServerUp(baseURL string) bool {
	client := &http.Client{Timeout: 1 * time.Second}
	resp, err := client.Get(baseURL + "/api/health")
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}

type loginResponse struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	User        struct {
		ID    int    `json:"id"`
		Name  string `json:"name"`
		Email string `json:"email"`
		Role  string `json:"role"`
	} `json:"user"`
}

func doJSON(t *testing.T, client *http.Client, method, url string, body interface{}, headers map[string]string) (int, map[string]interface{}) {
	t.Helper()
	var bodyReader io.Reader
	if body != nil {
		jsonBytes, err := json.Marshal(body)
		if err != nil {
			t.Fatalf("Failed to marshal JSON body: %v", err)
		}
		bodyReader = bytes.NewReader(jsonBytes)
	}

	req, err := http.NewRequest(method, url, bodyReader)
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}

	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("HTTP request failed: %v", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("Failed to read response body: %v", err)
	}

	var resMap map[string]interface{}
	if len(respBytes) > 0 {
		_ = json.Unmarshal(respBytes, &resMap)
	}
	return resp.StatusCode, resMap
}

func TestUniversalCRME2ELifecycle(t *testing.T) {
	baseURL := getBaseURL()
	if !isServerUp(baseURL) {
		t.Skipf("CRM backend server is not running at %s, skipping integration tests", baseURL)
	}

	client := &http.Client{Timeout: 10 * time.Second}

	// 1. Health Check
	t.Run("HealthCheck", func(t *testing.T) {
		code, res := doJSON(t, client, "GET", baseURL+"/api/health", nil, nil)
		if code != http.StatusOK {
			t.Fatalf("Expected 200, got %d", code)
		}
		if res["status"] != "ok" {
			t.Fatalf("Expected status=ok, got %v", res["status"])
		}
	})

	// 2. Auth Login
	var token string
	t.Run("AuthLogin", func(t *testing.T) {
		code, res := doJSON(t, client, "POST", baseURL+"/api/auth/login", map[string]string{
			"email":    "admin@crmdemo.com",
			"password": "admin123",
		}, nil)
		if code != http.StatusOK {
			t.Fatalf("Expected 200, got %d", code)
		}
		tok, ok := res["access_token"].(string)
		if !ok || tok == "" {
			t.Fatalf("Expected access_token in response: %v", res)
		}
		token = tok
	})

	authHeaders := map[string]string{
		"Authorization": "Bearer " + token,
	}

	// 3. Metadata Endpoints
	t.Run("MetadataEndpoints", func(t *testing.T) {
		code, _ := doJSON(t, client, "GET", baseURL+"/api/leads/statuses", nil, authHeaders)
		if code != http.StatusOK {
			t.Errorf("Expected 200 for statuses, got %d", code)
		}

		code, _ = doJSON(t, client, "GET", baseURL+"/api/leads/sources", nil, authHeaders)
		if code != http.StatusOK {
			t.Errorf("Expected 200 for sources, got %d", code)
		}

		code, _ = doJSON(t, client, "GET", baseURL+"/api/leads/tags", nil, authHeaders)
		if code != http.StatusOK {
			t.Errorf("Expected 200 for tags, got %d", code)
		}

		code, _ = doJSON(t, client, "GET", baseURL+"/api/leads/custom-fields", nil, authHeaders)
		if code != http.StatusOK {
			t.Errorf("Expected 200 for custom-fields, got %d", code)
		}
	})

	// 4. Lead Creation, Duplicate Prevention & Custom Fields
	uniqueID := time.Now().UnixNano() % 1000000
	leadPhone := fmt.Sprintf("+1-888-%06d", uniqueID)
	leadEmail := fmt.Sprintf("lead_%d@testcrm.io", uniqueID)

	t.Run("LeadCRUDAndDuplicateProtection", func(t *testing.T) {
		// Create Lead
		code, res := doJSON(t, client, "POST", baseURL+"/api/leads", map[string]interface{}{
			"number":      leadPhone,
			"name":        "Go Integration Test Corp",
			"email":       leadEmail,
			"requirement": "Enterprise CRM Testing",
			"city":        "Seattle",
			"status":      "new",
			"score":       85,
			"custom_fields": map[string]interface{}{
				"industry": "Cloud Computing",
			},
		}, authHeaders)
		if code != http.StatusCreated {
			t.Fatalf("Expected 201 Created for new lead, got %d: %v", code, res)
		}

		// Verify Duplicate Phone Prevention
		code, _ = doJSON(t, client, "POST", baseURL+"/api/leads", map[string]interface{}{
			"number": leadPhone,
			"name":   "Duplicate Phone Lead",
			"email":  fmt.Sprintf("other_%d@testcrm.io", uniqueID),
		}, authHeaders)
		if code != http.StatusConflict {
			t.Errorf("Expected 409 Conflict for duplicate phone, got %d", code)
		}

		// Verify Duplicate Email Prevention
		code, _ = doJSON(t, client, "POST", baseURL+"/api/leads", map[string]interface{}{
			"number": fmt.Sprintf("+1-889-%06d", uniqueID),
			"name":   "Duplicate Email Lead",
			"email":  leadEmail,
		}, authHeaders)
		if code != http.StatusConflict {
			t.Errorf("Expected 409 Conflict for duplicate email, got %d", code)
		}

		// Patch Lead
		code, _ = doJSON(t, client, "PATCH", baseURL+"/api/leads/"+leadPhone, map[string]interface{}{
			"status": "contacted",
			"score":  90,
		}, authHeaders)
		if code != http.StatusOK {
			t.Errorf("Expected 200 for lead update, got %d", code)
		}

		// Activity Timeline
		code, _ = doJSON(t, client, "GET", baseURL+"/api/leads/"+leadPhone+"/activities", nil, authHeaders)
		if code != http.StatusOK {
			t.Errorf("Expected 200 for activities, got %d", code)
		}

		// Add Note
		code, _ = doJSON(t, client, "POST", baseURL+"/api/leads/"+leadPhone+"/notes", map[string]string{
			"content": "Follow-up scheduled with decision maker.",
		}, authHeaders)
		if code != http.StatusCreated {
			t.Errorf("Expected 201 for note creation, got %d", code)
		}

		// Schedule Follow-up
		code, _ = doJSON(t, client, "POST", baseURL+"/api/leads/"+leadPhone+"/follow-ups", map[string]interface{}{
			"title":    "Contract Review Call",
			"due_date": time.Now().Add(24 * time.Hour).Format(time.RFC3339),
			"notes":    "Review contract terms",
		}, authHeaders)
		if code != http.StatusCreated {
			t.Errorf("Expected 201 for follow-up creation, got %d", code)
		}
	})

	// 5. Views, Export and Search
	t.Run("ViewsAndSearch", func(t *testing.T) {
		code, res := doJSON(t, client, "GET", baseURL+"/api/leads?view=all", nil, authHeaders)
		if code != http.StatusOK {
			t.Fatalf("Expected 200 for leads list, got %d", code)
		}
		if _, ok := res["view_counts"]; !ok {
			t.Errorf("Expected view_counts in response")
		}

		// CSV Export
		code, _ = doJSON(t, client, "GET", baseURL+"/api/leads/export", nil, authHeaders)
		if code != http.StatusOK {
			t.Errorf("Expected 200 for export, got %d", code)
		}
	})

	// 6. Soft Delete and Restore
	t.Run("SoftDeleteAndRestore", func(t *testing.T) {
		code, _ := doJSON(t, client, "DELETE", baseURL+"/api/leads/"+leadPhone, nil, authHeaders)
		if code != http.StatusOK {
			t.Fatalf("Expected 200 for lead soft delete, got %d", code)
		}

		code, _ = doJSON(t, client, "POST", baseURL+"/api/leads/"+leadPhone+"/restore", nil, authHeaders)
		if code != http.StatusOK {
			t.Fatalf("Expected 200 for lead restore, got %d", code)
		}
	})

	// 7. API Keys and Webhook Bearer Auth Lifecycle
	t.Run("APIKeysAndWebhooksLifecycle", func(t *testing.T) {
		// Create API Key
		code, keyRes := doJSON(t, client, "POST", baseURL+"/api/api-keys", map[string]string{
			"name":   "Go E2E Ingestion Key",
			"expiry": "7_days",
		}, authHeaders)
		if code != http.StatusCreated {
			t.Fatalf("Expected 201 for API key creation, got %d: %v", code, keyRes)
		}

		rawKey, _ := keyRes["api_key"].(string)
		keyIDVal, _ := keyRes["id"].(float64)
		keyID := int(keyIDVal)

		if !strings.HasPrefix(rawKey, "crm_live_") {
			t.Errorf("Expected API key to start with 'crm_live_', got %s", rawKey)
		}

		apiKeyHeaders := map[string]string{
			"Authorization": "Bearer " + rawKey,
		}

		// Ingest via Webhook
		webhookLeadPhone := fmt.Sprintf("+1-999-%06d", uniqueID)
		code, _ = doJSON(t, client, "POST", baseURL+"/api/webhooks/lead", map[string]interface{}{
			"number":      webhookLeadPhone,
			"name":        "Webhook Ingested Lead",
			"email":       fmt.Sprintf("webhook_%d@testcrm.io", uniqueID),
			"requirement": "API Key Ingestion Test",
			"source":      "website",
			"city":        "Austin",
		}, apiKeyHeaders)
		if code != http.StatusCreated {
			t.Errorf("Expected 201 for webhook ingestion, got %d", code)
		}

		// Webhook Duplicate Detection
		code, _ = doJSON(t, client, "POST", baseURL+"/api/webhooks/lead", map[string]interface{}{
			"number": webhookLeadPhone,
			"name":   "Duplicate Webhook Lead",
			"email":  fmt.Sprintf("dup_%d@testcrm.io", uniqueID),
		}, apiKeyHeaders)
		if code != http.StatusConflict {
			t.Errorf("Expected 409 Conflict for webhook duplicate, got %d", code)
		}

		// Revoke Key
		code, _ = doJSON(t, client, "POST", fmt.Sprintf("%s/api/api-keys/%d/revoke", baseURL, keyID), nil, authHeaders)
		if code != http.StatusOK {
			t.Errorf("Expected 200 for key revoke, got %d", code)
		}

		// Rejection with Revoked Key
		code, errRes := doJSON(t, client, "POST", baseURL+"/api/webhooks/lead", map[string]interface{}{
			"number": fmt.Sprintf("+1-999-rev-%06d", uniqueID),
			"name":   "Should Fail Lead",
		}, apiKeyHeaders)
		if code != http.StatusUnauthorized {
			t.Errorf("Expected 401 for revoked key, got %d", code)
		}
		if errRes["detail"] != "API key has been revoked." {
			t.Errorf("Expected detail 'API key has been revoked.', got %v", errRes["detail"])
		}

		// Cleanup API Key
		code, _ = doJSON(t, client, "DELETE", fmt.Sprintf("%s/api/api-keys/%d", baseURL, keyID), nil, authHeaders)
		if code != http.StatusOK {
			t.Errorf("Expected 200 for key delete, got %d", code)
		}
	})
}
