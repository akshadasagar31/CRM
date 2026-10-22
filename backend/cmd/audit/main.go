package main

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgresql://postgres:postgres@localhost:5432/crm_db"
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("Failed to connect to DB: %v", err)
	}
	defer pool.Close()

	fmt.Println("=== ALL CUSTOMERS ===")
	cRows, err := pool.Query(ctx, "SELECT id, name, email, phone, company FROM customers ORDER BY id ASC")
	if err != nil {
		log.Fatalf("Failed to query customers: %v", err)
	}
	defer cRows.Close()
	for cRows.Next() {
		var id int
		var name string
		var email, phone, company *string
		_ = cRows.Scan(&id, &name, &email, &phone, &company)
		fmt.Printf("Customer #%d: %s | Email: %s | Phone: %s | Company: %s\n",
			id, name, deref(email), deref(phone), deref(company))
	}

	fmt.Println("\n=== ALL LEADS ===")
	lRows, err := pool.Query(ctx, "SELECT number, name, email, phone, status, requirement FROM leads ORDER BY created_at ASC")
	if err != nil {
		log.Fatalf("Failed to query leads: %v", err)
	}
	defer lRows.Close()
	for lRows.Next() {
		var number, name, status, req string
		var email, phone *string
		_ = lRows.Scan(&number, &name, &email, &phone, &status, &req)
		fmt.Printf("Lead %s: %s | Email: %s | Phone: %s | Status: %s | Req: %s\n",
			number, name, deref(email), deref(phone), status, req)
	}

	fmt.Println("\n=== ALL ORDERS ===")
	oRows, err := pool.Query(ctx, "SELECT id, order_number, title, customer_id, deal_id FROM orders ORDER BY id ASC")
	if err == nil {
		defer oRows.Close()
		for oRows.Next() {
			var id int
			var orderNum, title string
			var custID int
			var dealID *int
			_ = oRows.Scan(&id, &orderNum, &title, &custID, &dealID)
			fmt.Printf("Order #%d (%s): %s | CustID: %d | DealID: %s\n",
				id, orderNum, title, custID, derefInt(dealID))
		}
	}

	fmt.Println("\n=== ALL INVOICES ===")
	iRows, err := pool.Query(ctx, "SELECT id, invoice_number, customer_name, customer_email, customer_id, deal_id, order_id, quotation_id FROM invoices ORDER BY id ASC")
	if err == nil {
		defer iRows.Close()
		for iRows.Next() {
			var id int
			var invNum, custName string
			var custEmail *string
			var custID int
			var dealID, orderID, quoteID *int
			_ = iRows.Scan(&id, &invNum, &custName, &custEmail, &custID, &dealID, &orderID, &quoteID)
			fmt.Printf("Invoice #%d (%s): %s (%s) | CustID: %d | DealID: %s | OrderID: %s | QuoteID: %s\n",
				id, invNum, custName, deref(custEmail), custID, derefInt(dealID), derefInt(orderID), derefInt(quoteID))
		}
	}
}

func deref(s *string) string {
	if s == nil {
		return "<nil>"
	}
	return *s
}

func derefInt(i *int) string {
	if i == nil {
		return "<nil>"
	}
	return fmt.Sprintf("%d", *i)
}
