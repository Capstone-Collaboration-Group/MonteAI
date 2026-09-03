import { Stack, useRouter } from 'expo-router';
import React from 'react';

import LoginScreen from '@/components/LoginScreen';

/**
 * Login route — Figma "Login" (node 448:487).
 * Reached from the auth entry's Login button. Successful login continues
 * into the app; the real Firebase + `/auth/login` wiring lands with the
 * auth integration.
 */
export default function LoginRoute() {
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LoginScreen
        onBack={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/auth-entry');
        }}
        onLogin={() => router.replace('/(tabs)/home')}
        onSignUpPress={() => router.push('/sign-up')}
      />
    </>
  );
}
