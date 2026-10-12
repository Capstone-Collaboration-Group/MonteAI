import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { MfaEnrollResponse, MfaStatusResponse } from '@monteai/types';
import { mfaService } from '@/lib/mfaService';
import { storeMfaTokens } from '@/lib/mfaSession';
import { useThemeColor } from '@/hooks/use-theme-color';

type Mode = 'idle' | 'enroll' | 'disable' | 'regenerate';

export default function MfaSecuritySection() {
  const heading = useThemeColor({}, 'text');
  const body = useThemeColor({}, 'icon');
  const primary = useThemeColor({}, 'primary');
  const border = useThemeColor({}, 'outline');
  const [status, setStatus] = useState<MfaStatusResponse | null>(null);
  const [enrollment, setEnrollment] = useState<MfaEnrollResponse | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [mode, setMode] = useState<Mode>('idle');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reloadStatus = async () => {
    const next = await mfaService.status();
    setStatus(next);
  };

  useEffect(() => {
    let active = true;
    mfaService.status()
      .then((next) => {
        if (active) setStatus(next);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Could not load two-factor status.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const startEnrollment = async () => {
    setLoading(true);
    setError(null);
    try {
      setEnrollment(await mfaService.enroll());
      setMode('enroll');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start authenticator setup.');
    } finally {
      setLoading(false);
    }
  };

  const submitCode = async () => {
    if (!code.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      if (mode === 'enroll') {
        const result = await mfaService.confirmEnroll({ code: code.trim() });
        await storeMfaTokens({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresAt: result.expiresAt,
        });
        setRecoveryCodes(result.recoveryCodes);
        setEnrollment(null);
      } else if (mode === 'disable') {
        await mfaService.disable({ code: code.trim() });
      } else if (mode === 'regenerate') {
        const result = await mfaService.regenerateRecoveryCodes({ code: code.trim() });
        setRecoveryCodes(result.recoveryCodes);
      }
      setCode('');
      setMode('idle');
      await reloadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The code could not be verified.');
    } finally {
      setLoading(false);
    }
  };

  const cancelStep = () => {
    setMode('idle');
    setEnrollment(null);
    setCode('');
    setError(null);
  };

  return (
    <View style={[styles.card, { borderColor: border }]}>
      <Text style={[styles.title, { color: heading }]}>Two-Factor Authentication</Text>
      <Text style={[styles.description, { color: body }]}>
        Use an authenticator app and a one-time code to protect sign-in.
      </Text>

      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      {loading && !status && !enrollment ? (
        <ActivityIndicator color={primary} />
      ) : mode === 'enroll' && enrollment ? (
        <View style={styles.stack}>
          <Text style={[styles.description, { color: body }]}>
            Add an account in your authenticator app using this setup key:
          </Text>
          <Text selectable style={[styles.secret, { color: heading, borderColor: border }]}>
            {enrollment.secret}
          </Text>
          <Text selectable style={[styles.uri, { color: body }]}>{enrollment.otpauthUri}</Text>
          <TextInput
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            maxLength={8}
            placeholder="6-digit code"
            style={[styles.input, { color: heading, borderColor: border }]}
          />
          <View style={styles.actions}>
            <ActionButton title="Verify and enable" onPress={() => void submitCode()} disabled={loading || code.trim().length < 6} primary={primary} />
            <ActionButton title="Cancel" onPress={cancelStep} disabled={loading} primary={primary} secondary />
          </View>
        </View>
      ) : mode === 'disable' || mode === 'regenerate' ? (
        <View style={styles.stack}>
          <Text style={[styles.description, { color: body }]}>
            Enter a code from your authenticator app to {mode === 'disable' ? 'disable two-factor authentication' : 'replace your recovery codes'}.
          </Text>
          <TextInput
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            maxLength={8}
            placeholder="6-digit code"
            style={[styles.input, { color: heading, borderColor: border }]}
          />
          <View style={styles.actions}>
            <ActionButton title={mode === 'disable' ? 'Disable' : 'Regenerate'} onPress={() => void submitCode()} disabled={loading || code.trim().length < 6} primary={primary} />
            <ActionButton title="Cancel" onPress={cancelStep} disabled={loading} primary={primary} secondary />
          </View>
        </View>
      ) : (
        <View style={styles.stack}>
          <Text style={[styles.status, { color: heading }]}>
            {status?.totpEnabled ? 'Two-factor authentication is on' : 'Two-factor authentication is off'}
          </Text>
          {status?.totpEnabled ? (
            <>
              <Text style={[styles.description, { color: body }]}>
                {status.recoveryCodesRemaining} recovery code(s) remain.
              </Text>
              <View style={styles.actions}>
                <ActionButton title="Regenerate codes" onPress={() => setMode('regenerate')} disabled={loading} primary={primary} secondary />
                <ActionButton title="Disable" onPress={() => setMode('disable')} disabled={loading} primary={primary} secondary />
              </View>
            </>
          ) : (
            <ActionButton title="Set up authenticator" onPress={() => void startEnrollment()} disabled={loading} primary={primary} />
          )}
        </View>
      )}

      {recoveryCodes ? (
        <View style={[styles.recoveryBox, { borderColor: border }]}>
          <Text style={[styles.status, { color: heading }]}>Save these recovery codes now</Text>
          <Text style={[styles.description, { color: body }]}>
            Each code works once. They will not be shown again after leaving this screen.
          </Text>
          {recoveryCodes.map((recoveryCode) => (
            <Text key={recoveryCode} selectable style={[styles.secret, { color: heading }]}>
              {recoveryCode}
            </Text>
          ))}
          <ActionButton title="I saved my codes" onPress={() => setRecoveryCodes(null)} disabled={false} primary={primary} secondary />
        </View>
      ) : null}
    </View>
  );
}

function ActionButton({
  title,
  onPress,
  disabled,
  primary,
  secondary = false,
}: {
  title: string;
  onPress: () => void;
  disabled: boolean;
  primary: string;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        { backgroundColor: secondary ? 'transparent' : primary, borderColor: primary },
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.buttonText, { color: secondary ? primary : '#fff' }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: 16, marginTop: 20 },
  title: { fontSize: 18, fontWeight: '700' },
  description: { fontSize: 13, lineHeight: 19 },
  status: { fontSize: 15, fontWeight: '600' },
  stack: { gap: 12, marginTop: 14 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { minHeight: 42, justifyContent: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  buttonText: { fontWeight: '600' },
  disabled: { opacity: 0.5 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  secret: { borderWidth: 1, borderRadius: 8, padding: 10, fontFamily: 'monospace', fontSize: 14 },
  uri: { fontSize: 11 },
  error: { color: '#b91c1c', marginTop: 10 },
  recoveryBox: { gap: 8, marginTop: 16, borderWidth: 1, borderRadius: 10, padding: 12 },
});
