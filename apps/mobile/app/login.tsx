import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import LoginScreen, { type LoginCredentials } from '@/components/LoginScreen';
import { useAuthSession } from '@/contexts/AuthSessionContext';
import { EMAIL_NOT_VERIFIED_CODE, describeAuthError } from '@/lib/authService';

/**
 * Login route — Figma "Login" (node 448:487).
 * Students sign in with their student number; the auth service resolves it
 * to the Firebase email (via /auth/resolve-login) and runs the standard
 * Firebase email/password sign-in. Unverified emails are blocked here with
 * a "Resend verification email" action.
 */
export default function LoginRoute() {
  const router = useRouter();
  const { signInWithStudentNumber, resendVerification } = useAuthSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<{
    label: string;
    onPress: () => void;
  } | null>(null);

  const handleResendVerification = useCallback(async () => {
    try {
      await resendVerification();
      Alert.alert(
        'Verification email sent',
        'Open the link in your inbox, then try signing in again.',
      );
    } catch (err) {
      Alert.alert('Could not send email', describeAuthError(err));
    }
  }, [resendVerification]);

  const handleLogin = async (credentials: LoginCredentials) => {
    setLoading(true);
    setError(null);
    setErrorAction(null);
    try {
      await signInWithStudentNumber(
        credentials.studentNumber,
        credentials.password,
      );
      router.replace('/(tabs)/home');
    } catch (err) {
      setError(describeAuthError(err));
      const code = (err as { code?: string } | null | undefined)?.code;
      if (code === EMAIL_NOT_VERIFIED_CODE) {
        setErrorAction({
          label: 'Resend verification email',
          onPress: handleResendVerification,
        });
      }
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
        errorAction={errorAction}
      />
    </>
  );
}
