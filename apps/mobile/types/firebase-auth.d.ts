// apps/mobile/types/firebase-auth.d.ts
//
// Metro resolves `firebase/auth` through the `react-native` export
// condition at runtime, which exposes `getReactNativePersistence`. The
// default TypeScript entry (web `auth-public.d.ts`) doesn't declare it,
// so this augments the module with the missing export. See
// @firebase/auth/dist/rn/index.rn.d.ts for the source of truth.

import 'firebase/auth';

declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
  }): import('firebase/auth').Persistence;
}
