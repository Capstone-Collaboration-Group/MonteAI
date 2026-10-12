import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import type { AuthTokens, RefreshResponse } from '@monteai/types';

const STORAGE_KEY = 'monteai.mfa.tokens.v1';
const EXPIRY_SLACK_MS = 60_000;
const baseURL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://192.168.100.9:5084/api/v1';
const anonymousClient = axios.create({
  baseURL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

let refreshInFlight: Promise<AuthTokens | null> | null = null;

async function readTokens(): Promise<AuthTokens | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthTokens;
    if (
      typeof parsed.accessToken !== 'string' ||
      typeof parsed.refreshToken !== 'string' ||
      typeof parsed.expiresAt !== 'string'
    ) {
      await AsyncStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function storeMfaTokens(tokens: AuthTokens): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
}

export async function clearMfaTokens(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

async function refreshTokens(refreshToken: string): Promise<AuthTokens | null> {
  if (!refreshInFlight) {
    refreshInFlight = anonymousClient
      .post<RefreshResponse>('/auth/refresh', { refreshToken })
      .then(({ data }) => data)
      .then(async (tokens) => {
        await storeMfaTokens(tokens);
        return tokens;
      })
      .catch(async () => {
        await clearMfaTokens();
        return null;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

export async function getMfaAccessToken(): Promise<string | undefined> {
  const tokens = await readTokens();
  if (!tokens) return undefined;
  const expiry = Date.parse(tokens.expiresAt);
  if (!Number.isNaN(expiry) && expiry - EXPIRY_SLACK_MS > Date.now()) {
    return tokens.accessToken;
  }
  const refreshed = await refreshTokens(tokens.refreshToken);
  return refreshed?.accessToken;
}

export async function refreshMfaAccessToken(): Promise<string | undefined> {
  const tokens = await readTokens();
  if (!tokens) return undefined;
  const refreshed = await refreshTokens(tokens.refreshToken);
  return refreshed?.accessToken;
}
