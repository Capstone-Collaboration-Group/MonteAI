import { Stack, useRouter } from 'expo-router';
import React, { useCallback } from 'react';

import SignUpFlow from '@/components/SignUpFlow';
import { useAuthSession } from '@/contexts/AuthSessionContext';

/**
 * Sign-up route — Figma "Sign Up Step by Step" (node 492:26).
 * Two-phase registration: create the Firebase account + send the default
 * Firebase verification link, and only after the link is opened register
 * the student profile via /auth/register (the profile also carries the
 * student-number → email mapping future logins depend on).
 * Errors surface inside SignUpFlow via describeAuthError.
 */
export default function SignUpRoute() {
  const router = useRouter();
  const {
    beginRegistration,
    completeRegistration,
    checkVerification,
    resendVerification,
    cancelRegistration,
  } = useAuthSession();

  const handleComplete = useCallback(async () => {
    await completeRegistration();
    router.replace('/(tabs)/home');
  }, [completeRegistration, router]);

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
        onBeginRegistration={beginRegistration}
        onCompleteRegistration={handleComplete}
        onCheckVerification={checkVerification}
        onResendVerification={resendVerification}
        onCancelRegistration={cancelRegistration}
      />
    </>
  );
}
