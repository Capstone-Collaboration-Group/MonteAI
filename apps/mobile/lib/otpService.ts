// apps/mobile/lib/otpService.ts
import { createApiClient, createOtpService } from "@monteai/api";

/**
 * Env-wired OTP singleton for mobile (Expo).
 *
 * NOTE: Expo only inlines `EXPO_PUBLIC_*` vars into the app bundle —
 * `import.meta.env` (Vite syntax) does not exist on native. Set these in
 * the gitignored `apps/mobile/.env.local`:
 *
 *   EXPO_PUBLIC_API_BASE_URL="https://localhost:7085/api/v1"
 *   EXPO_PUBLIC_USE_MOCK="true"
 *
 * `useMock` defaults to `true` in dev (`__DEV__`) because the .NET backend
 * does not expose OTP routes yet — the mock issues working in-memory codes.
 * Set `EXPO_PUBLIC_USE_MOCK="false"` once `/auth/send-otp`,
 * `/auth/resend-otp`, and `/auth/verify-email` exist server-side.
 */
const baseURL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://localhost:7085/api/v1";

const useMock =
  (process.env.EXPO_PUBLIC_USE_MOCK ?? (__DEV__ ? "true" : "false")) === "true";

const client = createApiClient({ baseURL });

export const otpService = createOtpService(client, useMock);
