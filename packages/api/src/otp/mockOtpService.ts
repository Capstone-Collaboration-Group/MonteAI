// packages/api/src/otp/mockOtpService.ts

import type { VerifyOTPDto } from "@monteai/types";
import { OTP_LENGTH, OTP_MAX_ATTEMPTS, OTP_TTL_MS } from "./types";
import type { OtpService } from "./types";

interface OtpEntry {
  code: string;
  expiresAt: number;
  attempts: number;
}

const store = new Map<string, OtpEntry>();

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function generateCode(): string {
  const min = 10 ** (OTP_LENGTH - 1);
  const max = 10 ** OTP_LENGTH - 1;
  return String(Math.floor(min + Math.random() * (max - min + 1)));
}

async function issue(email: string): Promise<boolean> {
  await delay(300);
  const key = normalizeEmail(email);
  if (!key) return false;
  const entry: OtpEntry = {
    code: generateCode(),
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
  };
  store.set(key, entry);
  // Dev-only visibility: there is no real mailer in mock mode.
  console.log(`[mockOtpService] OTP for ${key}: ${entry.code}`);
  return true;
}

/**
 * In-memory OTP service for `VITE_USE_MOCK=true` dev. Accepts any
 * non-empty email, enforces a 5-minute TTL and a max-attempt limit, and
 * consumes the code on successful verification — mirroring how a
 * single-use backend OTP should behave.
 */
export const mockOtpService: OtpService = {
  async sendOtp(email: string) {
    return issue(email);
  },

  async resendOtp(email: string) {
    return issue(email);
  },

  async verifyOtp(dto: VerifyOTPDto) {
    await delay(300);
    const key = normalizeEmail(dto.email);
    const entry = store.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      store.delete(key);
      return false;
    }
    if (entry.attempts >= OTP_MAX_ATTEMPTS) {
      store.delete(key);
      return false;
    }
    if (dto.otp.trim() !== entry.code) {
      entry.attempts += 1;
      store.set(key, entry);
      return false;
    }
    store.delete(key);
    return true;
  },
};

/** Dev/test helper — read the last issued mock code (e.g. to auto-fill OTP forms). */
export function getMockOtpForEmail(email: string): string | undefined {
  return store.get(normalizeEmail(email))?.code;
}

/** Dev/test helper — clear all issued mock codes. */
export function clearMockOtps(): void {
  store.clear();
}
