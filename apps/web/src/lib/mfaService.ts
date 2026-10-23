// web/src/lib/mfaService.ts
import { createMfaService } from "@monteai/api";
import { anonymousApiClient, apiClient } from "./apiClient";

const useMock = import.meta.env.VITE_USE_MOCK === "true";

/**
 * Authenticated MFA endpoints (status / enroll / confirm / disable /
 * regenerate) — these carry the Firebase ID token via the request
 * interceptor and are on the server's exempt-path list.
 */
export const mfaService = createMfaService(apiClient, useMock);

/**
 * Anonymous MFA endpoints (verify / refresh). The server's role middleware
 * 403s a TOTP-enabled user holding a raw Firebase token (mfa_required), and
 * verify/refresh are [AllowAnonymous] — so these must never send a Bearer.
 */
export const anonymousMfaService = createMfaService(anonymousApiClient, useMock);
