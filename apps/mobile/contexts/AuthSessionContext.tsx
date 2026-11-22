// apps/mobile/contexts/AuthSessionContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { RegistrationError, requireStudentSignupDraft, sanitizeRegistrationError } from '@monteai/api';
import type { MfaChallengeResponse, MfaVerifyResponse, RegistrationDraft, RegisterUserRequest } from '@monteai/types';
import { firebaseAuth } from '@/lib/firebase';
import { anonymousMfaService } from '@/lib/mfaService';
import { clearMfaTokens, getMfaAccessToken, storeMfaTokens } from '@/lib/mfaSession';
import {
  EMAIL_NOT_VERIFIED_CODE,
  authError,
  checkEmailVerified,
  completeProfileRegistration,
  createStudentAccount,
  deleteUnverifiedAccount,
  getFreshFirebaseIdToken,
  sendVerificationEmail,
  signInWithPassword,
  signInWithStudentNumber as authServiceSignIn,
  signOut as authServiceSignOut,
} from '@/lib/authService';
import { registrationUsesMock as useMock } from '@/lib/registration/config';
import { matchesSignupAccount, toPendingStudentRegistration, type PendingStudentRegistration,
  type StudentRegistrationInput } from '@/lib/registration/pendingRegistration';
import { createPendingRegistrationStore } from '@/lib/registration/pendingRegistrationStore';
import { createPendingSignupSession, type SignupAccount } from '@/lib/registration/pendingSignupSession';
import { submitPendingSignupRegistration } from '@/lib/registration/submitRegistration';

export interface AuthSession {
  email: string;
  uid: string;
  studentNumber?: string;
}

export type StudentRegistration = StudentRegistrationInput;

/** What gets persisted while waiting for the verification link. */
export type PendingRegistration = PendingStudentRegistration;

export interface BeginRegistrationResult {
  /** False in mock mode (and verified resumes) — skip the email step. */
  verificationRequired: boolean;
}

export interface AuthSessionContextValue {
  session: AuthSession | null;
  restoring: boolean;
  mfaPending: boolean;
  /** Profile/consent fields ONLY. Never a capture, OCR result, receipt, or password. */
  pendingRegistration: PendingRegistration | null;
  registrationAccountReady: boolean;
  registrationEmailVerified: boolean;
  subscribeRegistrationInvalidation: (listener: () => void) => () => void;
  getVerifiedRegistrationDraft: () => Promise<RegistrationDraft>;
  signInWithStudentNumber: (studentNumber: string, password: string) => Promise<boolean>;
  verifyMfa: (code: string) => Promise<MfaVerifyResponse>;
  cancelMfa: () => Promise<void>;
  beginRegistration: (payload: StudentRegistration) => Promise<BeginRegistrationResult>;
  completeRegistration: (profile: RegisterUserRequest, signal: AbortSignal) => Promise<void>;
  checkVerification: () => Promise<boolean>;
  resendVerification: () => Promise<void>;
  cancelRegistration: () => Promise<void>;
  signOut: () => Promise<void>;
}

const MOCK_SESSION_KEY = 'monteai.auth.session';
const STUDENT_NUMBER_KEY = 'monteai.auth.studentNumber';

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);
interface AccountOperation {
  sequence: number;
  kind: 'signup' | 'login';
  email?: string;
  uid?: string;
  loginChecked?: boolean;
}

export function useAuthSession(): AuthSessionContextValue {
  const context = useContext(AuthSessionContext);
  if (!context) {
    throw new Error('useAuthSession must be used within <AuthSessionProvider>');
  }
  return context;
}

let profileStorageTail = Promise.resolve();
function enqueueProfileStorage<T>(action: () => Promise<T>): Promise<T> {
  const work = profileStorageTail.then(action);
  profileStorageTail = work.then(() => {}, () => {});
  return work;
}

function safeSet(key: string, value: string): Promise<void> {
  return enqueueProfileStorage(async () => {
    try { await AsyncStorage.setItem(key, value); } catch { /* profile-only cache is optional */ }
  });
}

function safeRemove(key: string): Promise<void> {
  return enqueueProfileStorage(async () => {
    try { await AsyncStorage.removeItem(key); } catch { /* profile-only cache is optional */ }
  });
}

function buildPending(payload: StudentRegistration): PendingRegistration {
  // Project independently of the receipt-bearing registration request.
  const pending = toPendingStudentRegistration(payload);
  if (!pending) throw authError('auth/registration-missing');
  // The caller cannot supply the authoritative identity; only Firebase binds it.
  delete pending.firebaseUid;
  requireStudentSignupDraft({ ...pending, id: 'pending-signup', role: 'Student' });
  return pending;
}

/**
 * Boot-level auth session backed by Firebase (AsyncStorage-persisted —
 * see lib/firebase.ts). onAuthStateChanged is the source of truth; the
 * root layout keeps the native splash up until the restore finishes.
 *
 * A verified Firebase account is NOT an app session while its student
 * registration is pending. Profile registration must succeed first.
 *
 * Login is ALWAYS live: student number → /auth/resolve-login → Firebase
 * email/password sign-in. Android signup is create/sign in → verify email
 * → RAM capture/verification → receipt-bearing profile POST. Mock mode
 * exercises the same controller but never uploads or registers live.
 */
export function AuthSessionProvider({ children }: { children: ReactNode }) {
  // undefined = first onAuthStateChanged callback still pending (restore).
  const [firebaseUser, setFirebaseUser] = useState<User | null | undefined>(undefined);
  const [mockSession, setMockSession] = useState<AuthSession | null>(null);
  const [studentNumberCache, setStudentNumberCache] = useState<string | null>(null);
  const [mockRestoring, setMockRestoring] = useState(true);
  const [mfaPendingToken, setMfaPendingTokenState] = useState<string | null>(null);
  const mfaPendingTokenRef = useRef<string | null>(null);
  const setMfaPendingToken = useCallback((token: string | null) => {
    mfaPendingTokenRef.current = token;
    setMfaPendingTokenState(token);
  }, []);
  const [mfaChecking, setMfaChecking] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const accountOperation = useRef<AccountOperation | null>(null);
  const accountCleanup = useRef<Promise<void> | null>(null);
  const mfaVerification = useRef<object | null>(null);
  const staleAccountUid = useRef<string | null>(null);
  const refreshAuthState = useRef<((user: User | null) => void) | null>(null);
  const loginMfaCheckInProgress = useRef(false);
  const registrationStarting = useRef(false);
  const signingOut = useRef(false);
  const operationSequence = useRef(0);
  const authRevision = useRef(0);
  const observedAccountKey = useRef<string | null | undefined>(undefined);
  const [signup] = useState(createPendingSignupSession);
  const [pendingStore] = useState(() => createPendingRegistrationStore(AsyncStorage));
  const [pendingRegistration, setPendingRegistration] = useState<PendingRegistration | null>(null);
  const [signupEmailVerified, setSignupEmailVerified] = useState(false);

  const runAccountCleanup = useCallback((action: () => Promise<void>): Promise<void> => {
    if (accountCleanup.current) return accountCleanup.current;
    signingOut.current = true;
    const work = Promise.resolve().then(action).finally(() => {
      if (accountCleanup.current !== work) return;
      accountCleanup.current = null;
      signingOut.current = false;
      refreshAuthState.current?.(firebaseAuth.currentUser);
    });
    accountCleanup.current = work;
    return work;
  }, []);

  const finishAccountOperation = useCallback(async (work: AccountOperation) => {
    if (accountOperation.current !== work) return;
    // An explicit cancellation may already own this UID's Firebase sign-out.
    if (accountCleanup.current) await accountCleanup.current.catch(() => {});
    if (accountOperation.current !== work) return;
    const user = firebaseAuth.currentUser;
    const stale = work.sequence !== operationSequence.current ||
      (work.kind === 'signup' && !matchesSignupAccount(signup.getPending(), user)) ||
      (work.kind === 'login' && !!user && !!work.uid && user.uid === work.uid && user.emailVerified && !work.loginChecked);
    if (stale && user && work.uid && user.uid === work.uid &&
      (work.kind !== 'signup' || user.email?.trim().toLowerCase() === work.email)) {
      // Firebase credential promises cannot be aborted. Keep their admission/
      // session gate until they settle, then sign out only their confirmed UID.
      // Never delete a verified account or touch an unrelated normal account.
      staleAccountUid.current = user.uid;
      try { await authServiceSignOut(); } catch { /* the confirmed stale UID stays gated */ }
    }
    accountOperation.current = null;
    registrationStarting.current = false;
    loginMfaCheckInProgress.current = false;
    if (refreshAuthState.current) {
      setAccountBusy(false);
      if (!stale && work.kind === 'login' && work.loginChecked && firebaseAuth.currentUser?.uid === work.uid) {
        setMfaChecking(false); // this explicit login already performed its challenge
      } else { refreshAuthState.current(firebaseAuth.currentUser); }
    }
  }, [signup]);

  useEffect(() => signup.subscribe(setPendingRegistration), [signup]);

  // Restore the mock session + cached student number, then subscribe to
  // Firebase auth state (subscription last so the first callback lands
  // after local state is settled — avoids a redirect flash).
  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    (async () => {
      try {
        const [mockRaw, studentNumberRaw, pending] = await Promise.all([
          enqueueProfileStorage(() => AsyncStorage.getItem(MOCK_SESSION_KEY)),
          enqueueProfileStorage(() => AsyncStorage.getItem(STUDENT_NUMBER_KEY)),
          pendingStore.read(),
        ]);
        if (!active) return;
        if (useMock && mockRaw) setMockSession(JSON.parse(mockRaw) as AuthSession);
        if (pending) signup.replace(pending);
        if (studentNumberRaw) {
          setStudentNumberCache(JSON.parse(studentNumberRaw) as string);
        }
      } catch {
        // no persisted state — signed-out boot
      } finally {
        if (active) setMockRestoring(false);
      }
      if (!active) return;
      const observe = (user: User | null) => {
        if (!active) return;
        const event = ++authRevision.current;
        const key = user ? JSON.stringify([user.uid, user.email?.trim().toLowerCase() ?? '']) : null;
        const switched = observedAccountKey.current !== undefined && observedAccountKey.current !== key;
        observedAccountKey.current = key;
        const invalidated = signup.observeAccount(user);
        const work = accountOperation.current;
        if (work?.kind === 'signup' && user && user.email?.trim().toLowerCase() === work.email && !work.uid) work.uid = user.uid;
        if (user?.uid !== staleAccountUid.current) staleAccountUid.current = null;
        if (switched) {
          setMfaPendingToken(null);
          void clearMfaTokens();
        }
        if (invalidated && !signup.getPending()) void pendingStore.write(null);
        setSignupEmailVerified(!!user?.emailVerified);
        // Observe switches and invalidate old storage immediately, even during
        // cleanup. A later cleanup refresh must not erase the new UID's tokens.
        if (signingOut.current) { setFirebaseUser(null); setMfaChecking(false); return; }
        if (user && user.uid === staleAccountUid.current) {
          setFirebaseUser(null);
          setMfaChecking(false);
          return;
        }
        if (!user) {
          setFirebaseUser(null);
          setMfaPendingToken(null);
          setMfaChecking(false);
          void clearMfaTokens();
          return;
        }
        // Do not challenge MFA (or open a session) for an unfinished signup,
        // including the auth callback emitted DURING account creation/resume.
        if (!user.emailVerified || loginMfaCheckInProgress.current || work || mfaPendingTokenRef.current ||
          signup.gatesSession(user) || useMock) {
          setFirebaseUser(user);
          if (!loginMfaCheckInProgress.current) setMfaChecking(false);
          return;
        }
        setMfaChecking(true);
        void (async () => {
          try {
            const sessionToken = await getMfaAccessToken();
            const stillCurrent = () => active && event === authRevision.current &&
              firebaseAuth.currentUser?.uid === user.uid && !signup.gatesSession(user) &&
              !accountOperation.current && !signingOut.current;
            if (!stillCurrent()) return;
            if (sessionToken) {
              setFirebaseUser(user);
              return;
            }
            const challenge = await anonymousMfaService.challenge(await user.getIdToken());
            if (!stillCurrent()) return;
            if (challenge.mfaRequired && !challenge.pendingToken) {
              throw new Error('Could not start the two-factor sign-in.');
            }
            setFirebaseUser(user);
            setMfaPendingToken(challenge.mfaRequired ? challenge.pendingToken ?? null : null);
          } catch {
            if (active && event === authRevision.current) {
              setFirebaseUser(null);
              setMfaPendingToken(null);
            }
          } finally {
            if (active && event === authRevision.current) setMfaChecking(false);
          }
        })();
      };
      refreshAuthState.current = observe;
      unsubscribe = onAuthStateChanged(firebaseAuth, observe);
    })();
    return () => {
      active = false;
      authRevision.current++;
      operationSequence.current++;
      refreshAuthState.current = null;
      signup.invalidate(); // abort any route-owned receipt and invalidate late profile completion
      unsubscribe?.();
    };
  }, [pendingStore, setMfaPendingToken, signup]);

  const restoring = mockRestoring || firebaseUser === undefined;

  const session = useMemo<AuthSession | null>(() => {
    if (pendingRegistration && (useMock || matchesSignupAccount(pendingRegistration, firebaseUser))) return null;
    if (accountBusy || registrationStarting.current || signingOut.current) return null;
    if (firebaseUser && firebaseUser.emailVerified && !mfaPendingToken && !mfaChecking) {
      return {
        uid: firebaseUser.uid,
        email: firebaseUser.email ?? '',
        studentNumber: studentNumberCache ?? undefined,
      };
    }
    return mfaPendingToken || mfaChecking || !useMock ? null : mockSession;
  }, [accountBusy, firebaseUser, mfaChecking, mfaPendingToken, mockSession, pendingRegistration, studentNumberCache]);

  const currentSignupAccount = useCallback((): SignupAccount | null => {
    if (!useMock) return firebaseAuth.currentUser;
    const pending = signup.getPending();
    return pending ? { uid: pending.firebaseUid ?? `mock-${pending.studentNumber}`,
      email: pending.email, emailVerified: true } : null;
  }, [signup]);

  const registrationAccountReady = matchesSignupAccount(pendingRegistration,
    useMock ? currentSignupAccount() : firebaseUser);
  const registrationEmailVerified = registrationAccountReady && (useMock || signupEmailVerified);

  const subscribeRegistrationInvalidation = useCallback((listener: () => void) => signup.onInvalidate(listener), [signup]);

  const getVerifiedRegistrationDraft = useCallback(async (): Promise<RegistrationDraft> => {
    try {
      if (useMock) return signup.ticket(currentSignupAccount()).draft;
      const user = firebaseAuth.currentUser;
      if (!matchesSignupAccount(signup.getPending(), user)) throw new RegistrationError('authentication_required');
      const revision = signup.revision;
      const token = await getFreshFirebaseIdToken();
      if (!token) throw new RegistrationError('authentication_required');
      if (revision !== signup.revision) throw new RegistrationError('identity_mismatch');
      const ticket = signup.ticket(firebaseAuth.currentUser);
      setSignupEmailVerified(true);
      return ticket.draft;
    } catch (error) { throw sanitizeRegistrationError(error); }
  }, [currentSignupAccount, signup]);

  const cacheStudentNumber = useCallback((studentNumber: string) => {
    setStudentNumberCache(studentNumber);
    void safeSet(STUDENT_NUMBER_KEY, JSON.stringify(studentNumber));
  }, []);

  const signInWithStudentNumber = useCallback(
    async (studentNumber: string, password: string): Promise<boolean> => {
      if (accountOperation.current || signingOut.current) throw authError('auth/operation-in-progress');
      const sequence = ++operationSequence.current;
      authRevision.current++;
      setMfaPendingToken(null);
      signup.invalidate(); // cancel the receipt, but failed login must keep the profile gate
      setSignupEmailVerified(false);
      if (useMock) {
        const next: AuthSession = {
          email: `${studentNumber}@mock.local`,
          uid: `mock-${studentNumber}`,
          studentNumber: studentNumber.trim(),
        };
        signup.clear();
        void pendingStore.write(null);
        setMockSession(next);
        await Promise.all([
          safeSet(MOCK_SESSION_KEY, JSON.stringify(next)),
          safeSet(STUDENT_NUMBER_KEY, JSON.stringify(studentNumber.trim())),
        ]);
        if (sequence !== operationSequence.current) throw authError('auth/no-current-user');
        return false;
      }
      setMfaChecking(true);
      loginMfaCheckInProgress.current = true;
      const work: AccountOperation = { sequence, kind: 'login' };
      accountOperation.current = work;
      setAccountBusy(true);
      try {
        await clearMfaTokens();
        if (sequence !== operationSequence.current) throw authError('auth/no-current-user');
        const user = await authServiceSignIn(studentNumber, password);
        work.uid = user.uid;
        if (sequence !== operationSequence.current || firebaseAuth.currentUser?.uid !== user.uid) {
          throw authError('auth/no-current-user');
        }
        if (!user.emailVerified) {
          setFirebaseUser(user);
          throw authError(EMAIL_NOT_VERIFIED_CODE);
        }
        const idToken = await user.getIdToken();
        const challenge: MfaChallengeResponse = await anonymousMfaService.challenge(idToken);
        if (sequence !== operationSequence.current || firebaseAuth.currentUser?.uid !== user.uid) {
          throw authError('auth/no-current-user');
        }
        if (challenge.mfaRequired) {
          if (!challenge.pendingToken) {
            throw new Error('Could not start the two-factor sign-in. Please try again.');
          }
          work.loginChecked = true;
          signup.clear();
          staleAccountUid.current = null; // explicit, successful backend-mapped login
          void pendingStore.write(null);
          setFirebaseUser(user);
          setMfaPendingToken(challenge.pendingToken);
          cacheStudentNumber(studentNumber.trim());
          return true;
        }
        work.loginChecked = true;
        signup.clear();
        staleAccountUid.current = null;
        void pendingStore.write(null);
        setFirebaseUser(user);
        cacheStudentNumber(studentNumber.trim());
        return false;
      } catch (err) {
        throw err;
      } finally {
        await finishAccountOperation(work);
      }
    },
    [cacheStudentNumber, finishAccountOperation, pendingStore, setMfaPendingToken, signup],
  );

  const verifyMfa = useCallback(async (code: string): Promise<MfaVerifyResponse> => {
    if (mfaVerification.current) throw authError('auth/operation-in-progress');
    const uid = firebaseAuth.currentUser?.uid;
    if (!mfaPendingToken || mfaPendingToken !== mfaPendingTokenRef.current || !uid ||
      accountOperation.current || signingOut.current) {
      throw new Error('Your sign-in session expired. Please sign in again.');
    }
    const work = {};
    mfaVerification.current = work;
    const revision = authRevision.current;
    const isCurrent = () => mfaVerification.current === work && revision === authRevision.current && firebaseAuth.currentUser?.uid === uid &&
      !!firebaseAuth.currentUser.emailVerified && mfaPendingTokenRef.current === mfaPendingToken &&
      !signup.getPending() && !accountOperation.current && !signingOut.current;
    try {
      const result = await anonymousMfaService.verify({ pendingToken: mfaPendingToken, code });
      if (!isCurrent()) throw authError('auth/no-current-user');
      const stored = await storeMfaTokens({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresAt: result.expiresAt,
      }, isCurrent);
      if (!stored || !isCurrent()) throw authError('auth/no-current-user');
      setMfaPendingToken(null);
      setFirebaseUser(firebaseAuth.currentUser);
      return result;
    } finally {
      if (mfaVerification.current === work) mfaVerification.current = null;
    }
  }, [mfaPendingToken, setMfaPendingToken, signup]);

  const cancelMfa = useCallback(async () => {
    if (accountCleanup.current) return accountCleanup.current;
    if (!mfaPendingTokenRef.current) return;
    const uid = firebaseAuth.currentUser?.uid;
    operationSequence.current++;
    authRevision.current++;
    loginMfaCheckInProgress.current = false;
    signup.invalidate();
    setMfaPendingToken(null);
    setFirebaseUser(null);
    const clearing = clearMfaTokens().catch(() => {});
    return runAccountCleanup(async () => {
      await clearing;
      if (uid && firebaseAuth.currentUser?.uid === uid) {
        staleAccountUid.current = uid;
        await authServiceSignOut();
      }
    });
  }, [runAccountCleanup, setMfaPendingToken, signup]);

  /**
   * Create/resume Firebase before capture. The profile-only gate is installed
   * synchronously BEFORE Firebase emits its signed-in callback.
   */
  const beginRegistration = useCallback(
    async (payload: StudentRegistration): Promise<BeginRegistrationResult> => {
      const pending = buildPending(payload);
      if (accountOperation.current) throw authError('auth/operation-in-progress');
      if (signingOut.current || registrationStarting.current) throw new RegistrationError('cancelled');
      const previous = signup.getPending();
      const existing = firebaseAuth.currentUser;
      if (existing?.emailVerified && !matchesSignupAccount(previous, existing)) {
        throw authError('auth/already-signed-in');
      }
      const sequence = ++operationSequence.current;
      const work: AccountOperation = { sequence, kind: 'signup', email: pending.email.trim().toLowerCase() };
      accountOperation.current = work;
      setAccountBusy(true);
      const canResume = !!existing && matchesSignupAccount(previous, existing) &&
        pending.email.toLowerCase() === previous?.email.toLowerCase();
      registrationStarting.current = true;
      loginMfaCheckInProgress.current = false;
      authRevision.current++;
      setMfaPendingToken(null);
      setMfaChecking(false);
      setSignupEmailVerified(false);
      const candidate = signup.replace({ ...pending, ...(canResume ? { firebaseUid: existing.uid } : {}) });
      void pendingStore.write(candidate);
      const stillCurrent = () => sequence === operationSequence.current &&
        signup.getPending()?.email.toLowerCase() === candidate.email.toLowerCase() && !signingOut.current;

      if (useMock) {
        const bound = signup.replace({ ...candidate, firebaseUid: `mock-${candidate.studentNumber}` });
        void pendingStore.write(bound);
        setSignupEmailVerified(true);
        registrationStarting.current = false;
        accountOperation.current = null;
        setAccountBusy(false);
        return { verificationRequired: false };
      }

      const fullName = `${payload.firstName} ${payload.lastName}`.trim();
      try {
        await clearMfaTokens();
        if (!stillCurrent()) throw new RegistrationError('cancelled');
        let user: User;
        if (canResume) {
          await existing.reload();
          user = existing;
        } else {
          try {
            user = await createStudentAccount({ email: candidate.email, password: payload.password, fullName });
          } catch (error) {
            if ((error as { code?: string } | null)?.code !== 'auth/email-already-in-use') throw error;
            if (!stillCurrent()) throw new RegistrationError('cancelled');
            try { user = await signInWithPassword(candidate.email, payload.password); }
            catch { throw error; } // do not reveal whether the account/password exists
          }
        }
        work.uid = user.uid;
        if (!stillCurrent() || firebaseAuth.currentUser?.uid !== user.uid || !matchesSignupAccount(candidate, user)) {
          throw new RegistrationError('cancelled');
        }
        const bound = signup.replace({ ...candidate, firebaseUid: user.uid });
        void pendingStore.write(bound);
        setFirebaseUser(user);
        setSignupEmailVerified(user.emailVerified);
        return { verificationRequired: !user.emailVerified };
      } catch (error) {
        if (sequence === operationSequence.current &&
          signup.getPending()?.email.toLowerCase() === candidate.email.toLowerCase()) {
          const leftover = firebaseAuth.currentUser;
          if (matchesSignupAccount(candidate, leftover)) {
            const bound = signup.replace({ ...candidate, firebaseUid: leftover!.uid });
            void pendingStore.write(bound);
            setFirebaseUser(leftover);
          } else {
            signup.clear();
            void pendingStore.write(null);
          }
        }
        throw error;
      } finally {
        await finishAccountOperation(work);
      }
    },
    [finishAccountOperation, pendingStore, setMfaPendingToken, signup],
  );

  /**
   * Called ONLY by the receipt-owning controller. A cancelled, switched, or
   * edited signup cannot promote a late server result into an app session.
   */
  const completeRegistration = useCallback(async (profile: RegisterUserRequest, signal: AbortSignal) => {
    try {
      const ticket = await submitPendingSignupRegistration(signup, currentSignupAccount, profile, signal,
        async (allowed, abort) => {
          if (useMock) {
            if (allowed.idVerificationReceipt !== 'mock-id-verification-receipt') throw new RegistrationError('invalid_receipt');
          } else { await completeProfileRegistration({ profile: allowed, signal: abort }); }
        });
      const account = currentSignupAccount();
      const completed = signup.complete(ticket, account, signal);
      // No awaits between the final guard and session promotion. Storage is
      // profile/session-only and queued; it never receives this request DTO.
      if (useMock) {
        const next: AuthSession = { uid: ticket.draft.id, email: completed.email, studentNumber: completed.studentNumber };
        setMockSession(next);
        void safeSet(MOCK_SESSION_KEY, JSON.stringify(next));
      } else { setFirebaseUser(firebaseAuth.currentUser); }
      setStudentNumberCache(completed.studentNumber);
      void safeSet(STUDENT_NUMBER_KEY, JSON.stringify(completed.studentNumber));
      void pendingStore.write(null);
      setMfaPendingToken(null);
      setMfaChecking(false);
    } catch (error) { throw sanitizeRegistrationError(error); }
  }, [currentSignupAccount, pendingStore, setMfaPendingToken, signup]);

  const checkVerification = useCallback(async () => {
    if (useMock) return true;
    const user = firebaseAuth.currentUser;
    if (!matchesSignupAccount(signup.getPending(), user)) throw authError('auth/no-current-user');
    const revision = signup.revision;
    const verified = await checkEmailVerified();
    if (revision !== signup.revision || !matchesSignupAccount(signup.getPending(), firebaseAuth.currentUser)) {
      throw authError('auth/no-current-user');
    }
    setSignupEmailVerified(verified);
    setFirebaseUser(firebaseAuth.currentUser);
    return verified;
  }, [signup]);

  const resendVerification = useCallback(async () => {
    if (useMock) return;
    const pending = signup.getPending();
    const user = firebaseAuth.currentUser;
    // Also preserve the existing unverified-login resend action (no signup draft).
    if (!user || (pending && !matchesSignupAccount(pending, user))) throw authError('auth/no-current-user');
    await sendVerificationEmail();
  }, [signup]);

  /**
   * Explicit signup cancellation: drop the pending profile draft and
   * delete the still-unverified account so the same email can be used
   * again from scratch. Verified accounts are never deleted.
   */
  const cancelRegistration = useCallback(async () => {
    if (accountCleanup.current) return accountCleanup.current;
    const pending = signup.getPending();
    const user = firebaseAuth.currentUser;
    const preparing = accountOperation.current?.kind === 'signup';
    if (!pending && !preparing) return;
    const ownsAccount = matchesSignupAccount(pending, user);
    if (ownsAccount || preparing || useMock) {
      operationSequence.current++;
      authRevision.current++;
      registrationStarting.current = false;
      loginMfaCheckInProgress.current = false;
    }
    signup.clear();
    setSignupEmailVerified(false);
    void pendingStore.write(null);
    if (useMock) return;
    // Never delete or sign out an unrelated/normal account.
    if (!ownsAccount || !user) return;
    setMfaPendingToken(null);
    setMfaChecking(false);
    setFirebaseUser(null);
    const clearing = clearMfaTokens().catch(() => {});
    return runAccountCleanup(async () => {
      try {
        await clearing;
        if (firebaseAuth.currentUser?.uid === user.uid) await deleteUnverifiedAccount();
      } catch {
        // requires-recent-login / already-deleted: keep the resume path available.
      } finally {
        if (firebaseAuth.currentUser?.uid === user.uid) {
          staleAccountUid.current = user.uid;
          await authServiceSignOut();
        }
      }
    });
  }, [pendingStore, runAccountCleanup, setMfaPendingToken, signup]);

  const signOut = useCallback(async () => {
    if (accountCleanup.current) return accountCleanup.current;
    const uid = firebaseAuth.currentUser?.uid;
    operationSequence.current++;
    authRevision.current++;
    registrationStarting.current = false;
    loginMfaCheckInProgress.current = false;
    signup.clear(); // synchronous receipt/capture cancellation before any await
    setFirebaseUser(null);
    setSignupEmailVerified(false);
    setMockSession(null);
    setStudentNumberCache(null);
    setMfaPendingToken(null);
    setMfaChecking(false);
    // Queue the token invalidation NOW, not after potentially slow profile
    // removals. Every removal precedes any later account's serialized writes.
    const removing = Promise.all([
      safeRemove(MOCK_SESSION_KEY),
      safeRemove(STUDENT_NUMBER_KEY),
      pendingStore.write(null),
      clearMfaTokens().catch(() => {}),
    ]);
    return runAccountCleanup(async () => {
      await removing;
      if (uid && firebaseAuth.currentUser?.uid === uid) {
        staleAccountUid.current = uid;
        await authServiceSignOut();
      }
    });
  }, [pendingStore, runAccountCleanup, setMfaPendingToken, signup]);

  const value = useMemo(
    () => ({
      session,
      restoring,
      mfaPending: mfaPendingToken !== null,
      pendingRegistration,
      registrationAccountReady,
      registrationEmailVerified,
      subscribeRegistrationInvalidation,
      getVerifiedRegistrationDraft,
      signInWithStudentNumber,
      verifyMfa,
      cancelMfa,
      beginRegistration,
      completeRegistration,
      checkVerification,
      resendVerification,
      cancelRegistration,
      signOut,
    }),
    [
      session,
      restoring,
      mfaPendingToken,
      pendingRegistration,
      registrationAccountReady,
      registrationEmailVerified,
      subscribeRegistrationInvalidation,
      getVerifiedRegistrationDraft,
      signInWithStudentNumber,
      verifyMfa,
      cancelMfa,
      beginRegistration,
      completeRegistration,
      checkVerification,
      resendVerification,
      cancelRegistration,
      signOut,
    ],
  );

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}
