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

// Brand Palette - Executive Corporate (Navy, Teal & Royal Blue)
var (
	ColorNavyText      = &props.Color{Red: 11, Green: 37, Blue: 69}    // #0B2545 - Deep Navy Primary Titles & Headers
	ColorDarkSlate     = ColorNavyText                                 // Backward compatibility alias
	ColorNavySecondary = &props.Color{Red: 71, Green: 85, Blue: 105}   // #475569 - Slate Secondary Text
	ColorMutedSlate    = ColorNavySecondary                            // Backward compatibility alias
	ColorPrimaryTeal   = &props.Color{Red: 13, Green: 148, Blue: 136}  // #0D9488 - Vibrant Teal Accent
	ColorRoyalBlue     = &props.Color{Red: 29, Green: 78, Blue: 216}   // #1D4ED8 - Royal Navy for Recipient Badge
	ColorTealLight     = &props.Color{Red: 240, Green: 253, Blue: 250} // #F0FDFA - Ice Teal Fill
	ColorTealBorder    = &props.Color{Red: 153, Green: 246, Blue: 228} // #99F6E4 - Soft Teal Border
	ColorLightBorder   = &props.Color{Red: 226, Green: 232, Blue: 240} // #E2E8F0 - Subtle Slate Divider
	ColorCardBg        = &props.Color{Red: 248, Green: 250, Blue: 252} // #F8FAFC - Soft Off-White / Card Fill
	ColorWhite         = &props.Color{Red: 255, Green: 255, Blue: 255}
	ColorBadgePaid     = &props.Color{Red: 16, Green: 185, Blue: 129}  // #10B981 - Emerald Green
	ColorPaidBg        = &props.Color{Red: 236, Green: 253, Blue: 245} // #ECFDF5 - Emerald Light Fill
	ColorBadgeOverdue  = &props.Color{Red: 239, Green: 68, Blue: 68}   // #EF4444 - Red
	ColorBadgePending  = &props.Color{Red: 245, Green: 158, Blue: 11}  // #F59E0B - Amber
	ColorHeaderBg      = &props.Color{Red: 11, Green: 37, Blue: 69}    // #0B2545 - Table Header Solid Deep Navy
	ColorSubHeaderBg   = &props.Color{Red: 240, Green: 253, Blue: 250} // #F0FDFA - Light Subheader Background
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
		WithTopMargin(8).
		WithBottomMargin(10).
		WithPageNumber(props.PageNumber{
			Pattern: "Page {current} of {total}",
			Place:   props.RightBottom,
			Size:    7,
			Color:   ColorNavySecondary,
		})

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
	sign := ""
	if val < 0 {
		sign = "-"
		val = -val
	}
	intPart := int64(val)
	fracPart := int64((val-float64(intPart))*100 + 0.5)
	if fracPart >= 100 {
		intPart++
		fracPart -= 100
	}

	intStr := fmt.Sprintf("%d", intPart)
	if len(intStr) > 3 {
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

func parseTermsLines(terms string) []string {
	terms = strings.ReplaceAll(terms, "\r\n", "\n")
	parts := strings.Split(terms, "\n")
	var result []string
	for _, p := range parts {
		trimmed := strings.TrimSpace(p)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

func NumberToWordsINR(val float64) string {
	if val < 0 {
		val = -val
	}
	intPart := int64(val)
	paise := int64((val-float64(intPart))*100 + 0.5)

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

	compName := "InCraax AI Automation Pvt Ltd"
	compAddr := "2nd Floor, Snehadeep Building, Ram Nagar-Road, Warje, Pune, 411058"
	compGstin := "27ABCDE1234F1Z5"
	compPan := "ABCDE1234F"
	compState := "Maharashtra"
	compEmail := "sales@incraax.com"
	compPhone := "+91 9172001627"

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
	custState := compState
	custGstin := "Unregistered"
	custPhone := ""
	custEmail := ""

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
		if quote.Customer.Phone != nil && *quote.Customer.Phone != "" {
			custPhone = *quote.Customer.Phone
		}
		if quote.Customer.Email != nil && *quote.Customer.Email != "" {
			custEmail = *quote.Customer.Email
		}
	}
	if quote.CustomerState != nil && *quote.CustomerState != "" {
		custState = *quote.CustomerState
	}
	if quote.CustomerGSTIN != nil && *quote.CustomerGSTIN != "" {
		custGstin = *quote.CustomerGSTIN
	}

	// 1. TOP HEADER (3 Columns: Logo/Company | Centered Title + Teal Pill | Date/Due/Supply Metadata)
	dateStr := quote.CreatedAt.Format("02-Jan-2006")
	validUntilStr := "30 Days from issue"
	if quote.ValidUntil != nil {
		validUntilStr = quote.ValidUntil.Format("02-Jan-2006")
	}

	posType := "Intra-State (CGST + SGST)"
	if quote.IsInterState {
		posType = "Inter-State (IGST)"
	}

	hasLogo := len(logoBytes) > 0
	ext := extension.Png
	if hasLogo {
		ext = parseImageExtension(logoMime)
	}

	pillCardStyle := &props.Cell{
		BackgroundColor: ColorPrimaryTeal,
		BorderColor:     ColorPrimaryTeal,
		BorderType:      border.Full,
		BorderThickness: 0.5,
	}

	// Header row
	var logoComponents []core.Component
	if hasLogo {
		logoComponents = append(logoComponents, image.NewFromBytes(logoBytes, ext, props.Rect{Percent: 90, Center: false}))
	} else {
		logoComponents = append(logoComponents,
			text.New(compName, props.Text{Family: fontName, Style: fontstyle.Bold, Size: 11, Color: ColorNavyText, Top: 1}),
			text.New("Smart Automation. Smarter Business.", props.Text{Family: fontName, Style: fontstyle.Italic, Size: 6.5, Color: ColorNavySecondary, Top: 5.5}),
		)
	}

	m.AddRows(
		row.New(16).Add(
			// Left: Logo & Company
			col.New(4).Add(logoComponents...),
			// Center: Title & Pill
			col.New(4).Add(
				text.New("COMMERCIAL QUOTATION", props.Text{
					Family: fontName,
					Style:  fontstyle.Bold,
					Size:   14,
					Align:  align.Center,
					Color:  ColorNavyText,
				}),
			),
			// Right: Metadata Lines
			col.New(4).Add(
				text.New(fmt.Sprintf("Quotation Date    : %s", dateStr), props.Text{Family: fontName, Size: 6.5, Align: align.Right, Top: 1, Color: ColorNavyText}),
				text.New(fmt.Sprintf("Valid Until           : %s", validUntilStr), props.Text{Family: fontName, Size: 6.5, Align: align.Right, Top: 5, Color: ColorNavyText}),
				text.New(fmt.Sprintf("Place of Supply   : %s - %s", custState, posType), props.Text{Family: fontName, Size: 6.5, Align: align.Right, Top: 9, Color: ColorNavyText}),
			),
		),
		// Sub-row for centered pill badge
		row.New(6).Add(
			col.New(4),
			col.New(4).WithStyle(pillCardStyle).Add(
				text.New(fmt.Sprintf("Quotation #%s", quote.QuotationNumber), props.Text{
					Family: fontName,
					Style:  fontstyle.Bold,
					Size:   8,
					Align:  align.Center,
					Top:    1.2,
					Color:  ColorWhite,
				}),
			),
			col.New(4),
		),
	)

	// Thin Teal Divider Line
	m.AddRows(
		row.New(3).Add(
			col.New(12).Add(
				line.New(props.Line{Color: ColorPrimaryTeal, Thickness: 0.8}),
			),
		),
	)

	// 2. PARTY CARDS (Billed By Supplier vs Billed To Recipient)
	cardStyle := &props.Cell{
		BackgroundColor: ColorCardBg,
		BorderColor:     ColorLightBorder,
		BorderType:      border.Full,
		BorderThickness: 0.35,
	}

	badgeSupplierStyle := &props.Cell{
		BackgroundColor: ColorPrimaryTeal,
		BorderColor:     ColorPrimaryTeal,
		BorderType:      border.Full,
		BorderThickness: 0.5,
	}

	badgeRecipientStyle := &props.Cell{
		BackgroundColor: ColorRoyalBlue,
		BorderColor:     ColorRoyalBlue,
		BorderType:      border.Full,
		BorderThickness: 0.5,
	}

	custLine2 := custAddr
	if custCompany != "" {
		if custAddr != "" && custAddr != "Registered Address" {
			custLine2 = fmt.Sprintf("%s - %s", custCompany, custAddr)
		} else {
			custLine2 = custCompany
		}
	} else if custAddr == "Registered Address" {
		custLine2 = "(Registered Address)"
	}

	contactSupplier := fmt.Sprintf("Contact  :  %s   |   %s", compPhone, compEmail)
	contactRecipient := "Contact  :  -"
	if custPhone != "" && custEmail != "" {
		contactRecipient = fmt.Sprintf("Contact  :  %s   |   %s", custPhone, custEmail)
	} else if custPhone != "" {
		contactRecipient = fmt.Sprintf("Contact  :  %s", custPhone)
	} else if custEmail != "" {
		contactRecipient = fmt.Sprintf("Contact  :  %s", custEmail)
	}

	m.AddRows(
		// Card Badge Header Bars
		row.New(5.5).Add(
			col.New(6).WithStyle(badgeSupplierStyle).Add(
				text.New("BILLED BY (SUPPLIER)", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Top: 1.2, Left: 2, Color: ColorWhite}),
			),
			col.New(6).WithStyle(badgeRecipientStyle).Add(
				text.New("BILLED TO (RECIPIENT)", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Top: 1.2, Left: 2, Color: ColorWhite}),
			),
		),
		// Card Body Content
		row.New(23).Add(
			col.New(6).WithStyle(cardStyle).Add(
				text.New(compName, props.Text{Family: fontName, Style: fontstyle.Bold, Size: 8.5, Top: 2, Left: 2, Color: ColorNavyText}),
				text.New(compAddr, props.Text{Family: fontName, Size: 6.5, Top: 6.5, Left: 2, Color: ColorNavySecondary}),
				text.New(fmt.Sprintf("GSTIN : %s       PAN : %s", compGstin, compPan), props.Text{Family: fontName, Style: fontstyle.Bold, Size: 6.5, Top: 11, Left: 2, Color: ColorNavyText}),
				text.New(contactSupplier, props.Text{Family: fontName, Size: 6.5, Top: 15.5, Left: 2, Color: ColorNavySecondary}),
			),
			col.New(6).WithStyle(cardStyle).Add(
				text.New(custName, props.Text{Family: fontName, Style: fontstyle.Bold, Size: 8.5, Top: 2, Left: 2, Color: ColorNavyText}),
				text.New(custLine2, props.Text{Family: fontName, Size: 6.5, Top: 6.5, Left: 2, Color: ColorNavySecondary}),
				text.New(fmt.Sprintf("GSTIN : %s", custGstin), props.Text{Family: fontName, Style: fontstyle.Bold, Size: 6.5, Top: 11, Left: 2, Color: ColorNavyText}),
				text.New(contactRecipient, props.Text{Family: fontName, Size: 6.5, Top: 15.5, Left: 2, Color: ColorNavySecondary}),
			),
		),
	)

	m.AddRows(row.New(3).Add(col.New(12)))

	// 3. LINE ITEMS TABLE HEADER - Solid Deep Navy Background (#0B2545)
	thStyle := &props.Cell{
		BackgroundColor: ColorHeaderBg,
		BorderColor:     ColorHeaderBg,
		BorderType:      border.Full,
		BorderThickness: 0.5,
	}

	m.AddRows(
		row.New(7).Add(
			col.New(1).WithStyle(thStyle).Add(text.New("#", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Align: align.Center, Top: 1.8, Color: ColorWhite})),
			col.New(4).WithStyle(thStyle).Add(text.New("Item Description", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Left: 2, Top: 1.8, Color: ColorWhite})),
			col.New(1).WithStyle(thStyle).Add(text.New("HSN/SAC", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Align: align.Center, Top: 1.8, Color: ColorWhite})),
			col.New(1).WithStyle(thStyle).Add(text.New("Quantity", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Align: align.Center, Top: 1.8, Color: ColorWhite})),
			col.New(2).WithStyle(thStyle).Add(text.New("Unit Price (₹)", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Align: align.Right, Right: 2, Top: 1.8, Color: ColorWhite})),
			col.New(1).WithStyle(thStyle).Add(text.New("GST %", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Align: align.Center, Top: 1.8, Color: ColorWhite})),
			col.New(2).WithStyle(thStyle).Add(text.New("Total (₹)", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Align: align.Right, Right: 2, Top: 1.8, Color: ColorWhite})),
		),
	)

	// 4. LINE ITEMS TABLE ROWS
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
				col.New(2).WithStyle(cStyle).Add(text.New(formatCurrency(item.LineTotal, quote.Currency, fontName), props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7.5, Align: align.Right, Right: 2, Top: 1.5, Color: ColorNavyText})),
			),
		)
	}

	m.AddRows(row.New(3).Add(col.New(12)))

	// 5. TAX BREAKDOWN & FINANCIAL SUMMARY (Side-by-Side Matching Reference)
	taxTableBg := &props.Cell{
		BackgroundColor: ColorSubHeaderBg,
		BorderColor:     ColorLightBorder,
		BorderType:      border.Bottom,
		BorderThickness: 0.5,
	}

	m.AddRows(
		row.New(5).Add(
			col.New(6).WithStyle(taxTableBg).Add(
				text.New("GST TAX BREAKDOWN", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Left: 2, Top: 1.2, Color: ColorPrimaryTeal}),
			),
			col.New(6).WithStyle(taxTableBg).Add(
				text.New("QUOTATION SUMMARY", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Left: 2, Top: 1.2, Color: ColorPrimaryTeal}),
			),
		),
	)

	taxableAmt := quote.TaxableAmount
	if taxableAmt == 0 {
		taxableAmt = quote.Subtotal - quote.DiscountAmount
	}

	// 4-Column GST Sub-Table Headers & Values
	cgstHeader := "CGST (9%)"
	sgstHeader := "SGST (9%)"
	cgstVal := formatCurrency(quote.CGSTAmount, quote.Currency, fontName)
	sgstVal := formatCurrency(quote.SGSTAmount, quote.Currency, fontName)
	if quote.IsInterState {
		cgstHeader = "IGST (18%)"
		sgstHeader = "-"
		cgstVal = formatCurrency(quote.IGSTAmount, quote.Currency, fontName)
		sgstVal = "-"
	}

	subThStyle := &props.Cell{
		BackgroundColor: ColorCardBg,
		BorderColor:     ColorLightBorder,
		BorderType:      border.Full,
		BorderThickness: 0.35,
	}

	m.AddRows(
		// Sub-table header row
		row.New(5).Add(
			col.New(2).WithStyle(subThStyle).Add(text.New("Taxable Value", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 6.5, Align: align.Center, Top: 1, Color: ColorNavyText})),
			col.New(1).WithStyle(subThStyle).Add(text.New(cgstHeader, props.Text{Family: fontName, Style: fontstyle.Bold, Size: 6.5, Align: align.Center, Top: 1, Color: ColorNavyText})),
			col.New(1).WithStyle(subThStyle).Add(text.New(sgstHeader, props.Text{Family: fontName, Style: fontstyle.Bold, Size: 6.5, Align: align.Center, Top: 1, Color: ColorNavyText})),
			col.New(2).WithStyle(subThStyle).Add(text.New("Total GST", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 6.5, Align: align.Center, Top: 1, Color: ColorNavyText})),
			col.New(3).WithStyle(trBorder).Add(text.New("Taxable Amount", props.Text{Family: fontName, Size: 7, Left: 2, Top: 1, Color: ColorNavySecondary})),
			col.New(3).WithStyle(trBorder).Add(text.New(formatCurrency(taxableAmt, quote.Currency, fontName), props.Text{Family: fontName, Size: 7.5, Align: align.Right, Right: 2, Top: 1, Color: ColorNavyText})),
		),
		// Sub-table values row
		row.New(5).Add(
			col.New(2).WithStyle(subThStyle).Add(text.New(formatCurrency(taxableAmt, quote.Currency, fontName), props.Text{Family: fontName, Size: 6.5, Align: align.Center, Top: 1, Color: ColorNavyText})),
			col.New(1).WithStyle(subThStyle).Add(text.New(cgstVal, props.Text{Family: fontName, Size: 6.5, Align: align.Center, Top: 1, Color: ColorNavyText})),
			col.New(1).WithStyle(subThStyle).Add(text.New(sgstVal, props.Text{Family: fontName, Size: 6.5, Align: align.Center, Top: 1, Color: ColorNavyText})),
			col.New(2).WithStyle(subThStyle).Add(text.New(formatCurrency(quote.TotalGSTAmount, quote.Currency, fontName), props.Text{Family: fontName, Size: 6.5, Align: align.Center, Top: 1, Color: ColorNavyText})),
			col.New(3).WithStyle(trBorder).Add(text.New("Total GST Tax", props.Text{Family: fontName, Size: 7, Left: 2, Top: 1, Color: ColorNavySecondary})),
			col.New(3).WithStyle(trBorder).Add(text.New(formatCurrency(quote.TotalGSTAmount, quote.Currency, fontName), props.Text{Family: fontName, Size: 7.5, Align: align.Right, Right: 2, Top: 1, Color: ColorNavyText})),
		),
		// Total Tax & Grand Total
		row.New(6).Add(
			col.New(3).WithStyle(trBorder).Add(
				text.New("Total Tax", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7.5, Left: 2, Top: 1.5, Color: ColorNavyText}),
			),
			col.New(3).WithStyle(trBorder).Add(
				text.New(formatCurrency(quote.TotalGSTAmount, quote.Currency, fontName), props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7.5, Align: align.Right, Right: 2, Top: 1.5, Color: ColorNavyText}),
			),
			col.New(3).WithStyle(trBorder).Add(
				text.New("Grand Total", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 8.5, Left: 2, Top: 1.5, Color: ColorNavyText}),
			),
			col.New(3).WithStyle(trBorder).Add(
				text.New(formatCurrency(quote.TotalAmount, quote.Currency, fontName), props.Text{Family: fontName, Style: fontstyle.Bold, Size: 9.5, Align: align.Right, Right: 2, Top: 1.5, Color: ColorNavyText}),
			),
		),
	)

	// Emerald Highlighted Total Payable Card
	emeraldCardStyle := &props.Cell{
		BackgroundColor: ColorPaidBg,
		BorderColor:     ColorBadgePaid,
		BorderType:      border.Full,
		BorderThickness: 0.5,
	}

	m.AddRows(
		row.New(6.5).Add(
			col.New(3).WithStyle(trBorder).Add(
				text.New("Total Payable", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7.5, Left: 2, Top: 1.5, Color: ColorNavyText}),
			),
			col.New(3).WithStyle(trBorder).Add(
				text.New(formatCurrency(quote.TotalAmount, quote.Currency, fontName), props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7.5, Align: align.Right, Right: 2, Top: 1.5, Color: ColorNavyText}),
			),
			col.New(6).WithStyle(emeraldCardStyle).Add(
				text.New("[✓]  Total Payable", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 8, Left: 3, Top: 1.5, Color: ColorBadgePaid}),
				text.New(formatCurrency(quote.TotalAmount, quote.Currency, fontName), props.Text{Family: fontName, Style: fontstyle.Bold, Size: 9.5, Align: align.Right, Right: 3, Top: 1.5, Color: ColorBadgePaid}),
			),
		),
	)

	m.AddRows(row.New(3).Add(col.New(12)))

	// 6. BANK DETAILS & TERMS & SIGNATORY (3 Columns)
	termsStr := "1. Quotation is valid for 30 days from date of issue.\n2. Payment terms: 50% advance, 50% upon delivery.\n3. Goods & Services Tax (GST) as applicable by Indian Tax Law."
	if quote.TermsAndConditions != nil && *quote.TermsAndConditions != "" {
		termsStr = *quote.TermsAndConditions
	}

	termLines := parseTermsLines(termsStr)
	var termComponents []core.Component
	termComponents = append(termComponents, text.New("PAYMENT INSTRUCTIONS", props.Text{
		Family: fontName, Style: fontstyle.Bold, Size: 7, Top: 2, Left: 2, Color: ColorPrimaryTeal,
	}))
	topPos := 5.5
	for idx, l := range termLines {
		if idx >= 4 {
			break
		}
		termComponents = append(termComponents, text.New(l, props.Text{
			Family: fontName, Size: 6.5, Top: topPos, Left: 2, Color: ColorNavySecondary,
		}))
		topPos += 3.5
	}

	m.AddRows(
		row.New(22).Add(
			col.New(4).WithStyle(cardStyle).Add(
				text.New("BANK & PAYMENT DETAILS", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Top: 2, Left: 2, Color: ColorPrimaryTeal}),
				text.New("Bank: HDFC Bank Ltd.", props.Text{Family: fontName, Size: 7, Top: 5.5, Left: 2, Color: ColorNavyText}),
				text.New("A/c No: 50200012345678", props.Text{Family: fontName, Size: 7, Top: 9, Left: 2, Color: ColorNavyText}),
				text.New("IFSC Code: HDFC0001234", props.Text{Family: fontName, Size: 7, Top: 12.5, Left: 2, Color: ColorNavyText}),
				text.New("Branch: Cyber City Branch, Pune", props.Text{Family: fontName, Size: 7, Top: 16, Left: 2, Color: ColorNavySecondary}),
			),
			col.New(5).WithStyle(cardStyle).Add(termComponents...),
			col.New(3).WithStyle(cardStyle).Add(
				text.New("For "+compName, props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Align: align.Center, Top: 2, Color: ColorNavyText}),
				// Signature Graphic / Line
				text.New("~ Achyut / Auth ~", props.Text{Family: fontName, Style: fontstyle.Italic, Size: 7.5, Align: align.Center, Top: 10, Color: ColorNavySecondary}),
				text.New("Authorized Signatory", props.Text{Family: fontName, Size: 6.5, Align: align.Center, Top: 16.5, Color: ColorNavySecondary}),
			),
		),
	)

	// 7. BOTTOM TRUST BADGES FOOTER STRIP
	m.AddRows(
		row.New(4).Add(col.New(12)),
		row.New(5).Add(
			col.New(3).Add(text.New("[✓] 100% Secure Payments", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 6.5, Color: ColorPrimaryTeal, Top: 1})),
			col.New(3).Add(text.New("[⚡] Fast & Reliable Service", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 6.5, Color: ColorPrimaryTeal, Top: 1})),
			col.New(3).Add(text.New("[☎] Dedicated Support", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 6.5, Color: ColorPrimaryTeal, Top: 1})),
			col.New(3).Add(text.New("Thank you for your business!", props.Text{Family: fontName, Style: fontstyle.Italic, Size: 7, Color: ColorNavyText, Align: align.Right, Top: 1})),
		),
	)

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

	compName := "InCraax AI Automation Pvt Ltd"
	compAddr := "2nd Floor, Snehadeep Building, Ram Nagar-Road, Warje, Pune, 411058"
	compGstin := "27ABCDE1234F1Z5"
	compPan := "ABCDE1234F"
	compState := "Maharashtra"
	compEmail := "akshadasagar31@gmail.com"
	compPhone := "+91 9172001627"

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
	custName := "prerna sagar"
	custCompany := ""
	custAddr := "Registered Address"
	custState := compState
	custGstin := "Unregistered"
	custPhone := "8237133807"
	custEmail := "akshadasagar24@gmail.com"

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
		if inv.Customer.Phone != nil && *inv.Customer.Phone != "" {
			custPhone = *inv.Customer.Phone
		}
		if inv.Customer.Email != nil && *inv.Customer.Email != "" {
			custEmail = *inv.Customer.Email
		}
	}
	if inv.CustomerState != nil && *inv.CustomerState != "" {
		custState = *inv.CustomerState
	}
	if inv.CustomerGSTIN != nil && *inv.CustomerGSTIN != "" {
		custGstin = *inv.CustomerGSTIN
	}

	// 1. TOP HEADER (3 Columns: Logo & Tagline | Centered TAX INVOICE + Teal Pill | Date/Due/Supply Metadata)
	dateStr := inv.InvoiceDate.Format("02-Jan-2006")
	dueDateStr := "-"
	if inv.DueDate != nil {
		dueDateStr = inv.DueDate.Format("02-Jan-2006")
	}

	posType := "Intra-State (CGST + SGST)"
	if inv.IsInterState {
		posType = "Inter-State (IGST)"
	}

	hasLogo := len(logoBytes) > 0
	ext := extension.Png
	if hasLogo {
		ext = parseImageExtension(logoMime)
	}

	pillCardStyle := &props.Cell{
		BackgroundColor: ColorPrimaryTeal,
		BorderColor:     ColorPrimaryTeal,
		BorderType:      border.Full,
		BorderThickness: 0.5,
	}

	var logoComponents []core.Component
	if hasLogo {
		logoComponents = append(logoComponents, image.NewFromBytes(logoBytes, ext, props.Rect{Percent: 90, Center: false}))
	} else {
		logoComponents = append(logoComponents,
			text.New(compName, props.Text{Family: fontName, Style: fontstyle.Bold, Size: 11, Color: ColorNavyText, Top: 1}),
			text.New("Smart Automation. Smarter Business.", props.Text{Family: fontName, Style: fontstyle.Italic, Size: 6.5, Color: ColorNavySecondary, Top: 5.5}),
		)
	}

	m.AddRows(
		row.New(16).Add(
			// Left: Logo & Company Name
			col.New(4).Add(logoComponents...),
			// Center: Title
			col.New(4).Add(
				text.New("TAX INVOICE", props.Text{
					Family: fontName,
					Style:  fontstyle.Bold,
					Size:   14,
					Align:  align.Center,
					Color:  ColorNavyText,
				}),
			),
			// Right: Metadata Lines
			col.New(4).Add(
				text.New(fmt.Sprintf("Invoice Date       : %s", dateStr), props.Text{Family: fontName, Size: 6.5, Align: align.Right, Top: 1, Color: ColorNavyText}),
				text.New(fmt.Sprintf("Payment Due Date: %s", dueDateStr), props.Text{Family: fontName, Size: 6.5, Align: align.Right, Top: 5, Color: ColorNavyText}),
				text.New(fmt.Sprintf("Place of Supply   : %s - %s", custState, posType), props.Text{Family: fontName, Size: 6.5, Align: align.Right, Top: 9, Color: ColorNavyText}),
			),
		),
		// Sub-row for centered pill badge
		row.New(6).Add(
			col.New(4),
			col.New(4).WithStyle(pillCardStyle).Add(
				text.New(fmt.Sprintf("Invoice #%s", inv.InvoiceNumber), props.Text{
					Family: fontName,
					Style:  fontstyle.Bold,
					Size:   8,
					Align:  align.Center,
					Top:    1.2,
					Color:  ColorWhite,
				}),
			),
			col.New(4),
		),
	)

	// Thin Teal Divider Line
	m.AddRows(
		row.New(3).Add(
			col.New(12).Add(
				line.New(props.Line{Color: ColorPrimaryTeal, Thickness: 0.8}),
			),
		),
	)

	// 2. PARTY CARDS (Billed By Supplier vs Billed To Recipient)
	cardStyle := &props.Cell{
		BackgroundColor: ColorCardBg,
		BorderColor:     ColorLightBorder,
		BorderType:      border.Full,
		BorderThickness: 0.35,
	}

	badgeSupplierStyle := &props.Cell{
		BackgroundColor: ColorPrimaryTeal,
		BorderColor:     ColorPrimaryTeal,
		BorderType:      border.Full,
		BorderThickness: 0.5,
	}

	badgeRecipientStyle := &props.Cell{
		BackgroundColor: ColorRoyalBlue,
		BorderColor:     ColorRoyalBlue,
		BorderType:      border.Full,
		BorderThickness: 0.5,
	}

	custLine2 := custAddr
	if custCompany != "" {
		if custAddr != "" && custAddr != "Registered Address" {
			custLine2 = fmt.Sprintf("%s - %s", custCompany, custAddr)
		} else {
			custLine2 = custCompany
		}
	} else if custAddr == "Registered Address" {
		custLine2 = "(Registered Address)"
	}

	contactSupplier := fmt.Sprintf("Contact  :  %s   |   %s", compPhone, compEmail)
	contactRecipient := "Contact  :  -"
	if custPhone != "" && custEmail != "" {
		contactRecipient = fmt.Sprintf("Contact  :  %s   |   %s", custPhone, custEmail)
	} else if custPhone != "" {
		contactRecipient = fmt.Sprintf("Contact  :  %s", custPhone)
	} else if custEmail != "" {
		contactRecipient = fmt.Sprintf("Contact  :  %s", custEmail)
	}

	m.AddRows(
		// Card Badge Header Bars
		row.New(5.5).Add(
			col.New(6).WithStyle(badgeSupplierStyle).Add(
				text.New("BILLED BY (SUPPLIER)", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Top: 1.2, Left: 2, Color: ColorWhite}),
			),
			col.New(6).WithStyle(badgeRecipientStyle).Add(
				text.New("BILLED TO (RECIPIENT)", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Top: 1.2, Left: 2, Color: ColorWhite}),
			),
		),
		// Card Body Content
		row.New(23).Add(
			col.New(6).WithStyle(cardStyle).Add(
				text.New(compName, props.Text{Family: fontName, Style: fontstyle.Bold, Size: 8.5, Top: 2, Left: 2, Color: ColorNavyText}),
				text.New(compAddr, props.Text{Family: fontName, Size: 6.5, Top: 6.5, Left: 2, Color: ColorNavySecondary}),
				text.New(fmt.Sprintf("GSTIN : %s       PAN : %s", compGstin, compPan), props.Text{Family: fontName, Style: fontstyle.Bold, Size: 6.5, Top: 11, Left: 2, Color: ColorNavyText}),
				text.New(contactSupplier, props.Text{Family: fontName, Size: 6.5, Top: 15.5, Left: 2, Color: ColorNavySecondary}),
			),
			col.New(6).WithStyle(cardStyle).Add(
				text.New(custName, props.Text{Family: fontName, Style: fontstyle.Bold, Size: 8.5, Top: 2, Left: 2, Color: ColorNavyText}),
				text.New(custLine2, props.Text{Family: fontName, Size: 6.5, Top: 6.5, Left: 2, Color: ColorNavySecondary}),
				text.New(fmt.Sprintf("GSTIN : %s", custGstin), props.Text{Family: fontName, Style: fontstyle.Bold, Size: 6.5, Top: 11, Left: 2, Color: ColorNavyText}),
				text.New(contactRecipient, props.Text{Family: fontName, Size: 6.5, Top: 15.5, Left: 2, Color: ColorNavySecondary}),
			),
		),
	)

	m.AddRows(row.New(3).Add(col.New(12)))

	// 3. INVOICE LINE ITEMS TABLE HEADER - Solid Deep Navy Background (#0B2545)
	thStyle := &props.Cell{
		BackgroundColor: ColorHeaderBg,
		BorderColor:     ColorHeaderBg,
		BorderType:      border.Full,
		BorderThickness: 0.5,
	}

	m.AddRows(
		row.New(7).Add(
			col.New(1).WithStyle(thStyle).Add(text.New("#", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Align: align.Center, Top: 1.8, Color: ColorWhite})),
			col.New(4).WithStyle(thStyle).Add(text.New("Item Description", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Left: 2, Top: 1.8, Color: ColorWhite})),
			col.New(1).WithStyle(thStyle).Add(text.New("HSN/SAC", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Align: align.Center, Top: 1.8, Color: ColorWhite})),
			col.New(1).WithStyle(thStyle).Add(text.New("Quantity", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Align: align.Center, Top: 1.8, Color: ColorWhite})),
			col.New(2).WithStyle(thStyle).Add(text.New("Unit Price (₹)", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Align: align.Right, Right: 2, Top: 1.8, Color: ColorWhite})),
			col.New(1).WithStyle(thStyle).Add(text.New("GST %", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Align: align.Center, Top: 1.8, Color: ColorWhite})),
			col.New(2).WithStyle(thStyle).Add(text.New("Total (₹)", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Align: align.Right, Right: 2, Top: 1.8, Color: ColorWhite})),
		),
	)

	// 4. LINE ITEMS TABLE ROWS
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

	// 5. TAX BREAKDOWN & FINANCIAL SUMMARY (Side-by-Side Matching Reference)
	taxTableBg := &props.Cell{
		BackgroundColor: ColorSubHeaderBg,
		BorderColor:     ColorLightBorder,
		BorderType:      border.Bottom,
		BorderThickness: 0.5,
	}

	m.AddRows(
		row.New(5).Add(
			col.New(6).WithStyle(taxTableBg).Add(
				text.New("GST TAX BREAKDOWN", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Left: 2, Top: 1.2, Color: ColorPrimaryTeal}),
			),
			col.New(6).WithStyle(taxTableBg).Add(
				text.New("INVOICE SUMMARY", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Left: 2, Top: 1.2, Color: ColorPrimaryTeal}),
			),
		),
	)

	taxableAmt := inv.TaxableAmount
	if taxableAmt == 0 {
		taxableAmt = inv.Subtotal - inv.DiscountAmount
	}

	cgstHeader := "CGST (9%)"
	sgstHeader := "SGST (9%)"
	cgstVal := formatCurrency(inv.CGSTAmount, inv.Currency, fontName)
	sgstVal := formatCurrency(inv.SGSTAmount, inv.Currency, fontName)
	if inv.IsInterState {
		cgstHeader = "IGST (18%)"
		sgstHeader = "-"
		cgstVal = formatCurrency(inv.IGSTAmount, inv.Currency, fontName)
		sgstVal = "-"
	}

	subThStyle := &props.Cell{
		BackgroundColor: ColorCardBg,
		BorderColor:     ColorLightBorder,
		BorderType:      border.Full,
		BorderThickness: 0.35,
	}

	m.AddRows(
		// Sub-table header row
		row.New(5).Add(
			col.New(2).WithStyle(subThStyle).Add(text.New("Taxable Value", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 6.5, Align: align.Center, Top: 1, Color: ColorNavyText})),
			col.New(1).WithStyle(subThStyle).Add(text.New(cgstHeader, props.Text{Family: fontName, Style: fontstyle.Bold, Size: 6.5, Align: align.Center, Top: 1, Color: ColorNavyText})),
			col.New(1).WithStyle(subThStyle).Add(text.New(sgstHeader, props.Text{Family: fontName, Style: fontstyle.Bold, Size: 6.5, Align: align.Center, Top: 1, Color: ColorNavyText})),
			col.New(2).WithStyle(subThStyle).Add(text.New("Total GST", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 6.5, Align: align.Center, Top: 1, Color: ColorNavyText})),
			col.New(3).WithStyle(trBorder).Add(text.New("Taxable Amount", props.Text{Family: fontName, Size: 7, Left: 2, Top: 1, Color: ColorNavySecondary})),
			col.New(3).WithStyle(trBorder).Add(text.New(formatCurrency(taxableAmt, inv.Currency, fontName), props.Text{Family: fontName, Size: 7.5, Align: align.Right, Right: 2, Top: 1, Color: ColorNavyText})),
		),
		// Sub-table values row
		row.New(5).Add(
			col.New(2).WithStyle(subThStyle).Add(text.New(formatCurrency(taxableAmt, inv.Currency, fontName), props.Text{Family: fontName, Size: 6.5, Align: align.Center, Top: 1, Color: ColorNavyText})),
			col.New(1).WithStyle(subThStyle).Add(text.New(cgstVal, props.Text{Family: fontName, Size: 6.5, Align: align.Center, Top: 1, Color: ColorNavyText})),
			col.New(1).WithStyle(subThStyle).Add(text.New(sgstVal, props.Text{Family: fontName, Size: 6.5, Align: align.Center, Top: 1, Color: ColorNavyText})),
			col.New(2).WithStyle(subThStyle).Add(text.New(formatCurrency(inv.TotalTax, inv.Currency, fontName), props.Text{Family: fontName, Size: 6.5, Align: align.Center, Top: 1, Color: ColorNavyText})),
			col.New(3).WithStyle(trBorder).Add(text.New("Total GST Tax", props.Text{Family: fontName, Size: 7, Left: 2, Top: 1, Color: ColorNavySecondary})),
			col.New(3).WithStyle(trBorder).Add(text.New(formatCurrency(inv.TotalTax, inv.Currency, fontName), props.Text{Family: fontName, Size: 7.5, Align: align.Right, Right: 2, Top: 1, Color: ColorNavyText})),
		),
		// Total Tax & Grand Total
		row.New(6).Add(
			col.New(3).WithStyle(trBorder).Add(
				text.New("Total Tax", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7.5, Left: 2, Top: 1.5, Color: ColorNavyText}),
			),
			col.New(3).WithStyle(trBorder).Add(
				text.New(formatCurrency(inv.TotalTax, inv.Currency, fontName), props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7.5, Align: align.Right, Right: 2, Top: 1.5, Color: ColorNavyText}),
			),
			col.New(3).WithStyle(trBorder).Add(
				text.New("Grand Total", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 8.5, Left: 2, Top: 1.5, Color: ColorNavyText}),
			),
			col.New(3).WithStyle(trBorder).Add(
				text.New(formatCurrency(inv.GrandTotal, inv.Currency, fontName), props.Text{Family: fontName, Style: fontstyle.Bold, Size: 9.5, Align: align.Right, Right: 2, Top: 1.5, Color: ColorNavyText}),
			),
		),
		// Amount Paid
		row.New(5).Add(
			col.New(3).WithStyle(trBorder).Add(
				text.New("Amount Paid", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Left: 2, Top: 1.2, Color: ColorBadgePaid}),
			),
			col.New(3).WithStyle(trBorder).Add(
				text.New(formatCurrency(inv.AmountPaid, inv.Currency, fontName), props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Align: align.Right, Right: 2, Top: 1.2, Color: ColorBadgePaid}),
			),
			col.New(3).WithStyle(trBorder).Add(
				text.New("Amount Paid", props.Text{Family: fontName, Size: 7, Left: 2, Top: 1.2, Color: ColorNavySecondary}),
			),
			col.New(3).WithStyle(trBorder).Add(
				text.New(formatCurrency(inv.AmountPaid, inv.Currency, fontName), props.Text{Family: fontName, Size: 7.5, Align: align.Right, Right: 2, Top: 1.2, Color: ColorBadgePaid}),
			),
		),
	)

	// Emerald Highlighted Balance Due Card
	emeraldCardStyle := &props.Cell{
		BackgroundColor: ColorPaidBg,
		BorderColor:     ColorBadgePaid,
		BorderType:      border.Full,
		BorderThickness: 0.5,
	}

	balanceText := formatCurrency(inv.RemainingBalance, inv.Currency, fontName)

	m.AddRows(
		row.New(6.5).Add(
			col.New(3).WithStyle(trBorder).Add(
				text.New("Balance Due", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7.5, Left: 2, Top: 1.5, Color: ColorNavyText}),
			),
			col.New(3).WithStyle(trBorder).Add(
				text.New(balanceText, props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7.5, Align: align.Right, Right: 2, Top: 1.5, Color: ColorNavyText}),
			),
			col.New(6).WithStyle(emeraldCardStyle).Add(
				text.New("[✓]  Balance Due", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 8, Left: 3, Top: 1.5, Color: ColorBadgePaid}),
				text.New(balanceText, props.Text{Family: fontName, Style: fontstyle.Bold, Size: 9.5, Align: align.Right, Right: 3, Top: 1.5, Color: ColorBadgePaid}),
			),
		),
	)

	// 6. RECORDED PAYMENTS AUDIT TRAIL
	if len(inv.Payments) > 0 {
		m.AddRows(row.New(2).Add(col.New(12)))
		m.AddRows(
			row.New(5).Add(
				col.New(12).WithStyle(taxTableBg).Add(
					text.New("RECORDED PAYMENTS AUDIT TRAIL", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Left: 2, Top: 1, Color: ColorPrimaryTeal}),
				),
			),
			row.New(5).Add(
				col.New(3).WithStyle(subThStyle).Add(text.New("Date", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Left: 2, Top: 1.2, Color: ColorNavyText})),
				col.New(3).WithStyle(subThStyle).Add(text.New("Method", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Left: 2, Top: 1.2, Color: ColorNavyText})),
				col.New(3).WithStyle(subThStyle).Add(text.New("Reference #", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Left: 2, Top: 1.2, Color: ColorNavyText})),
				col.New(3).WithStyle(subThStyle).Add(text.New("Amount Paid", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Align: align.Right, Right: 2, Top: 1.2, Color: ColorNavyText})),
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

	// 7. BANK DETAILS & TERMS & SIGNATORY (3 Columns)
	termsStr := "1. Please pay by the due date to avoid service interruption.\n2. Remit payments via NEFT/RTGS to the bank account listed.\n3. Include the invoice number in the payment reference."
	if inv.TermsAndConditions != nil && *inv.TermsAndConditions != "" {
		termsStr = *inv.TermsAndConditions
	}

	instructionLines := parseTermsLines(termsStr)
	var instructionComponents []core.Component
	instructionComponents = append(instructionComponents, text.New("PAYMENT INSTRUCTIONS", props.Text{
		Family: fontName, Style: fontstyle.Bold, Size: 7, Top: 2, Left: 2, Color: ColorPrimaryTeal,
	}))
	topPos := 5.5
	for idx, l := range instructionLines {
		if idx >= 4 {
			break
		}
		instructionComponents = append(instructionComponents, text.New(l, props.Text{
			Family: fontName, Size: 6.5, Top: topPos, Left: 2, Color: ColorNavySecondary,
		}))
		topPos += 3.5
	}

	m.AddRows(
		row.New(22).Add(
			col.New(4).WithStyle(cardStyle).Add(
				text.New("BANK & PAYMENT DETAILS", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Top: 2, Left: 2, Color: ColorPrimaryTeal}),
				text.New("Bank: HDFC Bank Ltd.", props.Text{Family: fontName, Size: 7, Top: 5.5, Left: 2, Color: ColorNavyText}),
				text.New("A/c No: 50200012345678", props.Text{Family: fontName, Size: 7, Top: 9, Left: 2, Color: ColorNavyText}),
				text.New("IFSC Code: HDFC0001234", props.Text{Family: fontName, Size: 7, Top: 12.5, Left: 2, Color: ColorNavyText}),
				text.New("Branch: Cyber City Branch, Pune", props.Text{Family: fontName, Size: 7, Top: 16, Left: 2, Color: ColorNavySecondary}),
			),
			col.New(5).WithStyle(cardStyle).Add(instructionComponents...),
			col.New(3).WithStyle(cardStyle).Add(
				text.New("For "+compName, props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Align: align.Center, Top: 2, Color: ColorNavyText}),
				// Signature Graphic / Line
				text.New("~ Achyut / Auth ~", props.Text{Family: fontName, Style: fontstyle.Italic, Size: 7.5, Align: align.Center, Top: 10, Color: ColorNavySecondary}),
				text.New("Authorized Signatory", props.Text{Family: fontName, Size: 6.5, Align: align.Center, Top: 16.5, Color: ColorNavySecondary}),
			),
		),
	)

	// 8. BOTTOM TRUST BADGES FOOTER STRIP
	m.AddRows(
		row.New(4).Add(col.New(12)),
		row.New(5).Add(
			col.New(3).Add(text.New("[✓] 100% Secure Payments", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 6.5, Color: ColorPrimaryTeal, Top: 1})),
			col.New(3).Add(text.New("[⚡] Fast & Reliable Service", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 6.5, Color: ColorPrimaryTeal, Top: 1})),
			col.New(3).Add(text.New("[☎] Dedicated Support", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 6.5, Color: ColorPrimaryTeal, Top: 1})),
			col.New(3).Add(text.New("Thank you for your business!", props.Text{Family: fontName, Style: fontstyle.Italic, Size: 7, Color: ColorNavyText, Align: align.Right, Top: 1})),
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

	compName := "InCraax AI Automation Pvt Ltd"
	compAddr := "2nd Floor, Snehadeep Building, Ram Nagar-Road, Warje, Pune, 411058"
	compGstin := "27ABCDE1234F1Z5"
	compPan := "AAACB2233M"
	compState := "Maharashtra"
	compEmail := "billing@incraax.com"
	compPhone := "+91 9172001627"

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
	_ = compGstin
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

	hasLogo := len(logoBytes) > 0
	ext := extension.Png
	if hasLogo {
		ext = parseImageExtension(logoMime)
	}

	pillCardStyle := &props.Cell{
		BackgroundColor: ColorPrimaryTeal,
		BorderColor:     ColorPrimaryTeal,
		BorderType:      border.Full,
		BorderThickness: 0.5,
	}

	var logoComponents []core.Component
	if hasLogo {
		logoComponents = append(logoComponents, image.NewFromBytes(logoBytes, ext, props.Rect{Percent: 90, Center: false}))
	} else {
		logoComponents = append(logoComponents,
			text.New(compName, props.Text{Family: fontName, Style: fontstyle.Bold, Size: 11, Color: ColorNavyText, Top: 1}),
			text.New("Smart Automation. Smarter Business.", props.Text{Family: fontName, Style: fontstyle.Italic, Size: 6.5, Color: ColorNavySecondary, Top: 5.5}),
		)
	}

	// 1. HEADER SECTION
	m.AddRows(
		row.New(16).Add(
			col.New(4).Add(logoComponents...),
			col.New(4).Add(
				text.New("OFFICIAL PAYMENT RECEIPT", props.Text{
					Family: fontName,
					Style:  fontstyle.Bold,
					Size:   13,
					Align:  align.Center,
					Color:  ColorNavyText,
				}),
			),
			col.New(4).Add(
				text.New(fmt.Sprintf("Receipt Date       : %s", receiptDate), props.Text{Family: fontName, Size: 6.5, Align: align.Right, Top: 1, Color: ColorNavyText}),
				text.New(fmt.Sprintf("Recorded By        : %s", recordedBy), props.Text{Family: fontName, Size: 6.5, Align: align.Right, Top: 5, Color: ColorNavyText}),
				text.New(fmt.Sprintf("Company State      : %s", compState), props.Text{Family: fontName, Size: 6.5, Align: align.Right, Top: 9, Color: ColorNavyText}),
			),
		),
		row.New(6).Add(
			col.New(4),
			col.New(4).WithStyle(pillCardStyle).Add(
				text.New(fmt.Sprintf("Voucher #%s", voucherNum), props.Text{
					Family: fontName,
					Style:  fontstyle.Bold,
					Size:   8,
					Align:  align.Center,
					Top:    1.2,
					Color:  ColorWhite,
				}),
			),
			col.New(4),
		),
	)

	// Thin Teal Divider Line
	m.AddRows(
		row.New(3).Add(
			col.New(12).Add(
				line.New(props.Line{Color: ColorPrimaryTeal, Thickness: 0.8}),
			),
		),
	)

	cardStyle := &props.Cell{
		BackgroundColor: ColorCardBg,
		BorderType:      border.Full,
		BorderColor:     ColorLightBorder,
		BorderThickness: 0.35,
	}

	badgeSupplierStyle := &props.Cell{
		BackgroundColor: ColorPrimaryTeal,
		BorderColor:     ColorPrimaryTeal,
		BorderType:      border.Full,
		BorderThickness: 0.5,
	}

	badgeRecipientStyle := &props.Cell{
		BackgroundColor: ColorRoyalBlue,
		BorderColor:     ColorRoyalBlue,
		BorderType:      border.Full,
		BorderThickness: 0.5,
	}

	custSubtitle := "(Registered Address)"
	if custCompany != "" {
		custSubtitle = custCompany
	}

	// 2. RECEIVED FROM & TRANSACTION DETAILS
	m.AddRows(
		row.New(5.5).Add(
			col.New(6).WithStyle(badgeSupplierStyle).Add(
				text.New("PAYMENT SETTLEMENT DETAILS", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Top: 1.2, Left: 2, Color: ColorWhite}),
			),
			col.New(6).WithStyle(badgeRecipientStyle).Add(
				text.New("RECEIVED FROM (CUSTOMER)", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Top: 1.2, Left: 2, Color: ColorWhite}),
			),
		),
		row.New(23).Add(
			col.New(6).WithStyle(cardStyle).Add(
				text.New(fmt.Sprintf("Payment Mode: %s", paymentMode), props.Text{Family: fontName, Style: fontstyle.Bold, Size: 8.5, Top: 2, Left: 2, Color: ColorNavyText}),
				text.New(fmt.Sprintf("Reference / UTR #: %s", refNum), props.Text{Family: fontName, Size: 7, Top: 6.5, Left: 2, Color: ColorNavyText}),
				text.New(fmt.Sprintf("Voucher ID: %s", voucherNum), props.Text{Family: fontName, Size: 6.5, Top: 11, Left: 2, Color: ColorNavySecondary}),
				text.New("Settlement: Commercial Accounts Receivable", props.Text{Family: fontName, Size: 6.5, Top: 15.5, Left: 2, Color: ColorPrimaryTeal}),
			),
			col.New(6).WithStyle(cardStyle).Add(
				text.New(custName, props.Text{Family: fontName, Style: fontstyle.Bold, Size: 8.5, Top: 2, Left: 2, Color: ColorNavyText}),
				text.New(fmt.Sprintf("%s - %s", custSubtitle, custAddr), props.Text{Family: fontName, Size: 6.5, Top: 6.5, Left: 2, Color: ColorNavySecondary}),
				text.New(fmt.Sprintf("Contact: %s", custContact), props.Text{Family: fontName, Size: 6.5, Top: 11, Left: 2, Color: ColorNavySecondary}),
				text.New(fmt.Sprintf("State: %s", compState), props.Text{Family: fontName, Size: 6.5, Top: 15.5, Left: 2, Color: ColorNavySecondary}),
			),
		),
	)

	m.AddRows(row.New(3).Add(col.New(12)))

	// 3. INVOICE ALLOCATION TABLE
	thStyle := &props.Cell{
		BackgroundColor: ColorHeaderBg,
		BorderType:      border.Full,
		BorderColor:     ColorHeaderBg,
		BorderThickness: 0.5,
	}
	trBorder := &props.Cell{
		BorderType:      border.Bottom,
		BorderColor:     ColorLightBorder,
		BorderThickness: 0.35,
	}

	m.AddRows(
		row.New(7).Add(
			col.New(3).WithStyle(thStyle).Add(text.New("LINKED INVOICE #", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Left: 2, Top: 1.8, Color: ColorWhite})),
			col.New(2).WithStyle(thStyle).Add(text.New("INVOICE DATE", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Left: 2, Top: 1.8, Color: ColorWhite})),
			col.New(2).WithStyle(thStyle).Add(text.New("INVOICE TOTAL", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Align: align.Right, Right: 2, Top: 1.8, Color: ColorWhite})),
			col.New(3).WithStyle(thStyle).Add(text.New("AMOUNT APPLIED", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Align: align.Right, Right: 2, Top: 1.8, Color: ColorWhite})),
			col.New(2).WithStyle(thStyle).Add(text.New("BALANCE DUE", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Align: align.Right, Right: 2, Top: 1.8, Color: ColorWhite})),
		),
	)

	invDateStr := "-"
	if receipt.Invoice != nil && !receipt.Invoice.InvoiceDate.IsZero() {
		invDateStr = receipt.Invoice.InvoiceDate.Format("02-Jan-2006")
	}

	balanceColor := ColorBadgePending
	if receipt.Payment.InvoiceRemainingBalance <= 0 {
		balanceColor = ColorBadgePaid
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
				text.New(formatCurrency(receipt.Payment.InvoiceRemainingBalance, receipt.Payment.Currency, fontName), props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7.5, Align: align.Right, Right: 2, Top: 2, Color: balanceColor}),
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
		BackgroundColor: ColorPaidBg,
		BorderType:      border.Full,
		BorderColor:     ColorBadgePaid,
		BorderThickness: 0.5,
	}

	m.AddRows(
		row.New(24).Add(
			col.New(7).WithStyle(cardStyle).Add(
				text.New("AMOUNT RECEIVED IN WORDS", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7, Top: 2, Left: 2, Color: ColorPrimaryTeal}),
				text.New(strings.ToUpper(amountWords), props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7.5, Top: 6, Left: 2, Color: ColorNavyText}),
				text.New("REMARKS & NOTES", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 6.5, Top: 12, Left: 2, Color: ColorNavySecondary}),
				text.New(notesStr, props.Text{Family: fontName, Size: 7, Top: 15.5, Left: 2, Color: ColorNavyText}),
			),
			col.New(5).WithStyle(totalCardStyle).Add(
				text.New("TOTAL RECEIVED", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 8, Align: align.Right, Right: 3, Top: 2, Color: ColorPrimaryTeal}),
				text.New(formatCurrency(receipt.Payment.Amount, receipt.Payment.Currency, fontName), props.Text{
					Family: fontName,
					Style:  fontstyle.Bold,
					Size:   13,
					Align:  align.Right,
					Right:  3,
					Top:    5.5,
					Color:  ColorBadgePaid,
				}),
				text.New(fmt.Sprintf("Remaining Due: %s", formatCurrency(receipt.Payment.InvoiceRemainingBalance, receipt.Payment.Currency, fontName)), props.Text{
					Family: fontName,
					Style:  fontstyle.Bold,
					Size:   7.5,
					Align:  align.Right,
					Right:  3,
					Top:    13,
					Color:  ColorNavyText,
				}),
				text.New(fmt.Sprintf("Invoice Status: %s", strings.ToUpper(receipt.Payment.InvoiceStatus)), props.Text{
					Family: fontName,
					Size:   7,
					Align:  align.Right,
					Right:  3,
					Top:    17,
					Color:  ColorNavySecondary,
				}),
			),
		),
	)

	m.AddRows(row.New(4).Add(col.New(12)))

	// 5. FOOTER & AUTHORIZED SIGNATORY
	rcptTerms := "1. This receipt voucher acknowledges credit of payment against the designated invoice.\n2. In case of cheque or transfer failure, this receipt shall stand void.\n3. This is an electronically generated official voucher and does not require physical stamp."
	rcptTermLines := parseTermsLines(rcptTerms)
	var rcptTermComponents []core.Component
	rcptTermComponents = append(rcptTermComponents, text.New("TERMS & CONDITIONS", props.Text{
		Family: fontName, Style: fontstyle.Bold, Size: 7, Top: 2, Left: 2, Color: ColorPrimaryTeal,
	}))
	topPos := 5.5
	for idx, l := range rcptTermLines {
		if idx >= 4 {
			break
		}
		rcptTermComponents = append(rcptTermComponents, text.New(l, props.Text{
			Family: fontName, Size: 6.5, Top: topPos, Left: 2, Color: ColorNavySecondary,
		}))
		topPos += 3.5
	}

	m.AddRows(
		row.New(22).Add(
			col.New(7).WithStyle(cardStyle).Add(rcptTermComponents...),
			col.New(5).WithStyle(cardStyle).Add(
				text.New("For "+compName, props.Text{Family: fontName, Style: fontstyle.Bold, Size: 7.5, Align: align.Center, Top: 2, Color: ColorNavyText}),
				text.New("~ Achyut / Auth ~", props.Text{Family: fontName, Style: fontstyle.Italic, Size: 7.5, Align: align.Center, Top: 10, Color: ColorNavySecondary}),
				text.New("Authorized Signatory", props.Text{Family: fontName, Size: 6.5, Align: align.Center, Top: 16.5, Color: ColorNavySecondary}),
			),
		),
	)

	// Bottom Trust Footer
	m.AddRows(
		row.New(4).Add(col.New(12)),
		row.New(5).Add(
			col.New(3).Add(text.New("[✓] 100% Secure Payments", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 6.5, Color: ColorPrimaryTeal, Top: 1})),
			col.New(3).Add(text.New("[⚡] Fast & Reliable Service", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 6.5, Color: ColorPrimaryTeal, Top: 1})),
			col.New(3).Add(text.New("[☎] Dedicated Support", props.Text{Family: fontName, Style: fontstyle.Bold, Size: 6.5, Color: ColorPrimaryTeal, Top: 1})),
			col.New(3).Add(text.New("Thank you for your business!", props.Text{Family: fontName, Style: fontstyle.Italic, Size: 7, Color: ColorNavyText, Align: align.Right, Top: 1})),
		),
	)

	doc, err := m.Generate()
	if err != nil {
		return nil, fmt.Errorf("failed to generate payment receipt PDF: %w", err)
	}

	return doc.GetBytes(), nil
}
