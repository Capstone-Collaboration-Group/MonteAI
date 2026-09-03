import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import  { useFonts } from 'expo-font';
import AnimatedSplashScreen from '@/components/AnimatedSplashScreen';
import AuthEntryScreen from '@/components/AuthEntryScreen';
import LoginScreen from '@/components/LoginScreen';
import SignUpFlow from '@/components/SignUpFlow';


SplashScreen.preventAutoHideAsync();

type EntryStage = 'splash' | 'auth' | 'login' | 'signup' | 'app';

export default function RootLayout() { 
  const [appReady, setAppReady ] = useState(false);
  const [stage, setStage] = useState<EntryStage>('splash');

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
      {stage === 'splash' ? (
  <AnimatedSplashScreen
    onGetStarted={() => setStage('auth')}
  />
) : stage === 'auth' ? (
  <AuthEntryScreen
    onLogin={() => setStage('login')}
    onSignUp={() => setStage('signup')}
  />
) : stage === 'login' ? (
  <LoginScreen
    onBack={() => setStage('auth')}
    onLogin={() => setStage('app')}
    onSignUpPress={() => setStage('signup')}
  />
) : stage === 'signup' ? (
  <SignUpFlow
    onExit={() => setStage('auth')}
    onLoginPress={() => setStage('auth')}
    onComplete={() => setStage('app')}
  />
) : (
  <Stack screenOptions={{ headerShown: false }} />
)}
    </View>
  )
}

