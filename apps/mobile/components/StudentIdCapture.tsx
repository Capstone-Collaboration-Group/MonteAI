import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { allowScreenCaptureAsync, preventScreenCaptureAsync } from 'expo-screen-capture';
import { MaterialIcons } from '@expo/vector-icons';
import { sanitizeRegistrationError, STUDENT_SIGNUP_TIMEOUT_MS, type StudentSignupFlow,
  type StudentSignupState } from '@monteai/api';
import type { StudentRegistrationDraft } from '@monteai/types';

import { Text } from '@/components/ui/ScaledText';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { useThemeColor } from '@/hooks/use-theme-color';
import { FontSize, Radius, Spacing } from '@/constants/theme';
import { createMemoryCaptureSession, getIdCaptureGuide, MemoryCaptureError,
  selectPictureSize, type Size } from '@/lib/idCapture/memoryCapture';
import { observeCaptureActivity } from '@/lib/idCapture/captureProof';
import { acquireSignupScreenProtection } from '@/lib/idCapture/screenProtection';
import { idVerificationEndpoint, registrationUsesMock } from '@/lib/registration/config';
import { getVerificationCamera } from '@/modules/verification-camera';

interface Props {
  flow: StudentSignupFlow;
  details: StudentRegistrationDraft;
  enabled: boolean;
  accountReady: boolean;
  emailVerified: boolean;
  ensureVerifiedAccount: () => Promise<void>;
  onRegistered: () => void;
  onEdit: () => void;
}
type Session = ReturnType<typeof createMemoryCaptureSession>;
interface CameraMount { epoch: number; pictureSize?: string }

export default function StudentIdCapture(props: Props) {
  if (Platform.OS !== 'android') return props.enabled
    ? <Text>Student ID capture is supported only in the native Android app. There is no file or gallery alternative.</Text> : null;
  return <AndroidStudentIdCapture {...props} />;
}

function AndroidStudentIdCapture({ flow, details, enabled, accountReady, emailVerified, ensureVerifiedAccount, onRegistered, onEdit }: Props) {
  const [encoder] = useState(() => { try { return getVerificationCamera(); } catch { return null; } });
  const [permission, requestPermission] = useCameraPermissions();
  const isFocused = useIsFocused();
  const mounted = useRef(false);
  const camera = useRef<CameraView>(null);
  const session = useRef<Session | null>(null);
  const cameraEpoch = useRef(0);
  const lifetime = useRef(0);
  const opening = useRef(false);
  const confirmedRef = useRef(false);
  const activity = useRef(AppState.currentState === 'active');
  const enabledRef = useRef(enabled);
  const focusedRef = useRef(isFocused);
  enabledRef.current = enabled;
  focusedRef.current = isFocused;
  const [state, setState] = useState<StudentSignupState>(flow.getState);
  const [protectedScreen, setProtectedScreen] = useState(false);
  const [appActive, setAppActive] = useState(activity.current);
  const [cameraMount, setCameraMount] = useState<CameraMount | null>(null);
  const [ready, setReady] = useState(false);
  const [preview, setPreview] = useState<Size>({ width: 0, height: 0 });
  const [nativeBusy, setNativeBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [now, setNow] = useState(Date.now);
  const [message, setMessage] = useState('Confirm the details printed on your ID, then open the camera.');
  const primary = useThemeColor({}, 'primary');
  const heading = useThemeColor({}, 'onSurface');
  const body = useThemeColor({}, 'onSurfaceVariant');
  const outline = useThemeColor({}, 'outlineVariant');
  const configured = registrationUsesMock || !!idVerificationEndpoint;

  // Closing the preview is different from cancelling its cleanup owner. After
  // encoding, the native session remains alive while its abortable consumer runs.
  const closePreview = useCallback(() => {
    cameraEpoch.current++;
    camera.current = null;
    if (mounted.current) { setCameraMount(null); setReady(false); }
  }, []);

  const cancel = useCallback(() => {
    closePreview();
    session.current?.cancel();
    flow.cancel();
    if (mounted.current) setPreparing(false);
  }, [closePreview, flow]);
  const invalidateLifetime = useCallback(() => { lifetime.current++; }, []);

  useEffect(() => {
    mounted.current = true;
    lifetime.current++;
    setProtectedScreen(false);
    let active = true;
    const protection = acquireSignupScreenProtection({ prevent: preventScreenCaptureAsync, allow: allowScreenCaptureAsync });
    void protection.ready.then(protectedNow => {
      if (!active) return;
      setProtectedScreen(protectedNow);
      if (!protectedNow) setMessage('Screen protection could not start. The camera will stay closed.');
    });
    return () => {
      active = false;
      mounted.current = false;
      invalidateLifetime();
      closePreview();
      session.current?.dispose();
      flow.cancel();
      protection.release();
    };
  }, [closePreview, flow, invalidateLifetime]);

  useEffect(() => {
    if (!encoder) return;
    const current = createMemoryCaptureSession({
      capture: options => {
        if (!camera.current) throw new MemoryCaptureError('capture_failed');
        return camera.current.takePictureAsync(options);
      },
      encode: (picture, crop) => encoder.encodeJpeg(picture, crop),
      disposePicture: picture => encoder.disposePicture(picture),
    }, 15_000, { consumerTimeoutMs: STUDENT_SIGNUP_TIMEOUT_MS + 5_000 });
    session.current = current;
    const unsubscribe = current.subscribeBusy(value => { if (mounted.current) setNativeBusy(value); });
    return () => {
      unsubscribe();
      current.dispose();
      if (session.current === current) session.current = null;
    };
  }, [encoder, flow]);

  useEffect(() => flow.subscribe(value => {
    if (!mounted.current) return;
    setState(value); // this state is explicitly image/receipt/OCR-free
    if (value.phase === 'ready' && value.failure?.stage === 'flow') {
      closePreview();
      session.current?.cancel();
      if (value.failure.code === 'details_changed') { confirmedRef.current = false; setConfirmed(false); }
    }
  }), [closePreview, flow]);

  useEffect(() => observeCaptureActivity(AppState, active => {
    activity.current = active;
    setAppActive(active);
    if (!active) cancel();
  }), [cancel]);

  useEffect(() => { if (!isFocused || !enabled) cancel(); }, [cancel, enabled, isFocused]);
  useEffect(() => { if (!permission?.granted) cancel(); }, [cancel, permission?.granted]);

  const binding = JSON.stringify([details.email, details.studentNumber, details.firstName,
    details.middleInitial ?? '', details.lastName, details.suffix ?? '', details.institute,
    details.program, details.yearLevel, details.section, details.position]);
  const previousBinding = useRef(binding);
  useEffect(() => {
    if (binding !== previousBinding.current) {
      previousBinding.current = binding;
      confirmedRef.current = false;
      setConfirmed(false);
      flow.invalidate();
      closePreview();
      session.current?.cancel();
    }
  }, [binding, closePreview, flow]);

  useEffect(() => {
    if (!state.retryAt || state.retryAt <= Date.now()) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [state.retryAt]);

  async function openCamera() {
    if (!mounted.current || !enabledRef.current || !focusedRef.current || !enabled || !encoder || !configured || !protectedScreen || !permission?.granted || !accountReady ||
      !emailVerified || !confirmedRef.current || !activity.current || !isFocused || opening.current ||
      session.current?.busy || flow.getState().busy || flow.getState().phase === 'retry-registration' ||
      (flow.getState().retryAt ?? 0) > Date.now()) return;
    const epoch = ++cameraEpoch.current;
    const currentLifetime = lifetime.current;
    opening.current = true;
    setPreparing(true);
    try {
      // A restored emailVerified flag alone cannot initiate a still: reload and
      // force-refresh the bound Firebase account before opening the preview.
      await ensureVerifiedAccount();
      if (!mounted.current || epoch !== cameraEpoch.current || !enabledRef.current || !focusedRef.current || !activity.current || !confirmedRef.current) return;
      setReady(false);
      setCameraMount({ epoch });
      setMessage('Front only. Keep every edge of the portrait ID just inside the guide, in even light.');
    } catch (error) {
      if (mounted.current && epoch === cameraEpoch.current) setMessage(sanitizeRegistrationError(error).message);
    } finally {
      opening.current = false;
      if (mounted.current && currentLifetime === lifetime.current) setPreparing(false);
    }
  }

  async function cameraReady(mount: CameraMount) {
    if (!mounted.current || mount.epoch !== cameraEpoch.current || !enabledRef.current || !focusedRef.current || !activity.current) return;
    const reference = camera.current;
    if (mount.pictureSize) { if (reference) setReady(true); return; }
    try {
      const sizes = await reference?.getAvailablePictureSizesAsync();
      if (!mounted.current || mount.epoch !== cameraEpoch.current || !reference || reference !== camera.current) return;
      const selected = selectPictureSize(sizes ?? []);
      if (!selected) throw new MemoryCaptureError('unavailable');
      // Bind native events to this specific remount. An old ready/mount-error
      // callback must never enable or close a newer camera instance.
      const epoch = ++cameraEpoch.current;
      camera.current = null;
      setReady(false);
      setCameraMount({ epoch, pictureSize: selected });
    } catch {
      if (mounted.current && mount.epoch === cameraEpoch.current) {
        closePreview();
        setMessage('No bounded still-photo size is available. Capture remains disabled.');
      }
    }
  }

  async function captureFront() {
    const current = session.current;
    if (!mounted.current || !current || current.busy || !protectedScreen || !permission?.granted || !ready || !cameraMount?.pictureSize || cameraMount.epoch !== cameraEpoch.current || !enabled || !accountReady || !emailVerified ||
      !confirmedRef.current || !activity.current || !isFocused || flow.getState().busy || (flow.getState().retryAt ?? 0) > Date.now()) return;
    setMessage('Capturing and encoding the front of your ID in memory…');
    const epoch = lifetime.current;
    try {
      await current.capture({ preview, guide: getIdCaptureGuide(preview) }, async (image, signal) => {
        if (!mounted.current || epoch !== lifetime.current || !enabledRef.current || !focusedRef.current || !activity.current || !confirmedRef.current) {
          current.cancel();
          throw new MemoryCaptureError('cancelled');
        }
        closePreview(); // do NOT dispose/cancel while verification owns the JPEG
        setMessage('Checking your ID, then completing registration…');
        await flow.verifyAndRegister(image, signal);
      });
      if (mounted.current && epoch === lifetime.current && current === session.current && flow.getState().phase === 'complete') onRegistered();
    } catch (error) {
      if (mounted.current && epoch === lifetime.current && current === session.current) {
        closePreview();
        if (!flow.getState().failure) setMessage(error instanceof MemoryCaptureError ? error.message : 'Capture could not finish safely.');
      }
    }
  }

  async function retryRegistration() {
    if (!mounted.current || !enabledRef.current || !focusedRef.current || !enabled || !accountReady || !emailVerified || !activity.current || !isFocused || session.current?.busy || flow.getState().busy || flow.getState().phase !== 'retry-registration') return;
    const epoch = lifetime.current;
    try {
      await flow.retryRegistration();
      if (mounted.current && epoch === lifetime.current && flow.getState().phase === 'complete') onRegistered();
    } catch { /* controller exposes only safe failure state; never display raw exceptions */ }
  }

  const busy = state.busy || nativeBusy || preparing;
  const cameraOpen = cameraMount !== null;
  const cooldown = Math.max(0, Math.ceil(((state.retryAt ?? 0) - now) / 1000));
  const finished = state.phase === 'complete';
  const canOpen = enabled && accountReady && emailVerified && confirmed && !!encoder && configured && protectedScreen &&
    !!permission?.granted && appActive && isFocused && !busy && !cooldown && !cameraOpen && state.phase !== 'retry-registration' && !finished;
  const guide = preview.width > 0 && preview.height > 0 ? getIdCaptureGuide(preview) : null;

  return <View style={[s.content, !enabled && s.hidden]}>
    <Text accessibilityRole="header" style={[s.title, { color: heading }]}>Verify your student ID</Text>
    <Text style={[s.body, { color: body }]}>Check these details against the front of your Colegio de Montalban ID. Leading zeros and the order of your given names matter.</Text>
    <View style={[s.identity, { borderColor: outline }]}>
      {[
        ['Student number', details.studentNumber], ['First / given names', details.firstName],
        ['Middle initial', details.middleInitial || 'None'], ['Last name', details.lastName], ['Suffix', details.suffix || 'None'],
      ].map(([label, value]) => <View key={label} style={s.identityRow}>
        <Text style={[s.small, { color: body }]}>{label}</Text>
        <Text style={[s.value, { color: heading }]}>{value}</Text>
      </View>)}
    </View>
    <Pressable accessibilityRole="checkbox" accessibilityLabel="These details match my printed student ID"
      accessibilityState={{ checked: confirmed, disabled: busy || finished }} disabled={busy || finished}
      onPress={() => { confirmedRef.current = !confirmedRef.current; setConfirmed(confirmedRef.current); if (!confirmedRef.current) cancel(); }} style={s.confirm}>
      <MaterialIcons name={confirmed ? 'check-box' : 'check-box-outline-blank'} size={26} color={primary} />
      <Text style={[s.body, s.flex, { color: heading }]}>These details match my printed student ID.</Text>
    </Pressable>
    <Pressable accessibilityRole="button" disabled={finished} onPress={() => { cancel(); onEdit(); }}><Text style={[s.link, { color: primary }]}>{accountReady ? 'Edit registration details (requires a fresh verification)' : 'Resume Firebase session before capture'}</Text></Pressable>
    <Text style={[s.small, { color: body }]}>Camera only · front only · no gallery, file selection, or liveness. The capture and OCR are not saved. Verification is sent in memory; its receipt is submitted immediately and is never saved.</Text>
    {registrationUsesMock && <Text style={[s.small, { color: body }]}>Mock mode: camera capture is real, but no ID upload or live registration is made.</Text>}
    {!configured && <Text style={s.error}>ID verification is not configured. Set EXPO_PUBLIC_ID_VERIFICATION_ENDPOINT for the Android development build; capture stays disabled.</Text>}
    {!encoder && <Text style={s.error}>This needs the rebuilt native Android client. Expo Go and older installed clients do not contain the memory-only encoder.</Text>}
    {!accountReady && !finished && <Text style={s.error}>Your Firebase signup session is unavailable. Resume with your email and password before capturing.</Text>}
    {!permission?.granted && <PrimaryButton label="Allow camera" disabled={!enabled || !appActive || !isFocused || !accountReady || !emailVerified || !encoder || !configured || !protectedScreen || busy || permission?.canAskAgain === false}
      onPress={() => {
        if (!mounted.current || !enabledRef.current || !focusedRef.current || !activity.current) return;
        const epoch = lifetime.current;
        void requestPermission().catch(() => {
          if (mounted.current && epoch === lifetime.current) setMessage('Camera permission could not be requested.');
        });
      }} />}
    {permission?.canAskAgain === false && !permission.granted && <Text style={[s.small, { color: body }]}>Camera permission is denied. Enable it manually in Android app settings; there is no file/gallery fallback.</Text>}
    <View style={s.preview} onLayout={event => {
      const { width, height } = event.nativeEvent.layout;
      if (width !== preview.width || height !== preview.height) {
        if (preview.width > 0 && session.current?.busy) cancel();
        setPreview({ width, height });
      }
    }}>
      {cameraMount && enabled && protectedScreen && permission?.granted && appActive && isFocused && <CameraView
        key={cameraMount.epoch} ref={reference => { if (cameraMount.epoch === cameraEpoch.current) camera.current = reference; }} style={StyleSheet.absoluteFill} facing="back" mode="picture" mirror={false}
        flash="off" animateShutter={false} pictureSize={cameraMount.pictureSize}
        onCameraReady={() => { void cameraReady(cameraMount); }} onMountError={() => {
          if (!mounted.current || cameraMount.epoch !== cameraEpoch.current) return;
          closePreview(); session.current?.cancel(); setMessage('Camera unavailable. Reopen it to retry.');
        }} />}
      {cameraOpen && guide && <View pointerEvents="none" style={[s.guide, {
        left: guide.originX, top: guide.originY, width: guide.width, height: guide.height,
      }]} />}
      {!cameraOpen && <Text style={s.previewLabel}>{state.phase === 'verifying' ? 'Verifying ID…' : state.phase === 'registering' ? 'Registering…' : 'Camera closed'}</Text>}
    </View>
    <Text accessibilityLiveRegion="polite" style={[s.body, { color: body }]}>{cameraOpen || preparing ? message : state.failure?.message ?? message}</Text>
    {state.failure?.outcome === 'unmatched' && <Text style={[s.small, { color: body }]}>Check the structured details above. Edit any mistakes, or retake the front in clear lighting. OCR text and scores are not shown.</Text>}
    {cooldown > 0 && <Text accessibilityLiveRegion="polite" style={[s.small, { color: body }]}>Try again in {cooldown}s. No automatic verification retry will be made.</Text>}
    {state.phase === 'retry-registration' ? <>
      <Text style={[s.small, { color: body }]}>Your photo has been discarded. Retry only registration with the same in-memory verification and unchanged details; another scan is not needed unless it expires or you leave.</Text>
      <PrimaryButton label="Retry registration (no new photo)" loading={state.busy} disabled={busy || !accountReady || !appActive || !isFocused} onPress={() => { void retryRegistration(); }} />
      <PrimaryButton label="Discard verification and retake" disabled={busy} onPress={cancel} />
    </> : <>
      <PrimaryButton label={preparing ? 'Checking verified account…' : 'Open camera'} disabled={!canOpen} loading={preparing} onPress={() => { void openCamera(); }} />
      <PrimaryButton label="Capture front and register" disabled={!cameraOpen || !ready || busy || !confirmed || !accountReady || !appActive || !isFocused || cooldown > 0}
        loading={state.busy || nativeBusy} onPress={() => { void captureFront(); }} />
    </>}
    <Pressable accessibilityRole="button" disabled={finished} onPress={cancel} style={s.cancel}><Text style={[s.link, { color: primary }]}>Cancel capture / close camera</Text></Pressable>
  </View>;
}

const s = StyleSheet.create({
  content: { gap: Spacing.md },
  hidden: { display: 'none' },
  flex: { flex: 1 },
  title: { fontSize: FontSize.xxl, textAlign: 'center' },
  body: { fontSize: FontSize.md, lineHeight: 23 },
  small: { fontSize: FontSize.sm, lineHeight: 20 },
  error: { color: '#ba1a1a', fontSize: FontSize.sm, lineHeight: 20 },
  identity: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.sm },
  identityRow: { gap: Spacing.xxs },
  value: { fontSize: FontSize.md, fontWeight: '600' },
  confirm: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  link: { fontSize: FontSize.sm, fontWeight: '600', textDecorationLine: 'underline' },
  preview: { height: 390, backgroundColor: '#17231d', borderRadius: Radius.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  previewLabel: { color: '#fff', fontSize: FontSize.md },
  guide: { position: 'absolute', borderWidth: 2, borderColor: '#fff', borderRadius: Radius.sm },
  cancel: { paddingVertical: Spacing.sm, alignItems: 'center' },
});
