// apps/mobile/lib/authService.ts
//
// Real authentication pipeline for the mobile app:
//   1. POST /auth/resolve-login  (anonymous) — student number → Firebase email
//   2. Firebase email/password sign-in (session persists via AsyncStorage)
//   3. Sign-up runs in two phases: create the Firebase account + send the
//      Firebase email-verification link, then (once verified) register the
//      profile server-side via POST /auth/register.
//   4. AuthSessionContext mirrors onAuthStateChanged for routing
//
// The token accessors below are shared by every service module in lib/
// (they feed createApiClient's request interceptor + 401 retry).

import axios from 'axios';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { firebaseAuth } from './firebase';

/** Error code used for "signed in but the email link wasn't opened yet". */
export const EMAIL_NOT_VERIFIED_CODE = 'auth/email-not-verified';

/** Builds an Error carrying a firebase-style `code` for describeAuthError. */
export function authError(code: string): Error & { code: string } {
  const err = new Error(code) as Error & { code: string };
  err.code = code;
  return err;
}

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
 * Phase 1 of sign-up: creates the Firebase account, sets the display
 * name, and sends the Firebase verification link. On failure after the
 * account exists (profile/link send), the brand-new user is deleted so a
 * retry can reuse the same email. Throws auth/email-already-in-use when
 * the address is taken (the caller may attempt a password resume).
 */
export async function createStudentAccount(input: {
  email: string;
  password: string;
  fullName: string;
}): Promise<User> {
  const credential = await createUserWithEmailAndPassword(
    firebaseAuth,
    input.email,
    input.password,
  );
  try {
    await updateProfile(credential.user, { displayName: input.fullName });
    await sendEmailVerification(credential.user);
  } catch (err) {
    try {
      await credential.user.delete();
    } catch {
      // keep the original error — a leftover account is handled by the
      // email-already-in-use resume path on retry.
    }
    throw err;
  }
  return credential.user;
}

/**
 * Phase 2 of sign-up: registers the student profile server-side with the
 * verified account's fresh Firebase Bearer token (POST /auth/register,
 * which requires the token — the server owns the student-number → email
 * mapping future logins depend on). Requires a signed-in, verified user.
 */
export async function completeProfileRegistration(input: {
  buildProfile: (uid: string) => Record<string, unknown>;
}): Promise<User> {
  const user = firebaseAuth.currentUser;
  if (!user) throw authError('auth/no-current-user');
  if (!user.emailVerified) throw authError(EMAIL_NOT_VERIFIED_CODE);

  const token = await user.getIdToken();
  try {
    await axios.post(`${baseURL}/auth/register`, input.buildProfile(user.uid), {
      timeout: 10000,
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      const data = err.response.data as
        | { message?: string; Message?: string }
        | undefined;
      const message =
        data?.message ??
        data?.Message ??
        `Registration failed (HTTP ${err.response.status}).`;
      // Plain Error — describeAuthError surfaces err.message directly.
      throw new Error(message);
    }
    throw err;
  }
  return user;
}

/** Sends (or re-sends) the verification link to the signed-in user. */
export async function sendVerificationEmail(): Promise<void> {
  const user = firebaseAuth.currentUser;
  if (!user) throw authError('auth/no-current-user');
  await sendEmailVerification(user);
}

/**
 * Reloads the current user from Firebase and reports emailVerified.
 * Reload failures (offline) fall back to the cached flag so polling can
 * simply try again on the next tick.
 */
export async function checkEmailVerified(): Promise<boolean> {
  const user = firebaseAuth.currentUser;
  if (!user) return false;
  try {
    await user.reload();
  } catch {
    return user.emailVerified;
  }
  return firebaseAuth.currentUser?.emailVerified ?? user.emailVerified;
}

/**
 * Deletes the signed-in account when it was created by this sign-up flow
 * and is still unverified (used when the user backs out of step 6).
 * Verified accounts are never touched.
 */
export async function deleteUnverifiedAccount(): Promise<void> {
  const user = firebaseAuth.currentUser;
  if (!user || user.emailVerified) return;
  await user.delete();
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

/** Plain email/password sign-in — used by the sign-up resume path. */
export async function signInWithPassword(
  email: string,
  password: string,
): Promise<User> {
  const credential = await signInWithEmailAndPassword(
    firebaseAuth,
    email,
    password,
  );
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
    case EMAIL_NOT_VERIFIED_CODE:
      return 'Your email address is not verified yet. Open the verification link we sent you, then try again.';
    case 'auth/no-current-user':
      return 'Your session has expired. Please sign in again.';
    case 'auth/registration-missing':
      return 'Your sign-up session expired. Please start the sign-up again.';
    default:
      break;
  }
  if (axios.isAxiosError(err)) {
    if (err.response) {
      const data = err.response.data as
        | { message?: string; Message?: string }
        | undefined;
      const message = data?.message ?? data?.Message;
      if (message) return message;
      if (err.response.status === 401 || err.response.status === 400) {
        return 'Invalid student number or password.';
      }
    } else {
      return 'Cannot reach the server. Check your connection and try again.';
    }
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return 'Something went wrong. Please try again.';
}
