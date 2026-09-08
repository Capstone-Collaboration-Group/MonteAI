import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';

import LoginScreen, { type LoginCredentials } from '@/components/LoginScreen';
import { useAuthSession } from '@/contexts/AuthSessionContext';
import { describeAuthError } from '@/lib/authService';

/**
 * Login route — Figma "Login" (node 448:487).
 * Students sign in with their student number; the auth service resolves it
 * to the Firebase email (via /auth/resolve-login) and runs the standard
 * Firebase email/password sign-in.
 */
export default function LoginRoute() {
  const router = useRouter();
  const { signInWithStudentNumber } = useAuthSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (credentials: LoginCredentials) => {
    setLoading(true);
    setError(null);
    try {
      await signInWithStudentNumber(
        credentials.studentNumber,
        credentials.password,
      );
      router.replace('/(tabs)/home');
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <LoginScreen
        onBack={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/auth-entry');
        }}
        onLogin={handleLogin}
        onSignUpPress={() => router.push('/sign-up')}
        loading={loading}
        error={error}
      />
    </>
  );
}
