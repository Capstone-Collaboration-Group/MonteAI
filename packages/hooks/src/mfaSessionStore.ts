// packages/hooks/src/mfaSessionStore.ts
import type { AuthTokens } from "@monteai/types";

/**
 * The MFA session JWT issued after a successful TOTP verify. It lives outside
 * React state (localStorage on web, AsyncStorage on native) because it must
 * survive a reload, and the axios interceptor needs it before any React tree
 * has mounted.
 */
export interface MfaSessionStore {
  getTokens(): Promise<AuthTokens | null>;
  setTokens(tokens: AuthTokens): Promise<void>;
  clearTokens(): Promise<void>;
}

/** localStorage on web; no-op elsewhere (native apps pass AsyncStorage). */
export function createWebMfaSessionStore(): MfaSessionStore {
  const read = (): AuthTokens | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem("monteai.mfa.tokens.v1");
      if (!raw) return null;
      const parsed = JSON.parse(raw) as AuthTokens;
      return parsed?.accessToken && parsed?.refreshToken ? parsed : null;
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
        window.localStorage.setItem("monteai.mfa.tokens.v1", JSON.stringify(tokens));
      } catch {
        // quota / private mode — session just won't persist
      }
    },
    async clearTokens() {
      try {
        window.localStorage.removeItem("monteai.mfa.tokens.v1");
      } catch {
        // ignore
      }
    },
  };
}

/** In-memory store for tests and SSR (no window). */
export function createMemoryMfaSessionStore(): MfaSessionStore {
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
