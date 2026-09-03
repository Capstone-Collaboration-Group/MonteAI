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

export interface LoginCredentials {
  studentNumber: string;
  password: string;
}

interface LoginScreenProps {
  onBack?: () => void;
  onLogin?: (credentials: LoginCredentials) => void;
  onSignUpPress?: () => void;
  onForgotPress?: () => void;
  loading?: boolean;
  error?: string | null;
}

/**
 * Login screen — mirrors Figma "Login" (node 448:487): brand header,
 * "Welcome Back!" heading, student number + password fields, show-password
 * row with forgot link, Login button, sign-up footer and trust footer.
 */
export default function LoginScreen({
  onBack,
  onLogin,
  onSignUpPress,
  onForgotPress,
  loading = false,
  error = null,
}: LoginScreenProps) {
  const [studentNumber, setStudentNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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

  const handleLogin = () => {
    const next: Record<string, string> = {};
    if (!studentNumber.trim()) next.studentNumber = 'Student number is required.';
    if (!password) next.password = 'Password is required.';
    setFieldErrors(next);
    if (Object.keys(next).length > 0) return;
    onLogin?.({ studentNumber: studentNumber.trim(), password });
  };

  const toggleShowPassword = () => setShowPassword((prev) => !prev);

  return (
    <View style={[styles.root, { backgroundColor: background }]}>
      {/* Decorative ellipses (Figma Ellipse 6 / Ellipse 7) */}
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

            <Text style={[styles.welcome, { color: '#3c3c3c' }]}>Welcome Back!</Text>
            <Text style={[styles.welcomeSub, { color: body }]}>
              Sign in to continue to your account
            </Text>

            {/* Student Number */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: heading }]}>Student Number</Text>
              <View
                style={[
                  styles.input,
                  {
                    backgroundColor: surface,
                    borderColor: fieldErrors.studentNumber ? '#ba1a1a' : inputBorder,
                  },
                ]}>
                <MaterialIcons name="badge" size={18} color="#15803d" />
                <TextInput
                  value={studentNumber}
                  onChangeText={setStudentNumber}
                  placeholder="Enter your student number"
                  placeholderTextColor="#bcbdc0"
                  autoCapitalize="none"
                  autoComplete="username"
                  returnKeyType="next"
                  style={[styles.textInput, { color: heading }]}
                />
              </View>
              {fieldErrors.studentNumber ? (
                <Text style={styles.errorText}>{fieldErrors.studentNumber}</Text>
              ) : null}
            </View>

            {/* Password */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: heading }]}>Password</Text>
              <View
                style={[
                  styles.input,
                  {
                    backgroundColor: surface,
                    borderColor: fieldErrors.password ? '#ba1a1a' : inputBorder,
                  },
                ]}>
                <MaterialIcons name="lock" size={18} color="#15803d" />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  placeholderTextColor="#bcbdc0"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="password"
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  style={[styles.textInput, { color: heading }]}
                />
                <Pressable
                  onPress={toggleShowPassword}
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  hitSlop={8}>
                  <MaterialIcons
                    name={showPassword ? 'visibility-off' : 'visibility'}
                    size={18}
                    color="#6b7280"
                  />
                </Pressable>
              </View>
              {fieldErrors.password ? (
                <Text style={styles.errorText}>{fieldErrors.password}</Text>
              ) : null}
            </View>

            {/* Show password + Forgot */}
            <View style={styles.optionsRow}>
              <Pressable
                onPress={toggleShowPassword}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: showPassword }}
                accessibilityLabel="Show password"
                style={styles.checkboxRow}>
                <View
                  style={[
                    styles.checkbox,
                    {
                      borderColor: inputBorder,
                      backgroundColor: showPassword ? primary : 'transparent',
                    },
                  ]}>
                  {showPassword ? (
                    <MaterialIcons name="check" size={12} color={onPrimary} />
                  ) : null}
                </View>
                <Text style={[styles.optionsText, { color: body }]}>Show Password</Text>
              </Pressable>
              <Pressable onPress={onForgotPress} hitSlop={8}>
                <Text style={styles.forgotText}>Forgot Password?</Text>
              </Pressable>
            </View>

            {error ? <Text style={[styles.errorText, styles.formError]}>{error}</Text> : null}

            <Pressable
              onPress={handleLogin}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel="Login"
              style={({ pressed }) => [
                styles.loginButton,
                { backgroundColor: primary },
                (pressed || loading) && styles.pressed,
              ]}>
              <Text style={[styles.loginText, { color: onPrimary }]}>
                {loading ? 'Signing in...' : 'Login'}
              </Text>
            </Pressable>

            {/* or divider */}
            <View style={styles.orRow}>
              <View style={[styles.dividerLine, { backgroundColor: '#9c9c9e' }]} />
              <Text style={styles.orText}>or</Text>
              <View style={[styles.dividerLine, { backgroundColor: '#9c9c9e' }]} />
            </View>

            <Text style={[styles.registerRow, { color: heading }]}>
              Not Registered Yet?{' '}
              <Text onPress={onSignUpPress} style={styles.signUpLink}>
                Sign up!
              </Text>
            </Text>

            {/* Trust footer */}
            <View style={styles.trust}>
              <MaterialIcons name="verified-user" size={20} color={primary} />
              <Text style={styles.trustText}>Secure.Trusted.Accessible.</Text>
              <Text style={styles.trustText}>Your online library, anytime and anywhere</Text>
            </View>
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
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionsText: {
    fontSize: 12,
  },
  forgotText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#659a65',
  },
  loginButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 8,
  },
  loginText: {
    fontSize: 15,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 16,
  },
  orText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9c9c9e',
  },
  registerRow: {
    fontSize: 13,
    textAlign: 'center',
  },
  signUpLink: {
    fontWeight: '700',
    color: '#4f8a4e',
  },
  trust: {
    alignItems: 'center',
    gap: 4,
    marginTop: 28,
  },
  trustText: {
    fontSize: 11,
    color: '#999f97',
    textAlign: 'center',
  },
});
