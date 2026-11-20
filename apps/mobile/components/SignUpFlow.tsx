import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  BackHandler,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text, TextInput } from '@/components/ui/ScaledText';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';

import { useThemeColor } from '@/hooks/use-theme-color';
import { PRIVACY_NOTICE_VERSION, TERMS_AND_CONDITIONS_VERSION, type StudentRegistrationDraft } from '@monteai/types';
import type { StudentSignupFlow } from '@monteai/api';
import { isValidEmailForRole } from '@monteai/utils';
import type { PendingStudentRegistration, StudentRegistrationInput } from '@/lib/registration/pendingRegistration';
import { describeSignupAccountError, getResumeSignupStep, SIGNUP_EMAIL_STEP as VERIFY_STEP,
  SIGNUP_FORM_STEPS as TOTAL_FORM_STEPS, SIGNUP_ID_STEP as ID_STEP } from '@/lib/registration/signupSteps';
import { Spacing, Radius, FontSize } from '@/constants/theme';
import { TextField } from '@/components/ui/TextField';
import { SelectDropdown } from '@/components/ui/SelectDropdown';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { FormField } from '@/components/ui/FormField';
import SignupConsent from '@/components/SignupConsent';
import StudentIdCapture from '@/components/StudentIdCapture';

// ── Constants ──────────────────────────────────────────────────────
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
const RESEND_COOLDOWN_SECONDS = 60;
const VERIFY_POLL_INTERVAL_MS = 4000;

// ── Types ──────────────────────────────────────────────────────────
export type SignUpPayload = StudentRegistrationInput & {
  fullName: string;
};

interface SignUpFlowProps {
  flow: StudentSignupFlow;
  pendingRegistration: PendingStudentRegistration | null;
  accountReady: boolean;
  emailVerified: boolean;
  onExit?: () => void;
  onLoginPress?: () => void;
  /** Phase 1: create the Firebase account + send the verification link. */
  onBeginRegistration: (payload: SignUpPayload) => Promise<{ verificationRequired: boolean }>;
  /** Called only AFTER the memory-owned capture/registration completes. */
  onRegistered: () => void;
  ensureVerifiedAccount: () => Promise<void>;
  /** True once Firebase reports emailVerified for the current user. */
  onCheckVerification: () => Promise<boolean>;
  onResendVerification: () => Promise<void>;
  /** Explicitly cancelling signup drops the profile-only draft. */
  onCancelRegistration: () => Promise<void>;
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
  flow,
  pendingRegistration,
  accountReady,
  emailVerified,
  onExit,
  onLoginPress,
  onBeginRegistration,
  onRegistered,
  ensureVerifiedAccount,
  onCheckVerification,
  onResendVerification,
  onCancelRegistration,
  initialStep,
}: SignUpFlowProps) {
  const [step, setStep] = useState(() => initialStep ?? getResumeSignupStep(pendingRegistration, accountReady, emailVerified));
  const stepRef = useRef(step);
  const mounted = useRef(false);
  const startingRef = useRef(false);
  const checkingRef = useRef(false);
  const resendingRef = useRef(false);
  const uiRevision = useRef(0);
  const isFocused = useIsFocused();
  const focusedRef = useRef(isFocused);
  focusedRef.current = isFocused;
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [firstName, setFirstName] = useState(pendingRegistration?.firstName ?? '');
  const [middleInitial, setMiddleInitial] = useState(pendingRegistration?.middleInitial ?? '');
  const [lastName, setLastName] = useState(pendingRegistration?.lastName ?? '');
  const [suffix, setSuffix] = useState(pendingRegistration?.suffix ?? '');
  const [institute, setInstitute] = useState(pendingRegistration?.institute ?? '');
  const [program, setProgram] = useState(pendingRegistration?.program ?? '');
  const [yearLevel, setYearLevel] = useState<number>(pendingRegistration?.yearLevel ?? 0);
  const [section, setSection] = useState(pendingRegistration?.section ?? '');
  const [studentNumber, setStudentNumber] = useState(pendingRegistration?.studentNumber ?? '');
  const [position] = useState(pendingRegistration?.position ?? DEFAULT_POSITION);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState(pendingRegistration?.email ?? '');
  const [privacyAccepted, setPrivacyAccepted] = useState(!!pendingRegistration?.privacyNoticeAccepted && pendingRegistration.privacyNoticeVersion === PRIVACY_NOTICE_VERSION);
  const [termsAccepted, setTermsAccepted] = useState(!!pendingRegistration?.termsAccepted && pendingRegistration.termsVersion === TERMS_AND_CONDITIONS_VERSION);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [starting, setStarting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  const background = useThemeColor({}, 'background');
  const primary = useThemeColor({}, 'primary');
  const heading = useThemeColor({}, 'onSurface');
  const body = useThemeColor({}, 'onSurfaceVariant');
  const surface = useThemeColor({}, 'surface');
  const outline = useThemeColor({}, 'outlineVariant');

  const changeStep = useCallback((value: number) => {
    uiRevision.current++;
    stepRef.current = value;
    setStep(value);
  }, []);
  const invalidateUi = useCallback(() => { uiRevision.current++; }, []);
  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener('change', state => setAppActive(state === 'active'));
    return () => { mounted.current = false; invalidateUi(); subscription.remove(); flow.cancel(); };
  }, [flow, invalidateUi]);

  // Email verification may advance to the ID screen, NEVER to registration or
  // automatic capture. Poll only in the foreground, one Firebase check at a time.
  const checkVerification = useCallback(async (manual: boolean) => {
    if (checkingRef.current || stepRef.current !== VERIFY_STEP || !isFocused || !appActive) return;
    checkingRef.current = true;
    const revision = uiRevision.current;
    if (manual) setChecking(true);
    try {
      const ok = await onCheckVerification();
      if (!mounted.current || revision !== uiRevision.current || stepRef.current !== VERIFY_STEP || !focusedRef.current || AppState.currentState !== 'active') return;
      if (ok) { setErrors({}); changeStep(ID_STEP); }
      else if (manual) setErrors({ verify: 'Not verified yet. Open the link in your email, then try again.' });
    } catch (error) {
      if (manual && mounted.current && revision === uiRevision.current && stepRef.current === VERIFY_STEP) setErrors({ verify: describeSignupAccountError(error) });
    } finally {
      checkingRef.current = false;
      if (mounted.current) setChecking(false);
    }
  }, [appActive, changeStep, isFocused, onCheckVerification]);

  // Auto-check every few seconds while the verify step is on screen so a
  // link opened in the mail app advances the flow without a manual tap.
  useEffect(() => {
    if (step !== VERIFY_STEP || !isFocused || !appActive) return;
    const id = setInterval(() => { void checkVerification(false); }, VERIFY_POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [appActive, checkVerification, isFocused, step]);

  // Resend cooldown ticker (60s window mirroring the web/desktop flow).
  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  // ── Handlers ─────────────────────────────────────────────────────
  const goBack = useCallback(() => {
    if (flow.getState().phase === 'complete') return;
    if (startingRef.current) return;
    flow.invalidate();
    setErrors({});
    if (step === ID_STEP) { changeStep(2); return; }
    if (step === VERIFY_STEP) {
      setResendIn(0);
      changeStep(TOTAL_FORM_STEPS);
      return;
    }
    if (step > 1) {
      changeStep(step - 1);
    } else {
      uiRevision.current++;
      setPassword('');
      setConfirmPassword('');
      onExit?.();
    }
  }, [changeStep, flow, onExit, step]);

  useEffect(() => {
    if (!isFocused) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { goBack(); return true; });
    return () => listener.remove();
  }, [goBack, isFocused]);

  const exit = () => {
    uiRevision.current++;
    flow.cancel();
    setPassword('');
    setConfirmPassword('');
    onExit?.();
  };

  const login = () => {
    uiRevision.current++;
    flow.cancel();
    setPassword('');
    setConfirmPassword('');
    onLoginPress?.();
  };

  const cancelSignup = () => Alert.alert('Cancel signup?',
    'Your pending details will be removed. An unverified signup account may be deleted; a verified account is kept and signed out.',
    [{ text: 'Keep signup', style: 'cancel' }, { text: 'Cancel signup', style: 'destructive', onPress: () => {
      uiRevision.current++;
      flow.cancel();
      void onCancelRegistration().then(() => {
        if (mounted.current) {
          setPassword(''); setConfirmPassword(''); setPrivacyAccepted(false); setTermsAccepted(false);
          setErrors({}); changeStep(1);
        }
      }).catch(error => { if (mounted.current) setErrors({ verify: describeSignupAccountError(error) }); });
    } }]);

  const validateStep = (): boolean => {
    const next: Record<string, string> = {};
    if (step === 2) {
      if (!firstName.trim()) next.firstName = 'First name is required.';
      else if (firstName.trim().length > 50) next.firstName = 'Use at most 50 characters.';
      if (!lastName.trim()) next.lastName = 'Last name is required.';
      else if (lastName.trim().length > 50) next.lastName = 'Use at most 50 characters.';
      if (middleInitial && !/^[A-Za-z]$/.test(middleInitial)) next.middleInitial = 'Use one letter, or leave this empty.';
      if (suffix.trim().length > 10) next.suffix = 'Use at most 10 characters.';
    } else if (step === 3) {
      if (!institute) next.institute = 'Select your institute.';
      if (!program) next.program = 'Select your program.';
      if (!yearLevel) next.yearLevel = 'Select your year level.';
      if (!section.trim()) next.section = 'Section is required (e.g. A).';
      else if (!/^[A-Za-z]$/.test(section.trim())) next.section = 'Use a single letter (e.g. A).';
    } else if (step === 4) {
      if (!/^\d{2}-\d{5}$/.test(studentNumber.trim())) next.studentNumber = 'Use exactly NN-NNNNN, including leading zeros.';
      if (!accountReady) {
        if (pendingRegistration) {
          if (!password) next.password = 'Enter the password for your pending Firebase account.';
        } else {
          if (password.length < 8) next.password = 'Minimum 8 characters.';
          if (confirmPassword !== password) next.confirmPassword = 'Passwords do not match.';
        }
      }
    } else if (step === 5) {
      const value = email.trim().toLowerCase();
      if (!value) next.email = 'Email is required.';
      else if (!isValidEmailForRole(value, 'Student') || value.length > 100) next.email = 'Enter a valid email address (at most 100 characters).';
      if (!privacyAccepted || !termsAccepted) next.consent = 'Read and accept both the privacy notice and terms to continue.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const buildPayload = (): SignUpPayload => {
    const mi = middleInitial.trim().toUpperCase();
    const cleanSuffix = suffix.trim();
    const cleanSection = section.trim().toUpperCase();
    const fullName = `${firstName.trim()}${mi ? ` ${mi}.` : ''} ${lastName.trim()}${cleanSuffix ? ` ${cleanSuffix}` : ''}`
      .replace(/\s+/g, ' ').trim();
    return {
      fullName, firstName: firstName.trim(), middleInitial: mi || undefined,
      lastName: lastName.trim(), suffix: cleanSuffix || undefined,
      studentNumber: studentNumber.trim(), email: email.trim(),
      institute, program, position, yearLevel,
      section: cleanSection, password,
      privacyNoticeAccepted: privacyAccepted, privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
      termsAccepted, termsVersion: TERMS_AND_CONDITIONS_VERSION,
    };
  };

  const handleNext = async () => {
    if (startingRef.current || stepRef.current > TOTAL_FORM_STEPS || Platform.OS !== 'android') return;
    if (!validateStep()) return;
    if (step < TOTAL_FORM_STEPS) {
      changeStep(step + 1);
      return;
    }
    startingRef.current = true;
    const revision = uiRevision.current;
    setStarting(true);
    try {
      const result = await onBeginRegistration(buildPayload());
      if (!mounted.current || revision !== uiRevision.current || !focusedRef.current) return;
      setPassword('');
      setConfirmPassword('');
      if (result.verificationRequired) {
        setErrors({});
        setResendIn(RESEND_COOLDOWN_SECONDS);
        changeStep(VERIFY_STEP);
      } else {
        // Mock / verified resume still requires explicit Android ID capture.
        setErrors({});
        changeStep(ID_STEP);
      }
    } catch (err) {
      if (mounted.current && revision === uiRevision.current) setErrors({ email: describeSignupAccountError(err) });
    } finally {
      startingRef.current = false;
      if (mounted.current) setStarting(false);
    }
  };

  const handleResend = async () => {
    if (resendingRef.current || resendIn > 0 || !accountReady || stepRef.current !== VERIFY_STEP) return;
    resendingRef.current = true;
    const revision = uiRevision.current;
    setResending(true);
    try {
      await onResendVerification();
      if (mounted.current && revision === uiRevision.current) { setErrors({}); setResendIn(RESEND_COOLDOWN_SECONDS); }
    } catch (err) {
      if (mounted.current && revision === uiRevision.current) setErrors({ verify: describeSignupAccountError(err) });
    } finally {
      resendingRef.current = false;
      if (mounted.current) setResending(false);
    }
  };

  const captureDetails: StudentRegistrationDraft = {
    firstName, middleInitial: middleInitial || undefined, lastName, suffix: suffix || undefined,
    email, studentNumber, institute, program, yearLevel, section,
    position,
  };

  const editDetails = () => {
    flow.invalidate();
    setErrors({});
    changeStep(accountReady ? 2 : 4);
  };

  // ── Render ───────────────────────────────────────────────────────
  return (
    <View style={[s.root, { backgroundColor: background }]}>
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* ── Top nav ── */}
          <View style={s.nav}>
            <Pressable onPress={goBack} disabled={starting} accessibilityRole="button" accessibilityLabel={step > 1 ? 'Go back' : 'Back'} hitSlop={12} style={s.navBtn}>
              <MaterialIcons name="chevron-left" size={26} color={heading} />
            </Pressable>
            <View style={s.flex} />
            <Pressable onPress={exit} accessibilityRole="button" accessibilityLabel="Close" hitSlop={12} style={s.navBtn}>
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

            /* ── Step 6: email verification (Firebase link) ── */
            ) : step === VERIFY_STEP ? (
              <View style={s.stepBody}>
                <View style={s.iconBadge}>
                  <MaterialIcons name="mark-email-read" size={32} color={primary} />
                </View>
                <Text style={[s.stepHeader, { color: heading }]}>Check your email</Text>
                <Text style={[s.stepHint, { color: body }]}>
                  We sent a verification link to{'\n'}
                  <Text style={{ fontWeight: '600', color: heading }}>{email.trim()}</Text>
                  {'\n'}Open it to verify your Firebase email, then continue to student ID verification.
                </Text>
                {errors.verify ? <Text style={[s.stepHint, s.verifyError]}>{errors.verify}</Text> : null}
                <Text style={[s.stepHint, { color: body }]}>
                  Didn&apos;t get the email?{' '}
                  {resendIn > 0 ? (
                    <Text style={{ color: '#9ca3af' }}>Resend in {resendIn}s</Text>
                  ) : resending ? (
                    <Text style={{ color: primary, fontWeight: '600' }}>Sending…</Text>
                  ) : (
                    <Text onPress={handleResend} style={{ color: primary, fontWeight: '600' }}>Resend</Text>
                  )}
                </Text>
              </View>

            /* ── Steps 2-5: Form fields ── */
            ) : step <= TOTAL_FORM_STEPS ? (
              <View style={s.stepBody}>
                <Text style={[s.stepHeader, { color: heading }]}>Create your account</Text>
                <Text style={[s.stepOf, { color: '#6b7280' }]}>Step {step} of {TOTAL_FORM_STEPS}</Text>
                <StepDots step={step} />

                {step === 2 && (
                  <>
                    <TextField label="First / given names" icon="person" value={firstName} onChangeText={setFirstName} placeholder="All given names, in the printed order" autoCapitalize="words" maxLength={50} error={errors.firstName} />
                    <TextField label="Middle initial (optional)" icon="person-outline" value={middleInitial} onChangeText={(v) => setMiddleInitial(v.toUpperCase())} placeholder="One letter, or leave empty" autoCapitalize="characters" maxLength={1} error={errors.middleInitial} />
                    <TextField label="Last name" icon="person" value={lastName} onChangeText={setLastName} placeholder="Enter your printed last name" autoCapitalize="words" maxLength={50} error={errors.lastName} />
                    <TextField label="Suffix (optional)" icon="person-outline" value={suffix} onChangeText={setSuffix} placeholder="Jr., Sr., II, III" maxLength={10} error={errors.suffix} />
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
                    <TextField label="Student number" icon="badge" value={studentNumber} onChangeText={setStudentNumber} placeholder="NN-NNNNN (e.g. 00-00123)" maxLength={8} error={errors.studentNumber} />
                    <Text style={[s.hint, { color: body }]}>Enter exactly two digits, a hyphen, and five digits. Keep all leading zeros; do not substitute letters.</Text>
                    {accountReady ? <Text style={[s.hint, { color: body }]}>Your pending Firebase account is signed in. No password is needed to edit these details.</Text> : <>
                    {/* Password fields need a show/hide toggle — keep inline */}
                    <FormField label={pendingRegistration ? 'Existing account password' : 'Password'} icon="lock" error={errors.password}>
                      <View style={[s.inputRow, { backgroundColor: surface, borderColor: errors.password ? '#ba1a1a' : outline }]}>
                        <TextInput value={password} onChangeText={setPassword} placeholder={pendingRegistration ? 'Enter your existing password' : 'Create a password'} placeholderTextColor="#9ca3af" secureTextEntry={!showPassword} autoCapitalize="none" autoCorrect={false} autoComplete="off" style={[s.inputFlex, { color: heading }]} />
                        <Pressable onPress={() => setShowPassword((p) => !p)} accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} hitSlop={8}>
                          <MaterialIcons name={showPassword ? 'visibility-off' : 'visibility'} size={20} color="#6b7280" />
                        </Pressable>
                      </View>
                      {!errors.password ? <Text style={[s.hint, { color: body }]}>{pendingRegistration ? 'Resume the Firebase account bound to your signup email.' : 'Minimum 8 characters'}</Text> : null}
                    </FormField>
                    {!pendingRegistration &&
                    <FormField label="Confirm Password" icon="lock-outline" error={errors.confirmPassword}>
                      <View style={[s.inputRow, { backgroundColor: surface, borderColor: errors.confirmPassword ? '#ba1a1a' : outline }]}>
                        <TextInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm your password" placeholderTextColor="#9ca3af" secureTextEntry={!showConfirmPassword} autoCapitalize="none" autoCorrect={false} autoComplete="off" style={[s.inputFlex, { color: heading }]} />
                        <Pressable onPress={() => setShowConfirmPassword((p) => !p)} accessibilityLabel={showConfirmPassword ? 'Hide password' : 'Show password'} hitSlop={8}>
                          <MaterialIcons name={showConfirmPassword ? 'visibility-off' : 'visibility'} size={20} color="#6b7280" />
                        </Pressable>
                      </View>
                    </FormField>}
                    </>}
                  </>
                )}

                {step === 5 && (
                  <>
                    <TextField label="Email" icon="mail" value={email} onChangeText={setEmail} editable={!accountReady && !starting} placeholder="Your personal email address" keyboardType="email-address" autoComplete="email" maxLength={100} error={errors.email} />
                    <Text style={[s.hint, { color: body }]}>{accountReady ? 'This email is bound to your pending Firebase account. Explicitly cancel signup to use a different email.' : 'Personal student emails are accepted. You must open Firebase’s verification link before ID capture.'}</Text>
                    <SignupConsent privacyAccepted={privacyAccepted} termsAccepted={termsAccepted}
                      onPrivacyChange={setPrivacyAccepted} onTermsChange={setTermsAccepted} disabled={starting} />
                    {errors.consent && <Text style={s.verifyError}>{errors.consent}</Text>}
                  </>
                )}
              </View>
            ) : null}

            {/* Always mounted: closing just the preview after encoding must not
                unmount/abort the session that still owns verification's JPEG. */}
            <StudentIdCapture flow={flow} details={captureDetails} enabled={step === ID_STEP}
              accountReady={accountReady} emailVerified={emailVerified} ensureVerifiedAccount={ensureVerifiedAccount}
              onRegistered={onRegistered} onEdit={editDetails} />

            {/* ── Actions ── */}
            <View style={s.actions}>
              {step === VERIFY_STEP ? (
                <PrimaryButton
                  label={checking ? 'Checking…' : 'I’ve verified — Continue to ID'}
                  onPress={() => { void checkVerification(true); }}
                  disabled={checking || !accountReady || !appActive || !isFocused}
                  loading={checking}
                  accessibilityLabel="I have verified my email"
                />
              ) : step <= TOTAL_FORM_STEPS ? (
                <PrimaryButton
                  label={step === TOTAL_FORM_STEPS ? (starting ? 'Preparing Firebase account…' : pendingRegistration ? 'Resume signup' : 'Create Firebase account') : 'Next'}
                  onPress={() => { void handleNext(); }}
                  disabled={starting || Platform.OS !== 'android'}
                  loading={starting}
                  accessibilityLabel={step === TOTAL_FORM_STEPS ? pendingRegistration ? 'Resume signup' : 'Create Firebase account' : 'Next'}
                />
              ) : null}
              {Platform.OS !== 'android' && <Text style={[s.stepHint, { color: body }]}>Student signup requires the rebuilt native Android app. iOS and browser signup are not integrated.</Text>}
              {step === VERIFY_STEP && !accountReady && <PrimaryButton label="Resume Firebase session" onPress={editDetails} />}
              {step === TOTAL_FORM_STEPS ? (
                <Text style={[s.loginRow, { color: body }]}>
                  Already have an account?{' '}
                  <Text onPress={login} style={[s.loginLink, { color: primary }]}>Login here</Text>
                </Text>
              ) : null}
              {pendingRegistration && <Pressable accessibilityRole="button" disabled={starting} onPress={cancelSignup}>
                <Text style={[s.loginRow, { color: primary }]}>Cancel pending signup</Text>
              </Pressable>}
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
  verifyError: { color: '#ba1a1a', fontWeight: '500' },
  // Dots
  dotsRow: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginBottom: Spacing.sm },
  dot: { width: 32, height: 4, borderRadius: 2 },
  // Verify step
  iconBadge: { alignSelf: 'center', width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: '#dcfce7' },
  // Password row
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg, justifyContent: 'space-between' },
  inputFlex: { flex: 1, fontSize: FontSize.md, paddingRight: Spacing.sm },
  hint: { fontSize: FontSize.sm },
  // Actions
  actions: { marginTop: Spacing.xxl, gap: Spacing.lg },
  loginRow: { fontSize: FontSize.md, textAlign: 'center' },
  loginLink: { fontWeight: '600' },
});
