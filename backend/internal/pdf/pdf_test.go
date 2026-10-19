package pdf

import (
	"bytes"
	"testing"
	"time"

	"crm-backend-go/internal/models"
)

func TestGenerateQuotationPDF(t *testing.T) {
	validUntil := time.Now().AddDate(0, 0, 30)
	leadNum := "LEAD-0012"
	terms := "1. Prices valid for 30 days.\n2. 50% advance payment.\n3. Goods once sold cannot be returned."
	compName := "InCraax AI Automation Pvt Ltd"
	compAddr := "2nd Floor, Snehadeep Building, Ram Nagar-Road, Warje, Pune, 411058"
	compGSTIN := "27ABCDE1234F1Z5"
	compPAN := "ABCDE1234F"
	compState := "Maharashtra"

	custCompany := "Acme Corp"
	custAddr := "Park Street, Mumbai"
	custState := "Maharashtra"
	custGSTIN := "27XYZAB1234C1Z9"
	custPhone := "+91 98765 00000"
	custEmail := "info@acme.com"

	hsn := "8471"
	q := &models.Quotation{
		ID:              1,
		QuotationNumber: "QTN-0001",
		Status:          "approved",
		CreatedAt:       time.Now(),
		ValidUntil:      &validUntil,
		LeadNumber:      &leadNum,
		CompanyName:     &compName,
		CompanyAddress:  &compAddr,
		CompanyGSTIN:    &compGSTIN,
		CompanyPAN:      &compPAN,
		CompanyState:    &compState,
		CustomerState:   &custState,
		CustomerGSTIN:   &custGSTIN,
		Customer: &models.Customer{
			ID:      1,
			Name:    "John Doe",
			Company: &custCompany,
			Address: &custAddr,
			State:   &custState,
			GSTIN:   &custGSTIN,
			Phone:   &custPhone,
			Email:   &custEmail,
		},
		Items: []models.QuotationItem{
			{
				ID:          1,
				ProductName: "Enterprise AI Suite",
				HSNSAC:      &hsn,
				Quantity:    2.0,
				UnitPrice:   50000.0,
				GSTRate:     18.0,
				LineTotal:   118000.0,
			},
		},
		Subtotal:           100000.0,
		DiscountAmount:     0.0,
		TaxableAmount:      100000.0,
		CGSTAmount:         9000.0,
		SGSTAmount:         9000.0,
		IGSTAmount:         0.0,
		TotalGSTAmount:     18000.0,
		TotalAmount:        118000.0,
		TermsAndConditions: &terms,
	}

	pdfBytes, err := GenerateQuotationPDF(q, nil, nil, "")
	if err != nil {
		t.Fatalf("GenerateQuotationPDF failed: %v", err)
	}
	if len(pdfBytes) < 1000 {
		t.Fatalf("PDF output too small: %d bytes", len(pdfBytes))
	}
	if !bytes.HasPrefix(pdfBytes, []byte("%PDF-")) {
		t.Fatalf("Generated file does not have valid PDF header: %v", pdfBytes[:10])
	}
}

func TestGenerateInvoicePDF(t *testing.T) {
	dueDate := time.Now().AddDate(0, 0, 15)
	terms := "1. Please pay by the due date.\n2. Remit payments via NEFT/RTGS.\n3. Include invoice number in reference."
	compName := "InCraax AI Automation Pvt Ltd"
	compAddr := "2nd Floor, Snehadeep Building, Ram Nagar-Road, Warje, Pune, 411058"
	compGSTIN := "27ABCDE1234F1Z5"
	compPAN := "ABCDE1234F"
	compState := "Maharashtra"

	custName := "Prerna Sagar"
	custCompany := "Prerna Enterprises"
	custAddr := "Warje, Pune"
	custState := "Maharashtra"
	custGSTIN := "Unregistered"
	custPhone := "8237133807"
	custEmail := "akshadasagar24@gmail.com"

	refNum := "UTR99887766"
	hsn := "8471"

	inv := &models.Invoice{
		ID:               1,
		InvoiceNumber:    "INV-0002",
		Status:           "paid",
		InvoiceDate:      time.Now(),
		DueDate:          &dueDate,
		CompanyName:      &compName,
		CompanyAddress:   &compAddr,
		CompanyGSTIN:     &compGSTIN,
		CompanyPAN:       &compPAN,
		CompanyState:     &compState,
		CustomerState:    &custState,
		CustomerGSTIN:    &custGSTIN,
		IsInterState:     false,
		Subtotal:         75000.0,
		TaxableAmount:    75000.0,
		CGSTAmount:       6750.0,
		SGSTAmount:       6750.0,
		TotalTax:         13500.0,
		GrandTotal:       88500.0,
		AmountPaid:       88500.0,
		RemainingBalance: 0.0,
		Customer: &models.Customer{
			ID:      1,
			Name:    custName,
			Company: &custCompany,
			Address: &custAddr,
			State:   &custState,
			GSTIN:   &custGSTIN,
			Phone:   &custPhone,
			Email:   &custEmail,
		},
		Items: []models.InvoiceItem{
			{
				ID:          1,
				ProductName: "Laptop",
				HSNSAC:      &hsn,
				Quantity:    1.0,
				UnitPrice:   75000.0,
				GSTRate:     18.0,
				LineTotal:   88500.0,
			},
		},
		Payments: []models.InvoicePayment{
			{
				PaymentDate:     time.Now(),
				PaymentMethod:   "Bank Transfer (NEFT/RTGS/IMPS)",
				ReferenceNumber: &refNum,
				Amount:          88500.0,
			},
		},
		TermsAndConditions: &terms,
	}

	pdfBytes, err := GenerateInvoicePDF(inv, nil, nil, "")
	if err != nil {
		t.Fatalf("GenerateInvoicePDF failed: %v", err)
	}
	if len(pdfBytes) < 1000 {
		t.Fatalf("Invoice PDF output too small: %d bytes", len(pdfBytes))
	}
	if !bytes.HasPrefix(pdfBytes, []byte("%PDF-")) {
		t.Fatalf("Generated file does not have valid PDF header: %v", pdfBytes[:10])
	}
}

func TestGeneratePaymentReceiptPDF(t *testing.T) {
	refNum := "UTR11223344"
	receipt := &models.PaymentReceiptDetail{
		Payment: models.PaymentLedgerItem{
			ID:                      1,
			PaymentDate:             time.Now(),
			PaymentMethod:           "Bank Transfer",
			ReferenceNumber:         &refNum,
			Amount:                  88500.0,
			InvoiceNumber:           "INV-0002",
			InvoiceGrandTotal:       88500.0,
			InvoiceRemainingBalance: 0.0,
			InvoiceStatus:           "paid",
			CustomerName:            "Prerna Sagar",
		},
	}

	pdfBytes, err := GeneratePaymentReceiptPDF(receipt, nil, nil, "")
	if err != nil {
		t.Fatalf("GeneratePaymentReceiptPDF failed: %v", err)
	}
	if len(pdfBytes) < 1000 {
		t.Fatalf("Receipt PDF output too small: %d bytes", len(pdfBytes))
	}
	if !bytes.HasPrefix(pdfBytes, []byte("%PDF-")) {
		t.Fatalf("Generated file does not have valid PDF header: %v", pdfBytes[:10])
	}
}
