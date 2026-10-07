package utils

import (
	"strings"
	"unicode"
)

// NormalizePhone normalizes phone string by retaining digits and optional leading plus sign
func NormalizePhone(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	hasPlus := strings.HasPrefix(raw, "+")
	var digits strings.Builder
	for _, ch := range raw {
		if unicode.IsDigit(ch) {
			digits.WriteRune(ch)
		}
	}
	if hasPlus {
		return "+" + digits.String()
	}
	return digits.String()
}
