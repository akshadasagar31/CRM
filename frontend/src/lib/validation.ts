/**
 * Strict Indian Phone & Email Validation Utilities
 * Ensures Indian mobile numbers have exactly 10 digits starting with 6-9
 * and emails match a standard valid email format.
 */

export interface ValidationResult {
  isValid: boolean;
  sanitized: string;
  error?: string;
}

/**
 * Validates and sanitizes Indian mobile numbers.
 * Strips common prefixes (+91, 91, 0) and formatting characters (spaces, dashes, parentheses).
 * Ensures exactly 10 digits starting with 6, 7, 8, or 9.
 */
export function validateIndianPhone(rawPhone: string, required: boolean = true): ValidationResult {
  const trimmed = (rawPhone || "").trim();

  if (!trimmed) {
    if (required) {
      return {
        isValid: false,
        sanitized: "",
        error: "Phone number is required (10 digits starting with 6-9)",
      };
    }
    return { isValid: true, sanitized: "" };
  }

  // Strip spaces, dashes, dots, parentheses
  let digits = trimmed.replace(/[\s\-\(\)\.]+/g, "");

  // Remove leading '+' or '+91'
  if (digits.startsWith("+91")) {
    digits = digits.slice(3);
  } else if (digits.startsWith("+")) {
    digits = digits.slice(1);
  }

  // Remove leading 91 if length is 12
  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  }

  // Remove leading 0 if length is 11
  if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  // Check if exactly 10 digits and starts with 6, 7, 8, or 9
  const indianMobileRegex = /^[6-9]\d{9}$/;
  if (!indianMobileRegex.test(digits)) {
    if (/^\d{10}$/.test(digits)) {
      return {
        isValid: false,
        sanitized: digits,
        error: "Indian mobile numbers must start with 6, 7, 8, or 9",
      };
    }
    return {
      isValid: false,
      sanitized: digits,
      error: "Phone number must contain exactly 10 digits (e.g., 9876543210)",
    };
  }

  return {
    isValid: true,
    sanitized: digits,
  };
}

/**
 * Validates standard email addresses.
 * Format: name@domain.tld (e.g. name@gmail.com)
 */
export function validateEmail(rawEmail: string, required: boolean = true): ValidationResult {
  const trimmed = (rawEmail || "").trim();

  if (!trimmed) {
    if (required) {
      return {
        isValid: false,
        sanitized: "",
        error: "Email address is required (e.g. name@gmail.com)",
      };
    }
    return { isValid: true, sanitized: "" };
  }

  const emailRegex = /^[a-zA-Z0-9._%+-]+@([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;
  if (trimmed.length > 254 || trimmed.includes("..") || !emailRegex.test(trimmed)) {
    return {
      isValid: false,
      sanitized: trimmed,
      error: "Enter a valid email address (e.g. name@gmail.com)",
    };
  }

  return {
    isValid: true,
    sanitized: trimmed.toLowerCase(),
  };
}
