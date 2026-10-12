import { onAuthStateChanged } from "firebase/auth";
import { useEffect, type ReactNode } from "react";
import { MfaFlowProvider, useMfaSession } from "@monteai/hooks";
import { auth } from "../lib/firebaseServices";
import { anonymousMfaService } from "../lib/mfaService";
import { setTokenProvider } from "../lib/apiClient";

export function MfaSessionProvider({ children }: { children: ReactNode }) {
  const session = useMfaSession({ refresh: (refreshToken) => anonymousMfaService.refresh(refreshToken) });
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
