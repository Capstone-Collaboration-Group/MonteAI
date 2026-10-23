import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '@/components/ui/ScaledText';

import LoginScreen, { type LoginCredentials } from '@/components/LoginScreen';
import { useAuthSession } from '@/contexts/AuthSessionContext';
import { EMAIL_NOT_VERIFIED_CODE, describeAuthError } from '@/lib/authService';

/**
 * Login route — Figma "Login" (node 448:487).
 * Students sign in with their student number; the auth service resolves it
 * to the Firebase email (via /auth/resolve-login) and runs the standard
 * Firebase email/password sign-in. Unverified emails are blocked here with
 * a "Resend verification email" action.
 */
export default function LoginRoute() {
  const router = useRouter();
  const {
    signInWithStudentNumber,
    resendVerification,
    mfaPending,
    verifyMfa,
    cancelMfa,
  } = useAuthSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorAction, setErrorAction] = useState<{
    label: string;
    onPress: () => void;
  } | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [recoveryMode, setRecoveryMode] = useState(false);

  const handleResendVerification = useCallback(async () => {
    try {
      await resendVerification();
      Alert.alert(
        'Verification email sent',
        'Open the link in your inbox, then try signing in again.',
      );
    } catch (err) {
      Alert.alert('Could not send email', describeAuthError(err));
    }
  }, [resendVerification]);

  const handleLogin = async (credentials: LoginCredentials) => {
    setLoading(true);
    setError(null);
    setErrorAction(null);
    try {
      const requiresMfa = await signInWithStudentNumber(
        credentials.studentNumber,
        credentials.password,
      );
      if (!requiresMfa) router.replace('/(tabs)/home');
    } catch (err) {
      setError(describeAuthError(err));
      const code = (err as { code?: string } | null | undefined)?.code;
      if (code === EMAIL_NOT_VERIFIED_CODE) {
        setErrorAction({
          label: 'Resend verification email',
          onPress: handleResendVerification,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMfa = async () => {
    if (loading || !mfaCode.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await verifyMfa(mfaCode.trim());
      router.replace('/(tabs)/home');
    } catch (err) {
      setError(describeAuthError(err));
      setMfaCode('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      {mfaPending ? (
        <View style={styles.mfaContainer}>
          <Text style={styles.mfaTitle}>Two-factor authentication</Text>
          <Text style={styles.mfaDescription}>
            {recoveryMode
              ? 'Enter one of your saved recovery codes.'
              : 'Enter the 6-digit code from your authenticator app.'}
          </Text>
          <TextInput
            value={mfaCode}
            onChangeText={setMfaCode}
            autoCapitalize="characters"
            autoComplete="one-time-code"
            keyboardType={recoveryMode ? 'default' : 'number-pad'}
            placeholder={recoveryMode ? 'XXXXX-XXXXX' : '000000'}
            maxLength={recoveryMode ? 24 : 6}
            accessibilityLabel={recoveryMode ? 'Recovery code' : 'Authenticator code'}
            onSubmitEditing={() => void handleVerifyMfa()}
            style={styles.mfaInput}
          />
          {error ? <Text style={styles.mfaError}>{error}</Text> : null}
          <Pressable
            onPress={() => void handleVerifyMfa()}
            disabled={loading || (recoveryMode ? mfaCode.trim().length < 8 : mfaCode.length !== 6)}
            style={[styles.mfaButton, loading && styles.disabled]}
          >
            <Text style={styles.mfaButtonText}>{loading ? 'Verifying...' : 'Verify'}</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setRecoveryMode((current) => !current);
              setMfaCode('');
              setError(null);
            }}
            style={styles.mfaLink}
          >
            <Text style={styles.mfaLinkText}>
              {recoveryMode ? 'Use authenticator code' : 'Use a recovery code'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setError(null);
              setMfaCode('');
              void cancelMfa();
            }}
            disabled={loading}
            style={styles.mfaLink}
          >
            <Text style={styles.mfaLinkText}>Use a different account</Text>
          </Pressable>
        </View>
      ) : (
        <LoginScreen
          onBack={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/auth-entry');
          }}
          onLogin={handleLogin}
          onSignUpPress={() => router.push('/sign-up')}
          onForgotPress={() => router.push('/forgot-password')}
          loading={loading}
          error={error}
          errorAction={errorAction}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  mfaContainer: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  mfaTitle: { marginBottom: 8, fontSize: 24, fontWeight: '700', color: '#171717' },
  mfaDescription: { marginBottom: 24, fontSize: 16, color: '#666' },
  mfaInput: {
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 18,
    color: '#171717',
  },
  mfaError: { marginBottom: 16, color: '#b91c1c' },
  mfaButton: {
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#005d41',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  disabled: { opacity: 0.5 },
  mfaButtonText: { color: '#fff', fontWeight: '600' },
  mfaLink: { alignItems: 'center', marginTop: 16, paddingVertical: 8 },
  mfaLinkText: { color: '#005d41', fontWeight: '600' },
});
