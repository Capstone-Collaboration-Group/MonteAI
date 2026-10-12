import type { AuthTokens } from "@monteai/types/src/auth";

/**
 * Storage key for the MFA session tokens (access + refresh JWT issued by our
 * backend after a successful TOTP verify). Firebase ID tokens are deliberately
 * NOT stored here — they stay in Firebase's own auth session, which is the
 * source of truth for "is the user signed in".
 */
export const MFA_TOKENS_STORAGE_KEY = "monteai.mfa.tokens.v1";

export interface TokenStorage {
  getTokens(): Promise<AuthTokens | null>;
  setTokens(tokens: AuthTokens): Promise<void>;
  clearTokens(): Promise<void>;
}

export function createInMemoryTokenStorage(): TokenStorage {
  let current: AuthTokens | null = null;
  return {
    async getTokens() {
      return current;
    },
    async setTokens(tokens) {
      current = tokens;
    },
    async clearTokens() {
      current = null;
    },
  };
}

/**
 * localStorage-backed storage. Survives page reloads (required for the web
 * app: an MFA session must not evaporate on refresh) and is a no-op on
 * platforms without `localStorage` (e.g. SSR, or React Native where the
 * caller should pass a AsyncStorage-backed implementation instead).
 *
 * Write failures (private-mode quota, disabled storage) are swallowed — losing
 * persistence degrades to a re-login, whereas throwing would break the login
 * flow itself.
 */
export function createBrowserTokenStorage(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null = typeof window !== "undefined"
    ? window.localStorage
    : null,
): TokenStorage {
  const read = (): AuthTokens | null => {
    if (!storage) return null;
    try {
      const raw = storage.getItem(MFA_TOKENS_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as AuthTokens;
      if (!parsed || typeof parsed.accessToken !== "string" || typeof parsed.refreshToken !== "string") {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  };

  return {
    async getTokens() {
      return read();
    },
    async setTokens(tokens) {
      try {
        storage?.setItem(MFA_TOKENS_STORAGE_KEY, JSON.stringify(tokens));
      } catch {
        // Storage unavailable/full — session just won't persist.
      }
    },
    async clearTokens() {
      try {
        storage?.removeItem(MFA_TOKENS_STORAGE_KEY);
      } catch {
        // Storage unavailable — nothing to clear.
      }
    },
  };
}
