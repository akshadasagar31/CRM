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

// Brand Palette - Minimalist Corporate (White, Navy & Teal)
var (
	ColorNavyText      = &props.Color{Red: 15, Green: 23, Blue: 42}    // #0F172A - Deep Navy Primary Text & Titles
	ColorDarkSlate     = ColorNavyText                                 // Backward compatibility alias
	ColorNavySecondary = &props.Color{Red: 71, Green: 85, Blue: 105}   // #475569 - Muted Slate Secondary Text
	ColorMutedSlate    = ColorNavySecondary                            // Backward compatibility alias
	ColorPrimaryTeal   = &props.Color{Red: 13, Green: 148, Blue: 136}  // #0D9488 - Vibrant Teal Accent
	ColorTealLight     = &props.Color{Red: 240, Green: 253, Blue: 250} // #F0FDFA - Ice Teal Fill
	ColorTealBorder    = &props.Color{Red: 153, Green: 246, Blue: 228} // #99F6E4 - Soft Teal Border
	ColorLightBorder   = &props.Color{Red: 226, Green: 232, Blue: 240} // #E2E8F0 - Subtle Slate Divider
	ColorCardBg        = &props.Color{Red: 248, Green: 250, Blue: 252} // #F8FAFC - Soft Off-White / Card Fill
	ColorWhite         = &props.Color{Red: 255, Green: 255, Blue: 255}
	ColorBadgePaid     = &props.Color{Red: 16, Green: 185, Blue: 129}  // #10B981 - Green
	ColorBadgeOverdue  = &props.Color{Red: 239, Green: 68, Blue: 68}   // #EF4444 - Red
	ColorBadgePending  = &props.Color{Red: 245, Green: 158, Blue: 11}  // #F59E0B - Amber
	ColorHeaderBg      = &props.Color{Red: 248, Green: 250, Blue: 252} // #F8FAFC - Table Header Fill
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

func NumberToWordsINR(val float64) string {
	if val < 0 {
		val = -val
	}
	intPart := int64(val)
	paise := int64((val - float64(intPart))*100 + 0.5)

	if intPart == 0 && paise == 0 {
		return "Zero Rupees Only"
	}

	units := []string{"", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
		"Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"}
	tens := []string{"", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"}

	var convertLessThanThousand func(n int64) string
	convertLessThanThousand = func(n int64) string {
		var res string
		if n >= 100 {
			res += units[n/100] + " Hundred"
			n %= 100
			if n > 0 {
				res += " "
			}
		}
		if n >= 20 {
			res += tens[n/10]
			n %= 10
			if n > 0 {
				res += " " + units[n]
			}
		} else if n > 0 {
			res += units[n]
		}
		return res
	}

	var res string
	crore := intPart / 10000000
	intPart %= 10000000
	lakh := intPart / 100000
	intPart %= 100000
	thousand := intPart / 1000
	intPart %= 1000
	rem := intPart

	if crore > 0 {
		res += convertLessThanThousand(crore) + " Crore "
	}
	if lakh > 0 {
		res += convertLessThanThousand(lakh) + " Lakh "
	}
	if thousand > 0 {
		res += convertLessThanThousand(thousand) + " Thousand "
	}
	if rem > 0 {
		res += convertLessThanThousand(rem) + " "
	}

	res = strings.TrimSpace(res)
	if res == "" {
		res = "Zero"
	}
	res += " Rupees"

	if paise > 0 {
		paiseStr := convertLessThanThousand(paise)
		res += " and " + strings.TrimSpace(paiseStr) + " Paise"
	}

	return res + " Only"
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
					text.New("COMMERCIAL QUOTATION", props.Text{
						Family: fontName,
						Style:  fontstyle.Bold,
						Size:   14,
						Align:  align.Right,
						Color:  ColorNavyText,
					}),
					text.New(fmt.Sprintf("Quotation #%s", quote.QuotationNumber), props.Text{
						Family: fontName,
						Style:  fontstyle.Bold,
						Size:   10,
						Align:  align.Right,
						Top:    5.5,
						Color:  ColorPrimaryTeal,
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
						Size:   14,
						Color:  ColorNavyText,
					}),
				),
				col.New(6).Add(
					text.New("COMMERCIAL QUOTATION", props.Text{
						Family: fontName,
						Style:  fontstyle.Bold,
						Size:   14,
						Align:  align.Right,
						Color:  ColorNavyText,
					}),
					text.New(fmt.Sprintf("Quotation #%s", quote.QuotationNumber), props.Text{
						Family: fontName,
						Style:  fontstyle.Bold,
						Size:   10,
						Align:  align.Right,
						Top:    5.5,
						Color:  ColorPrimaryTeal,
					}),
				),
			),
		)
	}

	// Thin Teal Divider Line
	m.AddRows(
		row.New(2).Add(
			col.New(12).Add(
				line.New(props.Line{Color: ColorPrimaryTeal, Thickness: 0.8}),
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
				text.New("DATE", props.Text{Family: fontName, Size: 6.5, Style: fontstyle.Bold, Color: ColorNavySecondary}),
				text.New(dateStr, props.Text{Family: fontName, Size: 8.5, Top: 3.5, Color: ColorNavyText}),
			),
			col.New(3).Add(
				text.New("VALID UNTIL", props.Text{Family: fontName, Size: 6.5, Style: fontstyle.Bold, Color: ColorNavySecondary}),
				text.New(validUntilStr, props.Text{Family: fontName, Size: 8.5, Top: 3.5, Color: ColorNavyText}),
			),
			col.New(3).Add(
				text.New("DEAL / LEAD REF", props.Text{Family: fontName, Size: 6.5, Style: fontstyle.Bold, Color: ColorNavySecondary}),
				text.New(fmt.Sprintf("%s (%s)", dealRef, leadRef), props.Text{Family: fontName, Size: 8.5, Top: 3.5, Color: ColorNavyText}),
			),
			col.New(3).Add(
				text.New("PLACE OF SUPPLY", props.Text{Family: fontName, Size: 6.5, Style: fontstyle.Bold, Color: ColorNavySecondary, Align: align.Right}),
				text.New(fmt.Sprintf("%s - %s", custState, posType), props.Text{Family: fontName, Size: 8, Top: 3.5, Color: ColorNavyText, Style: fontstyle.Bold, Align: align.Right}),
			),
		),
	)

	// 2. PARTY CARDS (Billed By vs Quotation To)
	cardStyle := &props.Cell{
		BackgroundColor: ColorCardBg,
		BorderColor:     ColorLightBorder,
		BorderType:      border.Full,
		BorderThickness: 0.35,
	}

	m.AddRows(
		row.New(26).Add(
			col.New(6).WithStyle(cardStyle).Add(
				text.New("ISSUED BY (ORGANIZATION)", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Top: 2, Left: 2, Color: ColorPrimaryTeal}),
				text.New(compName, props.Text{Family: fontName, Style: fontstyle.Bold, Size: 9, Top: 6, Left: 2, Color: ColorNavyText}),
				text.New(compAddr, props.Text{Family: fontName, Size: 7, Top: 10.5, Left: 2, Color: ColorNavySecondary}),
				text.New(fmt.Sprintf("State: %s  |  GSTIN: %s  |  PAN: %s", compState, compGstin, compPan), props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Top: 15, Left: 2, Color: ColorNavyText}),
				text.New(fmt.Sprintf("Contact: %s  |  %s", compPhone, compEmail), props.Text{Family: fontName, Size: 7, Top: 19.5, Left: 2, Color: ColorNavySecondary}),
			),
			col.New(6).WithStyle(cardStyle).Add(
				text.New("QUOTATION TO (CLIENT)", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Top: 2, Left: 2, Color: ColorPrimaryTeal}),
				text.New(custName, props.Text{Family: fontName, Style: fontstyle.Bold, Size: 9, Top: 6, Left: 2, Color: ColorNavyText}),
				text.New(fmt.Sprintf("%s (%s)", custCompany, custAddr), props.Text{Family: fontName, Size: 7, Top: 10.5, Left: 2, Color: ColorNavySecondary}),
				text.New(fmt.Sprintf("State: %s  |  GSTIN: %s", custState, custGstin), props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Top: 15, Left: 2, Color: ColorNavyText}),
				text.New(fmt.Sprintf("Contact: %s", custContact), props.Text{Family: fontName, Size: 7, Top: 19.5, Left: 2, Color: ColorNavySecondary}),
			),
		),
	)

	// Spacing before table
	m.AddRows(row.New(3).Add(col.New(12)))

	// 3. LINE ITEMS TABLE HEADER - Clean Horizontal Dividers
	thStyle := &props.Cell{
		BackgroundColor: ColorHeaderBg,
		BorderColor:     ColorLightBorder,
		BorderType:      border.Bottom,
		BorderThickness: 0.75,
	}

	m.AddRows(
		row.New(6.5).Add(
			col.New(1).WithStyle(thStyle).Add(text.New("#", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Align: align.Center, Top: 1.5, Color: ColorNavyText})),
			col.New(4).WithStyle(thStyle).Add(text.New("ITEM DESCRIPTION", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Left: 2, Top: 1.5, Color: ColorNavyText})),
			col.New(1).WithStyle(thStyle).Add(text.New("HSN/SAC", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Align: align.Center, Top: 1.5, Color: ColorNavyText})),
			col.New(1).WithStyle(thStyle).Add(text.New("QTY", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Align: align.Center, Top: 1.5, Color: ColorNavyText})),
			col.New(2).WithStyle(thStyle).Add(text.New("UNIT PRICE", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Align: align.Right, Right: 2, Top: 1.5, Color: ColorNavyText})),
			col.New(1).WithStyle(thStyle).Add(text.New("GST %", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Align: align.Center, Top: 1.5, Color: ColorNavyText})),
			col.New(2).WithStyle(thStyle).Add(text.New("TOTAL", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Align: align.Right, Right: 2, Top: 1.5, Color: ColorNavyText})),
		),
	)

	// 4. LINE ITEMS TABLE ROWS - Clean Horizontal Dividers, no vertical borders
	trBorder := &props.Cell{
		BorderColor:     ColorLightBorder,
		BorderType:      border.Bottom,
		BorderThickness: 0.35,
	}
	trZebra := &props.Cell{
		BackgroundColor: ColorCardBg,
		BorderColor:     ColorLightBorder,
		BorderType:      border.Bottom,
		BorderThickness: 0.35,
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
			row.New(6.5).Add(
				col.New(1).WithStyle(cStyle).Add(text.New(fmt.Sprintf("%d", idx+1), props.Text{Family: fontName, Size: 7.5, Align: align.Center, Top: 1.5, Color: ColorNavySecondary})),
				col.New(4).WithStyle(cStyle).Add(text.New(item.ProductName, props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7.5, Left: 2, Top: 1.5, Color: ColorNavyText})),
				col.New(1).WithStyle(cStyle).Add(text.New(hsn, props.Text{Family: fontName, Size: 7, Align: align.Center, Top: 1.5, Color: ColorNavySecondary})),
				col.New(1).WithStyle(cStyle).Add(text.New(fmt.Sprintf("%.1f", item.Quantity), props.Text{Family: fontName, Size: 7.5, Align: align.Center, Top: 1.5, Color: ColorNavySecondary})),
				col.New(2).WithStyle(cStyle).Add(text.New(formatCurrency(item.UnitPrice, quote.Currency, fontName), props.Text{Family: fontName, Size: 7.5, Align: align.Right, Right: 2, Top: 1.5, Color: ColorNavyText})),
				col.New(1).WithStyle(cStyle).Add(text.New(fmt.Sprintf("%.0f%%", item.GSTRate), props.Text{Family: fontName, Size: 7, Align: align.Center, Top: 1.5, Color: ColorNavySecondary})),
				col.New(2).WithStyle(cStyle).Add(text.New(formatCurrency(item.LineTotal, quote.Currency, fontName), props.Text{Family: fontName, Size: 7.5, Align: align.Right, Right: 2, Top: 1.5, Color: ColorNavyText})),
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
		BorderType:      border.Bottom,
		BorderThickness: 0.5,
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
				text.New(gstRow1Left, props.Text{Family: fontName, Size: 7.5, Left: 2, Top: 1.2, Color: ColorNavyText}),
			),
			col.New(3).WithStyle(trBorder).Add(
				text.New("Subtotal", props.Text{Family: fontName, Size: 7.5, Left: 2, Top: 1.2, Color: ColorNavySecondary}),
			),
			col.New(3).WithStyle(trBorder).Add(
				text.New(formatCurrency(quote.Subtotal, quote.Currency, fontName), props.Text{Family: fontName, Size: 7.5, Align: align.Right, Right: 2, Top: 1.2, Color: ColorNavyText}),
			),
		),
		row.New(5).Add(
			col.New(6).WithStyle(trBorder).Add(
				text.New(gstRow2Left, props.Text{Family: fontName, Size: 7.5, Left: 2, Top: 1.2, Color: ColorNavyText}),
			),
			col.New(3).WithStyle(trBorder).Add(
				text.New("Taxable Amount", props.Text{Family: fontName, Size: 7.5, Left: 2, Top: 1.2, Color: ColorNavySecondary}),
			),
			col.New(3).WithStyle(trBorder).Add(
				text.New(formatCurrency(taxableAmt, quote.Currency, fontName), props.Text{Family: fontName, Size: 7.5, Align: align.Right, Right: 2, Top: 1.2, Color: ColorNavyText}),
			),
		),
		row.New(5).Add(
			col.New(6).WithStyle(trBorder).Add(
				text.New(gstRow3Left, props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7.5, Left: 2, Top: 1.2, Color: ColorNavyText}),
			),
			col.New(3).WithStyle(trBorder).Add(
				text.New("Total GST Tax", props.Text{Family: fontName, Size: 7.5, Left: 2, Top: 1.2, Color: ColorNavySecondary}),
			),
			col.New(3).WithStyle(trBorder).Add(
				text.New(formatCurrency(quote.TotalGSTAmount, quote.Currency, fontName), props.Text{Family: fontName, Size: 7.5, Align: align.Right, Right: 2, Top: 1.2, Color: ColorNavyText}),
			),
		),
	)

	// Round off if present
	if quote.RoundOffAmount != 0 {
		m.AddRows(
			row.New(5).Add(
				col.New(6).WithStyle(trBorder).Add(text.New("", props.Text{})),
				col.New(3).WithStyle(trBorder).Add(
					text.New("Round Off", props.Text{Family: fontName, Size: 7.5, Left: 2, Top: 1.2, Color: ColorNavySecondary}),
				),
				col.New(3).WithStyle(trBorder).Add(
					text.New(formatCurrency(quote.RoundOffAmount, quote.Currency, fontName), props.Text{Family: fontName, Size: 7.5, Align: align.Right, Right: 2, Top: 1.2, Color: ColorNavyText}),
				),
			),
		)
	}

	// Grand Total Highlighted Card - Elegant Teal Accent Card
	grandTotalStyle := &props.Cell{
		BackgroundColor: ColorCardBg,
		BorderColor:     ColorPrimaryTeal,
		BorderType:      border.Full,
		BorderThickness: 0.75,
	}

	m.AddRows(
		row.New(7).Add(
			col.New(6).WithStyle(grandTotalStyle).Add(
				text.New("Terms: Prices valid for 30 days. Delivery as agreed.", props.Text{Family: fontName, Size: 6.5, Style: fontstyle.Italic, Left: 2, Top: 2, Color: ColorNavySecondary}),
			),
			col.New(3).WithStyle(grandTotalStyle).Add(
				text.New("GRAND TOTAL", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 8.5, Left: 2, Top: 2, Color: ColorNavyText}),
			),
			col.New(3).WithStyle(grandTotalStyle).Add(
				text.New(formatCurrency(quote.TotalAmount, quote.Currency, fontName), props.Text{Family: fontName, Style: fontstyle.Bold, Size: 10.5, Align: align.Right, Right: 2, Top: 1.5, Color: ColorPrimaryTeal}),
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
				text.New("Bank: HDFC Bank Ltd.", props.Text{Family: fontName, Size: 7, Top: 5.5, Left: 2, Color: ColorNavyText}),
				text.New("A/C No: 50200012345678", props.Text{Family: fontName, Size: 7, Top: 9, Left: 2, Color: ColorNavyText}),
				text.New("IFSC Code: HDFC0001234", props.Text{Family: fontName, Size: 7, Top: 12.5, Left: 2, Color: ColorNavyText}),
				text.New("Branch: Cyber City Branch, Pune", props.Text{Family: fontName, Size: 7, Top: 16, Left: 2, Color: ColorNavySecondary}),
			),
			col.New(5).WithStyle(cardStyle).Add(
				text.New("TERMS & CONDITIONS", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Top: 2, Left: 2, Color: ColorPrimaryTeal}),
				text.New(termsStr, props.Text{Family: fontName, Size: 6.5, Top: 5.5, Left: 2, Color: ColorNavySecondary}),
			),
			col.New(3).WithStyle(cardStyle).Add(
				text.New("FOR "+compName, props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Align: align.Center, Top: 2, Color: ColorNavyText}),
				text.New("Authorized Signatory", props.Text{Family: fontName, Size: 7, Align: align.Center, Top: 15, Color: ColorNavySecondary}),
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
						Size:   14,
						Align:  align.Right,
						Color:  ColorNavyText,
					}),
					text.New(fmt.Sprintf("Invoice #%s", inv.InvoiceNumber), props.Text{
						Family: fontName,
						Style:  fontstyle.Bold,
						Size:   10,
						Align:  align.Right,
						Top:    5.5,
						Color:  ColorPrimaryTeal,
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
						Size:   14,
						Color:  ColorNavyText,
					}),
				),
				col.New(6).Add(
					text.New("TAX INVOICE", props.Text{
						Family: fontName,
						Style:  fontstyle.Bold,
						Size:   14,
						Align:  align.Right,
						Color:  ColorNavyText,
					}),
					text.New(fmt.Sprintf("Invoice #%s", inv.InvoiceNumber), props.Text{
						Family: fontName,
						Style:  fontstyle.Bold,
						Size:   10,
						Align:  align.Right,
						Top:    5.5,
						Color:  ColorPrimaryTeal,
					}),
				),
			),
		)
	}

	// Thin Teal Divider Line
	m.AddRows(
		row.New(2).Add(
			col.New(12).Add(
				line.New(props.Line{Color: ColorPrimaryTeal, Thickness: 0.8}),
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
				text.New("INVOICE DATE", props.Text{Family: fontName, Size: 6.5, Style: fontstyle.Bold, Color: ColorNavySecondary}),
				text.New(dateStr, props.Text{Family: fontName, Size: 8.5, Top: 3.5, Color: ColorNavyText}),
			),
			col.New(3).Add(
				text.New("PAYMENT DUE DATE", props.Text{Family: fontName, Size: 6.5, Style: fontstyle.Bold, Color: ColorNavySecondary}),
				text.New(dueDateStr, props.Text{Family: fontName, Size: 8.5, Top: 3.5, Color: ColorNavyText}),
			),
			col.New(3).Add(
				text.New("PAYMENT STATUS", props.Text{Family: fontName, Size: 6.5, Style: fontstyle.Bold, Color: ColorNavySecondary}),
				text.New(statusText, props.Text{Family: fontName, Size: 8.5, Top: 3.5, Style: fontstyle.Bold, Color: statusColor}),
			),
			col.New(3).Add(
				text.New("PLACE OF SUPPLY", props.Text{Family: fontName, Size: 6.5, Style: fontstyle.Bold, Color: ColorNavySecondary, Align: align.Right}),
				text.New(fmt.Sprintf("%s - %s", custState, posType), props.Text{Family: fontName, Size: 8, Top: 3.5, Color: ColorNavyText, Style: fontstyle.Bold, Align: align.Right}),
			),
		),
	)

	// 2. PARTY CARDS (Billed By vs Billed To)
	// 2. PARTY CARDS (Billed By vs Billed To)
	cardStyle := &props.Cell{
		BackgroundColor: ColorCardBg,
		BorderColor:     ColorLightBorder,
		BorderType:      border.Full,
		BorderThickness: 0.35,
	}

	m.AddRows(
		row.New(26).Add(
			col.New(6).WithStyle(cardStyle).Add(
				text.New("BILLED BY (SUPPLIER)", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Top: 2, Left: 2, Color: ColorPrimaryTeal}),
				text.New(compName, props.Text{Family: fontName, Style: fontstyle.Bold, Size: 9, Top: 6, Left: 2, Color: ColorNavyText}),
				text.New(compAddr, props.Text{Family: fontName, Size: 7, Top: 10.5, Left: 2, Color: ColorNavySecondary}),
				text.New(fmt.Sprintf("State: %s  |  GSTIN: %s  |  PAN: %s", compState, compGstin, compPan), props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Top: 15, Left: 2, Color: ColorNavyText}),
				text.New(fmt.Sprintf("Contact: %s  |  %s", compPhone, compEmail), props.Text{Family: fontName, Size: 7, Top: 19.5, Left: 2, Color: ColorNavySecondary}),
			),
			col.New(6).WithStyle(cardStyle).Add(
				text.New("BILLED TO (RECIPIENT)", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Top: 2, Left: 2, Color: ColorPrimaryTeal}),
				text.New(custName, props.Text{Family: fontName, Style: fontstyle.Bold, Size: 9, Top: 6, Left: 2, Color: ColorNavyText}),
				text.New(fmt.Sprintf("%s (%s)", custCompany, custAddr), props.Text{Family: fontName, Size: 7, Top: 10.5, Left: 2, Color: ColorNavySecondary}),
				text.New(fmt.Sprintf("State: %s  |  GSTIN: %s", custState, custGstin), props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Top: 15, Left: 2, Color: ColorNavyText}),
				text.New(fmt.Sprintf("Contact: %s", custContact), props.Text{Family: fontName, Size: 7, Top: 19.5, Left: 2, Color: ColorNavySecondary}),
			),
		),
	)

	m.AddRows(row.New(3).Add(col.New(12)))

	// 3. INVOICE LINE ITEMS TABLE HEADER - Clean Horizontal Dividers
	thStyle := &props.Cell{
		BackgroundColor: ColorHeaderBg,
		BorderColor:     ColorLightBorder,
		BorderType:      border.Bottom,
		BorderThickness: 0.75,
	}

	m.AddRows(
		row.New(6.5).Add(
			col.New(1).WithStyle(thStyle).Add(text.New("#", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Align: align.Center, Top: 1.5, Color: ColorNavyText})),
			col.New(4).WithStyle(thStyle).Add(text.New("ITEM DESCRIPTION", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Left: 2, Top: 1.5, Color: ColorNavyText})),
			col.New(1).WithStyle(thStyle).Add(text.New("HSN/SAC", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Align: align.Center, Top: 1.5, Color: ColorNavyText})),
			col.New(1).WithStyle(thStyle).Add(text.New("QTY", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Align: align.Center, Top: 1.5, Color: ColorNavyText})),
			col.New(2).WithStyle(thStyle).Add(text.New("UNIT PRICE", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Align: align.Right, Right: 2, Top: 1.5, Color: ColorNavyText})),
			col.New(1).WithStyle(thStyle).Add(text.New("GST %", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Align: align.Center, Top: 1.5, Color: ColorNavyText})),
			col.New(2).WithStyle(thStyle).Add(text.New("TOTAL", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Align: align.Right, Right: 2, Top: 1.5, Color: ColorNavyText})),
		),
	)

	// 4. LINE ITEMS TABLE ROWS - Subtle bottom dividers, no vertical borders
	trBorder := &props.Cell{
		BorderColor:     ColorLightBorder,
		BorderType:      border.Bottom,
		BorderThickness: 0.35,
	}
	trZebra := &props.Cell{
		BackgroundColor: ColorCardBg,
		BorderColor:     ColorLightBorder,
		BorderType:      border.Bottom,
		BorderThickness: 0.35,
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
			row.New(6.5).Add(
				col.New(1).WithStyle(cStyle).Add(text.New(fmt.Sprintf("%d", idx+1), props.Text{Family: fontName, Size: 7.5, Align: align.Center, Top: 1.5, Color: ColorNavySecondary})),
				col.New(4).WithStyle(cStyle).Add(text.New(itemName, props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7.5, Left: 2, Top: 1.5, Color: ColorNavyText})),
				col.New(1).WithStyle(cStyle).Add(text.New(hsn, props.Text{Family: fontName, Size: 7, Align: align.Center, Top: 1.5, Color: ColorNavySecondary})),
				col.New(1).WithStyle(cStyle).Add(text.New(fmt.Sprintf("%.1f", item.Quantity), props.Text{Family: fontName, Size: 7.5, Align: align.Center, Top: 1.5, Color: ColorNavySecondary})),
				col.New(2).WithStyle(cStyle).Add(text.New(formatCurrency(item.UnitPrice, inv.Currency, fontName), props.Text{Family: fontName, Size: 7.5, Align: align.Right, Right: 2, Top: 1.5, Color: ColorNavyText})),
				col.New(1).WithStyle(cStyle).Add(text.New(fmt.Sprintf("%.0f%%", gstRate), props.Text{Family: fontName, Size: 7, Align: align.Center, Top: 1.5, Color: ColorNavySecondary})),
				col.New(2).WithStyle(cStyle).Add(text.New(formatCurrency(lineTotal, inv.Currency, fontName), props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7.5, Align: align.Right, Right: 2, Top: 1.5, Color: ColorNavyText})),
			),
		)
	}

	m.AddRows(row.New(3).Add(col.New(12)))

	// 5. TAX BREAKDOWN & FINANCIAL TOTALS - Clean Horizontal Dividers
	taxTableBg := &props.Cell{
		BackgroundColor: ColorHeaderBg,
		BorderColor:     ColorLightBorder,
		BorderType:      border.Bottom,
		BorderThickness: 0.5,
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
				text.New(gstRow1Left, props.Text{Family: fontName, Size: 7.5, Left: 2, Top: 1.2, Color: ColorNavyText}),
			),
			col.New(3).WithStyle(trBorder).Add(
				text.New("Taxable Amount", props.Text{Family: fontName, Size: 7.5, Left: 2, Top: 1.2, Color: ColorNavySecondary}),
			),
			col.New(3).WithStyle(trBorder).Add(
				text.New(formatCurrency(taxableAmt, inv.Currency, fontName), props.Text{Family: fontName, Size: 7.5, Align: align.Right, Right: 2, Top: 1.2, Color: ColorNavyText}),
			),
		),
		row.New(5).Add(
			col.New(6).WithStyle(trBorder).Add(
				text.New(gstRow2Left, props.Text{Family: fontName, Size: 7.5, Left: 2, Top: 1.2, Color: ColorNavyText}),
			),
			col.New(3).WithStyle(trBorder).Add(
				text.New("Total GST Tax", props.Text{Family: fontName, Size: 7.5, Left: 2, Top: 1.2, Color: ColorNavySecondary}),
			),
			col.New(3).WithStyle(trBorder).Add(
				text.New(formatCurrency(inv.TotalTax, inv.Currency, fontName), props.Text{Family: fontName, Size: 7.5, Align: align.Right, Right: 2, Top: 1.2, Color: ColorNavyText}),
			),
		),
		row.New(5).Add(
			col.New(6).WithStyle(trBorder).Add(
				text.New(gstRow3Left, props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7.5, Left: 2, Top: 1.2, Color: ColorNavyText}),
			),
			col.New(3).WithStyle(trBorder).Add(
				text.New("Grand Total", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 8, Left: 2, Top: 1.2, Color: ColorNavyText}),
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
				text.New("Amount Paid", props.Text{Family: fontName, Size: 7.5, Left: 2, Top: 1.2, Color: ColorNavySecondary}),
			),
			col.New(3).WithStyle(trBorder).Add(
				text.New(formatCurrency(inv.AmountPaid, inv.Currency, fontName), props.Text{Family: fontName, Size: 7.5, Align: align.Right, Right: 2, Top: 1.2, Color: ColorBadgePaid}),
			),
		),
	)

	grandTotalStyle := &props.Cell{
		BackgroundColor: ColorCardBg,
		BorderColor:     ColorPrimaryTeal,
		BorderType:      border.Full,
		BorderThickness: 0.75,
	}

	m.AddRows(
		row.New(6).Add(
			col.New(6).WithStyle(grandTotalStyle).Add(
				text.New(fmt.Sprintf("Balance Due: %s", formatCurrency(inv.RemainingBalance, inv.Currency, fontName)), props.Text{Family: fontName, Style: fontstyle.Bold, Size: 8.5, Left: 2, Top: 1.5, Color: ColorBadgeOverdue}),
			),
			col.New(3).WithStyle(grandTotalStyle).Add(
				text.New("BALANCE DUE", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 8.5, Left: 2, Top: 1.5, Color: ColorNavyText}),
			),
			col.New(3).WithStyle(grandTotalStyle).Add(
				text.New(formatCurrency(inv.RemainingBalance, inv.Currency, fontName), props.Text{Family: fontName, Style: fontstyle.Bold, Size: 10, Align: align.Right, Right: 2, Top: 1.5, Color: ColorBadgeOverdue}),
			),
		),
	)

	// 6. PAYMENTS MINI-LEDGER (If payments recorded) - Clean Horizontal Dividers
	if len(inv.Payments) > 0 {
		m.AddRows(row.New(2).Add(col.New(12)))
		m.AddRows(
			row.New(5).Add(
				col.New(12).WithStyle(taxTableBg).Add(
					text.New("RECORDED PAYMENTS AUDIT TRAIL", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Left: 2, Top: 1, Color: ColorPrimaryTeal}),
				),
			),
			row.New(5).Add(
				col.New(3).WithStyle(thStyle).Add(text.New("DATE", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Left: 2, Top: 1, Color: ColorNavyText})),
				col.New(3).WithStyle(thStyle).Add(text.New("METHOD", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Left: 2, Top: 1, Color: ColorNavyText})),
				col.New(3).WithStyle(thStyle).Add(text.New("REFERENCE #", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Left: 2, Top: 1, Color: ColorNavyText})),
				col.New(3).WithStyle(thStyle).Add(text.New("AMOUNT PAID", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Align: align.Right, Right: 2, Top: 1, Color: ColorNavyText})),
			),
		)

		for _, p := range inv.Payments {
			ref := "-"
			if p.ReferenceNumber != nil && *p.ReferenceNumber != "" {
				ref = *p.ReferenceNumber
			}
			m.AddRows(
				row.New(5).Add(
					col.New(3).WithStyle(trBorder).Add(text.New(p.PaymentDate.Format("02-Jan-2006"), props.Text{Family: fontName, Size: 7.5, Left: 2, Top: 1.2, Color: ColorNavyText})),
					col.New(3).WithStyle(trBorder).Add(text.New(strings.ToUpper(p.PaymentMethod), props.Text{Family: fontName, Size: 7.5, Left: 2, Top: 1.2, Color: ColorNavyText})),
					col.New(3).WithStyle(trBorder).Add(text.New(ref, props.Text{Family: fontName, Size: 7, Left: 2, Top: 1.2, Color: ColorNavySecondary})),
					col.New(3).WithStyle(trBorder).Add(text.New(formatCurrency(p.Amount, inv.Currency, fontName), props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7.5, Align: align.Right, Right: 2, Top: 1.2, Color: ColorBadgePaid})),
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
				text.New("Bank: HDFC Bank Ltd.", props.Text{Family: fontName, Size: 7, Top: 5.5, Left: 2, Color: ColorNavyText}),
				text.New("A/C No: 50200012345678", props.Text{Family: fontName, Size: 7, Top: 9, Left: 2, Color: ColorNavyText}),
				text.New("IFSC Code: HDFC0001234", props.Text{Family: fontName, Size: 7, Top: 12.5, Left: 2, Color: ColorNavyText}),
				text.New("Branch: Cyber City Branch, Pune", props.Text{Family: fontName, Size: 7, Top: 16, Left: 2, Color: ColorNavySecondary}),
			),
			col.New(5).WithStyle(cardStyle).Add(
				text.New("PAYMENT INSTRUCTIONS", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Top: 2, Left: 2, Color: ColorPrimaryTeal}),
				text.New(termsStr, props.Text{Family: fontName, Size: 6.5, Top: 5.5, Left: 2, Color: ColorNavySecondary}),
			),
			col.New(3).WithStyle(cardStyle).Add(
				text.New("FOR "+compName, props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Align: align.Center, Top: 2, Color: ColorNavyText}),
				text.New("Authorized Signatory", props.Text{Family: fontName, Size: 7, Align: align.Center, Top: 15, Color: ColorNavySecondary}),
			),
		),
	)

	doc, err := m.Generate()
	if err != nil {
		return nil, fmt.Errorf("failed to generate invoice PDF: %w", err)
	}

	return doc.GetBytes(), nil
}

// =========================================================================
// PAYMENT RECEIPT PDF GENERATOR
// =========================================================================

func GeneratePaymentReceiptPDF(receipt *models.PaymentReceiptDetail, comp *models.CompanyProfile, logoBytes []byte, logoMime string) ([]byte, error) {
	if receipt == nil {
		return nil, fmt.Errorf("receipt cannot be nil")
	}

	m, fontName := buildMarotoInstance()

	compName := "CRM Enterprise Solutions"
	compAddr := "101 Cyber City, Tech Park, Pune 411001"
	compGstin := "27AAACB2233M1Z2"
	compPan := "AAACB2233M"
	compState := "Maharashtra"
	compEmail := "billing@bizcopilot.com"
	compPhone := "+91 98765 43210"

	if receipt.Invoice != nil {
		if receipt.Invoice.CompanyName != nil && *receipt.Invoice.CompanyName != "" {
			compName = *receipt.Invoice.CompanyName
		}
		if receipt.Invoice.CompanyAddress != nil && *receipt.Invoice.CompanyAddress != "" {
			compAddr = *receipt.Invoice.CompanyAddress
		}
		if receipt.Invoice.CompanyGSTIN != nil && *receipt.Invoice.CompanyGSTIN != "" {
			compGstin = *receipt.Invoice.CompanyGSTIN
		}
		if receipt.Invoice.CompanyPAN != nil && *receipt.Invoice.CompanyPAN != "" {
			compPan = *receipt.Invoice.CompanyPAN
		}
		if receipt.Invoice.CompanyState != nil && *receipt.Invoice.CompanyState != "" {
			compState = *receipt.Invoice.CompanyState
		}
	}

	if comp != nil {
		if comp.CompanyName != "" {
			compName = comp.CompanyName
		}
		if comp.Address != "" {
			compAddr = fmt.Sprintf("%s, %s %s", comp.Address, comp.City, comp.Pincode)
		}
		if comp.GSTNumber != "" {
			compGstin = comp.GSTNumber
		}
		if comp.PANNumber != "" {
			compPan = comp.PANNumber
		}
		if comp.State != "" {
			compState = comp.State
		}
		if comp.Email != "" {
			compEmail = comp.Email
		}
		if comp.Phone != "" {
			compPhone = comp.Phone
		}
	}
	_ = compAddr
	_ = compPan
	_ = compEmail
	_ = compPhone

	// Customer Info
	custName := receipt.Payment.CustomerName
	if custName == "" {
		custName = "Valued Customer"
	}
	custCompany := ""
	custAddr := "Registered Address"
	custContact := ""

	if receipt.Customer != nil {
		if receipt.Customer.Name != "" {
			custName = receipt.Customer.Name
		}
		if receipt.Customer.Company != nil && *receipt.Customer.Company != "" {
			custCompany = *receipt.Customer.Company
		}
		if receipt.Customer.Address != nil && *receipt.Customer.Address != "" {
			custAddr = *receipt.Customer.Address
			if receipt.Customer.City != nil && *receipt.Customer.City != "" {
				custAddr += ", " + *receipt.Customer.City
			}
		}
		var contacts []string
		if receipt.Customer.Phone != nil && *receipt.Customer.Phone != "" {
			contacts = append(contacts, *receipt.Customer.Phone)
		}
		if receipt.Customer.Email != nil && *receipt.Customer.Email != "" {
			contacts = append(contacts, *receipt.Customer.Email)
		}
		custContact = strings.Join(contacts, " | ")
	}

	voucherNum := fmt.Sprintf("PAY-%05d", receipt.Payment.ID)
	receiptDate := receipt.Payment.PaymentDate.Format("02-Jan-2006")
	paymentMode := strings.ToUpper(receipt.Payment.PaymentMethod)
	if paymentMode == "" {
		paymentMode = "CASH / DIRECT"
	}
	refNum := "N/A - Direct Deposit"
	if receipt.Payment.ReferenceNumber != nil && *receipt.Payment.ReferenceNumber != "" {
		refNum = *receipt.Payment.ReferenceNumber
	}
	recordedBy := "System Administrator"
	if receipt.Payment.Recorder != nil && receipt.Payment.Recorder.Name != "" {
		recordedBy = receipt.Payment.Recorder.Name
	}

	// 1. HEADER SECTION
	hasLogo := len(logoBytes) > 0
	if hasLogo {
		ext := parseImageExtension(logoMime)
		m.AddRows(
			row.New(16).Add(
				col.New(4).Add(
					image.NewFromBytes(logoBytes, ext, props.Rect{Percent: 90, Center: false}),
				),
				col.New(8).Add(
					text.New("OFFICIAL PAYMENT RECEIPT", props.Text{
						Family: fontName,
						Style:  fontstyle.Bold,
						Size:   14,
						Align:  align.Right,
						Color:  ColorNavyText,
					}),
					text.New(fmt.Sprintf("Voucher #%s", voucherNum), props.Text{
						Family: fontName,
						Style:  fontstyle.Bold,
						Size:   10,
						Align:  align.Right,
						Top:    5.5,
						Color:  ColorPrimaryTeal,
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
						Size:   14,
						Color:  ColorNavyText,
					}),
				),
				col.New(6).Add(
					text.New("OFFICIAL PAYMENT RECEIPT", props.Text{
						Family: fontName,
						Style:  fontstyle.Bold,
						Size:   14,
						Align:  align.Right,
						Color:  ColorNavyText,
					}),
					text.New(fmt.Sprintf("Voucher #%s", voucherNum), props.Text{
						Family: fontName,
						Style:  fontstyle.Bold,
						Size:   10,
						Align:  align.Right,
						Top:    5.5,
						Color:  ColorPrimaryTeal,
					}),
				),
			),
		)
	}

	// Thin Teal Divider Line
	m.AddRows(
		row.New(2).Add(
			col.New(12).Add(
				line.New(props.Line{Color: ColorPrimaryTeal, Thickness: 0.8}),
			),
		),
	)

	// Meta Details Sub-Header (Receipt Date, Status Badge, Recorded By, Company GSTIN / State)
	m.AddRows(
		row.New(12).Add(
			col.New(3).Add(
				text.New("RECEIPT DATE", props.Text{Family: fontName, Size: 6.5, Style: fontstyle.Bold, Color: ColorNavySecondary}),
				text.New(receiptDate, props.Text{Family: fontName, Size: 8.5, Top: 3.5, Color: ColorNavyText}),
			),
			col.New(3).Add(
				text.New("PAYMENT STATUS", props.Text{Family: fontName, Size: 6.5, Style: fontstyle.Bold, Color: ColorNavySecondary}),
				text.New("RECEIVED & CLEARED", props.Text{Family: fontName, Size: 8.5, Top: 3.5, Style: fontstyle.Bold, Color: ColorBadgePaid}),
			),
			col.New(3).Add(
				text.New("RECORDED BY", props.Text{Family: fontName, Size: 6.5, Style: fontstyle.Bold, Color: ColorNavySecondary}),
				text.New(recordedBy, props.Text{Family: fontName, Size: 8.5, Top: 3.5, Color: ColorNavyText}),
			),
			col.New(3).Add(
				text.New("COMPANY GSTIN / STATE", props.Text{Family: fontName, Size: 6.5, Style: fontstyle.Bold, Color: ColorNavySecondary, Align: align.Right}),
				text.New(fmt.Sprintf("%s (%s)", compGstin, compState), props.Text{Family: fontName, Size: 8, Top: 3.5, Color: ColorNavyText, Style: fontstyle.Bold, Align: align.Right}),
			),
		),
	)

	m.AddRows(row.New(2).Add(col.New(12)))

	cardStyle := &props.Cell{
		BackgroundColor: ColorCardBg,
		BorderType:      border.Full,
		BorderColor:     ColorLightBorder,
		BorderThickness: 0.35,
	}

	// 2. RECEIVED FROM & TRANSACTION DETAILS
	m.AddRows(
		row.New(26).Add(
			col.New(6).WithStyle(cardStyle).Add(
				text.New("RECEIVED FROM (CUSTOMER)", props.Text{
					Family: fontName,
					Style:  fontstyle.Bold,
					Size:   7.5,
					Top:    2,
					Left:   2,
					Color:  ColorPrimaryTeal,
				}),
				text.New(custName, props.Text{Family: fontName, Style: fontstyle.Bold, Size: 9, Top: 6, Left: 2, Color: ColorNavyText}),
				text.New(custCompany, props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7.5, Top: 10.5, Left: 2, Color: ColorNavySecondary}),
				text.New(custContact, props.Text{Family: fontName, Size: 7, Top: 14.5, Left: 2, Color: ColorNavySecondary}),
				text.New(custAddr, props.Text{Family: fontName, Size: 7, Top: 18.5, Left: 2, Color: ColorNavySecondary}),
			),
			col.New(6).WithStyle(cardStyle).Add(
				text.New("TRANSACTION DETAILS", props.Text{
					Family: fontName,
					Style:  fontstyle.Bold,
					Size:   7.5,
					Top:    2,
					Left:   2,
					Color:  ColorPrimaryTeal,
				}),
				text.New(fmt.Sprintf("Payment Mode: %s", paymentMode), props.Text{Family: fontName, Style: fontstyle.Bold, Size: 8, Top: 6, Left: 2, Color: ColorNavyText}),
				text.New(fmt.Sprintf("Reference / UTR #: %s", refNum), props.Text{Family: fontName, Size: 7.5, Top: 10, Left: 2, Color: ColorNavyText}),
				text.New(fmt.Sprintf("Voucher ID: %s", voucherNum), props.Text{Family: fontName, Size: 7, Top: 14, Left: 2, Color: ColorNavySecondary}),
				text.New(fmt.Sprintf("Receipt Date: %s", receiptDate), props.Text{Family: fontName, Size: 7, Top: 17.5, Left: 2, Color: ColorNavySecondary}),
				text.New("Payment Type: Accounts Receivable Settlement", props.Text{Family: fontName, Size: 6.5, Top: 21, Left: 2, Color: ColorPrimaryTeal}),
			),
		),
	)

	m.AddRows(row.New(3).Add(col.New(12)))

	// 3. INVOICE ALLOCATION TABLE
	thStyle := &props.Cell{
		BackgroundColor: ColorHeaderBg,
		BorderType:      border.Bottom,
		BorderColor:     ColorLightBorder,
		BorderThickness: 0.75,
	}
	trBorder := &props.Cell{
		BorderType:      border.Bottom,
		BorderColor:     ColorLightBorder,
		BorderThickness: 0.35,
	}

	m.AddRows(
		row.New(6).Add(
			col.New(3).WithStyle(thStyle).Add(text.New("LINKED INVOICE #", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Left: 2, Top: 1.5, Color: ColorNavyText})),
			col.New(2).WithStyle(thStyle).Add(text.New("INVOICE DATE", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Left: 2, Top: 1.5, Color: ColorNavyText})),
			col.New(2).WithStyle(thStyle).Add(text.New("INVOICE TOTAL", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Align: align.Right, Right: 2, Top: 1.5, Color: ColorNavyText})),
			col.New(3).WithStyle(thStyle).Add(text.New("AMOUNT APPLIED", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Align: align.Right, Right: 2, Top: 1.5, Color: ColorNavyText})),
			col.New(2).WithStyle(thStyle).Add(text.New("BALANCE DUE", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Align: align.Right, Right: 2, Top: 1.5, Color: ColorNavyText})),
		),
	)

	invDateStr := "-"
	if receipt.Invoice != nil && !receipt.Invoice.InvoiceDate.IsZero() {
		invDateStr = receipt.Invoice.InvoiceDate.Format("02-Jan-2006")
	}

	m.AddRows(
		row.New(8).Add(
			col.New(3).WithStyle(trBorder).Add(
				text.New(receipt.Payment.InvoiceNumber, props.Text{Family: fontName, Style: fontstyle.Bold, Size: 8, Left: 2, Top: 2, Color: ColorPrimaryTeal}),
			),
			col.New(2).WithStyle(trBorder).Add(
				text.New(invDateStr, props.Text{Family: fontName, Size: 7.5, Left: 2, Top: 2, Color: ColorNavyText}),
			),
			col.New(2).WithStyle(trBorder).Add(
				text.New(formatCurrency(receipt.Payment.InvoiceGrandTotal, receipt.Payment.Currency, fontName), props.Text{Family: fontName, Size: 7.5, Align: align.Right, Right: 2, Top: 2, Color: ColorNavyText}),
			),
			col.New(3).WithStyle(trBorder).Add(
				text.New(formatCurrency(receipt.Payment.Amount, receipt.Payment.Currency, fontName), props.Text{Family: fontName, Style: fontstyle.Bold, Size: 8, Align: align.Right, Right: 2, Top: 2, Color: ColorBadgePaid}),
			),
			col.New(2).WithStyle(trBorder).Add(
				text.New(formatCurrency(receipt.Payment.InvoiceRemainingBalance, receipt.Payment.Currency, fontName), props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7.5, Align: align.Right, Right: 2, Top: 2, Color: ColorBadgePending}),
			),
		),
	)

	m.AddRows(row.New(4).Add(col.New(12)))

	// 4. AMOUNT IN WORDS & TOTAL RECEIVED SUMMARY CARD
	amountWords := NumberToWordsINR(receipt.Payment.Amount)
	notesStr := "Payment credited in full towards outstanding invoice."
	if receipt.Payment.Notes != nil && *receipt.Payment.Notes != "" {
		notesStr = *receipt.Payment.Notes
	}

	totalCardStyle := &props.Cell{
		BackgroundColor: ColorCardBg,
		BorderType:      border.Full,
		BorderColor:     ColorPrimaryTeal,
		BorderThickness: 0.75,
	}

	m.AddRows(
		row.New(26).Add(
			col.New(7).WithStyle(cardStyle).Add(
				text.New("AMOUNT RECEIVED IN WORDS", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Top: 2, Left: 2, Color: ColorPrimaryTeal}),
				text.New(amountWords, props.Text{Family: fontName, Style: fontstyle.Bold, Size: 8, Top: 6, Left: 2, Color: ColorNavyText}),
				text.New("REMARKS & NOTES", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 6.5, Top: 13, Left: 2, Color: ColorNavySecondary}),
				text.New(notesStr, props.Text{Family: fontName, Size: 7, Top: 16.5, Left: 2, Color: ColorNavyText}),
			),
			col.New(5).WithStyle(totalCardStyle).Add(
				text.New("TOTAL RECEIVED", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 8, Align: align.Right, Right: 3, Top: 2, Color: ColorPrimaryTeal}),
				text.New(formatCurrency(receipt.Payment.Amount, receipt.Payment.Currency, fontName), props.Text{
					Family: fontName,
					Style:  fontstyle.Bold,
					Size:   14,
					Align:  align.Right,
					Right:  3,
					Top:    6,
					Color:  ColorBadgePaid,
				}),
				text.New(fmt.Sprintf("Remaining Due: %s", formatCurrency(receipt.Payment.InvoiceRemainingBalance, receipt.Payment.Currency, fontName)), props.Text{
					Family: fontName,
					Style:  fontstyle.Bold,
					Size:   7.5,
					Align:  align.Right,
					Right:  3,
					Top:    14,
					Color:  ColorNavyText,
				}),
				text.New(fmt.Sprintf("Invoice Status: %s", strings.ToUpper(receipt.Payment.InvoiceStatus)), props.Text{
					Family: fontName,
					Size:   7,
					Align:  align.Right,
					Right:  3,
					Top:    18.5,
					Color:  ColorNavySecondary,
				}),
			),
		),
	)

	m.AddRows(row.New(6).Add(col.New(12)))

	// 5. FOOTER & AUTHORIZED SIGNATORY
	m.AddRows(
		row.New(22).Add(
			col.New(7).WithStyle(cardStyle).Add(
				text.New("TERMS & CONDITIONS", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Top: 2, Left: 2, Color: ColorPrimaryTeal}),
				text.New("1. This receipt voucher acknowledges credit of payment against the designated invoice.\n2. In case of cheque or transfer failure, this receipt shall stand void.\n3. This is an electronically generated official voucher and does not require physical stamp.", props.Text{Family: fontName, Size: 6.5, Top: 5.5, Left: 2, Color: ColorNavySecondary}),
			),
			col.New(5).WithStyle(cardStyle).Add(
				text.New("FOR "+compName, props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7.5, Align: align.Center, Top: 2, Color: ColorNavyText}),
				text.New("Authorized Signatory / Accounts Desk", props.Text{Family: fontName, Size: 7, Align: align.Center, Top: 16, Color: ColorNavySecondary}),
			),
		),
	)

	doc, err := m.Generate()
	if err != nil {
		return nil, fmt.Errorf("failed to generate payment receipt PDF: %w", err)
	}

	return doc.GetBytes(), nil
}
