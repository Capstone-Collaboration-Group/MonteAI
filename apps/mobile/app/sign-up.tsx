import { Stack, useRouter } from 'expo-router';
import React from 'react';

import SignUpFlow from '@/components/SignUpFlow';

/**
 * Sign-up route — Figma "Sign Up Step by Step" (node 492:26).
 * Reached from the auth entry's Sign Up button. Completing the flow
 * (including email verification) continues into the app; the real
 * Firebase + `/auth/register` wiring lands with the auth integration.
 */
export default function SignUpRoute() {
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SignUpFlow
        onExit={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/auth-entry');
        }}
        onLoginPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/auth-entry');
        }}
        onComplete={() => router.replace('/(tabs)/home')}
      />
    </>
  );
}
