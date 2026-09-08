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
  registerStudentAccount,
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

export interface AuthSessionContextValue {
  session: AuthSession | null;
  restoring: boolean;
  signInWithStudentNumber: (studentNumber: string, password: string) => Promise<void>;
  registerStudent: (payload: StudentRegistration) => Promise<void>;
  signOut: () => Promise<void>;
}

const MOCK_SESSION_KEY = 'monteai.auth.session';
const STUDENT_NUMBER_KEY = 'monteai.auth.studentNumber';

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

/**
 * Boot-level auth session backed by Firebase (AsyncStorage-persisted —
 * see lib/firebase.ts). onAuthStateChanged is the source of truth; the
 * root layout keeps the native splash up until the restore finishes.
 *
 * Login is ALWAYS live: student number → /auth/resolve-login → Firebase
 * email/password sign-in. Registration is live too, except in mock mode
 * (EXPO_PUBLIC_USE_MOCK) where the OTP + data services are mocked and an
 * offline demo session is persisted instead.
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
    if (firebaseUser) {
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
    try {
      await AsyncStorage.setItem(STUDENT_NUMBER_KEY, JSON.stringify(studentNumber));
    } catch {
      // storage failures shouldn't break sign-in
    }
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
      // Set immediately so navigation past the auth gate doesn't wait for
      // the (redundant) listener callback.
      setFirebaseUser(user);
      await cacheStudentNumber(studentNumber.trim());
    },
    [cacheStudentNumber],
  );

  const registerStudent = useCallback(
    async (payload: StudentRegistration) => {
      if (useMock) {
        // Offline demo path — pairs with the mock OTP + data services.
        const next: AuthSession = {
          email: payload.email,
          uid: `mock-${payload.studentNumber}`,
          studentNumber: payload.studentNumber,
        };
        setMockSession(next);
        try {
          await AsyncStorage.setItem(MOCK_SESSION_KEY, JSON.stringify(next));
        } catch {
          // ignore storage failures
        }
        return;
      }

      const middleInitial = payload.middleInitial?.trim();
      const user = await registerStudentAccount({
        email: payload.email.trim(),
        password: payload.password,
        fullName: `${payload.firstName} ${payload.lastName}`.trim(),
        // Shape matches the server's RegisterUserDto (binding is
        // case-insensitive). MiddleInitial is a server-side `char`, so it
        // is omitted when empty — an empty string would fail to bind.
        buildProfile: (uid) => ({
          Id: uid,
          Email: payload.email.trim(),
          FirstName: payload.firstName.trim(),
          ...(middleInitial ? { MiddleInitial: middleInitial } : {}),
          LastName: payload.lastName.trim(),
          Suffix: payload.suffix?.trim() || null,
          Role: 'Student',
          StudentNumber: payload.studentNumber.trim(),
          Position: payload.position,
          Institute: payload.institute,
          Program: payload.program,
          YearLevel: payload.yearLevel,
          Section: payload.section,
        }),
      });
      setFirebaseUser(user);
      await cacheStudentNumber(payload.studentNumber.trim());
    },
    [cacheStudentNumber],
  );

  const signOut = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(MOCK_SESSION_KEY);
      await AsyncStorage.removeItem(STUDENT_NUMBER_KEY);
    } catch {
      // ignore storage failures
    }
    setMockSession(null);
    setStudentNumberCache(null);
    await authServiceSignOut();
    // The Firebase listener flips to null on its own; set it explicitly so
    // the auth-gate redirect is immediate even if the callback lags.
    setFirebaseUser(null);
  }, []);

  const value = useMemo(
    () => ({ session, restoring, signInWithStudentNumber, registerStudent, signOut }),
    [session, restoring, signInWithStudentNumber, registerStudent, signOut],
  );

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}
