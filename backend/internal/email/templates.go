package email

import (
	"fmt"
	"strings"
	"time"
)

// FollowUpReminderData holds context for follow-up notifications
type FollowUpReminderData struct {
	FollowUpID   int
	Title        string
	FollowUpType string
	DueDate      time.Time
	Notes        string
	LeadNumber   string
	LeadName     string
	LeadPhone    string
	LeadEmail    string
	DealID       *int
	DealName     string
	CRMURL       string
}

// RenderFollowUpReminder renders clean HTML and plain-text reminder email
func RenderFollowUpReminder(data FollowUpReminderData) (html string, plainText string) {
	entityDesc := data.LeadName
	if entityDesc == "" {
		entityDesc = data.DealName
	}
	if entityDesc == "" {
		entityDesc = "Customer"
	}

	formattedDate := data.DueDate.Format("Monday, 02 Jan 2006 at 03:04 PM")

	plainText = fmt.Sprintf(`BizCopilot CRM - Follow-up Task Reminder

Hello,

This is a reminder that you have a scheduled follow-up task due:
- Task: %s (%s)
- With: %s
- Scheduled Date: %s
- Notes: %s

Lead Details:
- Name: %s
- Phone: %s
- Email: %s

Open in CRM: %s

---
Automated Notification from BizCopilot CRM.
`, data.Title, data.FollowUpType, entityDesc, formattedDate, data.Notes, data.LeadName, data.LeadPhone, data.LeadEmail, data.CRMURL)

	html = fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Follow-up Reminder</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; }
    .header { background: #0f172a; padding: 20px 24px; color: #ffffff; }
    .header h1 { margin: 0; font-size: 18px; font-weight: 600; color: #ffffff; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 4px; background: #0d9488; color: #ffffff; font-size: 12px; font-weight: 600; margin-top: 8px; }
    .content { padding: 24px; font-size: 14px; line-height: 1.5; color: #334155; }
    .field-group { margin-bottom: 14px; }
    .field-label { font-size: 12px; font-weight: 600; text-transform: uppercase; color: #64748b; margin-bottom: 2px; }
    .field-value { font-size: 14px; color: #0f172a; }
    .notes-box { background: #f1f5f9; border-left: 3px solid #0d9488; padding: 12px 16px; border-radius: 4px; margin: 16px 0; font-size: 14px; color: #334155; }
    .btn { display: inline-block; background: #0d9488; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: 600; font-size: 13px; margin-top: 14px; }
    .footer { padding: 16px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>Task Reminder: %s</h1>
      <span class="badge">%s Due</span>
    </div>
    <div class="content">
      <p style="margin-top:0; color: #334155;">
        You have a scheduled follow-up with <strong>%s</strong> set for <strong>%s</strong>.
      </p>

      <div class="notes-box">
        <strong>Notes:</strong> %s
      </div>

      <div class="field-group">
        <div class="field-label">Contact Details</div>
        <div class="field-value">%s &bull; %s &bull; %s</div>
      </div>

      <div style="text-align: center; margin-top: 20px;">
        <a href="%s" class="btn" style="color: #ffffff;">View in BizCopilot CRM</a>
      </div>
    </div>
    <div class="footer">
      Automated task reminder from BizCopilot CRM.
    </div>
  </div>
</body>
</html>`, escapeHTML(data.Title), escapeHTML(data.FollowUpType), escapeHTML(entityDesc), formattedDate, escapeHTML(data.Notes), escapeHTML(data.LeadName), escapeHTML(data.LeadPhone), escapeHTML(data.LeadEmail), data.CRMURL)

	return html, plainText
}

// CustomerFollowUpData holds context for automatic follow-up delivery directly to the customer
type CustomerFollowUpData struct {
	CustomerName string
	Title        string
	FollowUpType string
	Notes        string
	Requirement  string
	CompanyName  string
	CompanyEmail string
	CompanyPhone string
	RepName      string
	RepEmail     string
}

// RenderCustomerFollowUp renders a professional, deliverability-optimized email directly to the customer
func RenderCustomerFollowUp(data CustomerFollowUpData) (html string, plainText string) {
	greetingName := strings.TrimSpace(data.CustomerName)
	if greetingName == "" {
		greetingName = "Valued Customer"
	}
	company := strings.TrimSpace(data.CompanyName)
	if company == "" {
		company = "BizCopilot CRM"
	}

	// Prepare personalized body or high-conversion professional fallback
	bodyHTML := ""
	bodyText := ""
	cleanNotes := strings.TrimSpace(data.Notes)

	if cleanNotes != "" {
		paragraphs := strings.Split(cleanNotes, "\n")
		var sb strings.Builder
		for _, p := range paragraphs {
			tp := strings.TrimSpace(p)
			if tp != "" {
				sb.WriteString(fmt.Sprintf(`<p style="margin: 0 0 14px; line-height: 1.6; color: #334155; font-size: 15px;">%s</p>`, escapeHTML(tp)))
			}
		}
		bodyHTML = sb.String()
		bodyText = cleanNotes
	} else {
		reqDesc := strings.TrimSpace(data.Requirement)
		if reqDesc != "" {
			reqDesc = fmt.Sprintf(" regarding your requirement: &ldquo;%s&rdquo;", escapeHTML(reqDesc))
		}
		bodyHTML = fmt.Sprintf(`
      <p style="margin: 0 0 14px; line-height: 1.6; color: #334155; font-size: 15px;">
        I hope this message finds you well. I am following up on your recent inquiry with %s%s.
      </p>
      <p style="margin: 0 0 14px; line-height: 1.6; color: #334155; font-size: 15px;">
        We want to ensure all your questions are answered and you have all the information needed to make the best decision for your business.
      </p>
      <p style="margin: 0 0 14px; line-height: 1.6; color: #334155; font-size: 15px;">
        Please feel free to reply directly to this email or call us anytime. We look forward to connecting with you!
      </p>
    `, escapeHTML(company), reqDesc)

		bodyText = fmt.Sprintf("I hope this message finds you well. I am following up on your recent inquiry with %s.\n\nWe want to ensure all your questions are answered and you have all the information needed to make the best decision for your business.\n\nPlease feel free to reply directly to this email or call us anytime.", company)
	}

	repSignName := strings.TrimSpace(data.RepName)
	if repSignName == "" {
		repSignName = company
	}

	plainText = fmt.Sprintf(`Dear %s,

%s

Best regards,
%s
%s
Phone: %s
Email: %s
`, greetingName, bodyText, repSignName, company, data.CompanyPhone, data.CompanyEmail)

	html = fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Following Up - %s</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .header { background: #0f172a; padding: 24px; color: #ffffff; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 600; color: #ffffff; }
    .content { padding: 28px 24px; font-size: 15px; line-height: 1.6; color: #334155; }
    .signature { margin-top: 24px; padding-top: 20px; border-top: 1px solid #e2e8f0; color: #475569; font-size: 14px; }
    .footer { padding: 16px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>%s</h1>
    </div>
    <div class="content">
      <p style="margin: 0 0 16px; font-size: 16px; font-weight: 600; color: #0f172a;">Dear %s,</p>
      %s

      <div class="signature">
        <div style="font-weight: 600; color: #0f172a; font-size: 15px;">%s</div>
        <div style="color: #64748b; margin-top: 2px;">%s</div>
        <div style="margin-top: 6px; font-size: 13px; color: #475569;">
          %s &bull; <a href="mailto:%s" style="color: #0d9488; text-decoration: none;">%s</a>
        </div>
      </div>
    </div>
    <div class="footer">
      Sent with care from %s. You can reply directly to this message.
    </div>
  </div>
</body>
</html>`, escapeHTML(company), escapeHTML(company), escapeHTML(greetingName), bodyHTML, escapeHTML(repSignName), escapeHTML(company), escapeHTML(data.CompanyPhone), escapeHTML(data.CompanyEmail), escapeHTML(data.CompanyEmail), escapeHTML(company))

	return html, plainText
}

// RenderMissingCustomerEmailAlert notifies the salesperson when follow-up was due but customer had no email
func RenderMissingCustomerEmailAlert(data FollowUpReminderData) (html string, plainText string) {
	entityDesc := data.LeadName
	if entityDesc == "" {
		entityDesc = data.DealName
	}
	if entityDesc == "" {
		entityDesc = "Customer"
	}

	formattedDate := data.DueDate.Format("Monday, 02 Jan 2006 at 03:04 PM")

	plainText = fmt.Sprintf(`BizCopilot CRM - ACTION REQUIRED: Customer Follow-up Due (Missing Email)

Hello %s,

An automated customer follow-up was scheduled for %s, but could NOT be delivered because the customer does not have a registered email address.

Contact: %s
Phone: %s
Scheduled Time: %s
Task Title: %s
Notes: %s

Action Required:
Please contact the customer directly via phone and update their email address in the CRM so future automated communications can be delivered.

Open in CRM: %s
`, data.LeadName, entityDesc, entityDesc, data.LeadPhone, formattedDate, data.Title, data.Notes, data.CRMURL)

	html = fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Action Required - Missing Customer Email</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #fee2e2; overflow: hidden; }
    .header { background: #991b1b; padding: 20px 24px; color: #ffffff; }
    .header h1 { margin: 0; font-size: 18px; font-weight: 600; color: #ffffff; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 4px; background: #f87171; color: #ffffff; font-size: 12px; font-weight: 600; margin-top: 8px; }
    .content { padding: 24px; font-size: 14px; line-height: 1.5; color: #334155; }
    .alert-box { background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; border-radius: 4px; margin: 16px 0; color: #991b1b; }
    .btn { display: inline-block; background: #0f172a; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: 600; font-size: 13px; margin-top: 14px; }
    .footer { padding: 16px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>Action Required: Missing Customer Email</h1>
      <span class="badge">Follow-Up Alert</span>
    </div>
    <div class="content">
      <div class="alert-box">
        <strong>Delivery Notice:</strong> An automated follow-up was scheduled for <strong>%s</strong>, but could not be sent to the customer because no valid email address is on file.
      </div>
      <p><strong>Scheduled Time:</strong> %s</p>
      <p><strong>Customer Phone:</strong> %s</p>
      <p><strong>Task:</strong> %s</p>
      <p><strong>Notes:</strong> %s</p>
      <div style="text-align: center; margin-top: 20px;">
        <a href="%s" class="btn" style="color: #ffffff;">Update Contact in CRM</a>
      </div>
    </div>
    <div class="footer">
      Automated alert from BizCopilot CRM.
    </div>
  </div>
</body>
</html>`, escapeHTML(entityDesc), formattedDate, escapeHTML(data.LeadPhone), escapeHTML(data.Title), escapeHTML(data.Notes), data.CRMURL)

	return html, plainText
}

// QuotationEmailData holds context for quotation delivery
type QuotationEmailData struct {
	CustomerName    string
	QuotationNumber string
	Title           string
	Date            string
	ValidUntil      string
	TotalAmount     string
	Currency        string
	CompanyName     string
	CompanyEmail    string
	CompanyPhone    string
	Notes           string
}

// RenderQuotationFinalized renders deliverability-optimized HTML and plain text for quotation emails
func RenderQuotationFinalized(data QuotationEmailData) (html string, plainText string) {
	plainText = fmt.Sprintf(`Quotation %s from %s

Dear %s,

Thank you for your interest. We are pleased to provide you with Quotation %s for "%s".

Summary:
- Quotation Number: %s
- Issue Date: %s
- Valid Until: %s
- Total Amount: %s %s

Please find your official quotation PDF attached to this email.

If you have any questions or would like to approve this quote, please reply directly to this email or contact %s.

Warm regards,
%s
`, data.QuotationNumber, data.CompanyName, data.CustomerName, data.QuotationNumber, data.Title,
		data.QuotationNumber, data.Date, data.ValidUntil, data.Currency, data.TotalAmount,
		data.CompanyEmail, data.CompanyName)

	html = fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Quotation %s</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; }
    .header { background: #0f172a; padding: 24px; color: #ffffff; }
    .header h1 { margin: 0 0 4px 0; font-size: 20px; font-weight: 600; color: #ffffff; }
    .header p { margin: 0; font-size: 13px; color: #cbd5e1; }
    .content { padding: 24px; font-size: 14px; line-height: 1.6; color: #334155; }
    .summary-table { width: 100%%; border-collapse: collapse; margin: 18px 0; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0; }
    .summary-table td { padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
    .summary-table tr:last-child td { border-bottom: none; }
    .summary-table .label { color: #64748b; font-weight: 600; width: 45%%; }
    .summary-table .value { color: #0f172a; font-weight: 600; text-align: right; }
    .total-row td { background: #f0fdfa; font-size: 15px; color: #0f766e !important; }
    .attachment-notice { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px 16px; margin: 18px 0; font-size: 13px; color: #1e293b; }
    .footer { padding: 18px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>%s</h1>
      <p>Quotation %s</p>
    </div>
    <div class="content">
      <p>Dear <strong>%s</strong>,</p>
      <p>Thank you for giving us the opportunity to quote. Please find the summary of your quotation for <strong>%s</strong> below:</p>

      <table class="summary-table">
        <tr>
          <td class="label">Quotation Number</td>
          <td class="value">%s</td>
        </tr>
        <tr>
          <td class="label">Issue Date</td>
          <td class="value">%s</td>
        </tr>
        <tr>
          <td class="label">Valid Until</td>
          <td class="value">%s</td>
        </tr>
        <tr class="total-row">
          <td class="label" style="color: #0f766e;">Total Amount</td>
          <td class="value" style="color: #0f766e;">%s %s</td>
        </tr>
      </table>

      <div class="attachment-notice">
        <strong>Attached Document:</strong> Your official quotation PDF is attached to this email.
      </div>

      <p style="margin-bottom: 0;">If you have any questions or wish to proceed with this quotation, simply reply directly to this email or reach us at <a href="mailto:%s" style="color: #0d9488;">%s</a>.</p>
    </div>
    <div class="footer">
      &copy; %d %s. All rights reserved.
    </div>
  </div>
</body>
</html>`, escapeHTML(data.QuotationNumber), escapeHTML(data.CompanyName), escapeHTML(data.QuotationNumber),
		escapeHTML(data.CustomerName), escapeHTML(data.Title), escapeHTML(data.QuotationNumber),
		escapeHTML(data.Date), escapeHTML(data.ValidUntil), escapeHTML(data.Currency), escapeHTML(data.TotalAmount),
		escapeHTML(data.CompanyEmail), escapeHTML(data.CompanyEmail), time.Now().Year(), escapeHTML(data.CompanyName))

	return html, plainText
}

// InvoiceEmailData holds context for invoice delivery
type InvoiceEmailData struct {
	CustomerName  string
	InvoiceNumber string
	InvoiceDate   string
	DueDate       string
	GrandTotal    string
	AmountPaid    string
	BalanceDue    string
	Currency      string
	CompanyName   string
	CompanyEmail  string
	CompanyPhone  string
	Notes         string
}

// RenderInvoiceFinalized renders deliverability-optimized HTML and plain text for tax invoice emails
func RenderInvoiceFinalized(data InvoiceEmailData) (html string, plainText string) {
	plainText = fmt.Sprintf(`Tax Invoice %s from %s

Dear %s,

Thank you for your business. Please find attached Tax Invoice %s.

Summary:
- Invoice Number: %s
- Invoice Date: %s
- Due Date: %s
- Grand Total: %s %s
- Balance Due: %s %s

Please find your official tax invoice PDF attached to this email.

For payment instructions or inquiries, please reply directly to this email or reach us at %s.

Warm regards,
%s
`, data.InvoiceNumber, data.CompanyName, data.CustomerName, data.InvoiceNumber,
		data.InvoiceNumber, data.InvoiceDate, data.DueDate, data.Currency, data.GrandTotal,
		data.Currency, data.BalanceDue, data.CompanyEmail, data.CompanyName)

	html = fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice %s</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; }
    .header { background: #0f172a; padding: 24px; color: #ffffff; }
    .header h1 { margin: 0 0 4px 0; font-size: 20px; font-weight: 600; color: #ffffff; }
    .header p { margin: 0; font-size: 13px; color: #cbd5e1; }
    .content { padding: 24px; font-size: 14px; line-height: 1.6; color: #334155; }
    .summary-table { width: 100%%; border-collapse: collapse; margin: 18px 0; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0; }
    .summary-table td { padding: 10px 14px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
    .summary-table tr:last-child td { border-bottom: none; }
    .summary-table .label { color: #64748b; font-weight: 600; width: 45%%; }
    .summary-table .value { color: #0f172a; font-weight: 600; text-align: right; }
    .total-row td { background: #fffbeb; font-size: 15px; color: #b45309 !important; }
    .attachment-notice { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px 16px; margin: 18px 0; font-size: 13px; color: #1e293b; }
    .footer { padding: 18px 24px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>%s</h1>
      <p>Tax Invoice %s</p>
    </div>
    <div class="content">
      <p>Dear <strong>%s</strong>,</p>
      <p>Thank you for your business. Please find the details of your tax invoice below:</p>

      <table class="summary-table">
        <tr>
          <td class="label">Invoice Number</td>
          <td class="value">%s</td>
        </tr>
        <tr>
          <td class="label">Invoice Date</td>
          <td class="value">%s</td>
        </tr>
        <tr>
          <td class="label">Due Date</td>
          <td class="value">%s</td>
        </tr>
        <tr>
          <td class="label">Grand Total</td>
          <td class="value">%s %s</td>
        </tr>
        <tr class="total-row">
          <td class="label" style="color: #b45309;">Balance Due</td>
          <td class="value" style="color: #b45309;">%s %s</td>
        </tr>
      </table>

      <div class="attachment-notice">
        <strong>Attached Document:</strong> Your official tax invoice PDF is attached to this email.
      </div>

      <p style="margin-bottom: 0;">If you have any questions regarding payment or this invoice, reply directly to this email or reach us at <a href="mailto:%s" style="color: #0d9488;">%s</a>.</p>
    </div>
    <div class="footer">
      &copy; %d %s. All rights reserved.
    </div>
  </div>
</body>
</html>`, escapeHTML(data.InvoiceNumber), escapeHTML(data.CompanyName), escapeHTML(data.InvoiceNumber),
		escapeHTML(data.CustomerName), escapeHTML(data.InvoiceNumber), escapeHTML(data.InvoiceDate),
		escapeHTML(data.DueDate), escapeHTML(data.Currency), escapeHTML(data.GrandTotal),
		escapeHTML(data.Currency), escapeHTML(data.BalanceDue), escapeHTML(data.CompanyEmail),
		escapeHTML(data.CompanyEmail), time.Now().Year(), escapeHTML(data.CompanyName))

	return html, plainText
}

func escapeHTML(s string) string {
	s = strings.ReplaceAll(s, "&", "&amp;")
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	s = strings.ReplaceAll(s, "\"", "&quot;")
	return s
}
