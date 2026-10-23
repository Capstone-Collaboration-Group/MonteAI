// web/src/lib/apiClient.ts
import axios, { type AxiosInstance } from "axios";
import { auth } from "./firebase";

export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

/**
 * Bearer token for authenticated API calls.
 *
 * MFA users hold a session JWT issued by POST /auth/mfa/verify — that token
 * (not the Firebase ID token) is what the role middleware accepts, and it is
 * refreshed via POST /auth/refresh before it expires. Everyone else keeps the
 * unchanged Firebase ID token path.
 *
 * The MFA store is wired by the app (`setupApiAuth`) once the session hook
 * exists; until then this returns undefined and requests go out anonymous.
 */
type TokenProvider = () => Promise<string | undefined>;

let tokenProvider: TokenProvider | null = null;

/** Called by the app (with the useMfaSession accessor) at startup. */
export function setTokenProvider(provider: TokenProvider | null) {
  tokenProvider = provider;
}

async function resolveAuthToken(): Promise<string | undefined> {
  if (tokenProvider) {
    const mfaToken = await tokenProvider();
    if (mfaToken) return mfaToken;
  }
  return auth.currentUser?.getIdToken();
}

function buildClient(baseURL: string, authenticated: boolean): AxiosInstance {
  const client = axios.create({
    baseURL,
    timeout: 10000,
    headers: { "Content-Type": "application/json" },
  });

  if (authenticated) {
    client.interceptors.request.use(async (config) => {
      // Per-call auth overrides (notably the raw Firebase token for challenge)
      // must win over the session token provider.
      if (config.headers.has("Authorization")) return config;
      const token = await resolveAuthToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  return client;
}

export const apiClient = buildClient(apiBaseUrl, true);

/**
 * Anonymous client for MFA endpoints that must NOT carry a Bearer token:
 * POST /auth/mfa/verify and POST /auth/refresh are [AllowAnonymous] on the
 * server, and the role middleware 403s a TOTP-enabled user holding a raw
 * Firebase token (mfa_required). The MFA service uses this client.
 */
export const anonymousApiClient = buildClient(apiBaseUrl, false);
