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
import { OTP_LENGTH, type OtpService } from '@monteai/api';
import { otpService as defaultOtpService } from '@/lib/otpService';
import type { CreateStudentDto } from '@monteai/types';
import { Spacing, Radius, FontSize } from '@/constants/theme';
import { TextField } from '@/components/ui/TextField';
import { SelectDropdown } from '@/components/ui/SelectDropdown';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { FormField } from '@/components/ui/FormField';

// ── Constants ──────────────────────────────────────────────────────
const ALLOWED_EMAIL_DOMAIN = '@student.pnm.edu.ph';

const INSTITUTES = [
  'Institute of Computing Studies',
  'Institute of Teaching Education',
  'Institute of Business and Entrepreneurship',
];

const PROGRAMS = ['BS Information Technology', 'BS Computer Science', 'BS Data Science'];

const YEAR_LEVELS = [
  { label: '1st Year', value: 1 },
  { label: '2nd Year', value: 2 },
  { label: '3rd Year', value: 3 },
  { label: '4th Year', value: 4 },
] as const;

const DEFAULT_POSITION = 'Member';
const TOTAL_FORM_STEPS = 5;

// ── Types ──────────────────────────────────────────────────────────
export type SignUpPayload = Omit<CreateStudentDto, 'id' | 'groupId'> & {
  fullName: string;
  password: string;
  otp: string;
};

interface SignUpFlowProps {
  onExit?: () => void;
  onLoginPress?: () => void;
  onResendCode?: (email: string) => void | Promise<void>;
  otpService?: OtpService;
  onComplete?: (payload: SignUpPayload) => void;
  initialStep?: number;
}

// ── Small local pieces ─────────────────────────────────────────────
function StepDots({ step }: { step: number }) {
  const primary = useThemeColor({}, 'primary');
  return (
    <View style={s.dotsRow}>
      {Array.from({ length: TOTAL_FORM_STEPS }, (_, i) => (
        <View key={i} style={[s.dot, { backgroundColor: i < step ? primary : '#d1d5db' }]} />
      ))}
    </View>
  );
}

// ── Component ──────────────────────────────────────────────────────
export default function SignUpFlow({
  onExit,
  onLoginPress,
  onResendCode,
  otpService,
  onComplete,
  initialStep = 1,
}: SignUpFlowProps) {
  const activeOtpService = otpService ?? defaultOtpService;

  const [step, setStep] = useState(initialStep);
  const [firstName, setFirstName] = useState('');
  const [middleInitial, setMiddleInitial] = useState('');
  const [lastName, setLastName] = useState('');
  const [suffix, setSuffix] = useState('');
  const [institute, setInstitute] = useState('');
  const [program, setProgram] = useState('');
  const [yearLevel, setYearLevel] = useState<number>(0);
  const [section, setSection] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [codeSent, setCodeSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const background = useThemeColor({}, 'background');
  const primary = useThemeColor({}, 'primary');
  const heading = useThemeColor({}, 'onSurface');
  const body = useThemeColor({}, 'onSurfaceVariant');
  const surface = useThemeColor({}, 'surface');
  const outline = useThemeColor({}, 'outlineVariant');

  // ── Handlers ─────────────────────────────────────────────────────
  const goBack = () => {
    if (step > 1) { setErrors({}); setStep((p) => p - 1); }
    else onExit?.();
  };

  const validateStep = (): boolean => {
    const next: Record<string, string> = {};
    if (step === 2) {
      if (!firstName.trim()) next.firstName = 'First name is required.';
      if (!lastName.trim()) next.lastName = 'Last name is required.';
    } else if (step === 3) {
      if (!institute) next.institute = 'Select your institute.';
      if (!program) next.program = 'Select your program.';
      if (!yearLevel) next.yearLevel = 'Select your year level.';
      if (!section.trim()) next.section = 'Section is required (e.g. A).';
      else if (!/^[A-Za-z]$/.test(section.trim())) next.section = 'Use a single letter (e.g. A).';
    } else if (step === 4) {
      if (!studentNumber.trim()) next.studentNumber = 'Student number is required.';
      if (password.length < 8) next.password = 'Minimum 8 characters.';
      if (confirmPassword !== password) next.confirmPassword = 'Passwords do not match.';
    } else if (step === 5) {
      const value = email.trim().toLowerCase();
      if (!value) next.email = 'Email is required.';
      else if (!value.endsWith(ALLOWED_EMAIL_DOMAIN)) next.email = `Only accept ${ALLOWED_EMAIL_DOMAIN} emails.`;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const buildPayload = (): SignUpPayload => {
    const mi = middleInitial.trim().toUpperCase().slice(0, 1);
    const cleanSuffix = suffix.trim();
    const cleanSection = section.trim().toUpperCase();
    const fullName = `${firstName.trim()}${mi ? ` ${mi}.` : ''} ${lastName.trim()}${cleanSuffix ? ` ${cleanSuffix}` : ''}`
      .replace(/\s+/g, ' ').trim();
    return {
      fullName, firstName: firstName.trim(), middleInitial: mi || undefined,
      lastName: lastName.trim(), suffix: cleanSuffix || undefined,
      studentNumber: studentNumber.trim(), email: email.trim(),
      institute, program, position: DEFAULT_POSITION, yearLevel,
      section: cleanSection, password, otp: otp.trim(),
    };
  };

  const handleNext = async () => {
    if (!validateStep()) return;
    if (step < TOTAL_FORM_STEPS) { setStep((p) => p + 1); return; }
    setSending(true);
    try {
      const ok = onResendCode ? (await onResendCode(email.trim()), true) : await activeOtpService.sendOtp(email.trim());
      if (!ok) { setErrors({ email: 'Could not send the verification code. Try again.' }); return; }
      setErrors({}); setCodeSent(true); setStep(6);
    } catch {
      setErrors({ email: 'Could not send the verification code. Check your connection and try again.' });
    } finally { setSending(false); }
  };

  const handleResend = async () => {
    if (sending) return;
    setSending(true);
    try {
      const ok = onResendCode ? (await onResendCode(email.trim()), true) : await activeOtpService.resendOtp(email.trim());
      if (!ok) { setErrors({ otp: 'Could not resend the code. Try again.' }); return; }
      setErrors({}); setCodeSent(true);
    } catch {
      setErrors({ otp: 'Could not resend the code. Check your connection and try again.' });
    } finally { setSending(false); }
  };

  const handleVerify = async () => {
    if (otp.trim().length !== OTP_LENGTH) { setErrors({ otp: `Enter the ${OTP_LENGTH}-digit code sent to your email.` }); return; }
    if (onResendCode) { setErrors({}); onComplete?.(buildPayload()); return; }
    setVerifying(true);
    try {
      const ok = await activeOtpService.verifyOtp({ email: email.trim(), otp: otp.trim() });
      if (!ok) { setErrors({ otp: 'Incorrect or expired code. Check it and try again.' }); return; }
      setErrors({}); onComplete?.(buildPayload());
    } catch {
      setErrors({ otp: 'Could not verify the code. Check your connection and try again.' });
    } finally { setVerifying(false); }
  };

  // ── Render ───────────────────────────────────────────────────────
  return (
    <View style={[s.root, { backgroundColor: background }]}>
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* ── Top nav ── */}
          <View style={s.nav}>
            <Pressable onPress={goBack} accessibilityRole="button" accessibilityLabel={step > 1 ? 'Go back' : 'Back'} hitSlop={12} style={s.navBtn}>
              <MaterialIcons name="chevron-left" size={26} color={heading} />
            </Pressable>
            <View style={s.flex} />
            <Pressable onPress={onExit} accessibilityRole="button" accessibilityLabel="Close" hitSlop={12} style={s.navBtn}>
              <MaterialIcons name="close" size={22} color={heading} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* ── Step 1: Welcome ── */}
            {step === 1 ? (
              <View style={s.welcome}>
                <Image source={require('@/assets/images/cdm-logo.png')} style={s.logo} resizeMode="contain" accessibilityLabel="Colegio de Montalban logo" />
                <Text style={[s.brand, { color: primary }]}>MonteSkolar</Text>
                <Text style={[s.subhead, { color: body }]}>Online Thesis Library System</Text>
                <View style={s.heroMargin}>
                  <Text style={[s.hero, { color: heading }]}>Create your{'\n'}account</Text>
                  <Text style={[s.desc, { color: body }]}>Join MonteSkolar and{'\n'}access a world of research,{'\n'}knowledge and innovation.</Text>
                </View>
              </View>

            /* ── Step 6: OTP verify ── */
            ) : step === 6 ? (
              <View style={s.stepBody}>
                <View style={s.iconBadge}>
                  <MaterialIcons name="mark-email-read" size={32} color={primary} />
                </View>
                <Text style={[s.stepHeader, { color: heading }]}>Verify your email</Text>
                <Text style={[s.stepHint, { color: body }]}>
                  We sent a verification code to{'\n'}
                  <Text style={{ fontWeight: '600', color: heading }}>{email.trim()}</Text>
                </Text>
                <FormField label="Verification code" icon="password" error={errors.otp}>
                  <TextInput
                    value={otp}
                    onChangeText={setOtp}
                    placeholder={`Enter ${OTP_LENGTH}-digit code`}
                    placeholderTextColor="#9ca3af"
                    keyboardType="number-pad"
                    maxLength={OTP_LENGTH}
                    autoComplete="one-time-code"
                    style={[s.otpInput, { backgroundColor: surface, borderColor: errors.otp ? '#ba1a1a' : outline, color: heading }]}
                  />
                </FormField>
                {codeSent ? (
                  <Text style={[s.stepHint, { color: body }]}>
                    Didn&apos;t get the code?{' '}
                    {sending
                      ? <Text style={{ color: primary, fontWeight: '600' }}>Sending…</Text>
                      : <Text onPress={handleResend} style={{ color: primary, fontWeight: '600' }}>Resend</Text>}
                  </Text>
                ) : null}
              </View>

            /* ── Steps 2-5: Form fields ── */
            ) : (
              <View style={s.stepBody}>
                <Text style={[s.stepHeader, { color: heading }]}>Create your account</Text>
                <Text style={[s.stepOf, { color: '#6b7280' }]}>Step {step} of {TOTAL_FORM_STEPS}</Text>
                <StepDots step={step} />

                {step === 2 && (
                  <>
                    <TextField label="First name" icon="person" value={firstName} onChangeText={setFirstName} placeholder="Enter your first name" autoCapitalize="words" error={errors.firstName} />
                    <TextField label="Middle Initial" icon="person-outline" value={middleInitial} onChangeText={(v) => setMiddleInitial(v.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 1))} placeholder="Enter your middle initial" autoCapitalize="characters" maxLength={1} />
                    <TextField label="Last name" icon="person" value={lastName} onChangeText={setLastName} placeholder="Enter your last name" autoCapitalize="words" error={errors.lastName} />
                    <TextField label="Suffix (optional)" icon="person-outline" value={suffix} onChangeText={(v) => setSuffix(v.replace(/\s/g, '').slice(0, 4))} placeholder="Jr, Sr, II, III" autoCapitalize="characters" maxLength={4} />
                  </>
                )}

                {step === 3 && (
                  <>
                    <SelectDropdown label="Institute" icon="business" value={institute} placeholder="Select your institute" options={INSTITUTES} onSelect={setInstitute} error={errors.institute} />
                    <SelectDropdown label="Program" icon="school" value={program} placeholder="Select your program" options={PROGRAMS} onSelect={setProgram} error={errors.program} />
                    <SelectDropdown
                      label="Year level" icon="calendar-month"
                      value={YEAR_LEVELS.find((y) => y.value === yearLevel)?.label ?? ''}
                      placeholder="Select year level"
                      options={YEAR_LEVELS.map((y) => y.label)}
                      onSelect={(label) => { const m = YEAR_LEVELS.find((y) => y.label === label); if (m) setYearLevel(m.value); }}
                      error={errors.yearLevel}
                    />
                    <TextField label="Section" icon="group" value={section} onChangeText={(v) => setSection(v.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 1))} placeholder="e.g. A" autoCapitalize="characters" maxLength={1} error={errors.section} />
                  </>
                )}

                {step === 4 && (
                  <>
                    <TextField label="Student Number" icon="badge" value={studentNumber} onChangeText={setStudentNumber} placeholder="e.g. 00-00000" error={errors.studentNumber} />
                    {/* Password fields need a show/hide toggle — keep inline */}
                    <FormField label="Password" icon="lock" error={errors.password}>
                      <View style={[s.inputRow, { backgroundColor: surface, borderColor: errors.password ? '#ba1a1a' : outline }]}>
                        <TextInput value={password} onChangeText={setPassword} placeholder="Create a password" placeholderTextColor="#9ca3af" secureTextEntry={!showPassword} autoCapitalize="none" style={[s.inputFlex, { color: heading }]} />
                        <Pressable onPress={() => setShowPassword((p) => !p)} accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} hitSlop={8}>
                          <MaterialIcons name={showPassword ? 'visibility-off' : 'visibility'} size={20} color="#6b7280" />
                        </Pressable>
                      </View>
                      {!errors.password ? <Text style={[s.hint, { color: '#6b7280' }]}>Minimum 8 characters</Text> : null}
                    </FormField>
                    <FormField label="Confirm Password" icon="lock-outline" error={errors.confirmPassword}>
                      <View style={[s.inputRow, { backgroundColor: surface, borderColor: errors.confirmPassword ? '#ba1a1a' : outline }]}>
                        <TextInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm your password" placeholderTextColor="#9ca3af" secureTextEntry={!showConfirmPassword} autoCapitalize="none" style={[s.inputFlex, { color: heading }]} />
                        <Pressable onPress={() => setShowConfirmPassword((p) => !p)} accessibilityLabel={showConfirmPassword ? 'Hide password' : 'Show password'} hitSlop={8}>
                          <MaterialIcons name={showConfirmPassword ? 'visibility-off' : 'visibility'} size={20} color="#6b7280" />
                        </Pressable>
                      </View>
                    </FormField>
                  </>
                )}

                {step === 5 && (
                  <>
                    <TextField label="Email" icon="mail" value={email} onChangeText={setEmail} placeholder={`Enter your ${ALLOWED_EMAIL_DOMAIN}`} keyboardType="email-address" autoComplete="email" error={errors.email} />
                    {!errors.email ? <Text style={[s.hint, { color: '#6b7280' }]}>Only accept {ALLOWED_EMAIL_DOMAIN} emails</Text> : null}
                  </>
                )}
              </View>
            )}

            {/* ── Actions ── */}
            <View style={s.actions}>
              {step === 6 ? (
                <PrimaryButton label={verifying ? 'Verifying…' : 'Verify'} onPress={handleVerify} disabled={verifying} loading={verifying} accessibilityLabel="Verify email" />
              ) : (
                <PrimaryButton
                  label={step === TOTAL_FORM_STEPS ? (sending ? 'Sending code…' : 'Create Account') : 'Next'}
                  onPress={handleNext} disabled={sending} loading={sending}
                  accessibilityLabel={step === TOTAL_FORM_STEPS ? 'Create Account' : 'Next'}
                />
              )}
              {step === TOTAL_FORM_STEPS ? (
                <Text style={[s.loginRow, { color: body }]}>
                  Already have an account?{' '}
                  <Text onPress={onLoginPress} style={[s.loginLink, { color: primary }]}>Login here</Text>
                </Text>
              ) : null}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  flex: { flex: 1 },
  nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.xs, paddingVertical: Spacing.xs },
  navBtn: { padding: Spacing.sm },
  content: { flexGrow: 1, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xxl },
  // Welcome
  welcome: { alignItems: 'flex-start', paddingTop: Spacing.sm },
  logo: { width: 72, height: 72, marginBottom: Spacing.lg },
  brand: { fontSize: FontSize.xxl, fontWeight: '600' },
  subhead: { fontSize: FontSize.sm, marginTop: Spacing.xxs },
  heroMargin: { marginTop: Spacing.xxl, gap: Spacing.sm },
  hero: { fontSize: FontSize.display, lineHeight: 44 },
  desc: { fontSize: FontSize.md, lineHeight: 23 },
  // Steps
  stepBody: { paddingTop: Spacing.sm, gap: Spacing.lg },
  stepHeader: { fontSize: FontSize.xxl, textAlign: 'center' },
  stepOf: { fontSize: FontSize.sm, textAlign: 'center' },
  stepHint: { fontSize: FontSize.sm, lineHeight: 20, textAlign: 'center' },
  // Dots
  dotsRow: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginBottom: Spacing.sm },
  dot: { width: 32, height: 4, borderRadius: 2 },
  // OTP
  iconBadge: { alignSelf: 'center', width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: '#dcfce7' },
  otpInput: { borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg, fontSize: FontSize.xl, letterSpacing: 6, textAlign: 'center' },
  // Password row
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg, justifyContent: 'space-between' },
  inputFlex: { flex: 1, fontSize: FontSize.md, paddingRight: Spacing.sm },
  hint: { fontSize: FontSize.sm },
  // Actions
  actions: { marginTop: Spacing.xxl, gap: Spacing.lg },
  loginRow: { fontSize: FontSize.md, textAlign: 'center' },
  loginLink: { fontWeight: '600' },
});
