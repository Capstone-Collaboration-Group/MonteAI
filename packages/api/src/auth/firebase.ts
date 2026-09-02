import { initializeApp, type FirebaseOptions } from "firebase/app";
import { getAuth } from "firebase/auth";

export function createFirebaseAuth(config: FirebaseOptions) {
  const app = initializeApp(config);
  return getAuth(app);
}