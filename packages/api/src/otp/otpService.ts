// packages/api/src/otp/otpService.ts

import type { AxiosInstance } from "axios";
import type { VerifyOTPDto } from "@monteai/types";
import type { OtpService } from "./types";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Live OTP service. Endpoint paths intentionally mirror the existing
 * `AuthController` (`/auth/verify-otp`, `/auth/resend-otp`).
 */
export class LiveOtpService implements OtpService {
  private readonly client: AxiosInstance;

  constructor(client: AxiosInstance) {
    this.client = client;
  }

  async sendOtp(email: string): Promise<boolean> {
    const { data } = await this.client.post<{ sent: boolean }>(
      "/auth/resend-otp",
      {
        email: normalizeEmail(email),
      },
    );
    return data.sent;
  }

  async resendOtp(email: string): Promise<boolean> {
    const { data } = await this.client.post<{ sent: boolean }>(
      "/auth/resend-otp",
      {
        email: normalizeEmail(email),
      },
    );
    return data.sent;
  }

  async verifyOtp(dto: VerifyOTPDto): Promise<boolean> {
    const { data } = await this.client.post<{ verified: boolean }>(
      "/auth/verify-otp",
      {
        email: normalizeEmail(dto.email),
        otp: dto.otp.trim(),
      },
    );
    return data.verified;
  }
}
