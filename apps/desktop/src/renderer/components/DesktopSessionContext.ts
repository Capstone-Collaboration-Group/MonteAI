import { createContext, useContext } from 'react';

export const DesktopSessionContext = createContext<{ signOut(): Promise<void> } | null>(null);

export function useDesktopSession() {
  const session = useContext(DesktopSessionContext);
  if (!session) throw new Error('useDesktopSession must be used inside MfaSessionProvider.');
  return session;
}
