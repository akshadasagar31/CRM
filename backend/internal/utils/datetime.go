package utils

import (
	"strings"
	"time"
)

var flexibleDateFormats = []string{
	time.RFC3339Nano,
	time.RFC3339,
	"2006-01-02T15:04:05.999999999",
	"2006-01-02T15:04:05",
	"2006-01-02T15:04", // HTML5 datetime-local without seconds
	"2006-01-02 15:04:05",
	"2006-01-02 15:04",
	"2006-01-02",
	"02-01-2006 15:04:05",
	"02-01-2006 15:04",
	"02/01/2006 15:04:05",
	"02/01/2006 15:04",
	"02-01-2006",
	"02/01/2006",
}

// ParseFlexibleTime attempts to parse a datetime string across common web, HTML5, and ISO layouts
func ParseFlexibleTime(s string) (time.Time, error) {
	clean := strings.TrimSpace(s)
	if clean == "" {
		return time.Time{}, nil
	}

	for _, format := range flexibleDateFormats {
		if strings.Contains(format, "Z07:00") || strings.HasSuffix(format, "Z") {
			if t, err := time.Parse(format, clean); err == nil {
				return t, nil
			}
		} else {
			if t, err := time.ParseInLocation(format, clean, time.Local); err == nil {
				return t, nil
			}
		}
	}

	// Final attempt with standard RFC3339
	return time.Parse(time.RFC3339, clean)
}

// NullableTime represents an optionally present, flexible time.Time in JSON bodies
type NullableTime struct {
	Val *time.Time
	Set bool
}

// UnmarshalJSON unmarshals strings in any format, null, or empty string into a time.Time pointer
func (nt *NullableTime) UnmarshalJSON(b []byte) error {
	nt.Set = true
	raw := string(b)
	if raw == "null" || raw == `""` {
		nt.Val = nil
		return nil
	}

	s := strings.Trim(raw, `"`)
	s = strings.TrimSpace(s)
	if s == "" || s == "null" {
		nt.Val = nil
		return nil
	}

	t, err := ParseFlexibleTime(s)
	if err != nil {
		return err
	}
	nt.Val = &t
	return nil
}

// MarshalJSON marshals the NullableTime back to JSON
func (nt NullableTime) MarshalJSON() ([]byte, error) {
	if nt.Val == nil {
		return []byte("null"), nil
	}
	return nt.Val.MarshalJSON()
}
