// apps/mobile/app/submit-thesis.tsx
//
// "Submit Thesis" route — thin wrapper around the 3-step flow
// (Metadata → File Upload → Review).

import { Stack, useRouter } from 'expo-router';
import React, { useCallback } from 'react';

import { SubmitThesisFlow } from '@/components/thesis/SubmitThesisFlow';

export default function SubmitThesisRoute() {
  const router = useRouter();

  const handleExit = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/home');
  }, [router]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SubmitThesisFlow onExit={handleExit} />
    </>
  );
}
