import { Stack, useRouter } from 'expo-router';
import React from 'react';

import ForgotPasswordScreen from '@/components/ForgotPasswordScreen';

/**
 * Forgot-password route — the user enters the email associated with
 * their account and the Firebase password-reset link is sent there.
 * Mirrors the login route's back behavior.
 */
export default function ForgotPasswordRoute() {
  const router = useRouter();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ForgotPasswordScreen
        onBack={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/login');
        }}
      />
    </>
  );
}
