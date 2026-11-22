import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { allowScreenCaptureAsync, preventScreenCaptureAsync } from 'expo-screen-capture';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createMemoryCaptureSession, getIdCaptureGuide, MemoryCaptureError, selectPictureSize,
  type CaptureSummary, type Size } from '@/lib/idCapture/memoryCapture';
import { holdUntilCaptureAbort, observeCaptureActivity } from '@/lib/idCapture/captureProof';
import { getVerificationCamera, type FileWriteReport } from '@/modules/verification-camera';

type ProofMode = 'normal' | 'encode-failure' | 'hold';
type Session = ReturnType<typeof createMemoryCaptureSession>;
const PROTECTION_KEY = 'monteai-id-capture-proof';

export default function IdCaptureProofScreen() {
  if (!__DEV__ || process.env.EXPO_PUBLIC_ENABLE_ID_CAPTURE_PROOF !== 'true' || Platform.OS !== 'android') {
    return <SafeAreaView style={styles.page}><Text style={styles.text}>Android capture proof is not enabled in this build.</Text></SafeAreaView>;
  }
  return <AndroidCaptureProof />;
}

function AndroidCaptureProof() {
  const [encoder] = useState(() => {
    try { return getVerificationCamera(); } catch { return null; }
  });
  const [permission, requestPermission] = useCameraPermissions();
  const isFocused = useIsFocused();
  const mounted = useRef(true);
  const camera = useRef<CameraView>(null);
  const session = useRef<Session | null>(null);
  const mode = useRef<ProofMode>('normal');
  const epoch = useRef(0);
  const [protectedScreen, setProtectedScreen] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [pictureSize, setPictureSize] = useState<string | null>(null);
  const [preview, setPreview] = useState<Size>({ width: 0, height: 0 });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('Open the camera to begin. No upload or registration call is made.');
  const [summary, setSummary] = useState<CaptureSummary | null>(null);
  const [report, setReport] = useState<FileWriteReport | null>(() => {
    try { return encoder?.getFileWriteReport() ?? null; } catch { return null; }
  });

  const disposeSession = useCallback(() => {
    epoch.current++;
    session.current?.dispose();
    session.current = null;
  }, []);

  const closeCamera = useCallback(() => {
    disposeSession();
    setCameraOpen(false);
    setReady(false);
    setBusy(false);
    setSummary(null);
  }, [disposeSession]);

  useEffect(() => {
    let active = true;
    mounted.current = true;
    void preventScreenCaptureAsync(PROTECTION_KEY).then(() => {
      if (active) setProtectedScreen(true);
    }).catch(() => {
      if (active) setMessage('Screen protection could not start. The camera will stay closed.');
    });
    return () => {
      active = false;
      mounted.current = false;
      disposeSession();
      void allowScreenCaptureAsync(PROTECTION_KEY).catch(() => { /* no native diagnostics */ });
      // A manually started debug file watch intentionally spans route unmount.
      // Return here and stop it after late native callbacks finish. It retains
      // counters/observer handles only, never a capture; host destruction stops it.
    };
  }, [disposeSession]);

  useEffect(() => {
    return observeCaptureActivity(AppState, active => {
      setAppActive(active);
      if (!active) {
        closeCamera();
        setMessage('Camera closed and capture discarded. Reopen after returning.');
      } else {
        try { setReport(encoder?.getFileWriteReport() ?? null); } catch { /* counters only */ }
      }
    });
  }, [closeCamera, encoder]);

  useEffect(() => {
    if (!isFocused) closeCamera();
  }, [isFocused, closeCamera]);

  function openCamera() {
    if (!encoder || !protectedScreen || !permission?.granted || !appActive || !isFocused) return;
    closeCamera();
    session.current = createMemoryCaptureSession({
      capture: options => {
        if (!camera.current) throw new MemoryCaptureError('capture_failed');
        return camera.current.takePictureAsync(options);
      },
      encode: (picture, crop) => encoder.encodeJpeg(picture,
        mode.current === 'encode-failure' ? { ...crop, width: 0 } : crop),
      disposePicture: picture => encoder.disposePicture(picture),
    });
    setPictureSize(null);
    setCameraOpen(true);
    setMessage('Front only. Keep the entire portrait card just inside the guide.');
  }

  async function cameraReady() {
    if (pictureSize) { setReady(true); return; }
    const reference = camera.current;
    const currentEpoch = epoch.current;
    try {
      const sizes = await reference?.getAvailablePictureSizesAsync();
      if (!mounted.current || currentEpoch !== epoch.current || !reference || reference !== camera.current) return;
      const selected = selectPictureSize(sizes ?? []);
      if (!selected) throw new MemoryCaptureError('unavailable');
      setPictureSize(selected); // wait for the reconfigured camera's next ready event
    } catch {
      if (mounted.current && currentEpoch === epoch.current) {
        closeCamera();
        setMessage('No bounded still-photo size is available. Capture remains disabled.');
      }
    }
  }

  async function capture(proofMode: ProofMode) {
    const current = session.current;
    if (!current || current.busy || !ready || busy || !cameraOpen || !appActive || !isFocused) return;
    mode.current = proofMode;
    setBusy(true);
    setSummary(null);
    setMessage(proofMode === 'hold' ? 'Capturing for cancellation test. Wait for the held-in-RAM message, then cancel, leave, or background the app.' : 'Capturing and encoding in RAM…');
    try {
      const result = await current.capture({ preview, guide: getIdCaptureGuide(preview) }, async (_image, signal) => {
        if (proofMode !== 'hold') return;
        if (mounted.current && current === session.current && !signal.aborted) {
          setMessage('JPEG held in RAM for cancellation test. Tap Cancel / close camera now. This test cannot finish as normal success.');
        }
        await holdUntilCaptureAbort(signal);
      });
      // Negative-test modes must never display an ordinary JPEG success summary.
      if (proofMode !== 'normal') throw new MemoryCaptureError('processing_failed');
      if (mounted.current && current === session.current) {
        setSummary(result); // explicitly receipt/image-free metadata only
        setMessage('JPEG/base64 produced in RAM and discarded. No image was saved or sent.');
      }
    } catch (error) {
      if (mounted.current && current === session.current) {
        if (error instanceof MemoryCaptureError && error.code === 'timeout') closeCamera();
        setMessage(error instanceof MemoryCaptureError ? error.message : 'Capture could not finish safely.');
      }
    } finally {
      if (mounted.current && current === session.current) {
        setBusy(false);
        try { setReport(encoder?.getFileWriteReport() ?? null); } catch { /* counters only */ }
      }
    }
  }

  function changeFileWatch(start: boolean) {
    try {
      const nextReport = start ? encoder?.beginFileWriteProbe() ?? null : encoder?.endFileWriteProbe() ?? null;
      setReport(nextReport);
      if (start) {
        setSummary(null);
        setMessage(nextReport?.running ? 'File watch started. Choose a capture or cancellation test.'
          : 'The debug file watch is unavailable. Do not treat this run as privacy proof.');
      }
    } catch { setMessage('The debug file watch is unavailable. Do not treat this run as privacy proof.'); }
  }

  const guide = preview.width > 0 && preview.height > 0 ? getIdCaptureGuide(preview) : null;
  const canCapture = ready && !busy && cameraOpen && appActive && isFocused;

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Android memory-capture proof</Text>
        <Text style={styles.text}>Phase 2 only. Use a non-sensitive test card or blank object. No gallery, OCR, receipt, or signup integration.</Text>
        {!encoder && <Text style={styles.text}>Rebuild the native Android proof client. Expo Go and the old installed app do not contain this encoder.</Text>}
        {!permission?.granted && <ProofButton label="Allow camera" disabled={!encoder || !protectedScreen || permission?.canAskAgain === false}
          onPress={() => { void requestPermission().catch(() => setMessage('Camera permission could not be requested.')); }} />}
        {permission?.canAskAgain === false && !permission.granted && <Text style={styles.text}>Camera permission was denied. Enable it in Android app settings; there is no file/gallery fallback.</Text>}
        <View style={styles.preview} onLayout={event => {
          const { width, height } = event.nativeEvent.layout;
          if (width !== preview.width || height !== preview.height) {
            session.current?.cancel();
            setPreview({ width, height });
          }
        }}>
          {cameraOpen && protectedScreen && permission?.granted && appActive && isFocused && (
            <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" mode="picture" mirror={false}
              flash="off" animateShutter={false} pictureSize={pictureSize ?? undefined}
              onCameraReady={() => { void cameraReady(); }} onMountError={() => {
                closeCamera(); setMessage('Camera unavailable. Reopen it to retry.');
              }} />
          )}
          {cameraOpen && guide && <View pointerEvents="none" style={[styles.guide, {
            left: guide.originX, top: guide.originY, width: guide.width, height: guide.height,
          }]} />}
          {!cameraOpen && <Text style={styles.previewLabel}>Camera closed</Text>}
        </View>
        <Text accessibilityLiveRegion="polite" style={styles.text}>{message}</Text>
        {summary && <Text testID="capture-summary" style={styles.text}>{summary.width} × {summary.height} · {summary.byteLength} JPEG bytes · payload discarded</Text>}
        <View style={styles.buttons}>
          <ProofButton label="Open camera" disabled={cameraOpen || !encoder || !protectedScreen || !permission?.granted || !appActive} onPress={openCamera} />
          <ProofButton label="Capture front" disabled={!canCapture} onPress={() => { void capture('normal'); }} />
          <ProofButton label="Test encode failure" disabled={!canCapture} onPress={() => { void capture('encode-failure'); }} />
          <ProofButton label="Hold until cancel" disabled={!canCapture} onPress={() => { void capture('hold'); }} />
          <ProofButton label="Cancel / close camera" disabled={!cameraOpen} onPress={() => { closeCamera(); setMessage('Capture discarded; camera closed.'); }} />
        </View>
        <Text style={styles.text}>Debug file watch observes app-private and existing app-scoped external directories, including transient writes. Zero events is evidence for that interval, not a universal filesystem guarantee.</Text>
        <View style={styles.buttons}>
          <ProofButton label="Start file watch" disabled={!encoder || busy || report?.running === true} onPress={() => changeFileWatch(true)} />
          <ProofButton label="Stop file watch" disabled={!report?.running || busy} onPress={() => changeFileWatch(false)} />
        </View>
        {report && <Text testID="file-write-report" style={styles.text}>Watch: {report.running ? 'running' : 'stopped'} · {report.directoryCount} directories · {report.writeEventCount} write events · coverage {report.coverageComplete ? 'complete' : 'incomplete'}</Text>}
        <ProofButton label="Leave proof (unmount)" onPress={() => { closeCamera(); router.replace('/auth-entry'); }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function ProofButton({ label, disabled, onPress }: { label: string; disabled?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }}
    disabled={disabled} onPress={onPress} style={[styles.button, disabled && styles.disabled]}><Text style={styles.buttonText}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#fcf9f8' },
  content: { padding: 16, gap: 12 },
  title: { fontSize: 22, fontWeight: '700', color: '#173c2b' },
  text: { color: '#22372c', fontSize: 14, lineHeight: 20 },
  preview: { height: 390, backgroundColor: '#17231d', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  previewLabel: { color: '#fff' },
  guide: { position: 'absolute', borderWidth: 2, borderColor: '#fff', borderRadius: 8 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { backgroundColor: '#1b6444', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 8 },
  disabled: { opacity: 0.4 },
  buttonText: { color: '#fff', fontWeight: '600' },
});
