// packages/utils/src/emailRules.ts
export const STUDENT_EMAIL_DOMAIN = "@student.pnm.edu.ph";
export const FACULTY_EMAIL_DOMAIN = "@pnm.edu.ph";

export type EmailRole = "Student" | "Faculty";

const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}

export function emailDomainForRole(role: EmailRole): string {
  return role === "Student" ? STUDENT_EMAIL_DOMAIN : FACULTY_EMAIL_DOMAIN;
}

/** Students register with name@student.pnm.edu.ph, faculty with name@pnm.edu.ph. */
export function isValidEmailForRole(email: string, role: EmailRole): boolean {
  const value = email.trim().toLowerCase();
  if (!isValidEmail(value)) return false;
  return value.endsWith(emailDomainForRole(role).toLowerCase());
}
