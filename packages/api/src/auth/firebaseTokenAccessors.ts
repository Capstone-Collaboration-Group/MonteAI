import { onAuthStateChanged, type Auth } from "firebase/auth";

export function createFirebaseTokenAccessors(auth: Auth) { 
     const authReady: Promise<void> =
    typeof (auth as Auth & { authStateReady?: () => Promise<void> }).authStateReady === "function"
      ? (auth as Auth & { authStateReady: () => Promise<void> }).authStateReady()
      : new Promise<void>((resolve) => {
          const unsubscribe = onAuthStateChanged(auth, () => {
            unsubscribe();
            resolve();
          });
        });
    
    async function getAuthToken(): Promise<string | undefined> { 
        await authReady;
        return auth.currentUser?.getIdToken();
    }

    async function refreshAuthToken(): Promise<string | undefined> { 
        await authReady;
        return auth.currentUser?. getIdToken(true);
    }
    return { getAuthToken, refreshAuthToken };
}