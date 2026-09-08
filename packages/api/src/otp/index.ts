// packages/api/src/otp/index.ts

import type { AxiosInstance } from "axios";
import { mockOtpService } from "./mockOtpService";
import { LiveOtpService } from "./otpService";
import type { OtpService } from "./types";

export function createOtpService(
  client: AxiosInstance,
  useMock: boolean
): OtpService {
  return useMock ? mockOtpService : new LiveOtpService(client);
}

export type { OtpService } from "./types";
export {
  OTP_LENGTH,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MS,
} from "./types";
export { mockOtpService, getMockOtpForEmail, clearMockOtps } from "./mockOtpService";
export { LiveOtpService } from "./otpService";
