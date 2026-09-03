import React, { useEffect } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useThemeColor } from '@/hooks/use-theme-color';

interface AuthEntryScreenProps {
  onLogin?: () => void;
  onSignUp?: () => void;
  onTroublePress?: () => void;
  /** Set to false to render the final state immediately (e.g. screenshots/tests). */
  animated?: boolean;
}

const LOGO_SIZE = 128;
const EASE_OUT = Easing.bezier(0.65, 0, 0.35, 1);
const EASE_SPRING = Easing.bezier(0.34, 1.56, 0.64, 1);

/**
 * Auth entry screen — mirrors Figma "MonteSkolar - Animated Auth Entry"
 * (node 1426:2081): brand anchor on top, Login / Sign Up actions,
 * "Trouble accessing your account?" link, institutional footer.
 *
 * Type uses the system font stack because DM Sans (the Figma typeface)
 * is not bundled — set `fontFamily: 'DM Sans'` on the text styles once
 * the font files are added via expo-font.
 */
export default function AuthEntryScreen({
  onLogin,
  onSignUp,
  onTroublePress,
  animated = true,
}: AuthEntryScreenProps) {
  const background = useThemeColor({}, 'background');
  const primary = useThemeColor({}, 'primary');
  const onPrimary = useThemeColor({}, 'onPrimary');
  const body = useThemeColor({}, 'onSurfaceVariant');

  const logoScale = useSharedValue(animated ? 0.6 : 1);
  const logoOpacity = useSharedValue(animated ? 0 : 1);
  const brandOpacity = useSharedValue(animated ? 0 : 1);
  const brandTranslateY = useSharedValue(animated ? 12 : 0);
  const actionsOpacity = useSharedValue(animated ? 0 : 1);
  const actionsTranslateY = useSharedValue(animated ? 16 : 0);
  const footerOpacity = useSharedValue(animated ? 0 : 1);

  useEffect(() => {
    if (!animated) return;
    logoScale.value = withTiming(1, { duration: 800, easing: EASE_SPRING });
    logoOpacity.value = withTiming(1, { duration: 800, easing: EASE_SPRING });
    brandOpacity.value = withDelay(400, withTiming(1, { duration: 700, easing: EASE_OUT }));
    brandTranslateY.value = withDelay(400, withTiming(0, { duration: 700, easing: EASE_OUT }));
    actionsOpacity.value = withDelay(750, withTiming(1, { duration: 600, easing: EASE_OUT }));
    actionsTranslateY.value = withDelay(750, withTiming(0, { duration: 600, easing: EASE_OUT }));
    footerOpacity.value = withDelay(1100, withTiming(1, { duration: 600 }));
  }, [
    animated,
    actionsOpacity,
    actionsTranslateY,
    brandOpacity,
    brandTranslateY,
    footerOpacity,
    logoOpacity,
    logoScale,
  ]);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));
  const brandStyle = useAnimatedStyle(() => ({
    opacity: brandOpacity.value,
    transform: [{ translateY: brandTranslateY.value }],
  }));
  const actionsStyle = useAnimatedStyle(() => ({
    opacity: actionsOpacity.value,
    transform: [{ translateY: actionsTranslateY.value }],
  }));
  const footerStyle = useAnimatedStyle(() => ({ opacity: footerOpacity.value }));

  return (
    <View style={[styles.root, { backgroundColor: background }]}>
      {/* Soft green wash at the top (Figma radial tint #99F5CB @ 10%) */}
      <View pointerEvents="none" style={styles.topWash}>
        <View style={styles.topGlow} />
      </View>
      {/* Subtle academic motif, top corners @ ~5% (Figma decorative layer) */}
      <View pointerEvents="none" style={styles.motifLeft}>
        <View style={styles.motifRing} />
        <View style={styles.motifDot} />
      </View>
      <View pointerEvents="none" style={styles.motifRight}>
        <View style={styles.motifRing} />
        <View style={styles.motifBar} />
      </View>

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.canvas}>
          {/* Brand Section (Identity Anchor) */}
          <View style={styles.brandBlock}>
            <View style={styles.logoMargin}>
              <Animated.View style={[styles.logoShadow, logoStyle]}>
                <Image
                  source={require('@/assets/images/cdm-logo.png')}
                  style={styles.logo}
                  resizeMode="contain"
                  accessibilityLabel="MonteSkolar logo"
                />
              </Animated.View>
            </View>
            <Animated.View style={[styles.brandText, brandStyle]}>
              <Text style={[styles.title, { color: primary }]}>MonteSkolar</Text>
              <View style={styles.subtitleMargin}>
                <Text style={[styles.subtitle, { color: body }]}>
                  Your AI-Powered Research Library
                </Text>
              </View>
            </Animated.View>
          </View>

          {/* Action Section (Buttons) */}
          <Animated.View style={[styles.actionBlock, actionsStyle]}>
            <View style={styles.actionStack}>
              <Pressable
                onPress={onLogin}
                accessibilityRole="button"
                accessibilityLabel="Login"
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: primary },
                  pressed && styles.pressed,
                ]}>
                <Text style={[styles.buttonText, { color: onPrimary }]}>Login</Text>
              </Pressable>
              <Pressable
                onPress={onSignUp}
                accessibilityRole="button"
                accessibilityLabel="Sign Up"
                style={({ pressed }) => [
                  styles.outlineButton,
                  { borderColor: primary },
                  pressed && styles.pressed,
                ]}>
                <Text style={[styles.buttonText, { color: primary }]}>Sign Up</Text>
              </Pressable>
              <View style={styles.troubleWrap}>
                <Pressable
                  onPress={onTroublePress}
                  accessibilityRole="link"
                  accessibilityLabel="Trouble accessing your account?">
                  <Text style={[styles.troubleText, { color: body }]}>
                    Trouble accessing your account?
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Footer Section (Institutional Credit) */}
            <Animated.View style={[styles.footer, footerStyle]}>
              <MaterialIcons name="verified" size={13} color={body} />
              <Text style={[styles.footerText, { color: body }]}>
                Powered by Research &amp; Development Office
              </Text>
            </Animated.View>
          </Animated.View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  topWash: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
  },
  topGlow: {
    width: 420,
    height: 280,
    marginTop: -140,
    borderRadius: 210,
    backgroundColor: '#99f5cb',
    opacity: 0.12,
  },
  motifLeft: {
    position: 'absolute',
    top: 64,
    left: 24,
    opacity: 0.06,
    alignItems: 'center',
  },
  motifRight: {
    position: 'absolute',
    top: 88,
    right: 28,
    opacity: 0.06,
    alignItems: 'center',
  },
  motifRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 6,
    borderColor: '#1b1b1c',
  },
  motifDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1b1b1c',
    marginTop: 10,
  },
  motifBar: {
    width: 56,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#1b1b1c',
    marginTop: 10,
  },
  safe: {
    flex: 1,
  },
  canvas: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 96,
    paddingHorizontal: 16,
    paddingBottom: 48,
  },
  brandBlock: {
    alignItems: 'center',
    paddingTop: 88,
  },
  logoMargin: {
    paddingBottom: 24,
  },
  logoShadow: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    // Figma: 0/20/13 @ 3% + 0/8/5 @ 8%
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 13,
    elevation: 6,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  brandText: {
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '700',
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  subtitleMargin: {
    paddingTop: 8,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
    textAlign: 'center',
    opacity: 0.8,
  },
  actionBlock: {
    alignSelf: 'stretch',
    paddingBottom: 44,
    gap: 40,
  },
  actionStack: {
    alignSelf: 'stretch',
    gap: 16,
  },
  primaryButton: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  outlineButton: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  buttonText: {
    fontSize: 14,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 0.14,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
  troubleWrap: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingTop: 22,
    paddingBottom: 4,
  },
  troubleText: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    opacity: 0.6,
  },
  footerText: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});
