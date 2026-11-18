import { isAxiosError } from "axios";

const MESSAGES = {
  authentication_required: "Sign in again before completing registration.",
  email_unverified: "Verify your email before completing registration.",
  identity_mismatch: "Registration details do not match the signed-in account.",
  privacy_notice_required: "Please accept the current privacy notice before registering.",
  terms_required: "Please accept the current terms and conditions before registering.",
  faculty_email_required: "Faculty must register with a @pnm.edu.ph email address.",
  invalid_receipt: "The student ID verification receipt is invalid or expired. Verify your ID again.",
  registration_conflict: "This verification receipt or student registration has already been used.",
  invalid_request: "Check your registration details and try again.",
  service_unavailable: "Unable to complete registration right now. Check your connection and try again.",
} as const;

export type RegistrationErrorCode = keyof typeof MESSAGES;

/** Safe to display/report: never retains Axios config, request bodies, tokens, or a cause. */
export class RegistrationError extends Error {
  readonly code: RegistrationErrorCode;
  readonly status?: number;

  constructor(code: RegistrationErrorCode, status?: number) {
    const safeCode = Object.prototype.hasOwnProperty.call(MESSAGES, code) ? code : "service_unavailable";
    super(MESSAGES[safeCode]);
    this.name = "RegistrationError";
    this.code = safeCode;
    this.status = typeof status === "number" && Number.isInteger(status) && status >= 100 && status <= 599
      ? status
      : undefined;
  }
}

const SERVER_MESSAGES = new Map<string, RegistrationErrorCode>([
  ["Firebase UID is required.", "authentication_required"],
  ["A verified Firebase identity is required.", "authentication_required"],
  ["Registration details do not match the signed-in account.", "identity_mismatch"],
  ["Please accept the current privacy notice before registering.", "privacy_notice_required"],
  ["Please accept the current terms and conditions before registering.", "terms_required"],
  ["Faculty must register with a @pnm.edu.ph email address.", "faculty_email_required"],
  ["Student identity details are invalid.", "invalid_request"],
  ["The student ID verification receipt is invalid or expired.", "invalid_receipt"],
  ["This verification receipt or student registration has already been used.", "registration_conflict"],
  ["Unable to create the faculty profile.", "registration_conflict"],
]);

/** Only recognized, static server messages are used; arbitrary/echoed responses are discarded. */
export function sanitizeRegistrationError(error: unknown): RegistrationError {
  if (error instanceof RegistrationError) {
    return new RegistrationError(error.code, error.status);
  }
  if (isAxiosError(error)) {
    const status = error.response?.status;
    const body = error.response?.data as { message?: unknown; Message?: unknown } | undefined;
    const message = body?.message ?? body?.Message;
    const knownCode = typeof message === "string" ? SERVER_MESSAGES.get(message) : undefined;
    const code = knownCode ?? (
      status === 401 ? "authentication_required" :
      status === 403 ? "email_unverified" :
      status === 409 ? "registration_conflict" :
      status === 400 ? "invalid_request" : "service_unavailable"
    );
    return new RegistrationError(code, status);
  }
  return new RegistrationError("service_unavailable");
}
