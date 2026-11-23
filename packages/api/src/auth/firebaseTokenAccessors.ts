import { onAuthStateChanged, type Auth } from "firebase/auth";

export function createFirebaseTokenAccessors(auth: Auth) {
  let authReady: Promise<void> | undefined;
  function ready(): Promise<void> {
    authReady ??= typeof auth.authStateReady === "function"
      ? auth.authStateReady()
      : new Promise<void>((resolve) => {
          const unsubscribe = onAuthStateChanged(auth, () => {
            unsubscribe();
            resolve();
          });
        });
    return authReady;
  }

  async function getFirebaseIdToken(): Promise<string | undefined> {
    await ready();
    return auth.currentUser?.getIdToken();
  }

  async function refreshFirebaseIdToken(): Promise<string | undefined> {
    await ready();
    return auth.currentUser?.getIdToken(true);
  }

  /** Reload verification/identity first, then force-refresh. Never reads an MFA session store. */
  async function getFreshFirebaseIdToken(): Promise<string | undefined> {
    await ready();
    const user = auth.currentUser;
    if (!user) return undefined;
    await user.reload();
    if (auth.currentUser?.uid !== user.uid) return undefined;
    const email = user.email;
    const token = await user.getIdToken(true);
    return auth.currentUser?.uid === user.uid && auth.currentUser.email === email
      ? token
      : undefined;
  }

  return {
    getFirebaseIdToken,
    refreshFirebaseIdToken,
    getFreshFirebaseIdToken,
    // Backwards-compatible Firebase-only aliases for existing callers.
    getAuthToken: getFirebaseIdToken,
    refreshAuthToken: refreshFirebaseIdToken,
  };
}
