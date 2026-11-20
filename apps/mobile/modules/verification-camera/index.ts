import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';
import { CAPTURE_POLICY, MemoryCaptureError, type MemoryJpeg, type NativePicture, type Rect } from '../../lib/idCapture/memoryCapture';

export interface FileWriteReport {
  supported: boolean;
  running: boolean;
  coverageComplete: boolean;
  directoryCount: number;
  writeEventCount: number;
}

interface NativeEncoder {
  getCapabilities(): { policy: string; fileProbeSupported: boolean };
  encodeJpeg(picture: NativePicture, crop: Rect): Promise<MemoryJpeg>;
  disposePicture(picture: NativePicture): void;
  beginFileWriteProbe(): FileWriteReport;
  endFileWriteProbe(): FileWriteReport;
  getFileWriteReport(): FileWriteReport;
}

// No Expo Go, web, iOS, URI-based fallback, image-manipulator save, or disk encoding.
export function getVerificationCamera(): NativeEncoder {
  if (Platform.OS !== 'android') throw new MemoryCaptureError('unavailable');
  try {
    const encoder = requireOptionalNativeModule<NativeEncoder>('VerificationCamera');
    if (encoder?.getCapabilities().policy === CAPTURE_POLICY) return encoder;
  } catch { /* native errors are not safe diagnostics */ }
  throw new MemoryCaptureError('unavailable');
}
