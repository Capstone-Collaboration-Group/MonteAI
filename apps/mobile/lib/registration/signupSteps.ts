import { hasCurrentSignupConsent, type PendingStudentRegistration } from './pendingRegistration';

export const SIGNUP_FORM_STEPS = 5;
export const SIGNUP_EMAIL_STEP = 6;
export const SIGNUP_ID_STEP = 7;

export function getResumeSignupStep(pending: PendingStudentRegistration | null,
  accountReady: boolean, emailVerified: boolean): number {
  if (!pending) return 1;
  if (!accountReady) return 4; // receipt-free draft survives, Firebase must be signed in again
  if (!hasCurrentSignupConsent(pending)) return SIGNUP_FORM_STEPS;
  return emailVerified ? SIGNUP_ID_STEP : SIGNUP_EMAIL_STEP;
}

// Used only for pre-capture Firebase/account operations. Never render arbitrary
// Error.message or HTTP response text in the signup screen.
const AUTH_MESSAGES: Record<string, string> = {
  'auth/email-already-in-use': 'This email already has an account. Use its password to resume signup, or sign in if registration is complete.',
  'auth/invalid-credential': 'The email or password is incorrect.',
  'auth/wrong-password': 'The email or password is incorrect.',
  'auth/user-not-found': 'The email or password is incorrect.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/weak-password': 'Use a password with at least 8 characters.',
  'auth/too-many-requests': 'Too many attempts. Please try again later.',
  'auth/network-request-failed': 'Check your connection and try again.',
  'auth/no-current-user': 'Your Firebase session expired. Resume signup with your email and password.',
  'auth/email-not-verified': 'Open the Firebase verification link in your email before continuing.',
  'auth/registration-missing': 'Your signup draft is missing. Start signup again.',
  'auth/already-signed-in': 'Sign out of the current account before starting another signup.',
  'auth/operation-in-progress': 'An earlier account action is still finishing. Please wait.',
};

export function describeSignupAccountError(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' && Object.prototype.hasOwnProperty.call(AUTH_MESSAGES, code)
    ? AUTH_MESSAGES[code] : 'Signup could not continue. Check your details and connection, then try again.';
}
