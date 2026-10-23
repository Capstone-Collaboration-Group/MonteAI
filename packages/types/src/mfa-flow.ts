import type { MfaVerifyResponse } from "./mfa";

export type MfaSessionTokens = Pick<
  MfaVerifyResponse,
  "accessToken" | "refreshToken" | "expiresAt"
>;

/** Same contract as packages/api TokenStorage, redeclared to avoid a types→api dep. */
export interface MfaTokenStorage {
  getTokens(): Promise<MfaSessionTokens | null>;
  setTokens(tokens: MfaSessionTokens): Promise<void>;
  clearTokens(): Promise<void>;
}

export const MFA_PENDING_TOKEN_KEY = "monteai.mfa.pendingToken.v1";

/**
 * React 19 supports plain (non-`use`) promises as context values and
 * `use()` on the consumer side, so the pending token rides on a ref-like
 * object instead of useState — no provider re-render on every step.
 */
export interface MfaPendingTokenRef {
  current: string | null;
}

export interface MfaVerifyInput {
  pendingToken: string;
  code: string;
}

export type MfaVerifyFn = (input: MfaVerifyInput) => Promise<MfaVerifyResponse>;
