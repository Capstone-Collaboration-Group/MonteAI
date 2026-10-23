import axios from "axios";
import { auth } from "./firebaseServices";

type TokenProvider = () => Promise<string | undefined>;
let tokenProvider: TokenProvider | null = null;

export function setTokenProvider(provider: TokenProvider | null) {
  tokenProvider = provider;
}

// Single source of truth for outbound API auth: MFA session JWT when present
// (TOTP-enabled accounts reject raw Firebase tokens server-side), else the
// Firebase ID token. Used by the axios interceptor and by IPC callers that
// hand a token to the main process.
export async function getAuthToken(): Promise<string | undefined> {
  const sessionToken = await tokenProvider?.();
  return sessionToken ?? (await auth.currentUser?.getIdToken()) ?? undefined;
}

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

apiClient.interceptors.request.use(async (config) => {
  if (config.headers.has("Authorization")) return config;
  const token = await getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});