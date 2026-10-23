import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { AuthSessionProvider, useAuthSession } from '@/contexts/AuthSessionContext';
import { FontSizeProvider, useFontSize } from '@/contexts/FontSizeContext';

SplashScreen.preventAutoHideAsync();

/**
 * Root layout — all navigation is expo-router based. The auth session is
 * restored once on boot (see AuthSessionProvider) and the font-size
 * preference is read from AsyncStorage (see FontSizeProvider); until both
 * finish the native splash stays up, then `app/index.tsx` routes between
 * the animated splash/auth entry and the tabbed app.
 */
function AppShell() {
  const { restoring } = useAuthSession();
  const { ready: fontSizeReady } = useFontSize();
  const [fontsLoaded] = useFonts({});

  const appReady = fontsLoaded && !restoring && fontSizeReady;

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
    <FontSizeProvider>
      <AuthSessionProvider>
        <AppShell />
      </AuthSessionProvider>
    </FontSizeProvider>
  );
}
