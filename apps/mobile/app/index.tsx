import React from 'react';
import { Redirect, useRouter } from 'expo-router';

import AnimatedSplashScreen from '@/components/AnimatedSplashScreen';
import { useAuthSession } from '@/contexts/AuthSessionContext';

export default function IndexRoute() {
  const router = useRouter();
  const { session, restoring, pendingRegistration } = useAuthSession();

  if (restoring) return null;
  if (session) return <Redirect href="/(tabs)/home" />;
  if (pendingRegistration) return <Redirect href="/sign-up" />;

  return (
    <AnimatedSplashScreen onGetStarted={() => router.replace('/auth-entry')} />
  );
}
