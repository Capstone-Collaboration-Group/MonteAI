// packages/types/src/mfa.ts
//
// Mirrors server/Models/DTOs/Mfa/MfaDtos.cs. ASP.NET binds JSON
// case-insensitively, but responses come back camelCased via the default
// System.Text.Json options, so these field names are exact.

/**
 * POST /auth/mfa/challenge — called with a raw Firebase ID token right after
 * Firebase sign-in. `mfaRequired: false` means the user has no TOTP enrolled
 * and the Firebase token can be used as-is (unchanged legacy path).
 */
export interface MfaChallengeResponse {
  mfaRequired: boolean;
  pendingToken?: string | null;
}

/** GET /auth/mfa/status */
export interface MfaStatusResponse {
  totpEnabled: boolean;
  recoveryCodesRemaining: number;
}

/** POST /auth/mfa/enroll — the secret is base32 (RFC 4648). */
export interface MfaEnrollResponse {
  secret: string;
  otpauthUri: string;
}

/** POST /auth/mfa/enroll/confirm, /disable, /recovery-codes/regenerate */
export interface MfaCodeRequest {
  /** 6-digit TOTP code from the authenticator app (spaces tolerated). */
  code: string;
}

/** POST /auth/mfa/enroll/confirm — shown once, never retrievable again. */
export interface MfaConfirmEnrollResponse {
  recoveryCodes: string[];
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: import("./user").UserProfileDto;
}

/** POST /auth/mfa/verify — anonymous; auth is the pendingToken in the body. */
export interface MfaVerifyRequest {
  pendingToken: string;
  /** 6-digit TOTP code OR a single-use recovery code. */
  code: string;
}

/**
 * POST /auth/mfa/verify — replaces LoginResponseDto for MFA users. The
 * returned accessToken is our own session JWT (not a Firebase ID token) and
 * is what every subsequent request must send as `Authorization: Bearer`.
 */
export interface MfaVerifyResponse {
  accessToken: string;
  refreshToken: string;
  /** ISO-8601; when the accessToken stops being accepted. */
  expiresAt: string;
  user: import("./user").UserProfileDto;
}

/** POST /auth/mfa/recovery-codes/regenerate */
export interface MfaRegenerateResponse {
  recoveryCodes: string[];
}

/** POST /auth/refresh — rotates the refresh token, issues a fresh access token. */
export interface RefreshRequest {
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

/** Stable error code returned with HTTP 403 by the role middleware. */
export const MFA_REQUIRED_CODE = "mfa_required";
