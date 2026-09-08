import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { AuthSessionProvider, useAuthSession } from '@/contexts/AuthSessionContext';

SplashScreen.preventAutoHideAsync();

/**
 * Root layout — all navigation is expo-router based. The auth session is
 * restored once on boot (see AuthSessionProvider); until it finishes the
 * native splash stays up, then `app/index.tsx` routes between the animated
 * splash/auth entry and the tabbed app.
 */
function AppShell() {
  const { restoring } = useAuthSession();
  const [fontsLoaded] = useFonts({});

  const appReady = fontsLoaded && !restoring;

  useEffect(() => {
    if (appReady) {
      SplashScreen.hideAsync();
    }
  }, [appReady]);

  if (!appReady) {
    return null;
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}

export default function RootLayout() {
  return (
    <AuthSessionProvider>
      <AppShell />
    </AuthSessionProvider>
  );
}
