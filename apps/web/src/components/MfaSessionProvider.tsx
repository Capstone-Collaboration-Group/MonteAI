// web/src/components/MfaSessionProvider.tsx
import { useEffect, type ReactNode } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useMfaSession, MfaFlowProvider } from "@monteai/hooks";
import { anonymousMfaService } from "../lib/mfaService";
import { setTokenProvider } from "../lib/apiClient";
import { auth } from "../lib/firebase";

interface MfaSessionProviderProps {
  children: ReactNode;
}

/**
 * Owns the MFA session for the web app:
 *  - exposes the pending-challenge context (set by LoginForm after Firebase
 *    sign-in when the server returns mfaRequired), and
 *  - publishes the session's `getAccessToken` into the axios interceptor so
 *    every authenticated call prefers the MFA session JWT over the Firebase
 *    ID token (falling back to Firebase when no MFA session exists).
 *
 * Completing an MFA login persists the tokens via useMfaSession's
 * `establish`, which is what keeps the user signed in across a reload.
 */
export function MfaSessionProvider({ children }: MfaSessionProviderProps) {
  const session = useMfaSession({ refresh: (rt) => anonymousMfaService.refresh(rt) });

  const getAccessToken = session.getAccessToken;
  const clearSession = session.clear;

  useEffect(() => {
    setTokenProvider(async () => (await getAccessToken()) ?? undefined);
    return () => setTokenProvider(null);
  }, [getAccessToken]);

  useEffect(
    () =>
      onAuthStateChanged(auth, (user) => {
        if (!user) void clearSession();
      }),
    [clearSession],
  );

  return (
    <MfaFlowProvider onComplete={session.establish}>{children}</MfaFlowProvider>
  );
}
