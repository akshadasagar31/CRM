package pdf

import (
	"fmt"
	"os"
	"strings"

	"crm-backend-go/internal/models"

	"github.com/johnfercher/maroto/v2"
	"github.com/johnfercher/maroto/v2/pkg/components/col"
	"github.com/johnfercher/maroto/v2/pkg/components/image"
	"github.com/johnfercher/maroto/v2/pkg/components/line"
	"github.com/johnfercher/maroto/v2/pkg/components/row"
	"github.com/johnfercher/maroto/v2/pkg/components/text"
	"github.com/johnfercher/maroto/v2/pkg/config"
	"github.com/johnfercher/maroto/v2/pkg/consts/align"
	"github.com/johnfercher/maroto/v2/pkg/consts/border"
	"github.com/johnfercher/maroto/v2/pkg/consts/extension"
	"github.com/johnfercher/maroto/v2/pkg/consts/fontfamily"
	"github.com/johnfercher/maroto/v2/pkg/consts/fontstyle"
	"github.com/johnfercher/maroto/v2/pkg/consts/pagesize"
	"github.com/johnfercher/maroto/v2/pkg/core"
	"github.com/johnfercher/maroto/v2/pkg/fontrepository"
	"github.com/johnfercher/maroto/v2/pkg/props"
)

// Brand Palette
var (
	ColorPrimaryTeal   = &props.Color{Red: 13, Green: 148, Blue: 136} // #0D9488
	ColorDarkSlate     = &props.Color{Red: 15, Green: 23, Blue: 42}   // #0F172A
	ColorMutedSlate    = &props.Color{Red: 71, Green: 85, Blue: 105}  // #475569
	ColorLightBorder   = &props.Color{Red: 226, Green: 232, Blue: 240} // #E2E8F0
	ColorCardBg        = &props.Color{Red: 248, Green: 250, Blue: 252} // #F8FAFC
	ColorWhite         = &props.Color{Red: 255, Green: 255, Blue: 255}
	ColorBadgePaid     = &props.Color{Red: 16, Green: 185, Blue: 129} // #10B981
	ColorBadgeOverdue  = &props.Color{Red: 239, Green: 68, Blue: 68}  // #EF4444
	ColorBadgePending  = &props.Color{Red: 245, Green: 158, Blue: 11} // #F59E0B
	ColorHeaderBg      = &props.Color{Red: 241, Green: 245, Blue: 249} // #F1F5F9
)

const (
	FontFamilyCustom = "ArialUnicode"
)

// buildMarotoInstance creates a Maroto v2 instance with A4 dimensions and Unicode font if available
func buildMarotoInstance() (core.Maroto, string) {
	activeFont := fontfamily.Helvetica

	b := config.NewBuilder().
		WithPageSize(pagesize.A4).
		WithLeftMargin(10).
		WithRightMargin(10).
		WithTopMargin(10).
		WithBottomMargin(10)

	// Check if Windows Arial font exists
	arialPath := "C:\\Windows\\Fonts\\arial.ttf"
	arialBoldPath := "C:\\Windows\\Fonts\\arialbd.ttf"
	arialItalicPath := "C:\\Windows\\Fonts\\ariali.ttf"
	arialBoldItalicPath := "C:\\Windows\\Fonts\\arialbi.ttf"
	if fileExists(arialPath) {
		repo := fontrepository.New().
			AddUTF8Font(FontFamilyCustom, fontstyle.Normal, arialPath)
		if fileExists(arialBoldPath) {
			repo.AddUTF8Font(FontFamilyCustom, fontstyle.Bold, arialBoldPath)
		} else {
			repo.AddUTF8Font(FontFamilyCustom, fontstyle.Bold, arialPath)
		}
		if fileExists(arialItalicPath) {
			repo.AddUTF8Font(FontFamilyCustom, fontstyle.Italic, arialItalicPath)
		} else {
			repo.AddUTF8Font(FontFamilyCustom, fontstyle.Italic, arialPath)
		}
		if fileExists(arialBoldItalicPath) {
			repo.AddUTF8Font(FontFamilyCustom, fontstyle.BoldItalic, arialBoldItalicPath)
		} else {
			repo.AddUTF8Font(FontFamilyCustom, fontstyle.BoldItalic, arialPath)
		}

		customFonts, err := repo.Load()
		if err == nil && len(customFonts) > 0 {
			b.WithCustomFonts(customFonts)
			b.WithDefaultFont(&props.Font{Family: FontFamilyCustom})
			activeFont = FontFamilyCustom
		}
	}

	cfg := b.Build()
	return maroto.New(cfg), activeFont
}

func fileExists(filename string) bool {
	info, err := os.Stat(filename)
	if os.IsNotExist(err) {
		return false
	}
	return !info.IsDir()
}

func formatCurrency(val float64, currency string, activeFont string) string {
	currSymbol := "₹"
	if activeFont != FontFamilyCustom {
		currSymbol = "Rs."
	}
	if currency != "" && currency != "INR" && currency != "₹" {
		currSymbol = currency
	}
	return fmt.Sprintf("%s %s", currSymbol, formatNumber(val))
}

func formatNumber(val float64) string {
	// Standard two decimal formatting
	sign := ""
	if val < 0 {
		sign = "-"
		val = -val
	}
	intPart := int64(val)
	fracPart := int64((val - float64(intPart)) * 100 + 0.5)
	if fracPart >= 100 {
		intPart++
		fracPart -= 100
	}

	intStr := fmt.Sprintf("%d", intPart)
	if len(intStr) > 3 {
		// Format Indian number system: last 3 digits, then groups of 2
		last3 := intStr[len(intStr)-3:]
		rest := intStr[:len(intStr)-3]
		var parts []string
		for len(rest) > 2 {
			parts = append([]string{rest[len(rest)-2:]}, parts...)
			rest = rest[:len(rest)-2]
		}
		if len(rest) > 0 {
			parts = append([]string{rest}, parts...)
		}
		parts = append(parts, last3)
		intStr = strings.Join(parts, ",")
	}

	return fmt.Sprintf("%s%s.%02d", sign, intStr, fracPart)
}

func parseImageExtension(mimeType string) extension.Type {
	lower := strings.ToLower(mimeType)
	if strings.Contains(lower, "png") {
		return extension.Png
	}
	return extension.Jpg
}

// =========================================================================
// QUOTATION PDF GENERATOR
// =========================================================================

func GenerateQuotationPDF(quote *models.Quotation, comp *models.CompanyProfile, logoBytes []byte, logoMime string) ([]byte, error) {
	if quote == nil {
		return nil, fmt.Errorf("quotation cannot be nil")
	}

	m, fontName := buildMarotoInstance()

	compName := "CRM Enterprise Solutions"
	compAddr := "101 Cyber City, Tech Park, Pune 411001"
	compGstin := "27AAACB2233M1Z2"
	compPan := "AAACB2233M"
	compState := "Maharashtra"
	compEmail := "sales@bizcopilot.com"
	compPhone := "+91 98765 43210"

	if quote.CompanyName != nil && *quote.CompanyName != "" {
		compName = *quote.CompanyName
	} else if comp != nil && comp.CompanyName != "" {
		compName = comp.CompanyName
	}

	if quote.CompanyAddress != nil && *quote.CompanyAddress != "" {
		compAddr = *quote.CompanyAddress
	} else if comp != nil && comp.Address != "" {
		compAddr = fmt.Sprintf("%s, %s %s", comp.Address, comp.City, comp.Pincode)
	}

	if quote.CompanyGSTIN != nil && *quote.CompanyGSTIN != "" {
		compGstin = *quote.CompanyGSTIN
	} else if comp != nil && comp.GSTNumber != "" {
		compGstin = comp.GSTNumber
	}

	if quote.CompanyPAN != nil && *quote.CompanyPAN != "" {
		compPan = *quote.CompanyPAN
	} else if comp != nil && comp.PANNumber != "" {
		compPan = comp.PANNumber
	}

	if quote.CompanyState != nil && *quote.CompanyState != "" {
		compState = *quote.CompanyState
	} else if comp != nil && comp.State != "" {
		compState = comp.State
	}

	if comp != nil {
		if comp.Email != "" {
			compEmail = comp.Email
		}
		if comp.Phone != "" {
			compPhone = comp.Phone
		}
	}

	// Customer Info
	custName := "Valued Customer"
	custCompany := ""
	custAddr := "Registered Address"
	custState := "Maharashtra"
	custGstin := "Unregistered"
	custContact := ""

	if quote.Customer != nil {
		if quote.Customer.Name != "" {
			custName = quote.Customer.Name
		}
		if quote.Customer.Company != nil && *quote.Customer.Company != "" {
			custCompany = *quote.Customer.Company
		}
		if quote.Customer.Address != nil && *quote.Customer.Address != "" {
			custAddr = *quote.Customer.Address
			if quote.Customer.City != nil && *quote.Customer.City != "" {
				custAddr += ", " + *quote.Customer.City
			}
		}
		if quote.Customer.State != nil && *quote.Customer.State != "" {
			custState = *quote.Customer.State
		}
		if quote.Customer.GSTIN != nil && *quote.Customer.GSTIN != "" {
			custGstin = *quote.Customer.GSTIN
		}
		var contacts []string
		if quote.Customer.Phone != nil && *quote.Customer.Phone != "" {
			contacts = append(contacts, *quote.Customer.Phone)
		}
		if quote.Customer.Email != nil && *quote.Customer.Email != "" {
			contacts = append(contacts, *quote.Customer.Email)
		}
		custContact = strings.Join(contacts, " | ")
	}
	if quote.CustomerState != nil && *quote.CustomerState != "" {
		custState = *quote.CustomerState
	}
	if quote.CustomerGSTIN != nil && *quote.CustomerGSTIN != "" {
		custGstin = *quote.CustomerGSTIN
	}

	// 1. HEADER SECTION (Brand Logo / Name + Document Title)
	hasLogo := len(logoBytes) > 0
	if hasLogo {
		ext := parseImageExtension(logoMime)
		m.AddRows(
			row.New(16).Add(
				col.New(4).Add(
					image.NewFromBytes(logoBytes, ext, props.Rect{Percent: 90, Center: false}),
				),
				col.New(8).Add(
					text.New("GST TAX QUOTATION", props.Text{
						Family: fontName,
						Style:  fontstyle.Bold,
						Size:   16,
						Align:  align.Right,
						Color:  ColorPrimaryTeal,
					}),
					text.New(fmt.Sprintf("Quotation #%s", quote.QuotationNumber), props.Text{
						Family: fontName,
						Style:  fontstyle.Bold,
						Size:   11,
						Align:  align.Right,
						Top:    6,
						Color:  ColorDarkSlate,
					}),
				),
			),
		)
	} else {
		m.AddRows(
			row.New(15).Add(
				col.New(6).Add(
					text.New(compName, props.Text{
						Family: fontName,
						Style:  fontstyle.Bold,
						Size:   15,
						Color:  ColorPrimaryTeal,
					}),
				),
				col.New(6).Add(
					text.New("GST TAX QUOTATION", props.Text{
						Family: fontName,
						Style:  fontstyle.Bold,
						Size:   15,
						Align:  align.Right,
						Color:  ColorPrimaryTeal,
					}),
					text.New(fmt.Sprintf("Quotation #%s", quote.QuotationNumber), props.Text{
						Family: fontName,
						Style:  fontstyle.Bold,
						Size:   11,
						Align:  align.Right,
						Top:    5.5,
						Color:  ColorDarkSlate,
					}),
				),
			),
		)
	}

	// Thin Divider Line
	m.AddRows(
		row.New(2).Add(
			col.New(12).Add(
				line.New(props.Line{Color: ColorPrimaryTeal, Thickness: 0.6}),
			),
		),
	)

	// Meta Details Sub-header (Date, Valid Until, Deal/Lead, Status, Place of Supply)
	dateStr := quote.CreatedAt.Format("02-Jan-2006")
	validUntilStr := "30 Days from issue"
	if quote.ValidUntil != nil {
		validUntilStr = quote.ValidUntil.Format("02-Jan-2006")
	}

	dealRef := "-"
	if quote.Deal != nil && quote.Deal.Name != "" {
		dealRef = quote.Deal.Name
	}
	leadRef := "-"
	if quote.LeadNumber != nil && *quote.LeadNumber != "" {
		leadRef = *quote.LeadNumber
	}

	posType := "Intra-State (CGST + SGST)"
	if quote.IsInterState {
		posType = "Inter-State (IGST)"
	}

	m.AddRows(
		row.New(12).Add(
			col.New(3).Add(
				text.New("DATE", props.Text{Family: fontName, Size: 7, Style: fontstyle.Bold, Color: ColorMutedSlate}),
				text.New(dateStr, props.Text{Family: fontName, Size: 9, Top: 3.5, Color: ColorDarkSlate}),
			),
			col.New(3).Add(
				text.New("VALID UNTIL", props.Text{Family: fontName, Size: 7, Style: fontstyle.Bold, Color: ColorMutedSlate}),
				text.New(validUntilStr, props.Text{Family: fontName, Size: 9, Top: 3.5, Color: ColorDarkSlate}),
			),
			col.New(3).Add(
				text.New("DEAL / LEAD REF", props.Text{Family: fontName, Size: 7, Style: fontstyle.Bold, Color: ColorMutedSlate}),
				text.New(fmt.Sprintf("%s (%s)", dealRef, leadRef), props.Text{Family: fontName, Size: 8.5, Top: 3.5, Color: ColorDarkSlate}),
			),
			col.New(3).Add(
				text.New("PLACE OF SUPPLY", props.Text{Family: fontName, Size: 7, Style: fontstyle.Bold, Color: ColorMutedSlate, Align: align.Right}),
				text.New(fmt.Sprintf("%s - %s", custState, posType), props.Text{Family: fontName, Size: 8, Top: 3.5, Color: ColorPrimaryTeal, Style: fontstyle.Bold, Align: align.Right}),
			),
		),
	)

	// 2. PARTY CARDS (Billed By vs Quotation To)
	cardStyle := &props.Cell{
		BackgroundColor: ColorCardBg,
		BorderColor:     ColorLightBorder,
		BorderType:      border.Full,
		BorderThickness: 0.3,
	}

	m.AddRows(
		row.New(26).Add(
			col.New(6).WithStyle(cardStyle).Add(
				text.New("ISSUED BY (ORGANIZATION)", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7.5, Top: 2, Left: 2, Color: ColorPrimaryTeal}),
				text.New(compName, props.Text{Family: fontName, Style: fontstyle.Bold, Size: 9.5, Top: 6, Left: 2, Color: ColorDarkSlate}),
				text.New(compAddr, props.Text{Family: fontName, Size: 7.5, Top: 10.5, Left: 2, Color: ColorMutedSlate}),
				text.New(fmt.Sprintf("State: %s  |  GSTIN: %s  |  PAN: %s", compState, compGstin, compPan), props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7.5, Top: 15, Left: 2, Color: ColorDarkSlate}),
				text.New(fmt.Sprintf("Contact: %s  |  %s", compPhone, compEmail), props.Text{Family: fontName, Size: 7, Top: 19.5, Left: 2, Color: ColorMutedSlate}),
			),
			col.New(6).WithStyle(cardStyle).Add(
				text.New("QUOTATION TO (CLIENT)", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7.5, Top: 2, Left: 2, Color: ColorPrimaryTeal}),
				text.New(custName, props.Text{Family: fontName, Style: fontstyle.Bold, Size: 9.5, Top: 6, Left: 2, Color: ColorDarkSlate}),
				text.New(fmt.Sprintf("%s (%s)", custCompany, custAddr), props.Text{Family: fontName, Size: 7.5, Top: 10.5, Left: 2, Color: ColorMutedSlate}),
				text.New(fmt.Sprintf("State: %s  |  GSTIN: %s", custState, custGstin), props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7.5, Top: 15, Left: 2, Color: ColorDarkSlate}),
				text.New(fmt.Sprintf("Contact: %s", custContact), props.Text{Family: fontName, Size: 7, Top: 19.5, Left: 2, Color: ColorMutedSlate}),
			),
		),
	)

	// Spacing before table
	m.AddRows(row.New(3).Add(col.New(12)))

	// 3. LINE ITEMS TABLE HEADER
	thStyle := &props.Cell{
		BackgroundColor: ColorHeaderBg,
		BorderColor:     ColorLightBorder,
		BorderType:      border.Full,
		BorderThickness: 0.3,
	}

	m.AddRows(
		row.New(6).Add(
			col.New(1).WithStyle(thStyle).Add(text.New("#", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7.5, Align: align.Center, Top: 1.5})),
			col.New(4).WithStyle(thStyle).Add(text.New("ITEM DESCRIPTION", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7.5, Left: 2, Top: 1.5})),
			col.New(1).WithStyle(thStyle).Add(text.New("HSN/SAC", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Align: align.Center, Top: 1.5})),
			col.New(1).WithStyle(thStyle).Add(text.New("QTY", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7.5, Align: align.Center, Top: 1.5})),
			col.New(2).WithStyle(thStyle).Add(text.New("UNIT PRICE", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7.5, Align: align.Right, Right: 2, Top: 1.5})),
			col.New(1).WithStyle(thStyle).Add(text.New("GST %", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7.5, Align: align.Center, Top: 1.5})),
			col.New(2).WithStyle(thStyle).Add(text.New("TOTAL", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7.5, Align: align.Right, Right: 2, Top: 1.5})),
		),
	)

	// 4. LINE ITEMS TABLE ROWS
	trBorder := &props.Cell{
		BorderColor:     ColorLightBorder,
		BorderType:      border.Full,
		BorderThickness: 0.2,
	}
	trZebra := &props.Cell{
		BackgroundColor: ColorCardBg,
		BorderColor:     ColorLightBorder,
		BorderType:      border.Full,
		BorderThickness: 0.2,
	}

	for idx, item := range quote.Items {
		cStyle := trBorder
		if idx%2 == 1 {
			cStyle = trZebra
		}
		hsn := "-"
		if item.HSNSAC != nil && *item.HSNSAC != "" {
			hsn = *item.HSNSAC
		}

		m.AddRows(
			row.New(6).Add(
				col.New(1).WithStyle(cStyle).Add(text.New(fmt.Sprintf("%d", idx+1), props.Text{Family: fontName, Size: 7.5, Align: align.Center, Top: 1.5})),
				col.New(4).WithStyle(cStyle).Add(text.New(item.ProductName, props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7.5, Left: 2, Top: 1.5, Color: ColorDarkSlate})),
				col.New(1).WithStyle(cStyle).Add(text.New(hsn, props.Text{Family: fontName, Size: 7, Align: align.Center, Top: 1.5, Color: ColorMutedSlate})),
				col.New(1).WithStyle(cStyle).Add(text.New(fmt.Sprintf("%.1f", item.Quantity), props.Text{Family: fontName, Size: 7.5, Align: align.Center, Top: 1.5})),
				col.New(2).WithStyle(cStyle).Add(text.New(formatCurrency(item.UnitPrice, quote.Currency, fontName), props.Text{Family: fontName, Size: 7.5, Align: align.Right, Right: 2, Top: 1.5})),
				col.New(1).WithStyle(cStyle).Add(text.New(fmt.Sprintf("%.0f%%", item.GSTRate), props.Text{Family: fontName, Size: 7.5, Align: align.Center, Top: 1.5})),
				col.New(2).WithStyle(cStyle).Add(text.New(formatCurrency(item.LineTotal, quote.Currency, fontName), props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7.5, Align: align.Right, Right: 2, Top: 1.5, Color: ColorDarkSlate})),
			),
		)
	}

	m.AddRows(row.New(3).Add(col.New(12)))

	// 5. TAX BREAKDOWN & TOTALS (Side-by-side or stacked)
	// Left side: GST Summary Table (6 cols)
	// Right side: Financial Totals Block (6 cols)
	taxTableBg := &props.Cell{
		BackgroundColor: ColorHeaderBg,
		BorderColor:     ColorLightBorder,
		BorderType:      border.Full,
		BorderThickness: 0.25,
	}

	m.AddRows(
		row.New(5).Add(
			col.New(6).WithStyle(taxTableBg).Add(
				text.New("STATUTORY GST TAX BREAKDOWN", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Left: 2, Top: 1, Color: ColorPrimaryTeal}),
			),
			col.New(6).WithStyle(taxTableBg).Add(
				text.New("FINANCIAL SUMMARY & TOTALS", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Left: 2, Top: 1, Color: ColorPrimaryTeal}),
			),
		),
	)

	// Detail lines
	taxableAmt := quote.TaxableAmount
	if taxableAmt == 0 {
		taxableAmt = quote.Subtotal - quote.DiscountAmount
	}

	gstRow1Left := fmt.Sprintf("Taxable Value: %s", formatCurrency(taxableAmt, quote.Currency, fontName))
	gstRow2Left := ""
	gstRow3Left := ""

	if quote.IsInterState {
		gstRow2Left = fmt.Sprintf("IGST: %s", formatCurrency(quote.IGSTAmount, quote.Currency, fontName))
		gstRow3Left = fmt.Sprintf("Total Tax: %s", formatCurrency(quote.TotalGSTAmount, quote.Currency, fontName))
	} else {
		gstRow2Left = fmt.Sprintf("CGST: %s  |  SGST: %s", formatCurrency(quote.CGSTAmount, quote.Currency, fontName), formatCurrency(quote.SGSTAmount, quote.Currency, fontName))
		gstRow3Left = fmt.Sprintf("Total Tax: %s", formatCurrency(quote.TotalGSTAmount, quote.Currency, fontName))
	}

	m.AddRows(
		row.New(5).Add(
			col.New(6).WithStyle(trBorder).Add(
				text.New(gstRow1Left, props.Text{Family: fontName, Size: 7.5, Left: 2, Top: 1.2, Color: ColorDarkSlate}),
			),
			col.New(3).WithStyle(trBorder).Add(
				text.New("Subtotal", props.Text{Family: fontName, Size: 7.5, Left: 2, Top: 1.2, Color: ColorMutedSlate}),
			),
			col.New(3).WithStyle(trBorder).Add(
				text.New(formatCurrency(quote.Subtotal, quote.Currency, fontName), props.Text{Family: fontName, Size: 7.5, Align: align.Right, Right: 2, Top: 1.2, Color: ColorDarkSlate}),
			),
		),
		row.New(5).Add(
			col.New(6).WithStyle(trBorder).Add(
				text.New(gstRow2Left, props.Text{Family: fontName, Size: 7.5, Left: 2, Top: 1.2, Color: ColorDarkSlate}),
			),
			col.New(3).WithStyle(trBorder).Add(
				text.New("Taxable Amount", props.Text{Family: fontName, Size: 7.5, Left: 2, Top: 1.2, Color: ColorMutedSlate}),
			),
			col.New(3).WithStyle(trBorder).Add(
				text.New(formatCurrency(taxableAmt, quote.Currency, fontName), props.Text{Family: fontName, Size: 7.5, Align: align.Right, Right: 2, Top: 1.2, Color: ColorDarkSlate}),
			),
		),
		row.New(5).Add(
			col.New(6).WithStyle(trBorder).Add(
				text.New(gstRow3Left, props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7.5, Left: 2, Top: 1.2, Color: ColorDarkSlate}),
			),
			col.New(3).WithStyle(trBorder).Add(
				text.New("Total GST Tax", props.Text{Family: fontName, Size: 7.5, Left: 2, Top: 1.2, Color: ColorMutedSlate}),
			),
			col.New(3).WithStyle(trBorder).Add(
				text.New(formatCurrency(quote.TotalGSTAmount, quote.Currency, fontName), props.Text{Family: fontName, Size: 7.5, Align: align.Right, Right: 2, Top: 1.2, Color: ColorDarkSlate}),
			),
		),
	)

	// Round off if present
	if quote.RoundOffAmount != 0 {
		m.AddRows(
			row.New(5).Add(
				col.New(6).WithStyle(trBorder).Add(text.New("", props.Text{})),
				col.New(3).WithStyle(trBorder).Add(
					text.New("Round Off", props.Text{Family: fontName, Size: 7.5, Left: 2, Top: 1.2, Color: ColorMutedSlate}),
				),
				col.New(3).WithStyle(trBorder).Add(
					text.New(formatCurrency(quote.RoundOffAmount, quote.Currency, fontName), props.Text{Family: fontName, Size: 7.5, Align: align.Right, Right: 2, Top: 1.2, Color: ColorDarkSlate}),
				),
			),
		)
	}

	// Grand Total Highlighted Row
	grandTotalStyle := &props.Cell{
		BackgroundColor: ColorHeaderBg,
		BorderColor:     ColorPrimaryTeal,
		BorderType:      border.Full,
		BorderThickness: 0.4,
	}

	m.AddRows(
		row.New(7).Add(
			col.New(6).WithStyle(grandTotalStyle).Add(
				text.New("Terms: Prices valid for 30 days. Delivery as agreed.", props.Text{Family: fontName, Size: 7, Style: fontstyle.Italic, Left: 2, Top: 2, Color: ColorMutedSlate}),
			),
			col.New(3).WithStyle(grandTotalStyle).Add(
				text.New("GRAND TOTAL", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 8.5, Left: 2, Top: 2, Color: ColorDarkSlate}),
			),
			col.New(3).WithStyle(grandTotalStyle).Add(
				text.New(formatCurrency(quote.TotalAmount, quote.Currency, fontName), props.Text{Family: fontName, Style: fontstyle.Bold, Size: 10, Align: align.Right, Right: 2, Top: 1.5, Color: ColorPrimaryTeal}),
			),
		),
	)

	m.AddRows(row.New(3).Add(col.New(12)))

	// 6. BANK DETAILS & TERMS & SIGNATORY
	termsStr := "1. Payment terms: 50% advance upon PO, balance before delivery.\n2. GST will be charged at prevailing government rates.\n3. Goods/services once supplied cannot be returned."
	if quote.TermsAndConditions != nil && *quote.TermsAndConditions != "" {
		termsStr = *quote.TermsAndConditions
	}

	m.AddRows(
		row.New(20).Add(
			col.New(4).WithStyle(cardStyle).Add(
				text.New("BANK & PAYMENT DETAILS", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Top: 2, Left: 2, Color: ColorPrimaryTeal}),
				text.New("Bank: HDFC Bank Ltd.", props.Text{Family: fontName, Size: 7, Top: 5.5, Left: 2, Color: ColorDarkSlate}),
				text.New("A/C No: 50200012345678", props.Text{Family: fontName, Size: 7, Top: 9, Left: 2, Color: ColorDarkSlate}),
				text.New("IFSC Code: HDFC0001234", props.Text{Family: fontName, Size: 7, Top: 12.5, Left: 2, Color: ColorDarkSlate}),
				text.New("Branch: Cyber City Branch, Pune", props.Text{Family: fontName, Size: 7, Top: 16, Left: 2, Color: ColorMutedSlate}),
			),
			col.New(5).WithStyle(cardStyle).Add(
				text.New("TERMS & CONDITIONS", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Top: 2, Left: 2, Color: ColorPrimaryTeal}),
				text.New(termsStr, props.Text{Family: fontName, Size: 6.5, Top: 5.5, Left: 2, Color: ColorMutedSlate}),
			),
			col.New(3).WithStyle(cardStyle).Add(
				text.New("FOR "+compName, props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Align: align.Center, Top: 2, Color: ColorDarkSlate}),
				text.New("Authorized Signatory", props.Text{Family: fontName, Size: 7, Align: align.Center, Top: 15, Color: ColorMutedSlate}),
			),
		),
	)

	// Document Generation
	doc, err := m.Generate()
	if err != nil {
		return nil, fmt.Errorf("failed to generate quotation PDF: %w", err)
	}

	return doc.GetBytes(), nil
}

// =========================================================================
// INVOICE PDF GENERATOR
// =========================================================================

func GenerateInvoicePDF(inv *models.Invoice, comp *models.CompanyProfile, logoBytes []byte, logoMime string) ([]byte, error) {
	if inv == nil {
		return nil, fmt.Errorf("invoice cannot be nil")
	}

	m, fontName := buildMarotoInstance()

	compName := "CRM Enterprise Solutions"
	compAddr := "101 Cyber City, Tech Park, Pune 411001"
	compGstin := "27AAACB2233M1Z2"
	compPan := "AAACB2233M"
	compState := "Maharashtra"
	compEmail := "billing@bizcopilot.com"
	compPhone := "+91 98765 43210"

	if inv.CompanyName != nil && *inv.CompanyName != "" {
		compName = *inv.CompanyName
	} else if comp != nil && comp.CompanyName != "" {
		compName = comp.CompanyName
	}

	if inv.CompanyAddress != nil && *inv.CompanyAddress != "" {
		compAddr = *inv.CompanyAddress
	} else if comp != nil && comp.Address != "" {
		compAddr = fmt.Sprintf("%s, %s %s", comp.Address, comp.City, comp.Pincode)
	}

	if inv.CompanyGSTIN != nil && *inv.CompanyGSTIN != "" {
		compGstin = *inv.CompanyGSTIN
	} else if comp != nil && comp.GSTNumber != "" {
		compGstin = comp.GSTNumber
	}

	if inv.CompanyPAN != nil && *inv.CompanyPAN != "" {
		compPan = *inv.CompanyPAN
	} else if comp != nil && comp.PANNumber != "" {
		compPan = comp.PANNumber
	}

	if inv.CompanyState != nil && *inv.CompanyState != "" {
		compState = *inv.CompanyState
	} else if comp != nil && comp.State != "" {
		compState = comp.State
	}

	if comp != nil {
		if comp.Email != "" {
			compEmail = comp.Email
		}
		if comp.Phone != "" {
			compPhone = comp.Phone
		}
	}

	// Customer Info
	custName := "Valued Customer"
	custCompany := ""
	custAddr := "Registered Address"
	custState := "Maharashtra"
	custGstin := "Unregistered"
	custContact := ""

	if inv.Customer != nil {
		if inv.Customer.Name != "" {
			custName = inv.Customer.Name
		}
		if inv.Customer.Company != nil && *inv.Customer.Company != "" {
			custCompany = *inv.Customer.Company
		}
		if inv.Customer.Address != nil && *inv.Customer.Address != "" {
			custAddr = *inv.Customer.Address
			if inv.Customer.City != nil && *inv.Customer.City != "" {
				custAddr += ", " + *inv.Customer.City
			}
		}
		if inv.Customer.State != nil && *inv.Customer.State != "" {
			custState = *inv.Customer.State
		}
		if inv.Customer.GSTIN != nil && *inv.Customer.GSTIN != "" {
			custGstin = *inv.Customer.GSTIN
		}
		var contacts []string
		if inv.Customer.Phone != nil && *inv.Customer.Phone != "" {
			contacts = append(contacts, *inv.Customer.Phone)
		}
		if inv.Customer.Email != nil && *inv.Customer.Email != "" {
			contacts = append(contacts, *inv.Customer.Email)
		}
		custContact = strings.Join(contacts, " | ")
	}
	if inv.CustomerState != nil && *inv.CustomerState != "" {
		custState = *inv.CustomerState
	}
	if inv.CustomerGSTIN != nil && *inv.CustomerGSTIN != "" {
		custGstin = *inv.CustomerGSTIN
	}

	// 1. HEADER SECTION (Logo + Title)
	hasLogo := len(logoBytes) > 0
	if hasLogo {
		ext := parseImageExtension(logoMime)
		m.AddRows(
			row.New(16).Add(
				col.New(4).Add(
					image.NewFromBytes(logoBytes, ext, props.Rect{Percent: 90, Center: false}),
				),
				col.New(8).Add(
					text.New("TAX INVOICE", props.Text{
						Family: fontName,
						Style:  fontstyle.Bold,
						Size:   16,
						Align:  align.Right,
						Color:  ColorPrimaryTeal,
					}),
					text.New(fmt.Sprintf("Invoice #%s", inv.InvoiceNumber), props.Text{
						Family: fontName,
						Style:  fontstyle.Bold,
						Size:   11,
						Align:  align.Right,
						Top:    6,
						Color:  ColorDarkSlate,
					}),
				),
			),
		)
	} else {
		m.AddRows(
			row.New(15).Add(
				col.New(6).Add(
					text.New(compName, props.Text{
						Family: fontName,
						Style:  fontstyle.Bold,
						Size:   15,
						Color:  ColorPrimaryTeal,
					}),
				),
				col.New(6).Add(
					text.New("TAX INVOICE", props.Text{
						Family: fontName,
						Style:  fontstyle.Bold,
						Size:   15,
						Align:  align.Right,
						Color:  ColorPrimaryTeal,
					}),
					text.New(fmt.Sprintf("Invoice #%s", inv.InvoiceNumber), props.Text{
						Family: fontName,
						Style:  fontstyle.Bold,
						Size:   11,
						Align:  align.Right,
						Top:    5.5,
						Color:  ColorDarkSlate,
					}),
				),
			),
		)
	}

	// Thin Divider Line
	m.AddRows(
		row.New(2).Add(
			col.New(12).Add(
				line.New(props.Line{Color: ColorPrimaryTeal, Thickness: 0.6}),
			),
		),
	)

	// Meta Details (Invoice Date, Due Date, Status Badge, Place of Supply)
	dateStr := inv.InvoiceDate.Format("02-Jan-2006")
	dueDateStr := "-"
	if inv.DueDate != nil {
		dueDateStr = inv.DueDate.Format("02-Jan-2006")
	}

	posType := "Intra-State (CGST + SGST)"
	if inv.IsInterState {
		posType = "Inter-State (IGST)"
	}

	statusColor := ColorPrimaryTeal
	statusText := strings.ToUpper(inv.Status)
	if strings.EqualFold(inv.Status, "paid") {
		statusColor = ColorBadgePaid
	} else if strings.EqualFold(inv.Status, "overdue") {
		statusColor = ColorBadgeOverdue
	} else if strings.EqualFold(inv.Status, "partially_paid") || strings.EqualFold(inv.Status, "partially paid") {
		statusColor = ColorBadgePending
		statusText = "PARTIALLY PAID"
	}

	m.AddRows(
		row.New(12).Add(
			col.New(3).Add(
				text.New("INVOICE DATE", props.Text{Family: fontName, Size: 7, Style: fontstyle.Bold, Color: ColorMutedSlate}),
				text.New(dateStr, props.Text{Family: fontName, Size: 9, Top: 3.5, Color: ColorDarkSlate}),
			),
			col.New(3).Add(
				text.New("PAYMENT DUE DATE", props.Text{Family: fontName, Size: 7, Style: fontstyle.Bold, Color: ColorMutedSlate}),
				text.New(dueDateStr, props.Text{Family: fontName, Size: 9, Top: 3.5, Color: ColorDarkSlate}),
			),
			col.New(3).Add(
				text.New("PAYMENT STATUS", props.Text{Family: fontName, Size: 7, Style: fontstyle.Bold, Color: ColorMutedSlate}),
				text.New(statusText, props.Text{Family: fontName, Size: 9, Top: 3.5, Style: fontstyle.Bold, Color: statusColor}),
			),
			col.New(3).Add(
				text.New("PLACE OF SUPPLY", props.Text{Family: fontName, Size: 7, Style: fontstyle.Bold, Color: ColorMutedSlate, Align: align.Right}),
				text.New(fmt.Sprintf("%s - %s", custState, posType), props.Text{Family: fontName, Size: 8, Top: 3.5, Color: ColorPrimaryTeal, Style: fontstyle.Bold, Align: align.Right}),
			),
		),
	)

	// 2. PARTY CARDS (Billed By vs Billed To)
	cardStyle := &props.Cell{
		BackgroundColor: ColorCardBg,
		BorderColor:     ColorLightBorder,
		BorderType:      border.Full,
		BorderThickness: 0.3,
	}

	m.AddRows(
		row.New(26).Add(
			col.New(6).WithStyle(cardStyle).Add(
				text.New("BILLED BY (SUPPLIER)", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7.5, Top: 2, Left: 2, Color: ColorPrimaryTeal}),
				text.New(compName, props.Text{Family: fontName, Style: fontstyle.Bold, Size: 9.5, Top: 6, Left: 2, Color: ColorDarkSlate}),
				text.New(compAddr, props.Text{Family: fontName, Size: 7.5, Top: 10.5, Left: 2, Color: ColorMutedSlate}),
				text.New(fmt.Sprintf("State: %s  |  GSTIN: %s  |  PAN: %s", compState, compGstin, compPan), props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7.5, Top: 15, Left: 2, Color: ColorDarkSlate}),
				text.New(fmt.Sprintf("Contact: %s  |  %s", compPhone, compEmail), props.Text{Family: fontName, Size: 7, Top: 19.5, Left: 2, Color: ColorMutedSlate}),
			),
			col.New(6).WithStyle(cardStyle).Add(
				text.New("BILLED TO (RECIPIENT)", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7.5, Top: 2, Left: 2, Color: ColorPrimaryTeal}),
				text.New(custName, props.Text{Family: fontName, Style: fontstyle.Bold, Size: 9.5, Top: 6, Left: 2, Color: ColorDarkSlate}),
				text.New(fmt.Sprintf("%s (%s)", custCompany, custAddr), props.Text{Family: fontName, Size: 7.5, Top: 10.5, Left: 2, Color: ColorMutedSlate}),
				text.New(fmt.Sprintf("State: %s  |  GSTIN: %s", custState, custGstin), props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7.5, Top: 15, Left: 2, Color: ColorDarkSlate}),
				text.New(fmt.Sprintf("Contact: %s", custContact), props.Text{Family: fontName, Size: 7, Top: 19.5, Left: 2, Color: ColorMutedSlate}),
			),
		),
	)

	m.AddRows(row.New(3).Add(col.New(12)))

	// 3. INVOICE LINE ITEMS TABLE HEADER
	thStyle := &props.Cell{
		BackgroundColor: ColorHeaderBg,
		BorderColor:     ColorLightBorder,
		BorderType:      border.Full,
		BorderThickness: 0.3,
	}

	m.AddRows(
		row.New(6).Add(
			col.New(1).WithStyle(thStyle).Add(text.New("#", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7.5, Align: align.Center, Top: 1.5})),
			col.New(4).WithStyle(thStyle).Add(text.New("ITEM DESCRIPTION", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7.5, Left: 2, Top: 1.5})),
			col.New(1).WithStyle(thStyle).Add(text.New("HSN/SAC", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Align: align.Center, Top: 1.5})),
			col.New(1).WithStyle(thStyle).Add(text.New("QTY", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7.5, Align: align.Center, Top: 1.5})),
			col.New(2).WithStyle(thStyle).Add(text.New("UNIT PRICE", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7.5, Align: align.Right, Right: 2, Top: 1.5})),
			col.New(1).WithStyle(thStyle).Add(text.New("GST %", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7.5, Align: align.Center, Top: 1.5})),
			col.New(2).WithStyle(thStyle).Add(text.New("TOTAL", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7.5, Align: align.Right, Right: 2, Top: 1.5})),
		),
	)

	// 4. LINE ITEMS TABLE ROWS
	trBorder := &props.Cell{
		BorderColor:     ColorLightBorder,
		BorderType:      border.Full,
		BorderThickness: 0.2,
	}
	trZebra := &props.Cell{
		BackgroundColor: ColorCardBg,
		BorderColor:     ColorLightBorder,
		BorderType:      border.Full,
		BorderThickness: 0.2,
	}

	for idx, item := range inv.Items {
		cStyle := trBorder
		if idx%2 == 1 {
			cStyle = trZebra
		}
		hsn := "-"
		if item.HSNSAC != nil && *item.HSNSAC != "" {
			hsn = *item.HSNSAC
		}

		itemName := item.ProductName
		if itemName == "" {
			itemName = item.Name
		}

		lineTotal := item.LineTotal
		if lineTotal == 0 && item.TotalAmount != 0 {
			lineTotal = item.TotalAmount
		}

		gstRate := item.GSTRate
		if gstRate == 0 {
			gstRate = item.CGSTRate + item.SGSTRate + item.IGSTRate
		}

		m.AddRows(
			row.New(6).Add(
				col.New(1).WithStyle(cStyle).Add(text.New(fmt.Sprintf("%d", idx+1), props.Text{Family: fontName, Size: 7.5, Align: align.Center, Top: 1.5})),
				col.New(4).WithStyle(cStyle).Add(text.New(itemName, props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7.5, Left: 2, Top: 1.5, Color: ColorDarkSlate})),
				col.New(1).WithStyle(cStyle).Add(text.New(hsn, props.Text{Family: fontName, Size: 7, Align: align.Center, Top: 1.5, Color: ColorMutedSlate})),
				col.New(1).WithStyle(cStyle).Add(text.New(fmt.Sprintf("%.1f", item.Quantity), props.Text{Family: fontName, Size: 7.5, Align: align.Center, Top: 1.5})),
				col.New(2).WithStyle(cStyle).Add(text.New(formatCurrency(item.UnitPrice, inv.Currency, fontName), props.Text{Family: fontName, Size: 7.5, Align: align.Right, Right: 2, Top: 1.5})),
				col.New(1).WithStyle(cStyle).Add(text.New(fmt.Sprintf("%.0f%%", gstRate), props.Text{Family: fontName, Size: 7.5, Align: align.Center, Top: 1.5})),
				col.New(2).WithStyle(cStyle).Add(text.New(formatCurrency(lineTotal, inv.Currency, fontName), props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7.5, Align: align.Right, Right: 2, Top: 1.5, Color: ColorDarkSlate})),
			),
		)
	}

	m.AddRows(row.New(3).Add(col.New(12)))

	// 5. TAX BREAKDOWN & FINANCIAL TOTALS
	taxTableBg := &props.Cell{
		BackgroundColor: ColorHeaderBg,
		BorderColor:     ColorLightBorder,
		BorderType:      border.Full,
		BorderThickness: 0.25,
	}

	m.AddRows(
		row.New(5).Add(
			col.New(6).WithStyle(taxTableBg).Add(
				text.New("STATUTORY GST TAX BREAKDOWN", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Left: 2, Top: 1, Color: ColorPrimaryTeal}),
			),
			col.New(6).WithStyle(taxTableBg).Add(
				text.New("INVOICE SUMMARY & BALANCES", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Left: 2, Top: 1, Color: ColorPrimaryTeal}),
			),
		),
	)

	taxableAmt := inv.TaxableAmount
	if taxableAmt == 0 {
		taxableAmt = inv.Subtotal - inv.DiscountAmount
	}

	gstRow1Left := fmt.Sprintf("Taxable Value: %s", formatCurrency(taxableAmt, inv.Currency, fontName))
	gstRow2Left := ""
	gstRow3Left := ""

	if inv.IsInterState {
		gstRow2Left = fmt.Sprintf("IGST: %s", formatCurrency(inv.IGSTAmount, inv.Currency, fontName))
		gstRow3Left = fmt.Sprintf("Total Tax: %s", formatCurrency(inv.TotalTax, inv.Currency, fontName))
	} else {
		gstRow2Left = fmt.Sprintf("CGST: %s  |  SGST: %s", formatCurrency(inv.CGSTAmount, inv.Currency, fontName), formatCurrency(inv.SGSTAmount, inv.Currency, fontName))
		gstRow3Left = fmt.Sprintf("Total Tax: %s", formatCurrency(inv.TotalTax, inv.Currency, fontName))
	}

	m.AddRows(
		row.New(5).Add(
			col.New(6).WithStyle(trBorder).Add(
				text.New(gstRow1Left, props.Text{Family: fontName, Size: 7.5, Left: 2, Top: 1.2, Color: ColorDarkSlate}),
			),
			col.New(3).WithStyle(trBorder).Add(
				text.New("Taxable Amount", props.Text{Family: fontName, Size: 7.5, Left: 2, Top: 1.2, Color: ColorMutedSlate}),
			),
			col.New(3).WithStyle(trBorder).Add(
				text.New(formatCurrency(taxableAmt, inv.Currency, fontName), props.Text{Family: fontName, Size: 7.5, Align: align.Right, Right: 2, Top: 1.2, Color: ColorDarkSlate}),
			),
		),
		row.New(5).Add(
			col.New(6).WithStyle(trBorder).Add(
				text.New(gstRow2Left, props.Text{Family: fontName, Size: 7.5, Left: 2, Top: 1.2, Color: ColorDarkSlate}),
			),
			col.New(3).WithStyle(trBorder).Add(
				text.New("Total GST Tax", props.Text{Family: fontName, Size: 7.5, Left: 2, Top: 1.2, Color: ColorMutedSlate}),
			),
			col.New(3).WithStyle(trBorder).Add(
				text.New(formatCurrency(inv.TotalTax, inv.Currency, fontName), props.Text{Family: fontName, Size: 7.5, Align: align.Right, Right: 2, Top: 1.2, Color: ColorDarkSlate}),
			),
		),
		row.New(5).Add(
			col.New(6).WithStyle(trBorder).Add(
				text.New(gstRow3Left, props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7.5, Left: 2, Top: 1.2, Color: ColorDarkSlate}),
			),
			col.New(3).WithStyle(trBorder).Add(
				text.New("Grand Total", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 8, Left: 2, Top: 1.2, Color: ColorDarkSlate}),
			),
			col.New(3).WithStyle(trBorder).Add(
				text.New(formatCurrency(inv.GrandTotal, inv.Currency, fontName), props.Text{Family: fontName, Style: fontstyle.Bold, Size: 8.5, Align: align.Right, Right: 2, Top: 1.2, Color: ColorPrimaryTeal}),
			),
		),
		row.New(5).Add(
			col.New(6).WithStyle(trBorder).Add(
				text.New(fmt.Sprintf("Amount Paid: %s", formatCurrency(inv.AmountPaid, inv.Currency, fontName)), props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7.5, Left: 2, Top: 1.2, Color: ColorBadgePaid}),
			),
			col.New(3).WithStyle(trBorder).Add(
				text.New("Amount Paid", props.Text{Family: fontName, Size: 7.5, Left: 2, Top: 1.2, Color: ColorMutedSlate}),
			),
			col.New(3).WithStyle(trBorder).Add(
				text.New(formatCurrency(inv.AmountPaid, inv.Currency, fontName), props.Text{Family: fontName, Size: 7.5, Align: align.Right, Right: 2, Top: 1.2, Color: ColorBadgePaid}),
			),
		),
	)

	grandTotalStyle := &props.Cell{
		BackgroundColor: ColorHeaderBg,
		BorderColor:     ColorPrimaryTeal,
		BorderType:      border.Full,
		BorderThickness: 0.4,
	}

	m.AddRows(
		row.New(6).Add(
			col.New(6).WithStyle(grandTotalStyle).Add(
				text.New(fmt.Sprintf("Balance Due: %s", formatCurrency(inv.RemainingBalance, inv.Currency, fontName)), props.Text{Family: fontName, Style: fontstyle.Bold, Size: 8.5, Left: 2, Top: 1.5, Color: ColorBadgeOverdue}),
			),
			col.New(3).WithStyle(grandTotalStyle).Add(
				text.New("BALANCE DUE", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 8.5, Left: 2, Top: 1.5, Color: ColorDarkSlate}),
			),
			col.New(3).WithStyle(grandTotalStyle).Add(
				text.New(formatCurrency(inv.RemainingBalance, inv.Currency, fontName), props.Text{Family: fontName, Style: fontstyle.Bold, Size: 9.5, Align: align.Right, Right: 2, Top: 1.5, Color: ColorBadgeOverdue}),
			),
		),
	)

	// 6. PAYMENTS MINI-LEDGER (If payments recorded)
	if len(inv.Payments) > 0 {
		m.AddRows(row.New(2).Add(col.New(12)))
		m.AddRows(
			row.New(5).Add(
				col.New(12).WithStyle(taxTableBg).Add(
					text.New("RECORDED PAYMENTS AUDIT TRAIL", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Left: 2, Top: 1, Color: ColorPrimaryTeal}),
				),
			),
			row.New(5).Add(
				col.New(3).WithStyle(thStyle).Add(text.New("DATE", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Left: 2, Top: 1})),
				col.New(3).WithStyle(thStyle).Add(text.New("METHOD", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Left: 2, Top: 1})),
				col.New(3).WithStyle(thStyle).Add(text.New("REFERENCE #", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Left: 2, Top: 1})),
				col.New(3).WithStyle(thStyle).Add(text.New("AMOUNT PAID", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Align: align.Right, Right: 2, Top: 1})),
			),
		)

		for _, p := range inv.Payments {
			ref := "-"
			if p.ReferenceNumber != nil && *p.ReferenceNumber != "" {
				ref = *p.ReferenceNumber
			}
			m.AddRows(
				row.New(5).Add(
					col.New(3).WithStyle(trBorder).Add(text.New(p.PaymentDate.Format("02-Jan-2006"), props.Text{Family: fontName, Size: 7, Left: 2, Top: 1.2, Color: ColorDarkSlate})),
					col.New(3).WithStyle(trBorder).Add(text.New(strings.ToUpper(p.PaymentMethod), props.Text{Family: fontName, Size: 7, Left: 2, Top: 1.2, Color: ColorDarkSlate})),
					col.New(3).WithStyle(trBorder).Add(text.New(ref, props.Text{Family: fontName, Size: 7, Left: 2, Top: 1.2, Color: ColorMutedSlate})),
					col.New(3).WithStyle(trBorder).Add(text.New(formatCurrency(p.Amount, inv.Currency, fontName), props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Align: align.Right, Right: 2, Top: 1.2, Color: ColorBadgePaid})),
				),
			)
		}
	}

	m.AddRows(row.New(3).Add(col.New(12)))

	// 7. BANK DETAILS & TERMS & SIGNATORY
	termsStr := "1. Please pay by the due date to avoid service interruption.\n2. Remit payments via NEFT/RTGS to the bank account listed.\n3. Include the invoice number in the payment reference."
	if inv.TermsAndConditions != nil && *inv.TermsAndConditions != "" {
		termsStr = *inv.TermsAndConditions
	}

	m.AddRows(
		row.New(20).Add(
			col.New(4).WithStyle(cardStyle).Add(
				text.New("BANK & PAYMENT DETAILS", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Top: 2, Left: 2, Color: ColorPrimaryTeal}),
				text.New("Bank: HDFC Bank Ltd.", props.Text{Family: fontName, Size: 7, Top: 5.5, Left: 2, Color: ColorDarkSlate}),
				text.New("A/C No: 50200012345678", props.Text{Family: fontName, Size: 7, Top: 9, Left: 2, Color: ColorDarkSlate}),
				text.New("IFSC Code: HDFC0001234", props.Text{Family: fontName, Size: 7, Top: 12.5, Left: 2, Color: ColorDarkSlate}),
				text.New("Branch: Cyber City Branch, Pune", props.Text{Family: fontName, Size: 7, Top: 16, Left: 2, Color: ColorMutedSlate}),
			),
			col.New(5).WithStyle(cardStyle).Add(
				text.New("PAYMENT INSTRUCTIONS", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Top: 2, Left: 2, Color: ColorPrimaryTeal}),
				text.New(termsStr, props.Text{Family: fontName, Size: 6.5, Top: 5.5, Left: 2, Color: ColorMutedSlate}),
			),
			col.New(3).WithStyle(cardStyle).Add(
				text.New("FOR "+compName, props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Align: align.Center, Top: 2, Color: ColorDarkSlate}),
				text.New("Authorized Signatory", props.Text{Family: fontName, Size: 7, Align: align.Center, Top: 15, Color: ColorMutedSlate}),
			),
		),
	)

	doc, err := m.Generate()
	if err != nil {
		return nil, fmt.Errorf("failed to generate invoice PDF: %w", err)
	}

	return doc.GetBytes(), nil
}
