// packages/api/src/otp/otpService.ts

import type { AxiosInstance } from "axios";
import type { VerifyOTPDto } from "@monteai/types";
import type { OtpService } from "./types";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Live OTP service. Endpoint paths intentionally mirror the existing
 * `AuthService` (`/auth/verify-email`, `/auth/resend-otp`) so the backend
 * only needs one contract to implement.
 *
 * NOTE: the .NET `AuthController` does not expose these routes yet —
 * live calls will fail until the backend adds them. Use the mock service
 * (`VITE_USE_MOCK=true`) until then.
 */
export class LiveOtpService implements OtpService {
  private readonly client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  async sendOtp(email: string): Promise<boolean> {
    const { data } = await this.client.post<boolean>("/auth/send-otp", {
      email: normalizeEmail(email),
    });
    return data;
  }

  async resendOtp(email: string): Promise<boolean> {
    const { data } = await this.client.post<boolean>("/auth/resend-otp", {
      email: normalizeEmail(email),
    });
    return data;
  }

  async verifyOtp(dto: VerifyOTPDto): Promise<boolean> {
    const { data } = await this.client.post<boolean>("/auth/verify-email", {
      email: normalizeEmail(dto.email),
      otp: dto.otp.trim(),
    });
    return data;
  }
}
