// packages/api/src/otp/types.ts

import type { VerifyOTPDto } from "@monteai/types";

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;

/**
 * Reusable email-OTP service (signup verification, password reset, ...).
 * Consumed via `createOtpService(client, useMock)` so web and mobile share
 * the same live/mock toggle pattern as the other `packages/api` modules.
 */
export interface OtpService {
  /** Sends a fresh OTP to the given email. */
  sendOtp(email: string): Promise<boolean>;
  /** Re-sends (re-issues) the OTP, e.g. "Didn't get the code?" flows. */
  resendOtp(email: string): Promise<boolean>;
  /** Verifies the OTP entered by the user. */
  verifyOtp(dto: VerifyOTPDto): Promise<boolean>;
}
