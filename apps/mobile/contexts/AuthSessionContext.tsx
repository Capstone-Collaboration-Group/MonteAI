// apps/mobile/contexts/AuthSessionContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';
import {
  EMAIL_NOT_VERIFIED_CODE,
  authError,
  checkEmailVerified,
  completeProfileRegistration,
  createStudentAccount,
  deleteUnverifiedAccount,
  sendVerificationEmail,
  signInWithPassword,
  signInWithStudentNumber as authServiceSignIn,
  signOut as authServiceSignOut,
} from '@/lib/authService';

export interface AuthSession {
  email: string;
  uid: string;
  studentNumber?: string;
}

export interface StudentRegistration {
  studentNumber: string;
  firstName: string;
  middleInitial?: string;
  lastName: string;
  suffix?: string;
  email: string;
  institute: string;
  program: string;
  yearLevel: number;
  section: string;
  position: string;
  password: string;
}

/** What gets persisted while waiting for the verification link. */
export type PendingRegistration = Omit<StudentRegistration, 'password'>;

export interface BeginRegistrationResult {
  /** False in mock mode (and verified resumes) — skip the email step. */
  verificationRequired: boolean;
}

export interface AuthSessionContextValue {
  session: AuthSession | null;
  restoring: boolean;
  signInWithStudentNumber: (studentNumber: string, password: string) => Promise<void>;
  beginRegistration: (payload: StudentRegistration) => Promise<BeginRegistrationResult>;
  completeRegistration: () => Promise<void>;
  checkVerification: () => Promise<boolean>;
  resendVerification: () => Promise<void>;
  cancelRegistration: () => Promise<void>;
  signOut: () => Promise<void>;
}

const MOCK_SESSION_KEY = 'monteai.auth.session';
const STUDENT_NUMBER_KEY = 'monteai.auth.studentNumber';
const PENDING_REGISTRATION_KEY = 'monteai.pendingRegistration';

const useMock =
  (process.env.EXPO_PUBLIC_USE_MOCK ?? (__DEV__ ? 'true' : 'false')) === 'true';

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

export function useAuthSession(): AuthSessionContextValue {
  const context = useContext(AuthSessionContext);
  if (!context) {
    throw new Error('useAuthSession must be used within <AuthSessionProvider>');
  }
  return context;
}

async function safeGet(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function safeSet(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    // storage failures shouldn't break the flow
  }
}

async function safeRemove(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // ignore storage failures
  }
}

function buildPending(payload: StudentRegistration): PendingRegistration {
  return {
    studentNumber: payload.studentNumber.trim(),
    firstName: payload.firstName.trim(),
    middleInitial: payload.middleInitial?.trim() || undefined,
    lastName: payload.lastName.trim(),
    suffix: payload.suffix?.trim() || undefined,
    email: payload.email.trim(),
    institute: payload.institute,
    program: payload.program,
    yearLevel: payload.yearLevel,
    section: payload.section,
    position: payload.position,
  };
}

/**
 * Boot-level auth session backed by Firebase (AsyncStorage-persisted —
 * see lib/firebase.ts). onAuthStateChanged is the source of truth; the
 * root layout keeps the native splash up until the restore finishes.
 *
 * `session` only surfaces VERIFIED Firebase users — unverified accounts
 * (mid-sign-up or blocked at login) stay outside the tab gate until they
 * open the verification link.
 *
 * Login is ALWAYS live: student number → /auth/resolve-login → Firebase
 * email/password sign-in. Registration runs in two phases (create +
 * verify link → profile POST) and is skipped entirely in mock mode
 * (EXPO_PUBLIC_USE_MOCK), where an offline demo session is persisted.
 */
export function AuthSessionProvider({ children }: { children: ReactNode }) {
  // undefined = first onAuthStateChanged callback still pending (restore).
  const [firebaseUser, setFirebaseUser] = useState<User | null | undefined>(undefined);
  const [mockSession, setMockSession] = useState<AuthSession | null>(null);
  const [studentNumberCache, setStudentNumberCache] = useState<string | null>(null);
  const [mockRestoring, setMockRestoring] = useState(true);

  // Restore the mock session + cached student number, then subscribe to
  // Firebase auth state (subscription last so the first callback lands
  // after local state is settled — avoids a redirect flash).
  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    (async () => {
      try {
        const [mockRaw, studentNumberRaw] = await Promise.all([
          AsyncStorage.getItem(MOCK_SESSION_KEY),
          AsyncStorage.getItem(STUDENT_NUMBER_KEY),
        ]);
        if (!active) return;
        if (mockRaw) setMockSession(JSON.parse(mockRaw) as AuthSession);
        if (studentNumberRaw) {
          setStudentNumberCache(JSON.parse(studentNumberRaw) as string);
        }
      } catch {
        // no persisted state — signed-out boot
      } finally {
        if (active) setMockRestoring(false);
      }
      unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
        if (!active) return;
        setFirebaseUser(user);
      });
    })();
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  const restoring = mockRestoring || firebaseUser === undefined;

  const session = useMemo<AuthSession | null>(() => {
    // Unverified users are deliberately invisible to the tab gate —
    // they must open the verification link before entering the app.
    if (firebaseUser && firebaseUser.emailVerified) {
      return {
        uid: firebaseUser.uid,
        email: firebaseUser.email ?? '',
        studentNumber: studentNumberCache ?? undefined,
      };
    }
    return mockSession;
  }, [firebaseUser, mockSession, studentNumberCache]);

  const cacheStudentNumber = useCallback(async (studentNumber: string) => {
    setStudentNumberCache(studentNumber);
    await safeSet(STUDENT_NUMBER_KEY, JSON.stringify(studentNumber));
  }, []);

  const signInWithStudentNumber = useCallback(
    async (studentNumber: string, password: string) => {
      if (useMock) {
        const next: AuthSession = {
          email: `${studentNumber}@mock.local`,
          uid: `mock-${studentNumber}`,
          studentNumber: studentNumber.trim(),
        };
        setMockSession(next);
        try {
          await AsyncStorage.setItem(MOCK_SESSION_KEY, JSON.stringify(next));
          await AsyncStorage.setItem(STUDENT_NUMBER_KEY, JSON.stringify(studentNumber.trim()));
        } catch {
          // ignore storage failures
        }
        return;
      }
      const user = await authServiceSignIn(studentNumber, password);
      if (!user.emailVerified) {
        // Blocked login — resend stays available because the Firebase
        // session is live; `session` stays null so the tab gate holds.
        throw authError(EMAIL_NOT_VERIFIED_CODE);
      }
      // Set immediately so navigation past the auth gate doesn't wait for
      // the (redundant) listener callback.
      setFirebaseUser(user);
      await cacheStudentNumber(studentNumber.trim());
    },
    [cacheStudentNumber],
  );

  /**
   * Phase 1: create the Firebase account + send the verification link
   * (mock mode skips straight through). When the email already exists,
   * attempts a password resume so an interrupted sign-up can continue
   * without the "already registered" dead end.
   */
  const beginRegistration = useCallback(
    async (payload: StudentRegistration): Promise<BeginRegistrationResult> => {
      const pending = buildPending(payload);
      if (useMock) {
        await safeSet(PENDING_REGISTRATION_KEY, JSON.stringify(pending));
        return { verificationRequired: false };
      }

      const fullName = `${payload.firstName} ${payload.lastName}`.trim();
      let user: User;
      try {
        user = await createStudentAccount({
          email: pending.email,
          password: payload.password,
          fullName,
        });
      } catch (err) {
        if ((err as { code?: string } | null | undefined)?.code !== 'auth/email-already-in-use') {
          throw err;
        }
        try {
          user = await signInWithPassword(pending.email, payload.password);
        } catch {
          // Different account/password — surface the original conflict.
          throw err;
        }
      }
      setFirebaseUser(user);
      await safeSet(PENDING_REGISTRATION_KEY, JSON.stringify(pending));
      return { verificationRequired: !user.emailVerified };
    },
    [],
  );

  /**
   * Phase 2: once the user opened the link, persist the profile
   * server-side with the verified account's token, then clear the
   * pending payload and open the session.
   */
  const completeRegistration = useCallback(async () => {
    const raw = await safeGet(PENDING_REGISTRATION_KEY);
    const pending = raw ? (JSON.parse(raw) as PendingRegistration) : null;
    if (!pending) throw authError('auth/registration-missing');

    if (useMock) {
      const next: AuthSession = {
        email: pending.email,
        uid: `mock-${pending.studentNumber}`,
        studentNumber: pending.studentNumber,
      };
      setMockSession(next);
      try {
        await AsyncStorage.setItem(MOCK_SESSION_KEY, JSON.stringify(next));
      } catch {
        // ignore storage failures
      }
      await safeRemove(PENDING_REGISTRATION_KEY);
      return;
    }

    const middleInitial = pending.middleInitial?.trim();
    const user = await completeProfileRegistration({
      // Shape matches the server's RegisterUserDto (binding is
      // case-insensitive). MiddleInitial is a server-side `char`, so it
      // is omitted when empty — an empty string would fail to bind.
      buildProfile: (uid) => ({
        Id: uid,
        Email: pending.email,
        FirstName: pending.firstName,
        ...(middleInitial ? { MiddleInitial: middleInitial } : {}),
        LastName: pending.lastName,
        Suffix: pending.suffix?.trim() || null,
        Role: 'Student',
        StudentNumber: pending.studentNumber,
        Position: pending.position,
        Institute: pending.institute,
        Program: pending.program,
        YearLevel: pending.yearLevel,
        Section: pending.section,
      }),
    });
    await safeRemove(PENDING_REGISTRATION_KEY);
    setFirebaseUser(user);
    await cacheStudentNumber(pending.studentNumber);
  }, [cacheStudentNumber]);

  const checkVerification = useCallback(async () => {
    if (useMock) return true;
    return checkEmailVerified();
  }, []);

  const resendVerification = useCallback(async () => {
    if (useMock) return;
    await sendVerificationEmail();
  }, []);

  /**
   * Backing out of the verification step: drop the pending payload and
   * delete the still-unverified account so the same email can be used
   * again from scratch. Verified accounts are never deleted.
   */
  const cancelRegistration = useCallback(async () => {
    await safeRemove(PENDING_REGISTRATION_KEY);
    if (useMock) return;
    try {
      await deleteUnverifiedAccount();
    } catch {
      // requires-recent-login / already-deleted — the resume path in
      // beginRegistration covers a leftover account anyway.
    }
    setFirebaseUser(null);
  }, []);

  const signOut = useCallback(async () => {
    await Promise.all([
      safeRemove(MOCK_SESSION_KEY),
      safeRemove(STUDENT_NUMBER_KEY),
      safeRemove(PENDING_REGISTRATION_KEY),
    ]);
    setMockSession(null);
    setStudentNumberCache(null);
    await authServiceSignOut();
    // The Firebase listener flips to null on its own; set it explicitly so
    // the auth-gate redirect is immediate even if the callback lags.
    setFirebaseUser(null);
  }, []);

  const value = useMemo(
    () => ({
      session,
      restoring,
      signInWithStudentNumber,
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
      signInWithStudentNumber,
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
