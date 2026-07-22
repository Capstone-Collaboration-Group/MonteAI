/**
 * Consolidated registration validation utilities
 * Validates all fields required for user registration
 */

import {
  validateEmail,
  getEmailError,
  normalizeEmail,
  isValidEmail,
} from "../common/Email";

import {
  validatePassword,
  passwordsMatch,
  getPasswordError,
  getConfirmPasswordError,
} from "../common/Password";

/**
 * Student number validation
 * Format: XX-XXXXX (e.g., 23-00001)
 */
const STUDENT_NUMBER_REGEX = /^\d{2}-\d{5}$/;

export function validateStudentNumber(studentNumber: string): boolean {
  if (!studentNumber || !studentNumber.trim()) {
    return false;
  }
  return STUDENT_NUMBER_REGEX.test(studentNumber);
}

export function getStudentNumberError(studentNumber: string): string | null {
  if (!studentNumber || !studentNumber.trim()) {
    return "Student Number is required.";
  }

  if (!validateStudentNumber(studentNumber)) {
    return "Student Number must be in format XX-XXXXX (e.g., 23-00001).";
  }

  return null;
}

/**
 * Complete registration data validation
 */
export interface RegistrationErrors {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  studentNumber?: string;
  email?: string;
  institute?: string;
  program?: string;
  year?: string;
  password?: string;
  confirmPassword?: string;
}

export interface RegistrationData {
  firstName: string;
  middleName: string;
  lastName: string;
  studentNumber: string;
  email: string;
  institute: string;
  program: string;
  year: string;
  password: string;
  confirmPassword: string;
}

/**
 * Validate all registration fields
 */
export function validateRegistration(
  data: RegistrationData,
): RegistrationErrors {
  const errors: RegistrationErrors = {};

  // First Name
  if (!data.firstName || !data.firstName.trim()) {
    errors.firstName = "First Name is required.";
  }

  // Middle Name (optional)
  // No validation needed

  // Last Name
  if (!data.lastName || !data.lastName.trim()) {
    errors.lastName = "Last Name is required.";
  }

  // Student Number
  const studentNumberError = getStudentNumberError(data.studentNumber);
  if (studentNumberError) {
    errors.studentNumber = studentNumberError;
  }

  // Email
  const emailError = getEmailError(data.email);
  if (emailError) {
    errors.email = emailError;
  }

  // Institute
  if (!data.institute || !data.institute.trim()) {
    errors.institute = "Institute is required.";
  }

  // Program
  if (!data.program || !data.program.trim()) {
    errors.program = "Program is required.";
  }

  // Year
  if (!data.year || !data.year.trim()) {
    errors.year = "Year is required.";
  }

  // Password
  const passwordError = getPasswordError(data.password);
  if (passwordError) {
    errors.password = passwordError;
  }

  // Confirm Password
  const confirmPasswordError = getConfirmPasswordError(
    data.password,
    data.confirmPassword,
  );
  if (confirmPasswordError) {
    errors.confirmPassword = confirmPasswordError;
  }

  return errors;
}

/**
 * Check if there are any validation errors
 */
export function hasRegistrationErrors(errors: RegistrationErrors): boolean {
  return Object.keys(errors).length > 0;
}

/**
 * Normalize student number to XX-XXXXX format
 */
export function normalizeStudentNumber(input: string): string {
  let value = input.replace(/\D/g, "");

  if (value.length > 7) {
    value = value.slice(0, 7);
  }

  if (value.length >= 3) {
    value = value.slice(0, 2) + "-" + value.slice(2);
  }

  return value;
}

/**
 * Prepare registration data for submission
 */
export function prepareRegistrationData(data: RegistrationData) {
  return {
    studentNumber: data.studentNumber,
    fullName: `${data.firstName} ${data.middleName} ${data.lastName}`.trim(),
    email: normalizeEmail(data.email),
    institute: data.institute,
    program: data.program,
    year: data.year,
    password: data.password,
  };
}

/**
 * Export all validation functions for convenience
 */
export {
  validateEmail,
  getEmailError,
  normalizeEmail,
  isValidEmail,
  validatePassword,
  passwordsMatch,
  getPasswordError,
  getConfirmPasswordError,
};
