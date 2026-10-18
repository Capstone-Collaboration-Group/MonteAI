import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useIsFocused } from '@react-navigation/native';

const DURATION_MS = 240;

interface TabScreenTransitionProps {
  children: React.ReactNode;
}

/**
 * Focus-driven scene transition for the bottom tabs: the focused screen
 * fades in with a small upward slide; the screen being left fades out.
 * Runs on every focus change (not just mount), so switching between
 * already-mounted tabs stays animated. Stateless content is untouched.
 */
export function TabScreenTransition({ children }: TabScreenTransitionProps) {
  const isFocused = useIsFocused();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(isFocused ? 1 : 0, {
      duration: DURATION_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [isFocused, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 12 }],
  }));

  return <Animated.View style={[s.root, animatedStyle]}>{children}</Animated.View>;
}

const s = StyleSheet.create({
  root: { flex: 1 },
});
