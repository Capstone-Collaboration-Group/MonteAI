import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
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
type CameraPermission = NonNullable<ReturnType<typeof useCameraPermissions>[0]>;
interface CameraMount { epoch: number; pictureSize?: string }
const CAMERA_START_TIMEOUT_MS = 15_000; // preview startup only; no still is allocated

export default function StudentIdCapture(props: Props) {
  if (Platform.OS !== 'android') return props.enabled
    ? <Text>Student ID capture is supported only in the native Android app. There is no file or gallery alternative.</Text> : null;
  return <AndroidStudentIdCapture {...props} />;
}

function AndroidStudentIdCapture({ flow, details, enabled, accountReady, emailVerified, ensureVerifiedAccount, onRegistered, onEdit }: Props) {
  const [encoder] = useState(() => { try { return getVerificationCamera(); } catch { return null; } });
  // Expo caches its hook response and does not refresh it on Android focus.
  // Accept only serialized, current-lifetime results, not that stale cache.
  const [, requestPermission, getPermission] = useCameraPermissions({ get: false });
  const [permission, setPermission] = useState<CameraPermission | null>(null);
  const permissionRef = useRef<CameraPermission | null>(null);
  const permissionWork = useRef(false);
  const permissionRefreshQueued = useRef(false);
  const currentPermissionRefresh = useRef<(() => Promise<CameraPermission | null>) | null>(null);
  const settingsOpening = useRef(false);
  const isFocused = useIsFocused();
  const mounted = useRef(false);
  const camera = useRef<CameraView>(null);
  const session = useRef<Session | null>(null);
  const cameraEpoch = useRef(0);
  const cameraConfiguration = useRef<CameraMount | null>(null);
  const readyConfiguration = useRef<CameraMount | null>(null);
  const sizeQuery = useRef<CameraMount | null>(null);
  const lifetime = useRef(0);
  const opening = useRef(false);
  const confirmedRef = useRef(false);
  const activity = useRef(AppState.currentState === 'active');
  const enabledRef = useRef(enabled);
  const focusedRef = useRef(isFocused);
  const accountReadyRef = useRef(accountReady);
  const emailVerifiedRef = useRef(emailVerified);
  enabledRef.current = enabled;
  focusedRef.current = isFocused;
  accountReadyRef.current = accountReady;
  emailVerifiedRef.current = emailVerified;
  const [state, setState] = useState<StudentSignupState>(flow.getState);
  const [protectedScreen, setProtectedScreen] = useState(false);
  const [appActive, setAppActive] = useState(activity.current);
  const [cameraMount, setCameraMount] = useState<CameraMount | null>(null);
  const [ready, setReady] = useState(false);
  const [preview, setPreview] = useState<Size>({ width: 0, height: 0 });
  const [nativeBusy, setNativeBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [permissionBusy, setPermissionBusy] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);
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
    cameraConfiguration.current = null;
    readyConfiguration.current = null;
    sizeQuery.current = null;
    camera.current = null;
    if (mounted.current) { setCameraMount(null); setReady(false); }
  }, []);

  const invalidateLifetime = useCallback(() => { lifetime.current++; }, []);
  const cancel = useCallback(() => {
    const current = flow.getState();
    const pending = !!(opening.current || session.current?.busy || current.busy);
    const hasWork = pending || cameraConfiguration.current !== null || current.phase === 'retry-registration';
    invalidateLifetime(); // also suppress late opening/retry navigation after completion
    if (mounted.current) setCancelling(pending);
    closePreview();
    session.current?.cancel();
    if (hasWork) flow.cancel();
    // Keep preparation/native/transport admission until its real owner settles.
    // Clearing `preparing` here makes Open look enabled while its handler rejects.
  }, [closePreview, flow, invalidateLifetime]);

  const clearPermission = useCallback(() => {
    permissionRef.current = null;
    if (mounted.current) setPermission(null);
  }, []);

  const refreshCameraPermission = useCallback(async (ask = false): Promise<CameraPermission | null> => {
    if (!mounted.current || !enabledRef.current || !focusedRef.current || !activity.current) return null;
    if (permissionWork.current) {
      if (!ask) permissionRefreshQueued.current = true;
      return null;
    }
    if (ask && (permissionRef.current?.granted || permissionRef.current?.canAskAgain === false ||
      !accountReadyRef.current || !emailVerifiedRef.current || opening.current || settingsOpening.current ||
      session.current?.busy || flow.getState().busy || flow.getState().phase === 'complete')) return null;
    permissionWork.current = true;
    permissionRefreshQueued.current = false;
    const epoch = lifetime.current;
    setPermissionBusy(true);
    try {
      const result = await (ask ? requestPermission() : getPermission());
      if (!mounted.current || epoch !== lifetime.current || !enabledRef.current || !focusedRef.current || !activity.current) {
        permissionRefreshQueued.current = true;
        return null;
      }
      permissionRef.current = result;
      setPermission(result);
      if (!result.granted) {
        cancel();
        setMessage(result.canAskAgain
          ? 'Camera permission was not allowed. Tap Allow camera to try again.'
          : 'Android will not show another camera prompt. Enable Camera in Android app settings, then return and check permission.');
      } else if (!opening.current && !session.current?.busy && !flow.getState().busy && flow.getState().phase === 'ready') {
        setMessage('Camera access is allowed. Confirm your printed details, then tap Open camera.');
      }
      return result;
    } catch {
      if (mounted.current && epoch === lifetime.current) {
        if (!ask) { clearPermission(); cancel(); }
        setMessage(ask ? 'Camera permission could not be requested. You can try again.'
          : 'Camera permission could not be checked. Tap Check camera permission to try again.');
      }
      return null;
    } finally {
      permissionWork.current = false;
      if (mounted.current) setPermissionBusy(false);
      // A permission prompt can blur/refocus the window before it resolves.
      // Join that work, then GET current status; never automatically ask again.
      if (permissionRefreshQueued.current && mounted.current && enabledRef.current && focusedRef.current && activity.current) {
        void currentPermissionRefresh.current?.(); // a replacement flow owns the next check
      }
    }
  }, [cancel, clearPermission, flow, getPermission, requestPermission]);
  currentPermissionRefresh.current = refreshCameraPermission;

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
    if (value.failure) setMessage(value.failure.message);
    if (value.phase === 'ready' && value.failure?.stage === 'flow') {
      invalidateLifetime();
      setCancelling(!!(opening.current || session.current?.busy || value.busy));
      closePreview();
      session.current?.cancel();
      if (value.failure.code === 'details_changed') { confirmedRef.current = false; setConfirmed(false); }
    }
  }), [closePreview, flow, invalidateLifetime]);

  useEffect(() => observeCaptureActivity(AppState, active => {
    const wasActive = activity.current;
    activity.current = active;
    setAppActive(active);
    if (!active) { clearPermission(); cancel(); }
    else if (!wasActive) void refreshCameraPermission();
  }), [cancel, clearPermission, refreshCameraPermission]);

  useEffect(() => {
    if (!isFocused || !enabled) { clearPermission(); cancel(); }
    else void refreshCameraPermission();
  }, [cancel, clearPermission, enabled, isFocused, refreshCameraPermission]);

  const binding = JSON.stringify([details.email, details.studentNumber, details.firstName,
    details.middleInitial ?? '', details.lastName, details.suffix ?? '', details.institute,
    details.program, details.yearLevel, details.section, details.position]);
  const previousBinding = useRef(binding);
  useEffect(() => {
    if (binding !== previousBinding.current) {
      previousBinding.current = binding;
      confirmedRef.current = false;
      setConfirmed(false);
      invalidateLifetime();
      flow.invalidate();
      closePreview();
      session.current?.cancel();
    }
  }, [binding, closePreview, flow, invalidateLifetime]);

  useEffect(() => {
    if (!state.retryAt || state.retryAt <= Date.now()) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [state.retryAt]);

  const mountEpoch = cameraMount?.epoch;
  const bindCamera = useCallback((reference: CameraView | null) => {
    if (mountEpoch === cameraEpoch.current) camera.current = reference;
  }, [mountEpoch]);

  useEffect(() => {
    if (mountEpoch === undefined || ready) return;
    const timer = setTimeout(() => {
      const current = cameraConfiguration.current;
      if (!mounted.current || current?.epoch !== mountEpoch || readyConfiguration.current === current) return;
      cancel();
      setMessage('Camera did not become ready. Tap Open camera to try again.');
    }, CAMERA_START_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [cancel, mountEpoch, ready]);

  async function openCamera() {
    if (!mounted.current || !enabledRef.current || !focusedRef.current || !encoder || !configured || !protectedScreen || !permissionRef.current?.granted || !accountReadyRef.current ||
      !emailVerifiedRef.current || !confirmedRef.current || !activity.current || opening.current || permissionWork.current || settingsOpening.current || cameraConfiguration.current ||
      session.current?.busy || flow.getState().busy || flow.getState().phase === 'retry-registration' ||
      flow.getState().phase === 'complete' ||
      (flow.getState().retryAt ?? 0) > Date.now()) return;
    const epoch = ++cameraEpoch.current;
    const currentLifetime = lifetime.current;
    opening.current = true;
    setPreparing(true);
    setCancelling(false);
    try {
      // A restored emailVerified flag alone cannot initiate a still: reload and
      // force-refresh the bound Firebase account before opening the preview.
      await ensureVerifiedAccount();
      if (!mounted.current || currentLifetime !== lifetime.current || epoch !== cameraEpoch.current || !enabledRef.current || !focusedRef.current || !activity.current || !confirmedRef.current || !accountReadyRef.current || !emailVerifiedRef.current) return;
      const currentPermission = await refreshCameraPermission();
      if (!currentPermission?.granted || !mounted.current || currentLifetime !== lifetime.current || epoch !== cameraEpoch.current || !enabledRef.current || !focusedRef.current || !activity.current || !confirmedRef.current || !accountReadyRef.current || !emailVerifiedRef.current) return;
      const mount = { epoch };
      cameraConfiguration.current = mount;
      readyConfiguration.current = null;
      setReady(false);
      setCameraMount(mount);
      setMessage('Starting camera… Wait for the preview before capturing.');
    } catch (error) {
      if (mounted.current && epoch === cameraEpoch.current) setMessage(sanitizeRegistrationError(error).message);
    } finally {
      opening.current = false;
      if (mounted.current) setPreparing(false); // release THIS check even when it was cancelled
    }
  }

  async function cameraReady(mount: CameraMount) {
    if (!mounted.current || mount !== cameraConfiguration.current || mount.epoch !== cameraEpoch.current || !enabledRef.current || !focusedRef.current || !activity.current || !permissionRef.current?.granted) return;
    const reference = camera.current;
    if (mount.pictureSize) {
      if (reference) {
        readyConfiguration.current = mount;
        setReady(true);
        setMessage('Camera ready. Front only. Keep every edge of the portrait ID just inside the guide, in even light.');
      }
      return;
    }
    if (sizeQuery.current === mount) return;
    sizeQuery.current = mount;
    try {
      const sizes = await reference?.getAvailablePictureSizesAsync();
      if (!mounted.current || mount !== cameraConfiguration.current || mount.epoch !== cameraEpoch.current || !reference || reference !== camera.current) return;
      const selected = selectPictureSize(sizes ?? []);
      if (!selected) throw new MemoryCaptureError('unavailable');
      // SDK 54 reconfigures pictureSize in place. Do NOT replace the native view:
      // the destroyed view's process-wide unbindAll can stop the new preview.
      // Configuration identity still rejects old ready/error/query callbacks.
      const bounded = { ...mount, pictureSize: selected };
      cameraConfiguration.current = bounded;
      readyConfiguration.current = null;
      setReady(false);
      setCameraMount(bounded);
      setMessage('Configuring camera… Wait for the bounded preview to become ready.');
    } catch {
      if (mounted.current && mount === cameraConfiguration.current && mount.epoch === cameraEpoch.current) {
        cancel();
        setMessage('No bounded still-photo size is available. Capture remains disabled.');
      }
    } finally {
      if (sizeQuery.current === mount) sizeQuery.current = null;
    }
  }

  async function captureFront() {
    const current = session.current;
    if (!mounted.current || !current || current.busy || !protectedScreen || !permissionRef.current?.granted || permissionWork.current || settingsOpening.current || !ready || !cameraMount?.pictureSize || cameraMount !== cameraConfiguration.current || readyConfiguration.current !== cameraMount || cameraMount.epoch !== cameraEpoch.current || !enabledRef.current || !focusedRef.current || !accountReadyRef.current || !emailVerifiedRef.current ||
      !confirmedRef.current || !activity.current || opening.current || flow.getState().busy || flow.getState().phase !== 'ready' || (flow.getState().retryAt ?? 0) > Date.now()) return;
    setCancelling(false);
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
        setCancelling(current.busy || flow.getState().busy); // watchdogs also leave a late cleanup owner
        if (!flow.getState().failure) setMessage(error instanceof MemoryCaptureError ? error.message : 'Capture could not finish safely.');
      }
    }
  }

  async function retryRegistration() {
    if (!mounted.current || !enabledRef.current || !focusedRef.current || !accountReadyRef.current || !emailVerifiedRef.current || !activity.current || opening.current || permissionWork.current || settingsOpening.current || session.current?.busy || flow.getState().busy || flow.getState().phase !== 'retry-registration') return;
    setCancelling(false);
    const epoch = lifetime.current;
    try {
      await flow.retryRegistration();
      if (mounted.current && epoch === lifetime.current && flow.getState().phase === 'complete') onRegistered();
    } catch { /* controller exposes only safe failure state; never display raw exceptions */ }
  }

  async function openAndroidSettings() {
    if (!mounted.current || !enabledRef.current || !focusedRef.current || !accountReadyRef.current || !emailVerifiedRef.current || !activity.current || permissionRef.current?.canAskAgain !== false || permissionRef.current.granted || settingsOpening.current || permissionWork.current || opening.current || session.current?.busy || flow.getState().busy || flow.getState().phase === 'complete') return;
    cancel();
    const epoch = lifetime.current;
    settingsOpening.current = true;
    setSettingsBusy(true);
    try { await Linking.openSettings(); }
    catch { if (mounted.current && epoch === lifetime.current) setMessage('Android settings could not be opened. Open this app’s permissions manually in Settings.'); }
    finally { settingsOpening.current = false; if (mounted.current) setSettingsBusy(false); }
  }

  const busy = state.busy || nativeBusy || preparing || permissionBusy || settingsBusy;
  const cameraOpen = cameraMount !== null;
  const finishingCancellation = cancelling && (preparing || nativeBusy || state.busy);
  const cooldown = Math.max(0, Math.ceil(((state.retryAt ?? 0) - now) / 1000));
  const finished = state.phase === 'complete';
  const canOpen = enabled && accountReady && emailVerified && confirmed && !!encoder && configured && protectedScreen &&
    !!permission?.granted && appActive && isFocused && !busy && !cooldown && !cameraOpen && state.phase !== 'retry-registration' && !finished;
  const guide = preview.width > 0 && preview.height > 0 ? getIdCaptureGuide(preview) : null;
  const canCapture = enabled && accountReady && emailVerified && confirmed && !!encoder && configured && protectedScreen &&
    !!permission?.granted && appActive && isFocused && cameraOpen && ready && !!cameraMount.pictureSize && !!guide && !busy && !cooldown && state.phase === 'ready';
  const canManagePermission = enabled && accountReady && emailVerified && !!encoder && configured && protectedScreen && appActive && isFocused && !busy && !finished;
  const cancelLabel = finishingCancellation ? null : preparing ? 'Cancel opening'
    : state.phase === 'verifying' ? 'Cancel verification' : state.phase === 'registering' ? 'Cancel registration'
    : nativeBusy ? 'Cancel capture' : cameraOpen ? 'Close camera' : null;
  const previewStatus = finishingCancellation ? 'Finishing cancelled work…'
    : preparing ? permissionBusy ? 'Checking camera permission…' : 'Checking verified account…'
    : state.phase === 'verifying' ? 'Verifying ID…' : state.phase === 'registering' ? 'Registering…'
    : nativeBusy ? 'Capturing and encoding…' : cameraOpen ? ready ? null : cameraMount.pictureSize ? 'Configuring camera…' : 'Starting camera…'
    : permissionBusy ? 'Checking camera permission…' : finished ? 'Registration complete' : 'Camera closed';
  const showingProgress = finishingCancellation || preparing || nativeBusy || state.busy || permissionBusy || (cameraOpen && !ready);

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
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: finished }} disabled={finished} onPress={() => { cancel(); onEdit(); }}><Text style={[s.link, { color: finished ? body : primary }]}>{accountReady ? 'Edit registration details (requires a fresh verification)' : 'Resume Firebase session before capture'}</Text></Pressable>
    <Text style={[s.small, { color: body }]}>Camera only · front only · no gallery, file selection, or liveness. The capture and OCR are not saved. Verification is sent in memory; its receipt is submitted immediately and is never saved.</Text>
    {registrationUsesMock && <Text style={[s.small, { color: body }]}>Mock mode: camera capture is real, but no ID upload or live registration is made.</Text>}
    {!configured && <Text style={s.error}>ID verification is not configured. Set EXPO_PUBLIC_ID_VERIFICATION_ENDPOINT for the Android development build; capture stays disabled.</Text>}
    {!encoder && <Text style={s.error}>This needs the rebuilt native Android client. Expo Go and older installed clients do not contain the memory-only encoder.</Text>}
    {!accountReady && !finished && <Text style={s.error}>Your Firebase signup session is unavailable. Resume with your email and password before capturing.</Text>}
    {!permission?.granted && <>
      {permission?.canAskAgain === false ? <>
        <Text style={[s.small, { color: body }]}>Android will not ask again. Open this app’s Settings → Permissions → Camera and allow camera access. Returning does not open the camera.</Text>
        <PrimaryButton label="Open Android settings" disabled={!canManagePermission} loading={settingsBusy} onPress={() => { void openAndroidSettings(); }} />
      </> : permission && <PrimaryButton label="Allow camera" disabled={!canManagePermission} loading={permissionBusy} onPress={() => { void refreshCameraPermission(true); }} />}
      <PrimaryButton label="Check camera permission" disabled={!canManagePermission} loading={permissionBusy} onPress={() => { void refreshCameraPermission(); }} />
    </>}
    <View style={s.preview} onLayout={event => {
      const { width, height } = event.nativeEvent.layout;
      if (width !== preview.width || height !== preview.height) {
        if (preview.width > 0 && session.current?.busy) cancel();
        setPreview({ width, height });
      }
    }}>
      {cameraMount && enabled && protectedScreen && permission?.granted && appActive && isFocused && <CameraView
        key={cameraMount.epoch} ref={bindCamera} style={StyleSheet.absoluteFill} facing="back" mode="picture" mirror={false}
        flash="off" animateShutter={false} pictureSize={cameraMount.pictureSize}
        onCameraReady={() => { void cameraReady(cameraMount); }} onMountError={() => {
          if (!mounted.current || cameraMount !== cameraConfiguration.current || cameraMount.epoch !== cameraEpoch.current) return;
          cancel(); setMessage('Camera unavailable. Reopen it to retry.');
        }} />}
      {cameraOpen && guide && <View pointerEvents="none" style={[s.guide, {
        left: guide.originX, top: guide.originY, width: guide.width, height: guide.height,
      }]} />}
      {previewStatus && <View pointerEvents="none" style={[StyleSheet.absoluteFill, s.previewStatus]}>
        {showingProgress && <ActivityIndicator color="#fff" />}
        <Text accessibilityLiveRegion="polite" style={s.previewLabel}>{previewStatus}</Text>
      </View>}
    </View>
    <Text accessibilityLiveRegion="polite" style={[s.body, { color: body }]}>{message}</Text>
    {finishingCancellation && <Text style={[s.small, { color: body }]}>The camera is closed. Wait for the earlier work to finish before opening it again. Cancelling does not undo a registration already received by the server.</Text>}
    {state.failure?.outcome === 'unmatched' && <Text style={[s.small, { color: body }]}>Check the structured details above. Edit any mistakes, or retake the front in clear lighting. OCR text and scores are not shown.</Text>}
    {cooldown > 0 && <Text accessibilityLiveRegion="polite" style={[s.small, { color: body }]}>Try again in {cooldown}s. No automatic verification retry will be made.</Text>}
    {state.phase === 'retry-registration' ? <>
      <Text style={[s.small, { color: body }]}>Your photo has been discarded. Retry only registration with the same in-memory verification and unchanged details; another scan is not needed unless it expires or you leave.</Text>
      <PrimaryButton label="Retry registration (no new photo)" loading={state.busy} disabled={busy || !enabled || !accountReady || !emailVerified || !appActive || !isFocused} onPress={() => { void retryRegistration(); }} />
      <PrimaryButton label="Discard verification and retake" disabled={busy || !enabled || !appActive || !isFocused} onPress={cancel} />
    </> : <>
      {!cameraOpen && !finished && <PrimaryButton label={preparing ? 'Checking verified account…' : 'Open camera'} accessibilityLabel="Open camera" disabled={!canOpen} loading={preparing} onPress={() => { void openCamera(); }} />}
      {cameraOpen && <PrimaryButton label="Capture front and register" disabled={!canCapture}
        loading={nativeBusy} onPress={() => { void captureFront(); }} />}
    </>}
    {cancelLabel && <Pressable accessibilityRole="button" accessibilityLabel={cancelLabel}
      accessibilityState={{ disabled: !enabled || !appActive || !isFocused }} disabled={!enabled || !appActive || !isFocused}
      onPress={() => cancel()} style={s.cancel}><Text style={[s.link, { color: enabled && appActive && isFocused ? primary : body }]}>{cancelLabel}</Text></Pressable>}
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
  previewStatus: { alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: '#00000055' },
  guide: { position: 'absolute', borderWidth: 2, borderColor: '#fff', borderRadius: Radius.sm },
  cancel: { paddingVertical: Spacing.sm, alignItems: 'center' },
});
