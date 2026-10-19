package services

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	"crm-backend-go/internal/config"
	"crm-backend-go/internal/database"
	"crm-backend-go/internal/email"
	"crm-backend-go/internal/models"
	"crm-backend-go/internal/pdf"
	"crm-backend-go/internal/repository"
)

type EmailWorker struct {
	db            *database.DB
	cfg           *config.Config
	emailRepo     *repository.EmailRepository
	companyRepo   *repository.CompanyRepository
	quotationRepo *repository.QuotationRepository
	invoiceRepo   *repository.InvoiceRepository
	emailService  *email.Service
}

func NewEmailWorker(
	db *database.DB,
	cfg *config.Config,
	emailRepo *repository.EmailRepository,
	companyRepo *repository.CompanyRepository,
	quotationRepo *repository.QuotationRepository,
	invoiceRepo *repository.InvoiceRepository,
	emailService *email.Service,
) *EmailWorker {
	return &EmailWorker{
		db:            db,
		cfg:           cfg,
		emailRepo:     emailRepo,
		companyRepo:   companyRepo,
		quotationRepo: quotationRepo,
		invoiceRepo:   invoiceRepo,
		emailService:  emailService,
	}
}

// Start launches the background scheduler ticking every 60 seconds
func (w *EmailWorker) Start(ctx context.Context) {
	ticker := time.NewTicker(60 * time.Second)
	go func() {
		// Run initial check immediately
		w.runCycle(context.Background())

		for {
			select {
			case <-ctx.Done():
				ticker.Stop()
				log.Println("[EmailWorker] Background scheduler stopped.")
				return
			case <-ticker.C:
				w.runCycle(context.Background())
			}
		}
	}()
	log.Println("[EmailWorker] Background email notification scheduler running (60s tick).")
}

// RunCycle executes a single scan and dispatch cycle
func (w *EmailWorker) RunCycle(ctx context.Context) {
	w.runCycle(ctx)
}

func (w *EmailWorker) runCycle(ctx context.Context) {
	// 1. Scan and enqueue due follow-up task reminders
	if err := w.scanAndEnqueueFollowUpReminders(ctx); err != nil {
		log.Printf("[EmailWorker] Error scanning follow-up reminders: %v", err)
	}

	// 2. Process pending & retryable outgoing emails
	if err := w.processPendingQueue(ctx); err != nil {
		log.Printf("[EmailWorker] Error processing email queue: %v", err)
	}
}

// scanAndEnqueueFollowUpReminders checks for due follow-ups and enqueues emails to assigned sales reps
func (w *EmailWorker) scanAndEnqueueFollowUpReminders(ctx context.Context) error {
	query := `
		SELECT f.id, f.title, f.follow_up_type, f.due_date, COALESCE(f.notes, ''),
		       f.lead_number, COALESCE(l.name, ''), COALESCE(l.phone, ''), COALESCE(l.email, ''),
		       f.deal_id, COALESCE(d.name, ''),
		       COALESCE(u.email, ''), COALESCE(u.name, '')
		FROM follow_ups f
		LEFT JOIN users u ON f.user_id = u.id
		LEFT JOIN leads l ON f.lead_number = l.number
		LEFT JOIN deals d ON f.deal_id = d.id
		WHERE f.completed = 0
		  AND f.due_date <= NOW()
	`

	rows, err := w.db.Pool.Query(ctx, query)
	if err != nil {
		return err
	}
	defer rows.Close()

	frontendBase := w.cfg.FrontendURL
	if frontendBase == "" {
		frontendBase = "http://localhost:3000"
	}

	for rows.Next() {
		var fID int
		var title, fType, notes, leadNum, leadName, leadPhone, leadEmail, dealName, repEmail, repName string
		var dueDate time.Time
		var dealID *int

		if err := rows.Scan(
			&fID, &title, &fType, &dueDate, &notes,
			&leadNum, &leadName, &leadPhone, &leadEmail,
			&dealID, &dealName,
			&repEmail, &repName,
		); err != nil {
			continue
		}

		// Strictly send follow-up reminders to the explicitly assigned salesperson
		repEmail = strings.TrimSpace(repEmail)
		repName = strings.TrimSpace(repName)
		if repEmail == "" || !email.IsValidEmail(repEmail) {
			log.Printf("[EmailWorker] Skipping follow-up reminder #%d: assigned salesperson has invalid or missing email address (%q)", fID, repEmail)
			continue
		}

		crmURL := fmt.Sprintf("%s/leads", frontendBase)
		if dealID != nil && *dealID > 0 {
			crmURL = fmt.Sprintf("%s/deals", frontendBase)
		}

		data := email.FollowUpReminderData{
			FollowUpID:   fID,
			Title:        title,
			FollowUpType: fType,
			DueDate:      dueDate,
			Notes:        notes,
			LeadNumber:   leadNum,
			LeadName:     leadName,
			LeadPhone:    leadPhone,
			LeadEmail:    leadEmail,
			DealID:       dealID,
			DealName:     dealName,
			CRMURL:       crmURL,
		}

		html, text := email.RenderFollowUpReminder(data)

		targetName := leadName
		if targetName == "" {
			targetName = dealName
		}
		if targetName == "" {
			targetName = "Customer"
		}

		subject := fmt.Sprintf("Follow-Up Reminder: %s (%s)", title, targetName)
		idempotencyKey := fmt.Sprintf("follow_up:%d:%d", fID, dueDate.Unix())

		item := &models.EmailLog{
			WorkspaceID:    1,
			RecipientEmail: repEmail,
			RecipientName:  repName,
			Subject:        subject,
			BodyHTML:       html,
			BodyText:       text,
			EntityType:     "follow_up",
			EntityID:       strconv.Itoa(fID),
			EmailType:      "follow_up_reminder",
			Status:         "pending",
			MaxRetries:     3,
			IdempotencyKey: idempotencyKey,
		}

		enqueued, err := w.emailRepo.Enqueue(ctx, item)
		if err == nil && enqueued {
			log.Printf("[EmailWorker] Enqueued follow-up reminder email #%d for rep %s", fID, repEmail)
		}
	}

	return nil
}

// processPendingQueue iterates over pending and retryable emails and dispatches them
func (w *EmailWorker) processPendingQueue(ctx context.Context) error {
	logs, err := w.emailRepo.GetPendingOrRetryable(ctx, 1, 25)
	if err != nil {
		return err
	}

	for _, item := range logs {
		w.dispatchSingleLog(ctx, item)
	}
	return nil
}

// dispatchSingleLog sends a single email record with PDF attachment if applicable and updates status
func (w *EmailWorker) dispatchSingleLog(ctx context.Context, item models.EmailLog) {
	var err error
	var attachmentBytes []byte
	var attachmentName string

	// Atomically claim this log record. If another worker or goroutine has already claimed it, skip!
	claimed, claimErr := w.emailRepo.ClaimForDispatch(ctx, item.ID)
	if claimErr != nil || !claimed {
		return
	}

	// If quotation or invoice, load entity and generate fresh Maroto v2 PDF
	if item.EntityType == "quotation" {
		qID, _ := strconv.Atoi(item.EntityID)
		if qID > 0 {
			attachmentBytes, attachmentName, err = w.generateQuotationPDFBytes(ctx, qID)
			if err != nil {
				log.Printf("[EmailWorker] Warning: Failed generating quotation PDF for email log #%d: %v", item.ID, err)
			}
		}
	} else if item.EntityType == "invoice" {
		invID, _ := strconv.Atoi(item.EntityID)
		if invID > 0 {
			attachmentBytes, attachmentName, err = w.generateInvoicePDFBytes(ctx, invID)
			if err != nil {
				log.Printf("[EmailWorker] Warning: Failed generating invoice PDF for email log #%d: %v", item.ID, err)
			}
		}
	}

	if !email.IsValidEmail(item.RecipientEmail) {
		errMsg := fmt.Sprintf("invalid recipient email address: %q", item.RecipientEmail)
		_, _ = w.db.Pool.Exec(ctx, "UPDATE email_logs SET status = 'failed', last_error = $1, retry_count = max_retries, next_retry_at = NULL, updated_at = NOW() WHERE id = $2", errMsg, item.ID)
		log.Printf("[EmailWorker] Email log #%d skipped: %s", item.ID, errMsg)
		return
	}

	sendErr := w.emailService.SendEmail(
		ctx,
		item.RecipientEmail,
		item.RecipientName,
		item.Subject,
		item.BodyHTML,
		item.BodyText,
		attachmentName,
		attachmentBytes,
	)

	if sendErr == nil {
		now := time.Now()
		_ = w.emailRepo.UpdateStatus(ctx, item.ID, "sent", "", &now, nil, false)
		log.Printf("[EmailWorker] Email log #%d successfully delivered to %s", item.ID, item.RecipientEmail)
	} else {
		// Calculate exponential backoff retry: 2m, 5m, 15m
		newRetryCount := item.RetryCount + 1
		var nextRetry *time.Time
		status := "failed"

		if newRetryCount < item.MaxRetries {
			delay := 2 * time.Minute
			if newRetryCount == 2 {
				delay = 5 * time.Minute
			} else if newRetryCount >= 3 {
				delay = 15 * time.Minute
			}
			t := time.Now().Add(delay)
			nextRetry = &t
			status = "failed"
		}

		_ = w.emailRepo.UpdateStatus(ctx, item.ID, status, sendErr.Error(), nil, nextRetry, true)
		log.Printf("[EmailWorker] Failed delivering email log #%d (attempt %d/%d): %v", item.ID, newRetryCount, item.MaxRetries, sendErr)
	}
}

// TriggerQuotationEmail enqueues and immediately attempts delivery for a finalized quotation
func (w *EmailWorker) TriggerQuotationEmail(ctx context.Context, quotationID int, isManualResend bool) (*models.EmailLog, error) {
	quote, err := w.quotationRepo.GetByID(ctx, quotationID, 1)
	if err != nil || quote == nil {
		return nil, fmt.Errorf("quotation not found: %w", err)
	}

	// Strictly determine linked customer registered email
	recipientEmail := ""
	recipientName := ""
	if quote.Customer != nil {
		if quote.Customer.Email != nil {
			recipientEmail = strings.TrimSpace(*quote.Customer.Email)
		}
		recipientName = strings.TrimSpace(quote.Customer.Name)
	}

	if recipientEmail == "" || !email.IsValidEmail(recipientEmail) {
		custDesc := "Customer"
		if recipientName != "" {
			custDesc = recipientName
		}
		errMsg := fmt.Sprintf("Customer %q does not have a valid registered email address (found: %q)", custDesc, recipientEmail)

		quoteAttachName := fmt.Sprintf("%s.pdf", quote.QuotationNumber)
		now := time.Now()
		failedLog := &models.EmailLog{
			WorkspaceID:    1,
			RecipientEmail: recipientEmail,
			RecipientName:  recipientName,
			Subject:        fmt.Sprintf("Quotation %s: %s", quote.QuotationNumber, quote.Title),
			BodyHTML:       fmt.Sprintf("<p>%s</p>", errMsg),
			BodyText:       errMsg,
			EntityType:     "quotation",
			EntityID:       strconv.Itoa(quote.ID),
			EmailType:      "quotation_finalized",
			Status:         "failed",
			RetryCount:     3,
			MaxRetries:     3,
			LastError:      &errMsg,
			HasAttachment:  true,
			AttachmentName: &quoteAttachName,
			IdempotencyKey: fmt.Sprintf("quotation:%d:valerr:%d", quote.ID, now.UnixNano()),
		}
		_, _ = w.emailRepo.Enqueue(ctx, failedLog)
		return nil, errors.New(errMsg)
	}

	comp, _ := w.companyRepo.GetProfile(ctx)
	companyName := "BizCopilot CRM"
	companyEmail := w.cfg.SMTPFromEmail
	if companyEmail == "" {
		companyEmail = "akshadasagar31@gmail.com"
	}
	companyPhone := ""
	if comp != nil {
		if comp.CompanyName != "" {
			companyName = comp.CompanyName
		}
		if comp.Phone != "" {
			companyPhone = comp.Phone
		}
	}

	validUntilStr := "N/A"
	if quote.ValidUntil != nil {
		validUntilStr = quote.ValidUntil.Format("02 Jan 2006")
	}

	quoteNotes := ""
	if quote.Notes != nil {
		quoteNotes = *quote.Notes
	}

	data := email.QuotationEmailData{
		CustomerName:    recipientName,
		QuotationNumber: quote.QuotationNumber,
		Title:           quote.Title,
		Date:            quote.CreatedAt.Format("02 Jan 2006"),
		ValidUntil:      validUntilStr,
		TotalAmount:     fmt.Sprintf("%.2f", quote.TotalAmount),
		Currency:        quote.Currency,
		CompanyName:     companyName,
		CompanyEmail:    companyEmail,
		CompanyPhone:    companyPhone,
		Notes:           quoteNotes,
	}

	html, text := email.RenderQuotationFinalized(data)
	subject := fmt.Sprintf("Quotation %s: %s from %s", quote.QuotationNumber, quote.Title, companyName)

	idempotencyKey := fmt.Sprintf("quotation:%d:%s", quote.ID, strings.ToLower(quote.Status))
	if isManualResend {
		idempotencyKey = fmt.Sprintf("quotation:%d:resend:%d", quote.ID, time.Now().UnixNano())
	}

	quoteAttachName := fmt.Sprintf("%s.pdf", quote.QuotationNumber)
	item := &models.EmailLog{
		WorkspaceID:    1,
		RecipientEmail: recipientEmail,
		RecipientName:  recipientName,
		Subject:        subject,
		BodyHTML:       html,
		BodyText:       text,
		EntityType:     "quotation",
		EntityID:       strconv.Itoa(quote.ID),
		EmailType:      "quotation_finalized",
		Status:         "pending",
		MaxRetries:     3,
		HasAttachment:  true,
		AttachmentName: &quoteAttachName,
		IdempotencyKey: idempotencyKey,
	}

	enqueued, err := w.emailRepo.Enqueue(ctx, item)
	if err != nil {
		return nil, err
	}
	if !enqueued {
		// Already sent for this status
		latest, _ := w.emailRepo.GetLatestStatusForEntity(ctx, 1, "quotation", strconv.Itoa(quote.ID))
		return latest, nil
	}

	// Asynchronous immediate dispatch
	go func(logID int) {
		bgCtx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
		defer cancel()
		loadedLog, err := w.emailRepo.GetByID(bgCtx, logID)
		if err == nil && loadedLog != nil {
			w.dispatchSingleLog(bgCtx, *loadedLog)
		}
	}(item.ID)

	return item, nil
}

// TriggerInvoiceEmail enqueues and immediately attempts delivery for a finalized invoice
func (w *EmailWorker) TriggerInvoiceEmail(ctx context.Context, invoiceID int, isManualResend bool) (*models.EmailLog, error) {
	invoice, err := w.invoiceRepo.Get(ctx, invoiceID)
	if err != nil || invoice == nil {
		return nil, fmt.Errorf("invoice not found: %w", err)
	}

	// Strictly determine linked customer registered email
	recipientEmail := ""
	recipientName := ""
	if invoice.Customer != nil {
		if invoice.Customer.Email != nil {
			recipientEmail = strings.TrimSpace(*invoice.Customer.Email)
		}
		recipientName = strings.TrimSpace(invoice.Customer.Name)
	}

	if recipientEmail == "" || !email.IsValidEmail(recipientEmail) {
		custDesc := "Customer"
		if recipientName != "" {
			custDesc = recipientName
		}
		errMsg := fmt.Sprintf("Customer %q does not have a valid registered email address (found: %q)", custDesc, recipientEmail)

		invAttachName := fmt.Sprintf("%s.pdf", invoice.InvoiceNumber)
		now := time.Now()
		failedLog := &models.EmailLog{
			WorkspaceID:    1,
			RecipientEmail: recipientEmail,
			RecipientName:  recipientName,
			Subject:        fmt.Sprintf("Tax Invoice %s", invoice.InvoiceNumber),
			BodyHTML:       fmt.Sprintf("<p>%s</p>", errMsg),
			BodyText:       errMsg,
			EntityType:     "invoice",
			EntityID:       strconv.Itoa(invoice.ID),
			EmailType:      "invoice_finalized",
			Status:         "failed",
			RetryCount:     3,
			MaxRetries:     3,
			LastError:      &errMsg,
			HasAttachment:  true,
			AttachmentName: &invAttachName,
			IdempotencyKey: fmt.Sprintf("invoice:%d:valerr:%d", invoice.ID, now.UnixNano()),
		}
		_, _ = w.emailRepo.Enqueue(ctx, failedLog)
		return nil, errors.New(errMsg)
	}

	comp, _ := w.companyRepo.GetProfile(ctx)
	companyName := "BizCopilot CRM"
	companyEmail := w.cfg.SMTPFromEmail
	if companyEmail == "" {
		companyEmail = "akshadasagar31@gmail.com"
	}
	companyPhone := ""
	if comp != nil {
		if comp.CompanyName != "" {
			companyName = comp.CompanyName
		}
		if comp.Phone != "" {
			companyPhone = comp.Phone
		}
	}

	dueDateStr := "Due on receipt"
	if invoice.DueDate != nil {
		dueDateStr = invoice.DueDate.Format("02 Jan 2006")
	}

	balanceDue := invoice.GrandTotal - invoice.AmountPaid
	if balanceDue < 0 {
		balanceDue = 0
	}

	invNotes := ""
	if invoice.Notes != nil {
		invNotes = *invoice.Notes
	}

	data := email.InvoiceEmailData{
		CustomerName:  recipientName,
		InvoiceNumber: invoice.InvoiceNumber,
		InvoiceDate:   invoice.InvoiceDate.Format("02 Jan 2006"),
		DueDate:       dueDateStr,
		GrandTotal:    fmt.Sprintf("%.2f", invoice.GrandTotal),
		AmountPaid:    fmt.Sprintf("%.2f", invoice.AmountPaid),
		BalanceDue:    fmt.Sprintf("%.2f", balanceDue),
		Currency:      invoice.Currency,
		CompanyName:   companyName,
		CompanyEmail:  companyEmail,
		CompanyPhone:  companyPhone,
		Notes:         invNotes,
	}

	html, text := email.RenderInvoiceFinalized(data)
	subject := fmt.Sprintf("Tax Invoice %s from %s", invoice.InvoiceNumber, companyName)

	idempotencyKey := fmt.Sprintf("invoice:%d:%s", invoice.ID, strings.ToLower(invoice.Status))
	if isManualResend {
		idempotencyKey = fmt.Sprintf("invoice:%d:resend:%d", invoice.ID, time.Now().UnixNano())
	}

	invAttachName := fmt.Sprintf("%s.pdf", invoice.InvoiceNumber)
	item := &models.EmailLog{
		WorkspaceID:    1,
		RecipientEmail: recipientEmail,
		RecipientName:  recipientName,
		Subject:        subject,
		BodyHTML:       html,
		BodyText:       text,
		EntityType:     "invoice",
		EntityID:       strconv.Itoa(invoice.ID),
		EmailType:      "invoice_finalized",
		Status:         "pending",
		MaxRetries:     3,
		HasAttachment:  true,
		AttachmentName: &invAttachName,
		IdempotencyKey: idempotencyKey,
	}

	enqueued, err := w.emailRepo.Enqueue(ctx, item)
	if err != nil {
		return nil, err
	}
	if !enqueued {
		latest, _ := w.emailRepo.GetLatestStatusForEntity(ctx, 1, "invoice", strconv.Itoa(invoice.ID))
		return latest, nil
	}

	// Asynchronous immediate dispatch
	go func(logID int) {
		bgCtx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
		defer cancel()
		loadedLog, err := w.emailRepo.GetByID(bgCtx, logID)
		if err == nil && loadedLog != nil {
			w.dispatchSingleLog(bgCtx, *loadedLog)
		}
	}(item.ID)

	return item, nil
}

// generateQuotationPDFBytes renders the PDF using existing Maroto v2 engine
func (w *EmailWorker) generateQuotationPDFBytes(ctx context.Context, qID int) ([]byte, string, error) {
	quote, err := w.quotationRepo.GetByID(ctx, qID, 1)
	if err != nil {
		return nil, "", err
	}
	if quote == nil {
		return nil, "", fmt.Errorf("quotation #%d not found", qID)
	}
	comp, _ := w.companyRepo.GetProfile(ctx)
	pdfBytes, err := pdf.GenerateQuotationPDF(quote, comp, nil, "")
	if err != nil {
		return nil, "", err
	}
	return pdfBytes, fmt.Sprintf("%s.pdf", quote.QuotationNumber), nil
}

// generateInvoicePDFBytes renders the PDF using existing Maroto v2 engine
func (w *EmailWorker) generateInvoicePDFBytes(ctx context.Context, invID int) ([]byte, string, error) {
	invoice, err := w.invoiceRepo.Get(ctx, invID)
	if err != nil {
		return nil, "", err
	}
	if invoice == nil {
		return nil, "", fmt.Errorf("invoice #%d not found", invID)
	}
	comp, _ := w.companyRepo.GetProfile(ctx)
	pdfBytes, err := pdf.GenerateInvoicePDF(invoice, comp, nil, "")
	if err != nil {
		return nil, "", err
	}
	return pdfBytes, fmt.Sprintf("%s.pdf", invoice.InvoiceNumber), nil
}
