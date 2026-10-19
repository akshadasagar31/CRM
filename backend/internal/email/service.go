package email

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/tls"
	"encoding/base64"
	"fmt"
	"log"
	"mime/quotedprintable"
	"net"
	"net/mail"
	"net/smtp"
	"regexp"
	"strings"
	"time"

	"crm-backend-go/internal/config"
)

var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9.!#$%&'*+/=?^_` + "`" + `{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$`)

// IsValidEmail validates an email address using RFC 5322 parsing and domain checks
func IsValidEmail(emailAddr string) bool {
	emailAddr = strings.TrimSpace(emailAddr)
	if emailAddr == "" || len(emailAddr) > 254 {
		return false
	}
	addr, err := mail.ParseAddress(emailAddr)
	if err != nil || addr.Address != emailAddr {
		return false
	}
	return emailRegex.MatchString(emailAddr)
}

// encodeQuotedPrintable encodes string text as quoted-printable for optimal deliverability
func encodeQuotedPrintable(s string) string {
	var buf bytes.Buffer
	w := quotedprintable.NewWriter(&buf)
	_, _ = w.Write([]byte(s))
	_ = w.Close()
	return buf.String()
}

// Service defines the email dispatch interface
type Service struct {
	cfg *config.Config
}

// NewService instantiates a new email service with configuration
func NewService(cfg *config.Config) *Service {
	return &Service{cfg: cfg}
}

// SendEmail builds and sends an RFC 5322 compliant message with deliverability headers and exactly one attachment
func (s *Service) SendEmail(
	ctx context.Context,
	toEmail string,
	toName string,
	subject string,
	bodyHTML string,
	bodyText string,
	attachmentName string,
	attachmentBytes []byte,
) error {
	toEmail = strings.TrimSpace(toEmail)
	if toEmail == "" {
		return fmt.Errorf("recipient email address cannot be empty")
	}
	if !IsValidEmail(toEmail) {
		return fmt.Errorf("invalid recipient email address: %q", toEmail)
	}

	fromEmail := s.cfg.SMTPFromEmail
	fromName := s.cfg.SMTPFromName
	if fromEmail == "" {
		fromEmail = "notifications@bizcopilot.com"
	}
	if fromName == "" {
		fromName = "BizCopilot CRM"
	}

	// Extract domain for Message-ID to align with sending domain
	domain := "gmail.com"
	if parts := strings.Split(fromEmail, "@"); len(parts) == 2 && parts[1] != "" {
		domain = parts[1]
	}

	// Generate unique standard Message-ID
	randBytes := make([]byte, 8)
	_, _ = rand.Read(randBytes)
	messageID := fmt.Sprintf("<%d.%x@%s>", time.Now().UnixNano(), randBytes, domain)

	// If mock mode, log delivery and return without external network call
	if s.cfg.SMTPMockMode {
		log.Printf("[EmailService Mock] Dispatched email to %s (%s) | Subject: '%s' | Attachment: %s (%d bytes)",
			toEmail, toName, subject, attachmentName, len(attachmentBytes))
		return nil
	}

	// Build MIME message payload
	var msgBuf bytes.Buffer
	boundaryMixed := fmt.Sprintf("==_Mixed_%x", randBytes)
	boundaryAlt := fmt.Sprintf("==_Alt_%x", randBytes)

	cleanSubject := cleanHeaderValue(subject)
	cleanFromName := cleanHeaderValue(fromName)
	cleanToName := cleanHeaderValue(toName)

	// Standard RFC 5322 Headers
	if cleanToName != "" && cleanToName != toEmail {
		msgBuf.WriteString(fmt.Sprintf("To: \"%s\" <%s>\r\n", cleanToName, toEmail))
	} else {
		msgBuf.WriteString(fmt.Sprintf("To: <%s>\r\n", toEmail))
	}
	msgBuf.WriteString(fmt.Sprintf("From: \"%s\" <%s>\r\n", cleanFromName, fromEmail))
	msgBuf.WriteString(fmt.Sprintf("Reply-To: \"%s\" <%s>\r\n", cleanFromName, fromEmail))
	msgBuf.WriteString(fmt.Sprintf("Subject: %s\r\n", cleanSubject))
	msgBuf.WriteString(fmt.Sprintf("Date: %s\r\n", time.Now().Format(time.RFC1123Z)))
	if !strings.HasSuffix(strings.ToLower(s.cfg.SMTPHost), "gmail.com") {
		msgBuf.WriteString(fmt.Sprintf("Message-ID: %s\r\n", messageID))
	}
	msgBuf.WriteString("MIME-Version: 1.0\r\n")

	hasAttachment := len(attachmentBytes) > 0 && attachmentName != ""

	if hasAttachment {
		// Top-level is multipart/mixed
		msgBuf.WriteString(fmt.Sprintf("Content-Type: multipart/mixed; boundary=\"%s\"\r\n\r\n", boundaryMixed))

		// Part 1: multipart/alternative (Plain Text + HTML)
		msgBuf.WriteString(fmt.Sprintf("--%s\r\n", boundaryMixed))
		msgBuf.WriteString(fmt.Sprintf("Content-Type: multipart/alternative; boundary=\"%s\"\r\n\r\n", boundaryAlt))

		// 1a. Text/Plain part (quoted-printable)
		msgBuf.WriteString(fmt.Sprintf("--%s\r\n", boundaryAlt))
		msgBuf.WriteString("Content-Type: text/plain; charset=UTF-8\r\n")
		msgBuf.WriteString("Content-Transfer-Encoding: quoted-printable\r\n\r\n")
		msgBuf.WriteString(encodeQuotedPrintable(bodyText))
		msgBuf.WriteString("\r\n")

		// 1b. Text/HTML part (quoted-printable)
		msgBuf.WriteString(fmt.Sprintf("--%s\r\n", boundaryAlt))
		msgBuf.WriteString("Content-Type: text/html; charset=UTF-8\r\n")
		msgBuf.WriteString("Content-Transfer-Encoding: quoted-printable\r\n\r\n")
		msgBuf.WriteString(encodeQuotedPrintable(bodyHTML))
		msgBuf.WriteString("\r\n")

		// Close alternative
		msgBuf.WriteString(fmt.Sprintf("--%s--\r\n", boundaryAlt))

		// Part 2: Single PDF Attachment
		// Do NOT include name="..." in Content-Type to prevent double attachment display in email clients
		msgBuf.WriteString(fmt.Sprintf("--%s\r\n", boundaryMixed))
		msgBuf.WriteString("Content-Type: application/pdf\r\n")
		msgBuf.WriteString(fmt.Sprintf("Content-Disposition: attachment; filename=\"%s\"\r\n", attachmentName))
		msgBuf.WriteString("Content-Transfer-Encoding: base64\r\n\r\n")
		msgBuf.WriteString(wrapBase64(attachmentBytes))
		msgBuf.WriteString("\r\n")

		// Close mixed
		msgBuf.WriteString(fmt.Sprintf("--%s--\r\n", boundaryMixed))
	} else {
		// No attachment: Direct multipart/alternative
		msgBuf.WriteString(fmt.Sprintf("Content-Type: multipart/alternative; boundary=\"%s\"\r\n\r\n", boundaryAlt))

		// 1. Text/Plain part
		msgBuf.WriteString(fmt.Sprintf("--%s\r\n", boundaryAlt))
		msgBuf.WriteString("Content-Type: text/plain; charset=UTF-8\r\n")
		msgBuf.WriteString("Content-Transfer-Encoding: quoted-printable\r\n\r\n")
		msgBuf.WriteString(encodeQuotedPrintable(bodyText))
		msgBuf.WriteString("\r\n")

		// 2. Text/HTML part
		msgBuf.WriteString(fmt.Sprintf("--%s\r\n", boundaryAlt))
		msgBuf.WriteString("Content-Type: text/html; charset=UTF-8\r\n")
		msgBuf.WriteString("Content-Transfer-Encoding: quoted-printable\r\n\r\n")
		msgBuf.WriteString(encodeQuotedPrintable(bodyHTML))
		msgBuf.WriteString("\r\n")

		// Close alternative
		msgBuf.WriteString(fmt.Sprintf("--%s--\r\n", boundaryAlt))
	}

	// Dispatch via SMTP
	return s.dialAndSend(ctx, toEmail, msgBuf.Bytes())
}

// dialAndSend connects to SMTP server with proper TLS/STARTTLS handling
func (s *Service) dialAndSend(ctx context.Context, recipient string, payload []byte) error {
	addr := fmt.Sprintf("%s:%d", s.cfg.SMTPHost, s.cfg.SMTPPort)
	from := s.cfg.SMTPFromEmail

	var auth smtp.Auth
	if s.cfg.SMTPUsername != "" {
		auth = smtp.PlainAuth("", s.cfg.SMTPUsername, s.cfg.SMTPPassword, s.cfg.SMTPHost)
	}

	tlsConfig := &tls.Config{
		ServerName:         s.cfg.SMTPHost,
		InsecureSkipVerify: false,
	}

	// Port 465 direct SSL/TLS
	if s.cfg.SMTPPort == 465 || strings.ToLower(s.cfg.SMTPEncryption) == "tls" {
		conn, err := tls.Dial("tcp", addr, tlsConfig)
		if err != nil {
			return fmt.Errorf("SMTP TLS connection failed: %w", err)
		}
		defer conn.Close()

		client, err := smtp.NewClient(conn, s.cfg.SMTPHost)
		if err != nil {
			return fmt.Errorf("SMTP client initialization error: %w", err)
		}
		defer client.Close()

		if auth != nil {
			if ok, _ := client.Extension("AUTH"); ok {
				if err := client.Auth(auth); err != nil {
					return fmt.Errorf("SMTP authentication failed: %w", err)
				}
			}
		}

		if err := client.Mail(from); err != nil {
			return fmt.Errorf("SMTP MAIL command failed: %w", err)
		}
		if err := client.Rcpt(recipient); err != nil {
			return fmt.Errorf("SMTP RCPT command failed: %w", err)
		}

		w, err := client.Data()
		if err != nil {
			return fmt.Errorf("SMTP DATA command failed: %w", err)
		}
		if _, err := w.Write(payload); err != nil {
			return fmt.Errorf("failed writing email payload: %w", err)
		}
		if err := w.Close(); err != nil {
			return fmt.Errorf("failed closing email writer: %w", err)
		}

		return client.Quit()
	}

	// Default: Standard SMTP / STARTTLS (Port 587 or 25)
	dialer := &net.Dialer{Timeout: 15 * time.Second}
	conn, err := dialer.DialContext(ctx, "tcp", addr)
	if err != nil {
		return fmt.Errorf("SMTP dial failed: %w", err)
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, s.cfg.SMTPHost)
	if err != nil {
		return fmt.Errorf("SMTP client init failed: %w", err)
	}
	defer client.Close()

	// Try STARTTLS if available
	if ok, _ := client.Extension("STARTTLS"); ok {
		if err := client.StartTLS(tlsConfig); err != nil {
			return fmt.Errorf("SMTP STARTTLS handshake failed: %w", err)
		}
	}

	if auth != nil {
		if ok, _ := client.Extension("AUTH"); ok {
			if err := client.Auth(auth); err != nil {
				return fmt.Errorf("SMTP authentication failed: %w", err)
			}
		}
	}

	if err := client.Mail(from); err != nil {
		return fmt.Errorf("SMTP MAIL command failed: %w", err)
	}
	if err := client.Rcpt(recipient); err != nil {
		return fmt.Errorf("SMTP RCPT command failed: %w", err)
	}

	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("SMTP DATA command failed: %w", err)
	}
	if _, err := w.Write(payload); err != nil {
		return fmt.Errorf("failed writing email payload: %w", err)
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("failed closing email writer: %w", err)
	}

	return client.Quit()
}

// wrapBase64 encodes bytes into base64 lines of max 76 characters per RFC 2045
func wrapBase64(data []byte) string {
	encoded := base64.StdEncoding.EncodeToString(data)
	var sb strings.Builder
	for len(encoded) > 76 {
		sb.WriteString(encoded[:76])
		sb.WriteString("\r\n")
		encoded = encoded[76:]
	}
	sb.WriteString(encoded)
	return sb.String()
}

func cleanHeaderValue(s string) string {
	s = strings.ReplaceAll(s, "\r", "")
	s = strings.ReplaceAll(s, "\n", "")
	return strings.TrimSpace(s)
}
