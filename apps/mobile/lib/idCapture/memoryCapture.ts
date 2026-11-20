// Android-only Phase 2 primitive. Never put a picture or encoded image in React
// state, storage, logs, a URL, or an image-cache component. The consumer must
// honor the abort signal and must not retain the image after it returns.
export const CAPTURE_POLICY = 'android-memory-jpeg-v1';
export const MAX_CAPTURE_PIXELS = 12_000_000;
export const MAX_JPEG_BYTES = 2 * 1024 * 1024;
export const MAX_JPEG_EDGE = 1600;
export const ID_CARD_ASPECT_RATIO = 720 / 1120; // cdm-front-v1, not a landscape bank card

export const MEMORY_PICTURE_OPTIONS = Object.freeze({
  pictureRef: true as const,
  skipProcessing: false as const, // true writes a cache file even with pictureRef on SDK 54
  base64: false as const,
  exif: false as const, // apply orientation to pixels; do not export metadata
  quality: 1,
  imageType: 'jpg' as const,
});

export interface Size { width: number; height: number }
export interface Rect extends Size { originX: number; originY: number }
export interface CaptureLayout { preview: Size; guide: Rect }
export interface NativePicture extends Size {
  nativeRefType: string;
  release(): void;
}
export interface CaptureSummary extends Size {
  byteLength: number;
  mimeType: 'image/jpeg';
}
export interface MemoryJpeg extends CaptureSummary { imageBase64: string }

type FailureCode = 'unavailable' | 'busy' | 'disposed' | 'invalid_layout' | 'invalid_image'
  | 'capture_failed' | 'encode_failed' | 'cleanup_failed' | 'processing_failed' | 'cancelled' | 'timeout';

const messages: Record<FailureCode, string> = {
  unavailable: 'This capture requires the rebuilt Android native client.',
  busy: 'A capture is still finishing. Please wait before trying again.',
  disposed: 'Reopen the camera to take another picture.',
  invalid_layout: 'Wait for the camera guide to finish loading.',
  invalid_image: 'Retake the front of the card, keeping every edge inside the guide.',
  capture_failed: 'The camera could not capture the card. Reopen it and try again.',
  encode_failed: 'The card could not be processed safely. Please retake it.',
  cleanup_failed: 'Close the camera before trying again.',
  processing_failed: 'The capture could not be checked. Please try again.',
  cancelled: 'Capture discarded.',
  timeout: 'The camera took too long. Reopen it and try again.',
};

export class MemoryCaptureError extends Error {
  readonly code: FailureCode;
  constructor(code: FailureCode) {
    super(messages[code]);
    this.name = 'MemoryCaptureError';
    this.code = code;
  }
}

function validSize(size: Size | null | undefined): size is Size {
  return !!size && Number.isFinite(size.width) && Number.isFinite(size.height)
    && size.width > 0 && size.height > 0;
}

export function getIdCaptureGuide(preview: Size): Rect {
  if (!validSize(preview)) throw new MemoryCaptureError('invalid_layout');
  const width = Math.min(preview.width * 0.84, preview.height * 0.84 * ID_CARD_ASPECT_RATIO);
  const height = width / ID_CARD_ASPECT_RATIO;
  return { originX: (preview.width - width) / 2, originY: (preview.height - height) / 2, width, height };
}

function copyLayout(layout: CaptureLayout): CaptureLayout {
  if (!layout || typeof layout !== 'object') throw new MemoryCaptureError('invalid_layout');
  const { preview, guide } = layout;
  if (!validSize(preview) || !validSize(guide) || !Number.isFinite(guide.originX)
    || !Number.isFinite(guide.originY) || guide.originX < 0 || guide.originY < 0
    || guide.originX + guide.width > preview.width || guide.originY + guide.height > preview.height) {
    throw new MemoryCaptureError('invalid_layout');
  }
  return {
    preview: { width: preview.width, height: preview.height },
    guide: { originX: guide.originX, originY: guide.originY, width: guide.width, height: guide.height },
  };
}

// CameraView's default Android preview is FILL_CENTER. Keep ratio unset; a
// ratio prop switches it to FIT_CENTER and would require different crop math.
export function getGuideCrop(layout: CaptureLayout, image: Size): Rect {
  const { preview, guide } = copyLayout(layout);
  if (!validSize(image) || !Number.isInteger(image.width) || !Number.isInteger(image.height)
    || image.width * image.height > MAX_CAPTURE_PIXELS || Math.max(image.width, image.height) > 6000) {
    throw new MemoryCaptureError('invalid_image');
  }
  const scale = Math.max(preview.width / image.width, preview.height / image.height);
  const offsetX = (image.width * scale - preview.width) / 2;
  const offsetY = (image.height * scale - preview.height) / 2;
  const originX = Math.max(0, Math.floor((guide.originX + offsetX) / scale));
  const originY = Math.max(0, Math.floor((guide.originY + offsetY) / scale));
  const endX = Math.min(image.width, Math.ceil((guide.originX + guide.width + offsetX) / scale));
  const endY = Math.min(image.height, Math.ceil((guide.originY + guide.height + offsetY) / scale));
  const crop = { originX, originY, width: endX - originX, height: endY - originY };
  if (Math.min(crop.width, crop.height) < 450) throw new MemoryCaptureError('invalid_image');
  return crop;
}

// Request a bounded still before allocating its pixels. CameraX can fall back
// to a different supported size; getGuideCrop and the native encoder recheck it.
export function selectPictureSize(sizes: readonly string[]): string | null {
  const candidates = sizes.flatMap(value => {
    const match = /^(\d{1,4})x(\d{1,4})$/.exec(value);
    if (!match) return [];
    const width = Number(match[1]);
    const height = Number(match[2]);
    const pixels = width * height;
    return Math.min(width, height) >= 900 && Math.max(width, height) <= 6000
      && pixels <= 6_000_000 ? [{ value, pixels }] : [];
  });
  candidates.sort((a, b) => b.pixels - a.pixels || a.value.localeCompare(b.value));
  return candidates[0]?.value ?? null;
}

function assertPicture(value: unknown): asserts value is NativePicture {
  if (!value || typeof value !== 'object' || !('release' in value) || typeof value.release !== 'function'
    || !('nativeRefType' in value) || value.nativeRefType !== 'image'
    || 'uri' in value || 'base64' in value) throw new MemoryCaptureError('invalid_image');
}

function assertJpeg(value: unknown): asserts value is MemoryJpeg {
  const keys = ['imageBase64', 'width', 'height', 'byteLength', 'mimeType'];
  if (!value || typeof value !== 'object' || Object.keys(value).some(key => !keys.includes(key))) {
    throw new MemoryCaptureError('invalid_image');
  }
  const image = value as MemoryJpeg;
  const encoded = image.imageBase64;
  if (image.mimeType !== 'image/jpeg' || !Number.isInteger(image.width) || !Number.isInteger(image.height)
    || Math.min(image.width, image.height) < 450 || Math.max(image.width, image.height) > MAX_JPEG_EDGE
    || !Number.isInteger(image.byteLength) || image.byteLength < 4 || image.byteLength > MAX_JPEG_BYTES
    || typeof encoded !== 'string' || encoded.length !== 4 * Math.ceil(image.byteLength / 3)
    || !encoded.startsWith('/9j/') || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    throw new MemoryCaptureError('invalid_image');
  }
  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0;
  if (encoded.length / 4 * 3 - padding !== image.byteLength) throw new MemoryCaptureError('invalid_image');
}

function discardImage(value: unknown): void {
  // Native maps are mutable. This releases our string reference, not a promise
  // of cryptographic erasure of immutable JS/JNI strings or camera-driver RAM.
  if (value && typeof value === 'object' && 'imageBase64' in value) {
    try { (value as { imageBase64: unknown }).imageBase64 = ''; } catch { /* no raw error escapes */ }
  }
}

export interface MemoryCaptureDependencies {
  capture(options: typeof MEMORY_PICTURE_OPTIONS): Promise<unknown>;
  encode(picture: NativePicture, crop: Rect): Promise<unknown>;
  disposePicture(picture: NativePicture): void;
}

interface Operation {
  controller: AbortController;
  reason: 'cancelled' | 'timeout';
  picture?: NativePicture;
  image?: unknown;
}

// Admission is shared across mounted/reopened routes, but holds flags/listeners
// only, never pictures or encoded data. A cancelled native owner must finish
// cleanup before ANY new session allocates another still.
let captureInFlight = false;
const flightListeners = new Set<(busy: boolean) => void>();
function publishFlight(): void {
  flightListeners.forEach(listener => {
    try { listener(captureInFlight); } catch { /* callbacks cannot break cleanup */ }
  });
}

export function createMemoryCaptureSession(dependencies: MemoryCaptureDependencies, timeoutMs = 15_000,
  options: { consumerTimeoutMs?: number } = {}) {
  let operation: Operation | undefined;
  let disposed = false;
  const subscriptions = new Set<(busy: boolean) => void>();

  function releasePicture(current: Operation): void {
    const picture = current.picture;
    current.picture = undefined;
    if (!picture) return;
    try { dependencies.disposePicture(picture); } finally { picture.release(); }
  }

  function cancel(reason: 'cancelled' | 'timeout' = 'cancelled'): void {
    if (!operation || operation.controller.signal.aborted) return;
    operation.reason = reason;
    discardImage(operation.image);
    operation.controller.abort();
  }

  function assertActive(current: Operation): void {
    if (current.controller.signal.aborted) throw new MemoryCaptureError(current.reason);
  }

  async function perform(current: Operation, layout: CaptureLayout,
    consume: (image: MemoryJpeg, signal: AbortSignal) => Promise<void>, beginConsumer: () => void): Promise<CaptureSummary> {
    let stage: FailureCode = 'capture_failed';
    try {
      const picture = await dependencies.capture({ ...MEMORY_PICTURE_OPTIONS });
      stage = 'invalid_image';
      assertPicture(picture);
      current.picture = picture;
      assertActive(current);
      const crop = getGuideCrop(layout, picture);
      stage = 'encode_failed';
      current.image = await dependencies.encode(picture, crop);
      assertActive(current);
      stage = 'invalid_image';
      assertJpeg(current.image);
      const { width, height, byteLength, mimeType } = current.image;
      stage = 'cleanup_failed';
      releasePicture(current); // raw pixels are no longer needed by the consumer
      stage = 'processing_failed';
      beginConsumer();
      await consume(current.image, current.controller.signal);
      assertActive(current);
      return { width, height, byteLength, mimeType };
    } catch {
      // Never retain a native error/cause, an encoded map, or consumer diagnostics.
      throw new MemoryCaptureError(current.controller.signal.aborted ? current.reason : stage);
    } finally {
      discardImage(current.image);
      current.image = undefined;
      try { releasePicture(current); } catch { /* release() was still attempted */ }
    }
  }

  return {
    get busy(): boolean { return captureInFlight; },
    subscribeBusy(listener: (busy: boolean) => void): () => void {
      if (disposed) return () => {};
      subscriptions.add(listener);
      flightListeners.add(listener);
      listener(captureInFlight);
      return () => { subscriptions.delete(listener); flightListeners.delete(listener); };
    },
    cancel,
    dispose(): void {
      disposed = true;
      cancel();
      subscriptions.forEach(listener => flightListeners.delete(listener));
      subscriptions.clear();
    },
    async capture(layout: CaptureLayout,
      consume: (image: MemoryJpeg, signal: AbortSignal) => Promise<void>): Promise<CaptureSummary> {
      if (disposed) throw new MemoryCaptureError('disposed');
      if (operation || captureInFlight) throw new MemoryCaptureError('busy');
      let snapshot: CaptureLayout;
      try { snapshot = copyLayout(layout); } catch { throw new MemoryCaptureError('invalid_layout'); }
      const current: Operation = { controller: new AbortController(), reason: 'cancelled' };
      operation = current;
      captureInFlight = true;
      publishFlight();
      let timeout = setTimeout(() => cancel('timeout'), timeoutMs);
      const work = perform(current, snapshot, consume, () => {
        // The proof keeps its original total 15s deadline. Signup explicitly
        // gives ONLY the consumer its own bounded budget, after raw-pixel cleanup.
        if (options.consumerTimeoutMs !== undefined) {
          clearTimeout(timeout);
          timeout = setTimeout(() => cancel('timeout'), options.consumerTimeoutMs);
        }
      }).finally(() => {
        clearTimeout(timeout);
        if (operation === current) operation = undefined;
        captureInFlight = false;
        publishFlight();
      });
      // Cancellation returns promptly, but the single-flight lock and the
      // cleanup owner live until native work settles. Never recycle a bitmap
      // while native encoding is using it; dispose late capture/encode results.
      return new Promise<CaptureSummary>((resolve, reject) => {
        const signal = current.controller.signal;
        const abort = () => reject(new MemoryCaptureError(current.reason));
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted) abort();
        work.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
      });
    },
  };
}
