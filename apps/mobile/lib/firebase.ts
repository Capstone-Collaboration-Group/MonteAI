// apps/mobile/lib/firebase.ts
//
// Firebase bootstrap for the mobile app. Auth uses the React Native
// persistence layer (AsyncStorage) so the sign-in session survives app
// restarts — the AuthSessionContext restores it on boot via
// onAuthStateChanged.
//
// Config comes from EXPO_PUBLIC_FIREBASE_* vars in the gitignored
// apps/mobile/.env.local (Expo only inlines EXPO_PUBLIC_* into the bundle).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence, type Auth } from 'firebase/auth';

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

function createAuthInstance(): Auth {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // Double init (e.g. Metro fast refresh re-evaluating this module) —
    // reuse the existing instance for the app.
    return getAuth(app);
  }
}

export const firebaseAuth = createAuthInstance();
