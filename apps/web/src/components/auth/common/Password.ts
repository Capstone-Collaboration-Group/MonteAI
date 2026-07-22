/**
 * Password validation utilities for authentication
 */

/**
 * Password requirements:
 * - At least 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one digit
 * - At least one special character
 */
export function validatePassword(password: string): boolean {
  if (!password) {
    return false;
  }

  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

/**
 * Check if two passwords match
 */
export function passwordsMatch(
  password: string,
  confirmPassword: string,
): boolean {
  return password === confirmPassword && password.length > 0;
}

/**
 * Get password validation error message
 */
export function getPasswordError(password: string): string | null {
  if (!password) {
    return "Password is required.";
  }

  if (password.length < 8) {
    return "Password must be at least 8 characters.";
  }

  if (!/[A-Z]/.test(password)) {
    return "Password must contain at least one uppercase letter.";
  }

  if (!/[a-z]/.test(password)) {
    return "Password must contain at least one lowercase letter.";
  }

  if (!/\d/.test(password)) {
    return "Password must contain at least one digit.";
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    return "Password must contain at least one special character.";
  }

  return null;
}

/**
 * Check if confirm password matches original password
 */
export function getConfirmPasswordError(
  password: string,
  confirmPassword: string,
): string | null {
  if (!confirmPassword) {
    return "Please confirm your password.";
  }

  if (!passwordsMatch(password, confirmPassword)) {
    return "Passwords do not match.";
  }

  return null;
}

/**
 * Calculate password strength (0-5)
 */
export function calculatePasswordStrength(password: string): number {
  if (!password) return 0;

  let strength = 0;

  if (password.length >= 8) strength++;
  if (/[A-Z]/.test(password)) strength++;
  if (/[a-z]/.test(password)) strength++;
  if (/\d/.test(password)) strength++;
  if (/[^A-Za-z0-9]/.test(password)) strength++;

  return Math.min(strength, 5);
}

/**
 * Get password strength level
 */
export function getPasswordStrengthLevel(password: string): {
  score: number;
  label: string;
  color: string;
} {
  const score = calculatePasswordStrength(password);

  if (score <= 2) {
    return {
      score,
      label: "Weak",
      color: "#DC2626",
    };
  }

  if (score <= 3) {
    return {
      score,
      label: "Medium",
      color: "#F59E0B",
    };
  }

  if (score <= 4) {
    return {
      score,
      label: "Strong",
      color: "#10B981",
    };
  }

  return {
    score,
    label: "Very Strong",
    color: "#006400",
  };
}
