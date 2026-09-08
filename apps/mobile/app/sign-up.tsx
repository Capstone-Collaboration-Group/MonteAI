import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert } from 'react-native';

import SignUpFlow, { type SignUpPayload } from '@/components/SignUpFlow';
import { useAuthSession } from '@/contexts/AuthSessionContext';
import { describeAuthError } from '@/lib/authService';

/**
 * Sign-up route — Figma "Sign Up Step by Step" (node 492:26).
 * After the in-flow email OTP verification, the account is created in
 * Firebase and the student profile is registered via /auth/register.
 */
export default function SignUpRoute() {
  const router = useRouter();
  const { registerStudent } = useAuthSession();
  const [submitting, setSubmitting] = useState(false);

  const handleComplete = async (payload: SignUpPayload) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await registerStudent({
        studentNumber: payload.studentNumber,
        firstName: payload.firstName,
        middleInitial: payload.middleInitial,
        lastName: payload.lastName,
        suffix: payload.suffix,
        email: payload.email,
        institute: payload.institute,
        program: payload.program,
        yearLevel: payload.yearLevel,
        section: payload.section,
        position: payload.position,
        password: payload.password,
      });
      router.replace('/(tabs)/home');
    } catch (err) {
      Alert.alert('Registration failed', describeAuthError(err));
    } finally {
      setSubmitting(false);
    }
  };

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
        onComplete={handleComplete}
      />
    </>
  );
}
