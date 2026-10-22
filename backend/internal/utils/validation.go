package utils

import (
	"errors"
	"regexp"
	"strings"
	"unicode"
)

var (
	// Indian mobile numbers must be exactly 10 digits starting with 6, 7, 8, or 9
	indianPhoneRegex = regexp.MustCompile(`^[6-9]\d{9}$`)

	// Standard valid email format regex RFC 5322 compliant
	emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$`)
)

// SanitizeIndianPhone trims formatting characters, strips '+91', '91', or leading '0',
// and validates that the remaining string is a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.
func SanitizeIndianPhone(raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "", errors.New("phone number cannot be empty")
	}

	// Extract only digits
	var digits strings.Builder
	for _, ch := range trimmed {
		if unicode.IsDigit(ch) {
			digits.WriteRune(ch)
		}
	}
	digitStr := digits.String()

	// If starts with country code 91 and has 12 digits, strip 91
	if len(digitStr) == 12 && strings.HasPrefix(digitStr, "91") {
		digitStr = digitStr[2:]
	} else if len(digitStr) == 11 && strings.HasPrefix(digitStr, "0") {
		// If starts with trunk prefix 0 and has 11 digits, strip 0
		digitStr = digitStr[1:]
	}

	if !indianPhoneRegex.MatchString(digitStr) {
		return "", errors.New("invalid phone number: must be a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9 (e.g. 9876543210)")
	}

	return digitStr, nil
}

// ValidateEmail validates that the email string is in a standard valid email format (e.g., name@gmail.com)
func ValidateEmail(raw string) (string, error) {
	clean := strings.ToLower(strings.TrimSpace(raw))
	if clean == "" {
		return "", errors.New("email address cannot be empty")
	}

	if len(clean) > 254 || strings.Contains(clean, "..") || !emailRegex.MatchString(clean) {
		return "", errors.New("invalid email address format: must follow a valid format like name@gmail.com")
	}

	return clean, nil
}
