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

let revision = 0;
let storageTail = Promise.resolve();
let refreshInFlight: { revision: number; work: Promise<AuthTokens | null> } | null = null;

function enqueue<T>(action: () => Promise<T>): Promise<T> {
  const work = storageTail.then(action);
  storageTail = work.then(() => {}, () => {});
  return work;
}

function readTokens(expected: number): Promise<AuthTokens | null> {
  return enqueue(async () => {
    try {
      if (expected !== revision) return null;
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw || expected !== revision) return null;
      const parsed = JSON.parse(raw) as AuthTokens;
      if (!parsed || typeof parsed.accessToken !== 'string' ||
        typeof parsed.refreshToken !== 'string' || typeof parsed.expiresAt !== 'string') {
        await AsyncStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  });
}

function writeTokens(tokens: AuthTokens, expected: number, isCurrent: () => boolean): Promise<boolean> {
  const clean = JSON.stringify({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresAt: tokens.expiresAt });
  return enqueue(async () => {
    if (expected !== revision || !isCurrent()) return false;
    await AsyncStorage.setItem(STORAGE_KEY, clean);
    if (expected !== revision || !isCurrent()) {
      // This write still owns the serialized slot. Remove it BEFORE any newer
      // account's write; never clear a newer account from a late async callback.
      await AsyncStorage.removeItem(STORAGE_KEY);
      return false;
    }
    return true;
  });
}

/** A caller must still own its account/action both before and after the write. */
export async function storeMfaTokens(tokens: AuthTokens, isCurrent: () => boolean): Promise<boolean> {
  if (!isCurrent()) return false;
  return writeTokens(tokens, ++revision, isCurrent);
}

export function clearMfaTokens(): Promise<void> {
  revision++; // invalidate reads/refreshes synchronously, before the disk removal
  return enqueue(() => AsyncStorage.removeItem(STORAGE_KEY));
}

function refreshTokens(refreshToken: string, expected: number): Promise<AuthTokens | null> {
  if (expected !== revision) return Promise.resolve(null);
  if (refreshInFlight?.revision === expected) return refreshInFlight.work;
  const work = anonymousClient.post<RefreshResponse>('/auth/refresh', { refreshToken })
    .then(async ({ data }) => await writeTokens(data, expected, () => true) ? data : null)
    .catch(async () => {
      if (expected === revision) await clearMfaTokens();
      return null;
    })
    .finally(() => { if (refreshInFlight?.work === work) refreshInFlight = null; });
  refreshInFlight = { revision: expected, work };
  return work;
}

export async function getMfaAccessToken(): Promise<string | undefined> {
  const expected = revision;
  const tokens = await readTokens(expected);
  if (!tokens || expected !== revision) return undefined;
  const expiry = Date.parse(tokens.expiresAt);
  if (!Number.isNaN(expiry) && expiry - EXPIRY_SLACK_MS > Date.now()) {
    return tokens.accessToken;
  }
  const refreshed = await refreshTokens(tokens.refreshToken, expected);
  return expected === revision ? refreshed?.accessToken : undefined;
}

export async function refreshMfaAccessToken(): Promise<string | undefined> {
  const expected = revision;
  const tokens = await readTokens(expected);
  if (!tokens || expected !== revision) return undefined;
  const refreshed = await refreshTokens(tokens.refreshToken, expected);
  return expected === revision ? refreshed?.accessToken : undefined;
}
