import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import  { useFonts } from 'expo-font';
import AnimatedSplashScreen from '@/components/AnimatedSplashScreen';


SplashScreen.preventAutoHideAsync();

export default function RootLayout() { 
  const [appReady, setAppReady ] = useState(false);
  const [showAnimatedSplash, setShowAnimatedSplash] = useState(true);

  const [fontsLoaded] = useFonts({

  });

  useEffect(() => {
    if (fontsLoaded) setAppReady(true);
  }, [fontsLoaded]);

  const onLayoutRootView = useCallback(async () => {
    if (appReady) { 
      await SplashScreen.hideAsync();
    }
  }, [appReady]);

  if(!appReady) { 
    return null;
  }

  return (
    <View style={{ flex: 1}} onLayout={onLayoutRootView}>
      {showAnimatedSplash ? (
  <AnimatedSplashScreen
    onGetStarted={() => setShowAnimatedSplash(false)}
  />
) : (
  <Stack screenOptions={{ headerShown: false }} />
)}
    </View>
  )
}

