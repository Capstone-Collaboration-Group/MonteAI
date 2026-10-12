// packages/api/src/mfa/types.ts

import type {
  MfaChallengeResponse,
  MfaCodeRequest,
  MfaConfirmEnrollResponse,
  MfaEnrollResponse,
  MfaRegenerateResponse,
  MfaStatusResponse,
  MfaVerifyRequest,
  MfaVerifyResponse,
  RefreshResponse,
} from "@monteai/types";

/**
 * Optional auth override for every method except `verify`/`refresh`.
 *
 * - `undefined` — use the client's default Authorization header (set by the
 *   request interceptor from `getAuthToken`).
 * - `string` — send `Authorization: Bearer <value>` for this call only. Pass
 *   the raw Firebase ID token here when the axios client is configured to
 *   return the MFA session token instead (or nothing).
 * - `null` — send no Authorization header at all.
 */
export type AuthOverride = string | null | undefined;

/** POST /auth/mfa/challenge — login step 1. */
export type MfaChallenge = (authOverride?: AuthOverride) => Promise<MfaChallengeResponse>;

/** GET /auth/mfa/status */
export type MfaStatus = (authOverride?: AuthOverride) => Promise<MfaStatusResponse>;

/** POST /auth/mfa/enroll — login/setup step 1. */
export type MfaEnroll = (authOverride?: AuthOverride) => Promise<MfaEnrollResponse>;

/** POST /auth/mfa/enroll/confirm */
export type MfaConfirmEnroll = (
  dto: MfaCodeRequest,
  authOverride?: AuthOverride,
) => Promise<MfaConfirmEnrollResponse>;

/** POST /auth/mfa/disable */
export type MfaDisable = (
  dto: MfaCodeRequest,
  authOverride?: AuthOverride,
) => Promise<void>;

/**
 * POST /auth/mfa/verify — anonymous. The pending token goes in the request
 * BODY, not the Authorization header, and no Authorization header is sent so
 * the role middleware does not 403 a TOTP-enabled user holding a raw Firebase
 * token. Accepts a 6-digit TOTP code or a single-use recovery code.
 */
export type MfaVerify = (dto: MfaVerifyRequest) => Promise<MfaVerifyResponse>;

/** POST /auth/mfa/recovery-codes/regenerate */
export type MfaRegenerateRecoveryCodes = (
  dto: MfaCodeRequest,
  authOverride?: AuthOverride,
) => Promise<MfaRegenerateResponse>;

/** POST /auth/refresh — anonymous; rotates the refresh token. */
export type MfaRefresh = (refreshToken: string) => Promise<RefreshResponse>;

export interface MfaService {
  challenge: MfaChallenge;
  status: MfaStatus;
  enroll: MfaEnroll;
  confirmEnroll: MfaConfirmEnroll;
  disable: MfaDisable;
  verify: MfaVerify;
  regenerateRecoveryCodes: MfaRegenerateRecoveryCodes;
  refresh: MfaRefresh;
}
