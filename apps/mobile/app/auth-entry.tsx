import { Stack, useRouter } from 'expo-router';
import React from 'react';

import AuthEntryScreen from '@/components/AuthEntryScreen';

/**
 * Auth entry route — Figma "MonteSkolar - Animated Auth Entry".
 * Preview at `/auth-entry`. Login / Sign Up currently continue into
 * the app until the real auth flows land.
 */
export default function AuthEntryRoute() {
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <AuthEntryScreen
        onLogin={() => router.push('/login')}
        onSignUp={() => router.push('/sign-up')}
      />
    </>
  );
}
