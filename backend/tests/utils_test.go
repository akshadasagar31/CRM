package tests

import (
	"testing"

	"crm-backend-go/internal/utils"
)

func TestPhoneNormalization(t *testing.T) {
	cases := []struct {
		input    string
		expected string
	}{
		{"+1 (555) 019-2834", "+15550192834"},
		{"(555) 019-2834", "5550192834"},
		{"+44 20 7946 0958", "+442079460958"},
		{"", ""},
		{"   +91 98765 43210  ", "+919876543210"},
	}

	for _, c := range cases {
		actual := utils.NormalizePhone(c.input)
		if actual != c.expected {
			t.Errorf("NormalizePhone(%q) = %q, expected %q", c.input, actual, c.expected)
		}
	}
}

func TestPasswordHashing(t *testing.T) {
	password := "SecurePassword123!"
	hashed, err := utils.HashPassword(password)
	if err != nil {
		t.Fatalf("HashPassword failed: %v", err)
	}

	if !utils.VerifyPassword(password, hashed) {
		t.Errorf("VerifyPassword failed to match correct password")
	}

	if utils.VerifyPassword("WrongPassword", hashed) {
		t.Errorf("VerifyPassword matched incorrect password")
	}
}

func TestJWTGenerationAndValidation(t *testing.T) {
	secret := "test_jwt_secret_key_12345"
	userID := 99

	token, err := utils.GenerateToken(userID, secret, 60)
	if err != nil {
		t.Fatalf("GenerateToken failed: %v", err)
	}

	extractedID, err := utils.ValidateToken(token, secret)
	if err != nil {
		t.Fatalf("ValidateToken failed: %v", err)
	}

	if extractedID != userID {
		t.Errorf("Extracted user ID %d, expected %d", extractedID, userID)
	}

	_, err = utils.ValidateToken(token, "wrong_secret_key")
	if err == nil {
		t.Errorf("ValidateToken should have failed with incorrect secret")
	}
}
