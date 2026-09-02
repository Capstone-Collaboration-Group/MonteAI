import type { Auth } from "firebase/auth";

export function createFirebaseTokenAccessors(auth: Auth) { 
    async function getAuthToken(): Promise<string | undefined> { 
        return auth.currentUser?.getIdToken();
    }

    async function refreshAuthToken(): Promise<string | undefined> { 
        return auth.currentUser?. getIdToken(true);
    }
    return { getAuthToken, refreshAuthToken };
}