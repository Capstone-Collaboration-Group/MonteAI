export function validateEmail(email: string) {
  const regex = /^[A-Za-z0-9._%+-]+@(student\.pnm\.edu\.ph|gmail\.com)$/;

  return regex.test(email);
}

export function validateStudentNumber(student: string) {
  const regex = /^\d{2}-\d{5}$/;

  return regex.test(student);
}

export function validatePassword(password: string) {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

export function passwordsMatch(password: string, confirmPassword: string) {
  return password === confirmPassword;
}

export function isRequired(value: string) {
  return value.trim().length > 0;
}

// Aliases for alternative naming conventions
export const isValidEmail = validateEmail;
export const isStudentNumber = validateStudentNumber;
