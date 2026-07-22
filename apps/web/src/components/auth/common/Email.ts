/**
 * Email validation utilities for authentication
 */

export const EMAIL_REGEX =
  /^[A-Za-z0-9._%+-]+@(student\.pnm\.edu\.ph|gmail\.com)$/;

/**
 * Validate email format
 * Accepts: @student.pnm.edu.ph or @gmail.com
 */
export function validateEmail(email: string): boolean {
  if (!email || !email.trim()) {
    return false;
  }
  return EMAIL_REGEX.test(email.toLowerCase());
}

/**
 * Get email validation error message
 */
export function getEmailError(email: string): string | null {
  if (!email || !email.trim()) {
    return "Email Address is required.";
  }

  if (!validateEmail(email)) {
    return "Use @gmail.com or @student.pnm.edu.ph";
  }

  return null;
}

/**
 * Check if email is valid (alias)
 */
export const isValidEmail = validateEmail;

/**
 * Normalize email (trim and lowercase)
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
