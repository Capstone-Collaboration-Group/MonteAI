import React from 'react';
import { Redirect, useRouter } from 'expo-router';

import AnimatedSplashScreen from '@/components/AnimatedSplashScreen';
import { useAuthSession } from '@/contexts/AuthSessionContext';

export default function IndexRoute() {
  const router = useRouter();
  const { session, restoring } = useAuthSession();

  if (restoring) return null;
  if (session) return <Redirect href="/(tabs)/home" />;

  return (
    <AnimatedSplashScreen onGetStarted={() => router.replace('/auth-entry')} />
  );
}
