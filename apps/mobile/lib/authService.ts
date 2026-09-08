// apps/mobile/lib/authService.ts
//
// Real authentication pipeline for the mobile app:
//   1. POST /auth/resolve-login  (anonymous) — student number → Firebase email
//   2. Firebase email/password sign-in (session persists via AsyncStorage)
//   3. AuthSessionContext mirrors onAuthStateChanged for routing
//
// The token accessors below are shared by every service module in lib/
// (they feed createApiClient's request interceptor + 401 retry).

import axios from 'axios';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { firebaseAuth } from './firebase';

const baseURL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://192.168.100.9:5084/api/v1';

// Bare client for the anonymous resolve-login endpoint — must NOT go
// through createApiClient (that one attaches auth headers).
const anonymousClient = axios.create({
  baseURL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

interface ResolveLoginResponse {
  studentNumber: string;
  email: string;
}

/** Bearer token for authenticated API calls (cached ~1h by the SDK). */
export async function getAuthToken(): Promise<string | undefined> {
  return firebaseAuth.currentUser?.getIdToken();
}

/** Force-refreshed token — used by the API client's 401 retry path. */
export async function refreshAuthToken(): Promise<string | undefined> {
  return firebaseAuth.currentUser?.getIdToken(true);
}

/**
 * Resolves a student number to the Firebase account email via the
 * server's anonymous /auth/resolve-login endpoint. Throws on 401
 * (unknown student number) and network failures — describeAuthError
 * maps both to friendly copy.
 */
export async function resolveStudentLogin(
  studentNumber: string,
): Promise<ResolveLoginResponse> {
  const { data } = await anonymousClient.post<ResolveLoginResponse>(
    '/auth/resolve-login',
    { studentNumber },
  );
  return data;
}

/**
 * Student-number login: resolve the number to an email, then run the
 * standard Firebase email/password sign-in. Returns the signed-in user.
 */
export async function signInWithStudentNumber(
  studentNumber: string,
  password: string,
): Promise<User> {
  const resolved = await resolveStudentLogin(studentNumber);
  const credential = await signInWithEmailAndPassword(
    firebaseAuth,
    resolved.email,
    password,
  );
  return credential.user;
}

/**
 * Live registration: creates the Firebase account, then registers the
 * student profile server-side (POST /auth/register, which requires the
 * fresh Firebase Bearer token). The server owns the student-number →
 * email mapping future logins depend on, so failures here must surface.
 * `buildProfile` receives the new account's UID (the server's primary key).
 */
export async function registerStudentAccount(input: {
  email: string;
  password: string;
  fullName: string;
  buildProfile: (uid: string) => Record<string, unknown>;
}): Promise<User> {
  const credential = await createUserWithEmailAndPassword(
    firebaseAuth,
    input.email,
    input.password,
  );
  await updateProfile(credential.user, { displayName: input.fullName });

  const token = await credential.user.getIdToken();
  await axios.post(`${baseURL}/auth/register`, input.buildProfile(credential.user.uid), {
    timeout: 10000,
    headers: { Authorization: `Bearer ${token}` },
  });

  return credential.user;
}

/** Clears the Firebase session; AuthSessionContext reacts via listener. */
export async function signOut(): Promise<void> {
  await firebaseSignOut(firebaseAuth);
}

/** Maps Firebase / network / API errors to user-friendly messages. */
export function describeAuthError(err: unknown): string {
  const code = (err as { code?: string } | null | undefined)?.code ?? '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'Invalid student number or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again in a few minutes.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    case 'auth/email-already-in-use':
      return 'This email is already registered.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    default:
      break;
  }
  if (axios.isAxiosError(err)) {
    if (err.response?.status === 401 || err.response?.status === 400) {
      return 'Invalid student number or password.';
    }
    if (!err.response) {
      return 'Cannot reach the server. Check your connection and try again.';
    }
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return 'Something went wrong. Please try again.';
}
