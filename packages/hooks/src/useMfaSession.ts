// packages/hooks/src/useMfaSession.ts
import { useCallback, useEffect, useRef, useState } from "react";
import type { AuthTokens, MfaVerifyResponse, RefreshResponse } from "@monteai/types";
import {
  createMemoryMfaSessionStore,
  createWebMfaSessionStore,
  type MfaSessionStore,
} from "./mfaSessionStore";

const EXPIRY_SLACK_MS = 60_000;

export interface MfaSession {
  tokens: AuthTokens | null;
  /** True while the initial restore (storage read) is still in flight. */
  restoring: boolean;
  /** True when an MFA session JWT is present (regardless of expiry). */
  isAuthenticated: boolean;
  /**
   * Returns a valid access token, transparently refreshing when expired.
   * `null` when there is no MFA session — callers fall back to Firebase.
   */
  getAccessToken(): Promise<string | null>;
  /** Completes login: stores the tokens returned by POST /auth/mfa/verify. */
  establish(result: Pick<MfaVerifyResponse, "accessToken" | "refreshToken" | "expiresAt">): Promise<void>;
  /** Clears the session (sign-out, refresh failure). */
  clear(): Promise<void>;
}

export interface UseMfaSessionOptions {
  /** POST /auth/refresh — rotates the refresh token, returns a new pair. */
  refresh: (refreshToken: string) => Promise<RefreshResponse>;
  /** Defaults to a localStorage-backed store on web, memory elsewhere. */
  store?: MfaSessionStore;
}

function isExpired(expiresAt: string): boolean {
  const expires = Date.parse(expiresAt);
  if (Number.isNaN(expires)) return true;
  return expires - EXPIRY_SLACK_MS <= Date.now();
}

/**
 * Owns the MFA session JWT lifecycle: restore from storage on mount,
 * transparent refresh before expiry, and a single-flight refresh so
 * concurrent callers share one POST /auth/refresh.
 *
 * This is what lets a page reload keep an MFA-signed-in user signed in —
 * the axios interceptor calls `getAccessToken()` on every request.
 */
export function useMfaSession({ refresh, store }: UseMfaSessionOptions): MfaSession {
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [sessionStore] = useState<MfaSessionStore>(
    () =>
      store ??
      (typeof window !== "undefined" && typeof window.localStorage !== "undefined"
        ? createWebMfaSessionStore()
        : createMemoryMfaSessionStore()),
  );
  const refreshInFlight = useRef<Promise<string | null> | null>(null);

  useEffect(() => {
    let cancelled = false;
    sessionStore
      .getTokens()
      .then((restored) => {
        if (!cancelled) setTokens(restored);
      })
      .catch(() => {
        // unreadable storage — start signed out
      })
      .finally(() => {
        if (!cancelled) setRestoring(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionStore]);

  const persist = useCallback(async (next: AuthTokens | null) => {
    setTokens(next);
    if (next) await sessionStore.setTokens(next);
    else await sessionStore.clearTokens();
  }, [sessionStore]);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const current = tokens;
    if (!current) return null;
    if (!isExpired(current.expiresAt)) return current.accessToken;

    if (!refreshInFlight.current) {
      refreshInFlight.current = refresh(current.refreshToken)
        .then(async (next: RefreshResponse) => {
          const pair: AuthTokens = {
            accessToken: next.accessToken,
            refreshToken: next.refreshToken,
            expiresAt: next.expiresAt,
          };
          await persist(pair);
          return pair.accessToken;
        })
        .catch(async () => {
          // refresh token rejected/expired — force a fresh MFA login
          await persist(null);
          return null;
        })
        .finally(() => {
          refreshInFlight.current = null;
        });
    }
    return refreshInFlight.current;
  }, [tokens, persist, refresh]);

  const establish = useCallback(
    async (result: Pick<MfaVerifyResponse, "accessToken" | "refreshToken" | "expiresAt">) => {
      await persist({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresAt: result.expiresAt,
      });
    },
    [persist],
  );

  const clear = useCallback(async () => {
    await persist(null);
  }, [persist]);

  return {
    tokens,
    restoring,
    isAuthenticated: tokens !== null,
    getAccessToken,
    establish,
    clear,
  };
}
