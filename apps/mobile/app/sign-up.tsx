import { Redirect, Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createStudentSignupFlow, type StudentSignupFlow } from '@monteai/api';

import SignUpFlow from '@/components/SignUpFlow';
import { useAuthSession } from '@/contexts/AuthSessionContext';
import { verifyRegistrationId } from '@/lib/registration/idVerificationService';

/**
 * Sign-up route — Figma "Sign Up Step by Step" (node 492:26).
 * Per-mount, memory-only signup controller. Firebase email verification is
 * followed by explicit Android front-ID capture, verification, and registration.
 * No receipt is passed through navigation or a persisted session/context.
 */
export default function SignUpRoute() {
  const router = useRouter();
  const {
    session,
    restoring,
    pendingRegistration,
    registrationAccountReady,
    registrationEmailVerified,
    getVerifiedRegistrationDraft,
    subscribeRegistrationInvalidation,
    beginRegistration,
    completeRegistration,
    checkVerification,
    resendVerification,
    cancelRegistration,
  } = useAuthSession();
  const ownsSignup = useRef(false);
  const currentFlow = useRef<StudentSignupFlow | null>(null);
  const [flow, setFlow] = useState<StudentSignupFlow | null>(null);
  // An existing normal session never starts signup. Once this route owns a
  // flow, session promotion must NOT redirect it before native cleanup settles.
  const blocked = restoring || (!!session && !ownsSignup.current);

  useEffect(() => {
    if (blocked) return;
    ownsSignup.current = true;
    const next = createStudentSignupFlow({
      getVerifiedDraft: getVerifiedRegistrationDraft,
      verify: verifyRegistrationId,
      register: completeRegistration,
    });
    currentFlow.current = next;
    const unsubscribe = subscribeRegistrationInvalidation(() => next.invalidate());
    setFlow(next);
    return () => {
      unsubscribe();
      next.dispose();
      if (currentFlow.current === next) currentFlow.current = null;
    };
  }, [blocked, completeRegistration, getVerifiedRegistrationDraft, subscribeRegistrationInvalidation]);

  const handleRegistered = useCallback(() => {
    const current = currentFlow.current;
    if (!current || current.getState().phase !== 'complete' || current.getState().busy) return;
    router.replace('/(tabs)/home');
  }, [router]);

  const ensureVerifiedAccount = useCallback(async () => { await getVerifiedRegistrationDraft(); }, [getVerifiedRegistrationDraft]);

  if (restoring) return null;
  if (blocked) return <Redirect href="/(tabs)/home" />;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      {flow && <SignUpFlow
        flow={flow}
        pendingRegistration={pendingRegistration}
        accountReady={registrationAccountReady}
        emailVerified={registrationEmailVerified}
        onExit={() => {
          currentFlow.current?.cancel();
          router.replace('/auth-entry');
        }}
        onLoginPress={() => {
          currentFlow.current?.cancel();
          router.replace('/login');
        }}
        onBeginRegistration={beginRegistration}
        onRegistered={handleRegistered}
        ensureVerifiedAccount={ensureVerifiedAccount}
        onCheckVerification={checkVerification}
        onResendVerification={resendVerification}
        onCancelRegistration={cancelRegistration}
      />}
    </>
  );
}
