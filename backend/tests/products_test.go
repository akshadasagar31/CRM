package tests

import (
	"fmt"
	"net/http"
	"testing"
	"time"
)

func TestProductsCatalogModule(t *testing.T) {
	baseURL := getBaseURL()
	if !isServerUp(baseURL) {
		t.Skipf("CRM backend server is not running at %s, skipping integration tests", baseURL)
	}

	client := &http.Client{Timeout: 10 * time.Second}

	// 1. Login as Admin
	var adminToken string
	code, res := doJSON(t, client, "POST", baseURL+"/api/auth/login", map[string]string{
		"email":    "admin@crmdemo.com",
		"password": "admin123",
	}, nil)
	if code != http.StatusOK {
		t.Fatalf("Admin login failed with status %d", code)
	}
	adminToken = res["access_token"].(string)
	adminHeaders := map[string]string{
		"Authorization": "Bearer " + adminToken,
	}

	// 2. Register/Login as Sales Rep
	salesEmail := fmt.Sprintf("rep-%d@crmdemo.com", time.Now().UnixNano())
	code, _ = doJSON(t, client, "POST", baseURL+"/api/auth/register", map[string]string{
		"name":     "Sales Tester",
		"email":    salesEmail,
		"password": "Password123!",
	}, nil)
	if code != http.StatusOK && code != http.StatusCreated {
		t.Fatalf("Failed to register sales rep: %d", code)
	}

	code, repRes := doJSON(t, client, "POST", baseURL+"/api/auth/login", map[string]string{
		"email":    salesEmail,
		"password": "Password123!",
	}, nil)
	if code != http.StatusOK {
		t.Fatalf("Sales rep login failed: %d", code)
	}
	repToken := repRes["access_token"].(string)
	repHeaders := map[string]string{
		"Authorization": "Bearer " + repToken,
	}

	var createdProductID int
	testSKU := fmt.Sprintf("TEST-PROD-%d", time.Now().UnixNano()%100000)

	// 3. Test List Seed Products & Categories
	t.Run("ListProductsAndCategories", func(t *testing.T) {
		status, listRes := doJSON(t, client, "GET", baseURL+"/api/products", nil, adminHeaders)
		if status != http.StatusOK {
			t.Fatalf("Expected 200 OK, got %d", status)
		}
		if total, ok := listRes["total"].(float64); !ok || total < 1 {
			t.Fatalf("Expected at least 1 seed product, got %v", listRes["total"])
		}

		catStatus, _ := doJSON(t, client, "GET", baseURL+"/api/products/categories", nil, adminHeaders)
		if catStatus != http.StatusOK {
			t.Fatalf("Expected 200 OK for categories, got %d", catStatus)
		}
	})

	// 4. Admin Creates Product
	t.Run("AdminCreateProduct", func(t *testing.T) {
		status, prodRes := doJSON(t, client, "POST", baseURL+"/api/products", map[string]interface{}{
			"name":          "Enterprise Analytics Plugin",
			"sku":           testSKU,
			"category":      "Software",
			"description":   "Advanced BI dashboards and reporting pipeline",
			"unit":          "License",
			"selling_price": 4999.00,
			"currency":      "INR",
			"tax_rate":      18.00,
			"hsn_sac":       "997331",
			"status":        "active",
		}, adminHeaders)

		if status != http.StatusCreated {
			t.Fatalf("Expected 201 Created, got %d (res: %v)", status, prodRes)
		}

		if idVal, ok := prodRes["id"].(float64); ok {
			createdProductID = int(idVal)
		} else {
			t.Fatalf("Missing product id in response: %v", prodRes)
		}
	})

	// 5. Duplicate SKU Check
	t.Run("DuplicateSKURejection", func(t *testing.T) {
		status, _ := doJSON(t, client, "POST", baseURL+"/api/products", map[string]interface{}{
			"name":          "Duplicate Item",
			"sku":           testSKU,
			"selling_price": 100.00,
		}, adminHeaders)

		if status != http.StatusBadRequest {
			t.Fatalf("Expected 400 Bad Request for duplicate SKU, got %d", status)
		}
	})

	// 6. Sales Rep Can Read Product but CANNOT Create/Update/Delete
	t.Run("SalesRepPermissionsEnforced", func(t *testing.T) {
		// Can Read
		status, readRes := doJSON(t, client, "GET", fmt.Sprintf("%s/api/products/%d", baseURL, createdProductID), nil, repHeaders)
		if status != http.StatusOK {
			t.Fatalf("Sales rep should be able to view product, got status %d", status)
		}
		if readRes["sku"] != testSKU {
			t.Fatalf("Expected SKU %s, got %v", testSKU, readRes["sku"])
		}

		// Cannot Create
		createStatus, _ := doJSON(t, client, "POST", baseURL+"/api/products", map[string]interface{}{
			"name":          "Unauthorized Product",
			"sku":           "UNAUTH-SKU",
			"selling_price": 50.00,
		}, repHeaders)
		if createStatus != http.StatusForbidden {
			t.Fatalf("Expected 403 Forbidden for sales rep create, got %d", createStatus)
		}

		// Cannot Update
		newPrice := 9999.00
		updateStatus, _ := doJSON(t, client, "PATCH", fmt.Sprintf("%s/api/products/%d", baseURL, createdProductID), map[string]interface{}{
			"selling_price": newPrice,
		}, repHeaders)
		if updateStatus != http.StatusForbidden {
			t.Fatalf("Expected 403 Forbidden for sales rep update, got %d", updateStatus)
		}

		// Cannot Delete
		deleteStatus, _ := doJSON(t, client, "DELETE", fmt.Sprintf("%s/api/products/%d", baseURL, createdProductID), nil, repHeaders)
		if deleteStatus != http.StatusForbidden {
			t.Fatalf("Expected 403 Forbidden for sales rep delete, got %d", deleteStatus)
		}
	})

	// 7. Admin Updates Product & Toggles Status
	t.Run("AdminUpdateProduct", func(t *testing.T) {
		updatedPrice := 5999.00
		updatedName := "Enterprise Analytics Plugin (v2.0)"
		status, upRes := doJSON(t, client, "PATCH", fmt.Sprintf("%s/api/products/%d", baseURL, createdProductID), map[string]interface{}{
			"name":          updatedName,
			"selling_price": updatedPrice,
			"status":        "inactive",
		}, adminHeaders)

		if status != http.StatusOK {
			t.Fatalf("Expected 200 OK, got %d (res: %v)", status, upRes)
		}
		if upRes["status"] != "inactive" {
			t.Fatalf("Expected status to be 'inactive', got %v", upRes["status"])
		}
	})

	// 8. Admin Soft Deletes Product
	t.Run("AdminDeleteProduct", func(t *testing.T) {
		status, delRes := doJSON(t, client, "DELETE", fmt.Sprintf("%s/api/products/%d", baseURL, createdProductID), nil, adminHeaders)
		if status != http.StatusOK {
			t.Fatalf("Expected 200 OK, got %d (res: %v)", status, delRes)
		}

		// Confirm it's no longer found
		getStatus, _ := doJSON(t, client, "GET", fmt.Sprintf("%s/api/products/%d", baseURL, createdProductID), nil, adminHeaders)
		if getStatus != http.StatusNotFound {
			t.Fatalf("Expected 404 Not Found after deletion, got %d", getStatus)
		}
	})
}
