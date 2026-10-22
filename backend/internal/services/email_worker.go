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

// scanAndEnqueueFollowUpReminders checks for due follow-ups and dispatches one automated follow-up message to the customer
// at the scheduled date and time, notifies the assigned salesperson, and ensures no subsequent messages are sent unless rescheduled.
func (w *EmailWorker) scanAndEnqueueFollowUpReminders(ctx context.Context) error {
	query := `
		SELECT f.id, f.title, f.follow_up_type, f.due_date, COALESCE(f.notes, ''),
		       COALESCE(f.lead_number, ''), COALESCE(l.name, ''), COALESCE(l.phone, ''), COALESCE(l.email, ''), COALESCE(l.requirement, ''),
		       f.deal_id, COALESCE(d.name, ''), COALESCE(d.requirement, ''),
		       COALESCE(c.name, ''), COALESCE(c.phone, ''), COALESCE(c.email, ''),
		       COALESCE(u.id, 0), COALESCE(u.email, ''), COALESCE(u.name, ''),
		       COALESCE(dl.name, ''), COALESCE(dl.phone, ''), COALESCE(dl.email, ''), COALESCE(dl.requirement, '')
		FROM follow_ups f
		LEFT JOIN users u ON f.user_id = u.id
		LEFT JOIN leads l ON f.lead_number = l.number
		LEFT JOIN deals d ON f.deal_id = d.id
		LEFT JOIN customers c ON d.customer_id = c.id
		LEFT JOIN leads dl ON d.lead_number = dl.number
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

	comp, _ := w.companyRepo.GetProfile(ctx)
	companyName := "BizCopilot CRM"
	companyEmail := w.cfg.SMTPFromEmail
	companyPhone := ""
	if comp != nil {
		if comp.CompanyName != "" {
			companyName = comp.CompanyName
		}
		if comp.Email != "" {
			companyEmail = comp.Email
		}
		if comp.Phone != "" {
			companyPhone = comp.Phone
		}
	}
	if companyEmail == "" {
		companyEmail = "notifications@bizcopilot.com"
	}

	type followUpCandidate struct {
		fID int
		title, fType, notes, leadNum, leadName, leadPhone, leadEmail, leadReq string
		dealID *int
		dealName, dealReq, custName, custPhone, custEmail string
		repID int
		repEmail, repName string
		dealLeadName, dealLeadPhone, dealLeadEmail, dealLeadReq string
		dueDate time.Time
	}

	var candidates []followUpCandidate

	for rows.Next() {
		var c followUpCandidate
		if err := rows.Scan(
			&c.fID, &c.title, &c.fType, &c.dueDate, &c.notes,
			&c.leadNum, &c.leadName, &c.leadPhone, &c.leadEmail, &c.leadReq,
			&c.dealID, &c.dealName, &c.dealReq,
			&c.custName, &c.custPhone, &c.custEmail,
			&c.repID, &c.repEmail, &c.repName,
			&c.dealLeadName, &c.dealLeadPhone, &c.dealLeadEmail, &c.dealLeadReq,
		); err == nil {
			candidates = append(candidates, c)
		}
	}

	for _, cand := range candidates {
		// Strictly determine target customer email and name
		// For Deal follow-ups, resolve linked lead first, then customer profile
		targetCustomerEmail := strings.TrimSpace(cand.leadEmail)
		targetCustomerName := strings.TrimSpace(cand.leadName)
		targetCustomerPhone := strings.TrimSpace(cand.leadPhone)
		targetRequirement := strings.TrimSpace(cand.leadReq)

		if targetCustomerEmail == "" && cand.dealLeadEmail != "" {
			targetCustomerEmail = strings.TrimSpace(cand.dealLeadEmail)
		}
		if targetCustomerEmail == "" && cand.custEmail != "" {
			targetCustomerEmail = strings.TrimSpace(cand.custEmail)
		}
		if targetCustomerName == "" && cand.dealLeadName != "" {
			targetCustomerName = strings.TrimSpace(cand.dealLeadName)
		}
		if targetCustomerName == "" && cand.custName != "" {
			targetCustomerName = strings.TrimSpace(cand.custName)
		}
		if targetCustomerName == "" && cand.dealName != "" {
			targetCustomerName = strings.TrimSpace(cand.dealName)
		}
		if targetCustomerName == "" {
			targetCustomerName = "Valued Customer"
		}
		if targetCustomerPhone == "" && cand.dealLeadPhone != "" {
			targetCustomerPhone = strings.TrimSpace(cand.dealLeadPhone)
		}
		if targetCustomerPhone == "" && cand.custPhone != "" {
			targetCustomerPhone = strings.TrimSpace(cand.custPhone)
		}
		if targetRequirement == "" && cand.dealLeadReq != "" {
			targetRequirement = strings.TrimSpace(cand.dealLeadReq)
		}
		if targetRequirement == "" && cand.dealReq != "" {
			targetRequirement = strings.TrimSpace(cand.dealReq)
		}

		cand.repEmail = strings.TrimSpace(cand.repEmail)
		cand.repName = strings.TrimSpace(cand.repName)

		crmURL := fmt.Sprintf("%s/leads", frontendBase)
		if cand.dealID != nil && *cand.dealID > 0 {
			crmURL = fmt.Sprintf("%s/deals", frontendBase)
		}

		repReminderData := email.FollowUpReminderData{
			FollowUpID:   cand.fID,
			Title:        cand.title,
			FollowUpType: cand.fType,
			DueDate:      cand.dueDate,
			Notes:        cand.notes,
			LeadNumber:   cand.leadNum,
			LeadName:     targetCustomerName,
			LeadPhone:    targetCustomerPhone,
			LeadEmail:    targetCustomerEmail,
			DealID:       cand.dealID,
			DealName:     cand.dealName,
			CRMURL:       crmURL,
		}

		// Check if this is an internal task without an associated customer/lead
		isInternal := cand.leadNum == "" && (cand.dealID == nil || *cand.dealID == 0) && targetCustomerEmail == ""
		if isInternal {
			if cand.repEmail != "" && email.IsValidEmail(cand.repEmail) {
				repHtml, repText := email.RenderFollowUpReminder(repReminderData)
				repSubject := fmt.Sprintf("Task Reminder: %s", cand.title)
				repIdempotencyKey := fmt.Sprintf("follow_up:rep:%d:%d", cand.fID, cand.dueDate.Unix())

				repItem := &models.EmailLog{
					WorkspaceID:    1,
					RecipientEmail: cand.repEmail,
					RecipientName:  cand.repName,
					Subject:        repSubject,
					BodyHTML:       repHtml,
					BodyText:       repText,
					EntityType:     "follow_up",
					EntityID:       strconv.Itoa(cand.fID),
					EmailType:      "follow_up_reminder",
					Status:         "pending",
					MaxRetries:     3,
					IdempotencyKey: repIdempotencyKey,
				}
				enqueued, err := w.emailRepo.Enqueue(ctx, repItem)
				if err == nil && enqueued {
					go w.dispatchSingleLog(context.Background(), *repItem)
				}
			}

			now := time.Now()
			_, _ = w.db.Pool.Exec(ctx, `
				UPDATE follow_ups
				SET completed = 1, completed_at = $1, reminder_state = 'sent',
				    delivery_status = 'internal_only', last_delivery_attempt_at = $1
				WHERE id = $2
			`, now, cand.fID)
			continue
		}

		// Check if customer email is missing or invalid
		if targetCustomerEmail == "" || !email.IsValidEmail(targetCustomerEmail) {
			errMsg := "Missing or invalid customer email address"
			log.Printf("[EmailWorker] Scheduled follow-up #%d (%s) cannot deliver to customer: %s. Sending task reminder to rep.", cand.fID, cand.title, errMsg)

			// Send the salesperson their task reminder email so they do not miss their scheduled task
			if cand.repEmail != "" && email.IsValidEmail(cand.repEmail) {
				repHtml, repText := email.RenderFollowUpReminder(repReminderData)
				repSubject := fmt.Sprintf("Task Reminder: %s", cand.title)
				repKey := fmt.Sprintf("follow_up:rep:%d:%d", cand.fID, cand.dueDate.Unix())

				repLog := &models.EmailLog{
					WorkspaceID:    1,
					RecipientEmail: cand.repEmail,
					RecipientName:  cand.repName,
					Subject:        repSubject,
					BodyHTML:       repHtml,
					BodyText:       repText,
					EntityType:     "follow_up",
					EntityID:       strconv.Itoa(cand.fID),
					EmailType:      "follow_up_reminder",
					Status:         "pending",
					MaxRetries:     3,
					IdempotencyKey: repKey,
				}
				enqueued, err := w.emailRepo.Enqueue(ctx, repLog)
				if err == nil && enqueued {
					go w.dispatchSingleLog(context.Background(), *repLog)
				}
			}

			now := time.Now()
			_, _ = w.db.Pool.Exec(ctx, `
				UPDATE follow_ups
				SET completed = 1, completed_at = $1, reminder_state = 'sent',
				    delivery_status = 'failed', delivery_error = $2, last_delivery_attempt_at = $1
				WHERE id = $3
			`, now, errMsg, cand.fID)

			if cand.leadNum != "" {
				_, _ = w.db.Pool.Exec(ctx, "UPDATE leads SET follow_up_completed = 1, last_activity_at = NOW() WHERE number = $1", cand.leadNum)
				_ = w.logActivity(ctx, cand.leadNum, cand.dealID, cand.repID, "follow_up_failed",
					fmt.Sprintf("Customer Outreach Skipped: %s", cand.title),
					fmt.Sprintf("Could not send automated follow-up to %s: %s", targetCustomerName, errMsg))
			} else if cand.dealID != nil && *cand.dealID > 0 {
				_ = w.logActivity(ctx, "", cand.dealID, cand.repID, "follow_up_failed",
					fmt.Sprintf("Customer Outreach Skipped: %s", cand.title),
					fmt.Sprintf("Could not send automated follow-up to %s: %s", targetCustomerName, errMsg))
			}
			continue
		}

		// 1. Dispatch automated message directly to the customer at the scheduled date/time
		custFollowUpData := email.CustomerFollowUpData{
			CustomerName: targetCustomerName,
			Title:        cand.title,
			FollowUpType: cand.fType,
			Notes:        cand.notes,
			Requirement:  targetRequirement,
			CompanyName:  companyName,
			CompanyEmail: companyEmail,
			CompanyPhone: companyPhone,
			RepName:      cand.repName,
			RepEmail:     cand.repEmail,
		}

		custHTML, custText := email.RenderCustomerFollowUp(custFollowUpData)
		custSubject := fmt.Sprintf("Following up on your inquiry - %s", companyName)
		if targetRequirement != "" {
			custSubject = fmt.Sprintf("Following up regarding %s - %s", targetRequirement, companyName)
		}
		customerIdempotencyKey := fmt.Sprintf("follow_up:customer:%d:%d", cand.fID, cand.dueDate.Unix())

		customerItem := &models.EmailLog{
			WorkspaceID:    1,
			RecipientEmail: targetCustomerEmail,
			RecipientName:  targetCustomerName,
			Subject:        custSubject,
			BodyHTML:       custHTML,
			BodyText:       custText,
			EntityType:     "follow_up",
			EntityID:       strconv.Itoa(cand.fID),
			EmailType:      "follow_up_customer",
			Status:         "pending",
			MaxRetries:     3,
			IdempotencyKey: customerIdempotencyKey,
		}
		if cand.repEmail != "" && email.IsValidEmail(cand.repEmail) {
			customerItem.ReplyTo = &cand.repEmail
		}

		custEnqueued, err := w.emailRepo.Enqueue(ctx, customerItem)
		if err == nil && custEnqueued {
			log.Printf("[EmailWorker] Enqueued automated customer follow-up email #%d for customer %s (%s)", cand.fID, targetCustomerName, targetCustomerEmail)
			go w.dispatchSingleLog(context.Background(), *customerItem)
		}

		// 2. Also send internal Task Reminder to the assigned salesperson
		if cand.repEmail != "" && email.IsValidEmail(cand.repEmail) {
			repHtml, repText := email.RenderFollowUpReminder(repReminderData)
			repSubject := fmt.Sprintf("Task Reminder: %s", cand.title)
			repIdempotencyKey := fmt.Sprintf("follow_up:rep:%d:%d", cand.fID, cand.dueDate.Unix())

			repItem := &models.EmailLog{
				WorkspaceID:    1,
				RecipientEmail: cand.repEmail,
				RecipientName:  cand.repName,
				Subject:        repSubject,
				BodyHTML:       repHtml,
				BodyText:       repText,
				EntityType:     "follow_up",
				EntityID:       strconv.Itoa(cand.fID),
				EmailType:      "follow_up_reminder",
				Status:         "pending",
				MaxRetries:     3,
				IdempotencyKey: repIdempotencyKey,
			}

			repEnqueued, err := w.emailRepo.Enqueue(ctx, repItem)
			if err == nil && repEnqueued {
				log.Printf("[EmailWorker] Enqueued rep follow-up reminder email #%d for rep %s", cand.fID, cand.repEmail)
				go w.dispatchSingleLog(context.Background(), *repItem)
			}
		}

		// 3. Mark follow-up completed so no other follow-ups are sent unless salesperson schedules one
		now := time.Now()
		_, _ = w.db.Pool.Exec(ctx, `
			UPDATE follow_ups
			SET completed = 1, completed_at = $1, reminder_state = 'sent',
			    delivery_status = 'sent', sent_at = $1, delivery_error = NULL, last_delivery_attempt_at = $1
			WHERE id = $2
		`, now, cand.fID)

		if cand.leadNum != "" {
			_, _ = w.db.Pool.Exec(ctx, "UPDATE leads SET follow_up_completed = 1, last_activity_at = NOW() WHERE number = $1", cand.leadNum)
			_ = w.logActivity(ctx, cand.leadNum, cand.dealID, cand.repID, "follow_up_sent",
				fmt.Sprintf("Customer Follow-up Sent: %s", cand.title),
				fmt.Sprintf("Customer outreach dispatched to %s (%s)", targetCustomerName, targetCustomerEmail))
		} else if cand.dealID != nil && *cand.dealID > 0 {
			_ = w.logActivity(ctx, "", cand.dealID, cand.repID, "follow_up_sent",
				fmt.Sprintf("Customer Follow-up Sent: %s", cand.title),
				fmt.Sprintf("Customer outreach dispatched to %s (%s)", targetCustomerName, targetCustomerEmail))
		}
	}

	return nil
}

// logActivity writes a consistent timeline entry into lead or deal activities
func (w *EmailWorker) logActivity(ctx context.Context, leadNum string, dealID *int, userID int, actType, title, desc string) error {
	var uid *int
	if userID > 0 {
		uid = &userID
	}
	if leadNum != "" {
		_, _ = w.db.Pool.Exec(ctx, `
			INSERT INTO lead_activities (lead_number, user_id, activity_type, title, description, created_at)
			VALUES ($1, $2, $3, $4, $5, NOW())
		`, leadNum, uid, actType, title, desc)
	}
	if dealID != nil && *dealID > 0 {
		_, _ = w.db.Pool.Exec(ctx, `
			INSERT INTO deal_activities (deal_id, user_id, activity_type, title, description, created_at)
			VALUES ($1, $2, $3, $4, $5, NOW())
		`, *dealID, uid, actType, title, desc)
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

	replyToEmail := ""
	if item.ReplyTo != nil {
		replyToEmail = *item.ReplyTo
	}

	sendErr := w.emailService.SendEmailWithReplyTo(
		ctx,
		item.RecipientEmail,
		item.RecipientName,
		replyToEmail,
		"",
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

		// Sync delivery status on parent entities
		if item.EntityType == "follow_up" {
			fID, _ := strconv.Atoi(item.EntityID)
			if fID > 0 {
				if item.EmailType == "follow_up_customer" {
					_, _ = w.db.Pool.Exec(ctx, "UPDATE follow_ups SET delivery_status = 'sent', sent_at = NOW(), delivery_error = NULL WHERE id = $1", fID)
				} else if item.EmailType == "follow_up_reminder" {
					_, _ = w.db.Pool.Exec(ctx, "UPDATE follow_ups SET reminder_state = 'sent' WHERE id = $1", fID)
				}
			}
		} else if item.EntityType == "quotation" {
			qID, _ := strconv.Atoi(item.EntityID)
			if qID > 0 {
				_, _ = w.db.Pool.Exec(ctx, "UPDATE quotations SET delivery_status = 'sent', sent_at = COALESCE(sent_at, NOW()) WHERE id = $1", qID)
			}
		} else if item.EntityType == "invoice" {
			invID, _ := strconv.Atoi(item.EntityID)
			if invID > 0 {
				_, _ = w.db.Pool.Exec(ctx, "UPDATE invoices SET delivery_status = 'sent', sent_at = COALESCE(sent_at, NOW()) WHERE id = $1", invID)
			}
		}
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

		if item.EntityType == "follow_up" {
			fID, _ := strconv.Atoi(item.EntityID)
			if fID > 0 {
				if item.EmailType == "follow_up_customer" {
					_, _ = w.db.Pool.Exec(ctx, "UPDATE follow_ups SET delivery_status = 'failed', delivery_error = $1 WHERE id = $2", sendErr.Error(), fID)
				} else if item.EmailType == "follow_up_reminder" {
					_, _ = w.db.Pool.Exec(ctx, "UPDATE follow_ups SET reminder_state = 'failed' WHERE id = $1", fID)
				}
			}
		} else if item.EntityType == "quotation" {
			qID, _ := strconv.Atoi(item.EntityID)
			if qID > 0 {
				_, _ = w.db.Pool.Exec(ctx, "UPDATE quotations SET delivery_status = 'failed' WHERE id = $1", qID)
			}
		} else if item.EntityType == "invoice" {
			invID, _ := strconv.Atoi(item.EntityID)
			if invID > 0 {
				_, _ = w.db.Pool.Exec(ctx, "UPDATE invoices SET delivery_status = 'failed' WHERE id = $1", invID)
			}
		}
	}
}

// TriggerQuotationEmail enqueues and immediately attempts delivery for a finalized quotation.
// Strictly enforces send-once: if quotation was already sent, automatic re-sends are prevented unless isManualResend is true.
func (w *EmailWorker) TriggerQuotationEmail(ctx context.Context, quotationID int, isManualResend bool) (*models.EmailLog, error) {
	quote, err := w.quotationRepo.GetByID(ctx, quotationID, 1)
	if err != nil || quote == nil {
		return nil, fmt.Errorf("quotation not found: %w", err)
	}

	// Strictly Send-Once: If not an explicit manual resend, verify quotation has not already been sent
	if !isManualResend {
		var existingSentAt *time.Time
		_ = w.db.Pool.QueryRow(ctx, "SELECT sent_at FROM quotations WHERE id = $1", quotationID).Scan(&existingSentAt)
		if existingSentAt != nil {
			log.Printf("[EmailWorker] Quotation #%d already sent on %v. Automatic duplicate send prevented (manual resend required).", quotationID, existingSentAt)
			latest, _ := w.emailRepo.GetLatestStatusForEntity(ctx, 1, "quotation", strconv.Itoa(quote.ID))
			return latest, nil
		}
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

	idempotencyKey := fmt.Sprintf("quotation:%d:dispatched", quote.ID)
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
		// Already sent for this quotation
		latest, _ := w.emailRepo.GetLatestStatusForEntity(ctx, 1, "quotation", strconv.Itoa(quote.ID))
		return latest, nil
	}

	// Update quotation sent_at and status immediately
	_, _ = w.db.Pool.Exec(ctx, "UPDATE quotations SET sent_at = COALESCE(sent_at, NOW()), delivery_status = 'pending', status = CASE WHEN status = 'Draft' THEN 'Sent' ELSE status END, updated_at = NOW() WHERE id = $1", quote.ID)
	_ = w.logActivity(ctx, "", &quote.DealID, 0, "quotation_sent",
		fmt.Sprintf("Quotation %s Dispatched", quote.QuotationNumber),
		fmt.Sprintf("Quotation %s email sent to %s (%s)", quote.QuotationNumber, recipientName, recipientEmail))

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

// TriggerInvoiceEmail enqueues and immediately attempts delivery for a finalized invoice.
// Strictly enforces send-once: if invoice was already sent, automatic re-sends are prevented unless isManualResend is true.
func (w *EmailWorker) TriggerInvoiceEmail(ctx context.Context, invoiceID int, isManualResend bool) (*models.EmailLog, error) {
	invoice, err := w.invoiceRepo.Get(ctx, invoiceID)
	if err != nil || invoice == nil {
		return nil, fmt.Errorf("invoice not found: %w", err)
	}

	// Strictly Send-Once: If not an explicit manual resend, verify invoice has not already been sent
	if !isManualResend {
		var existingSentAt *time.Time
		_ = w.db.Pool.QueryRow(ctx, "SELECT sent_at FROM invoices WHERE id = $1", invoiceID).Scan(&existingSentAt)
		if existingSentAt != nil {
			log.Printf("[EmailWorker] Invoice #%d already sent on %v. Automatic duplicate send prevented (manual resend required).", invoiceID, existingSentAt)
			latest, _ := w.emailRepo.GetLatestStatusForEntity(ctx, 1, "invoice", strconv.Itoa(invoice.ID))
			return latest, nil
		}
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

	idempotencyKey := fmt.Sprintf("invoice:%d:dispatched", invoice.ID)
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

	// Update invoice sent_at and status immediately
	_, _ = w.db.Pool.Exec(ctx, "UPDATE invoices SET sent_at = COALESCE(sent_at, NOW()), delivery_status = 'pending', status = CASE WHEN status = 'Draft' THEN 'Issued/Sent' ELSE status END, updated_at = NOW() WHERE id = $1", invoice.ID)
	_ = w.logActivity(ctx, "", invoice.DealID, 0, "invoice_sent",
		fmt.Sprintf("Invoice %s Dispatched", invoice.InvoiceNumber),
		fmt.Sprintf("Tax Invoice %s email sent to %s (%s)", invoice.InvoiceNumber, recipientName, recipientEmail))

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
