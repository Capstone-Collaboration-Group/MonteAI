import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useThemeColor } from '@/hooks/use-theme-color';
import { sendPasswordReset, describeAuthError } from '@/lib/authService';

interface ForgotPasswordScreenProps {
  onBack?: () => void;
}

/** Reset-specific copy; falls back to the shared auth error describer. */
function describeResetError(err: unknown): string {
  const code = (err as { code?: string } | null | undefined)?.code;
  switch (code) {
    case 'auth/user-not-found':
      return 'No account is associated with that email address.';
    case 'auth/invalid-email':
    case 'auth/missing-email':
      return 'That email address is not valid.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again in a few minutes.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    default:
      return describeAuthError(err);
  }
}

/**
 * Forgot-password screen — same visual language as LoginScreen (brand
 * header, decorative ellipses, input rows). The user enters the email
 * associated with their account and the Firebase password-reset link is
 * sent there. A success view shows where the link was sent until the
 * user goes back.
 */
export default function ForgotPasswordScreen({ onBack }: ForgotPasswordScreenProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const background = useThemeColor(
    { light: '#f1f1f1', dark: '#151718' },
    'background',
  );
  const surface = useThemeColor({ light: '#fafafa', dark: '#1f2122' }, 'surface');
  const primary = useThemeColor({}, 'primary');
  const onPrimary = useThemeColor({}, 'onPrimary');
  const heading = useThemeColor({}, 'onSurface');
  const body = useThemeColor({}, 'onSurfaceVariant');
  const inputBorder = useThemeColor({ light: '#88ae8a', dark: '#3e4943' }, 'outlineVariant');

  const handleSend = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setFieldError('Email address is required.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setFieldError('That email address is not valid.');
      return;
    }
    setFieldError(null);
    setError(null);
    setLoading(true);
    try {
      const sent = await sendPasswordReset(trimmed);
      setSentTo(sent);
    } catch (err) {
      setError(describeResetError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: background }]}>
      {/* Decorative ellipses (same as LoginScreen) */}
      <View pointerEvents="none" style={styles.decorTop} />
      <View pointerEvents="none" style={styles.decorBottom} />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {onBack ? (
            <View style={styles.nav}>
              <Pressable
                onPress={onBack}
                accessibilityRole="button"
                accessibilityLabel="Go back"
                hitSlop={12}
                style={styles.navButton}>
                <MaterialIcons name="chevron-left" size={26} color={heading} />
              </Pressable>
              <View style={styles.flex} />
            </View>
          ) : null}

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {/* Brand */}
            <View style={styles.brand}>
              <Image
                source={require('@/assets/images/cdm-logo.png')}
                style={styles.logo}
                resizeMode="contain"
                accessibilityLabel="Colegio de Montalban logo"
              />
              <Text style={[styles.brandName, { color: heading }]}>MonteSkolar</Text>
              <Text style={[styles.brandTag, { color: body }]}>AI-Powered Thesis Library</Text>
            </View>

            {/* Ornamental divider */}
            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: inputBorder }]} />
              <MaterialIcons name="menu-book" size={16} color={primary} />
              <View style={[styles.dividerLine, { backgroundColor: inputBorder }]} />
            </View>

            {sentTo ? (
              <>
                <View style={styles.successIcon}>
                  <MaterialIcons name="mark-email-read" size={28} color={primary} />
                </View>
                <Text style={[styles.welcome, { color: '#3c3c3c' }]}>Check your inbox</Text>
                <Text style={[styles.welcomeSub, { color: body }]}>
                  We sent a password reset link to{' '}
                  <Text style={[styles.sentEmail, { color: heading }]}>{sentTo}</Text>. Open it
                  in your inbox to choose a new password.
                </Text>
                <Pressable
                  onPress={onBack}
                  accessibilityRole="button"
                  accessibilityLabel="Back to login"
                  style={({ pressed }) => [
                    styles.sendButton,
                    { backgroundColor: primary },
                    pressed && styles.pressed,
                  ]}>
                  <Text style={[styles.sendText, { color: onPrimary }]}>Back to Login</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={[styles.welcome, { color: '#3c3c3c' }]}>Forgot Password?</Text>
                <Text style={[styles.welcomeSub, { color: body }]}>
                  Enter the email address associated with your account and we&apos;ll send
                  you a link to reset your password.
                </Text>

                {/* Email */}
                <View style={styles.field}>
                  <Text style={[styles.label, { color: heading }]}>Email Address</Text>
                  <View
                    style={[
                      styles.input,
                      {
                        backgroundColor: surface,
                        borderColor: fieldError ? '#ba1a1a' : inputBorder,
                      },
                    ]}>
                    <MaterialIcons name="mail" size={18} color="#15803d" />
                    <TextInput
                      value={email}
                      onChangeText={(value) => {
                        setEmail(value);
                        setFieldError(null);
                        setError(null);
                      }}
                      placeholder="Enter your email address"
                      placeholderTextColor="#bcbdc0"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="email"
                      returnKeyType="send"
                      onSubmitEditing={() => void handleSend()}
                      style={[styles.textInput, { color: heading }]}
                    />
                  </View>
                  {fieldError ? <Text style={styles.errorText}>{fieldError}</Text> : null}
                </View>

                {error ? <Text style={[styles.errorText, styles.formError]}>{error}</Text> : null}

                <Pressable
                  onPress={() => void handleSend()}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel="Send reset link"
                  style={({ pressed }) => [
                    styles.sendButton,
                    { backgroundColor: primary },
                    (pressed || loading) && styles.pressed,
                  ]}>
                  <Text style={[styles.sendText, { color: onPrimary }]}>
                    {loading ? 'Sending...' : 'Send Reset Link'}
                  </Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  decorTop: {
    position: 'absolute',
    top: -110,
    right: -90,
    width: 280,
    height: 271,
    borderRadius: 140,
    backgroundColor: '#b6e3d8',
    opacity: 0.7,
  },
  decorBottom: {
    position: 'absolute',
    bottom: -40,
    left: -40,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#80cab9',
    opacity: 0.7,
  },
  safe: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  navButton: {
    padding: 8,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingBottom: 32,
  },
  brand: {
    alignItems: 'center',
    marginTop: 8,
  },
  logo: {
    width: 110,
    height: 110,
    marginBottom: 12,
  },
  brandName: {
    fontSize: 30,
    fontWeight: '700',
    textAlign: 'center',
  },
  brandTag: {
    fontSize: 12,
    marginTop: 2,
    textAlign: 'center',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  welcome: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  welcomeSub: {
    fontSize: 13,
    marginTop: 4,
    marginBottom: 20,
    textAlign: 'center',
    lineHeight: 19,
  },
  sentEmail: {
    fontWeight: '700',
  },
  successIcon: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(79, 138, 78, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  field: {
    gap: 6,
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  errorText: {
    fontSize: 12,
    color: '#ba1a1a',
  },
  formError: {
    textAlign: 'center',
    marginBottom: 12,
  },
  sendButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 8,
    marginTop: 4,
  },
  sendText: {
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
});
