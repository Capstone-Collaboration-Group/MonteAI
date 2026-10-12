// web/src/lib/firebaseServices.ts
import { createFirebaseAuth } from "@monteai/api";
import { apiClient } from "./apiClient";

export const auth = createFirebaseAuth({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});

// Re-exported so the 12 existing service modules keep working unchanged.
// The Authorization header now prefers the MFA session JWT when one exists
// (see lib/apiClient.ts), falling back to the Firebase ID token.
export { apiClient };
