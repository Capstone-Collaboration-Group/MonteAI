import { useCallback, useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { MfaFlowProvider, queryClient, useAuth, useMfaSession } from "@monteai/hooks";
import { auth } from "../lib/firebaseServices";
import { anonymousMfaService } from "../lib/mfaService";
import { setTokenProvider } from "../lib/apiClient";
import { DesktopSessionContext } from "./DesktopSessionContext";
import SessionLoading from "./SessionLoading";

const refreshSession = (refreshToken: string) => anonymousMfaService.refresh(refreshToken);

export function MfaSessionProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const session = useMfaSession({ refresh: refreshSession });
  const getAccessToken = session.getAccessToken;
  const clearSession = session.clear;
  const [tokenProviderReady, setTokenProviderReady] = useState(false);

  useLayoutEffect(() => {
    setTokenProvider(async () => (await getAccessToken()) ?? undefined);
    if (!session.restoring) setTokenProviderReady(true);
    return () => setTokenProvider(null);
  }, [getAccessToken, session.restoring]);

  // Wait for BOTH stores to restore before clearing orphaned MFA credentials.
  useEffect(() => {
    if (!authLoading && !session.restoring && !user && session.isAuthenticated) {
      void clearSession();
    }
  }, [authLoading, session.restoring, session.isAuthenticated, user, clearSession]);

  const signOut = useCallback(async () => {
    await queryClient.cancelQueries();
    await auth.signOut();
    await clearSession();
    queryClient.clear();
  }, [clearSession]);

  return (
    <DesktopSessionContext.Provider value={{ signOut }}>
      <MfaFlowProvider onComplete={session.establish}>
        {authLoading || session.restoring || !tokenProviderReady ? <SessionLoading /> : children}
      </MfaFlowProvider>
    </DesktopSessionContext.Provider>
  );
}
