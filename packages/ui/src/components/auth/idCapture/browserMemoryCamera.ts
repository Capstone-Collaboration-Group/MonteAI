// Browser camera only. A bounded video frame is cropped straight into an
// unattached canvas; JPEG/bytes/base64 stay with this per-camera cleanup owner.
// No ImageCapture.takePhoto, FileReader, data/object URL, file, or image cache.
export const BROWSER_ID_CARD_ASPECT_RATIO = 720 / 1120;
export const BROWSER_MAX_INPUT_PIXELS = 12_000_000;
export const BROWSER_MAX_INPUT_EDGE = 6000;
export const BROWSER_MAX_JPEG_BYTES = 2 * 1024 * 1024;
export const BROWSER_MAX_JPEG_EDGE = 1600;
export const BROWSER_MIN_JPEG_EDGE = 450;
export const BROWSER_CAPTURE_TIMEOUT_MS = 15_000;
export const BROWSER_CONSUMER_TIMEOUT_MS = 50_000;

// Both maxima together are below 6 MP. Browsers can ignore ideal constraints;
// actual dimensions and the crop are checked again BEFORE allocating a canvas.
export const BROWSER_CAMERA_CONSTRAINTS = Object.freeze({
  audio: false,
  video: Object.freeze({
    facingMode: Object.freeze({ ideal: "environment" }),
    width: Object.freeze({ ideal: 1920, max: 2560 }),
    height: Object.freeze({ ideal: 1440, max: 2160 }),
    frameRate: Object.freeze({ ideal: 15, max: 30 }),
  }),
});

export interface BrowserCameraSize { width: number; height: number }
export interface BrowserCameraRect extends BrowserCameraSize { originX: number; originY: number }
export interface BrowserCameraLayout { preview: BrowserCameraSize; guide: BrowserCameraRect }
export interface BrowserCaptureSummary extends BrowserCameraSize { byteLength: number; mimeType: "image/jpeg" }
export interface BrowserMemoryJpeg extends BrowserCaptureSummary { imageBase64: string }

const MESSAGES = {
  unavailable: "Camera capture needs a supported browser on HTTPS or localhost. There is no file alternative.",
  permission_denied: "Camera access was not allowed. Allow Camera in this site's browser settings, then tap Open camera again.",
  busy: "Earlier camera or signup work is still finishing. Please wait.",
  disposed: "Return to signup and explicitly open the camera again.",
  invalid_layout: "Wait for the camera preview and portrait guide to finish loading.",
  invalid_image: "This camera frame is too small or too large. Use a supported camera and keep every ID edge inside the guide.",
  capture_failed: "The camera could not start or capture safely. Close it and try again.",
  encode_failed: "The ID could not be encoded within the capture limits. Retake in clear, even lighting.",
  processing_failed: "The capture could not be checked safely. Please try again.",
  camera_interrupted: "Camera access ended. The capture and verification were discarded. Reopen the camera to continue.",
  cancelled: "Camera closed; capture and verification discarded.",
  timeout: "Camera or signup work took too long. Reopen the camera after cleanup finishes.",
} as const;

export type BrowserCameraErrorCode = keyof typeof MESSAGES;
type CancelReason = "cancelled" | "timeout" | "camera_interrupted";

export class BrowserMemoryCameraError extends Error {
  readonly code: BrowserCameraErrorCode;
  constructor(code: BrowserCameraErrorCode) {
    const safeCode = Object.prototype.hasOwnProperty.call(MESSAGES, code) ? code : "capture_failed";
    super(MESSAGES[safeCode]);
    this.name = "BrowserMemoryCameraError";
    this.code = safeCode;
  }
}

function validSize(size: BrowserCameraSize | undefined): size is BrowserCameraSize {
  return !!size && Number.isFinite(size.width) && Number.isFinite(size.height) && size.width > 0 && size.height > 0;
}

export function getBrowserIdGuide(preview: BrowserCameraSize): BrowserCameraRect {
  if (!validSize(preview)) throw new BrowserMemoryCameraError("invalid_layout");
  const width = Math.min(preview.width * 0.84, preview.height * 0.84 * BROWSER_ID_CARD_ASPECT_RATIO);
  const height = width / BROWSER_ID_CARD_ASPECT_RATIO;
  return { originX: (preview.width - width) / 2, originY: (preview.height - height) / 2, width, height };
}

function copyLayout(layout: BrowserCameraLayout): BrowserCameraLayout {
  const preview = layout?.preview;
  const guide = layout?.guide;
  if (!validSize(preview) || !validSize(guide) || !Number.isFinite(guide.originX) || !Number.isFinite(guide.originY) ||
    guide.originX < 0 || guide.originY < 0 || guide.originX + guide.width > preview.width ||
    guide.originY + guide.height > preview.height || Math.abs(guide.width / guide.height - BROWSER_ID_CARD_ASPECT_RATIO) > 0.01) {
    throw new BrowserMemoryCameraError("invalid_layout");
  }
  return { preview: { ...preview }, guide: { ...guide } };
}

function assertInputSize(image: BrowserCameraSize): void {
  if (!validSize(image) || !Number.isInteger(image.width) || !Number.isInteger(image.height) ||
    image.width * image.height > BROWSER_MAX_INPUT_PIXELS || Math.max(image.width, image.height) > BROWSER_MAX_INPUT_EDGE) {
    throw new BrowserMemoryCameraError("invalid_image");
  }
}

// The video element uses object-fit: cover, object-position: center, no mirror.
// Crop coordinates map the visible guide into the video pixels, not CSS pixels.
export function getBrowserGuideCrop(layout: BrowserCameraLayout, image: BrowserCameraSize): BrowserCameraRect {
  const { preview, guide } = copyLayout(layout);
  assertInputSize(image);
  const scale = Math.max(preview.width / image.width, preview.height / image.height);
  const offsetX = (image.width * scale - preview.width) / 2;
  const offsetY = (image.height * scale - preview.height) / 2;
  const originX = Math.max(0, Math.floor((guide.originX + offsetX) / scale));
  const originY = Math.max(0, Math.floor((guide.originY + offsetY) / scale));
  const endX = Math.min(image.width, Math.ceil((guide.originX + guide.width + offsetX) / scale));
  const endY = Math.min(image.height, Math.ceil((guide.originY + guide.height + offsetY) / scale));
  const crop = { originX, originY, width: endX - originX, height: endY - originY };
  getBrowserJpegSize(crop);
  return crop;
}

export function getBrowserJpegSize(crop: BrowserCameraSize): BrowserCameraSize {
  assertInputSize(crop);
  const scale = Math.min(1, BROWSER_MAX_JPEG_EDGE / Math.max(crop.width, crop.height));
  const output = { width: Math.floor(crop.width * scale), height: Math.floor(crop.height * scale) };
  if (Math.min(output.width, output.height) < BROWSER_MIN_JPEG_EDGE) throw new BrowserMemoryCameraError("invalid_image");
  return output;
}

export interface BrowserCameraDependencies {
  getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream>;
  createCanvas(): HTMLCanvasElement;
}

export interface BrowserMemoryCameraState extends BrowserCameraSize {
  phase: "closed" | "opening" | "preview" | "capturing" | "consuming";
  busy: boolean;
  /** Admission only: another session can hold a preview or late cleanup. */
  blocked: boolean;
  failure?: { code: BrowserCameraErrorCode; message: string };
}

interface Operation {
  controller: AbortController;
  reason: CancelReason;
  canvas?: HTMLCanvasElement;
  blob?: Blob;
  bytes?: Uint8Array;
  image?: BrowserMemoryJpeg;
}

// Cross-remount admission contains an opaque lease and notifications ONLY. No
// stream, pixels, draft, receipt, request, or exception is kept in a global.
let cameraLease: symbol | undefined;
const admissionListeners = new Set<() => void>();
function publishAdmission(): void {
  admissionListeners.forEach(listener => { try { listener(); } catch { /* never diagnostics */ } });
}

function discardImage(current: Operation): void {
  if (current.image) current.image.imageBase64 = "";
  current.bytes?.fill(0);
  current.bytes = undefined;
}

function stopStream(stream: MediaStream | undefined): void {
  try { stream?.getTracks().forEach(track => { try { track.stop(); } catch { /* attempt all tracks */ } }); } catch { /* safe boundary */ }
}

function detachVideo(video: HTMLVideoElement | undefined): void {
  if (!video) return;
  try { video.pause(); } catch { /* still detach */ }
  try { video.srcObject = null; } catch { /* no URL fallback */ }
}

function base64(bytes: Uint8Array): string {
  let result = "";
  // Multiples of three permit independent base64 chunks without interior padding.
  for (let offset = 0; offset < bytes.length; offset += 24_576) {
    result += btoa(String.fromCharCode(...bytes.subarray(offset, offset + 24_576)));
  }
  return result;
}

function currentFrame(video: HTMLVideoElement): boolean {
  return video.readyState >= 2 && !video.paused && !video.ended && video.videoWidth > 0 && video.videoHeight > 0;
}

function waitForFrame(video: HTMLVideoElement, signal: AbortSignal): { ready: Promise<void>; dispose: () => void } {
  let finish = (_failed: boolean) => {};
  const ready = new Promise<void>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      ["loadeddata", "playing", "resize"].forEach(event => video.removeEventListener(event, check));
      video.removeEventListener("error", failed);
      signal.removeEventListener("abort", failed);
    };
    finish = failed => {
      if (settled) return;
      settled = true;
      cleanup();
      if (failed) reject(new BrowserMemoryCameraError("capture_failed")); else resolve();
    };
    const check = () => { if (currentFrame(video)) finish(false); };
    const failed = () => finish(true);
    ["loadeddata", "playing", "resize"].forEach(event => video.addEventListener(event, check));
    video.addEventListener("error", failed, { once: true });
    signal.addEventListener("abort", failed, { once: true });
    if (signal.aborted) failed();
    else check();
  });
  return { ready, dispose: () => finish(true) };
}

export function createBrowserMemoryCameraSession(dependencies: BrowserCameraDependencies = {
  getUserMedia: constraints => {
    if (typeof window === "undefined" || !window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      throw new BrowserMemoryCameraError("unavailable");
    }
    return navigator.mediaDevices.getUserMedia(constraints);
  },
  createCanvas: () => document.createElement("canvas"),
}, options: { captureTimeoutMs?: number; consumerTimeoutMs?: number; onInterrupted?: () => void } = {}) {
  const lease = Symbol("browser-memory-camera");
  const listeners = new Set<(state: BrowserMemoryCameraState) => void>();
  let operation: Operation | undefined;
  let disposed = false;
  let phase: BrowserMemoryCameraState["phase"] = "closed";
  let failure: BrowserMemoryCameraState["failure"];
  let stream: MediaStream | undefined;
  let video: HTMLVideoElement | undefined;
  let dimensions: BrowserCameraSize = { width: 0, height: 0 };
  let removeStreamListeners: (() => void) | undefined;
  let removeVideoListeners: (() => void) | undefined;

  function getState(): BrowserMemoryCameraState {
    return { phase, busy: !!operation, blocked: cameraLease !== undefined && cameraLease !== lease,
      ...dimensions, failure: failure ? { ...failure } : undefined };
  }
  function publish(): void {
    if (!disposed) listeners.forEach(listener => { try { listener(getState()); } catch { /* callbacks cannot own cleanup */ } });
  }
  admissionListeners.add(publish);

  function closePreview(): void {
    removeStreamListeners?.();
    removeStreamListeners = undefined;
    removeVideoListeners?.();
    removeVideoListeners = undefined;
    stopStream(stream);
    stream = undefined;
    detachVideo(video);
    video = undefined;
    dimensions = { width: 0, height: 0 };
  }
  function releaseIfClosed(): void {
    if (!operation && !stream && cameraLease === lease) {
      cameraLease = undefined;
      publishAdmission();
    }
  }
  function cancel(reason: CancelReason = "cancelled"): void {
    if (operation && !operation.controller.signal.aborted) {
      operation.reason = reason;
      discardImage(operation);
      operation.controller.abort();
    }
    closePreview();
    phase = "closed";
    failure = { code: reason, message: MESSAGES[reason] };
    releaseIfClosed();
    publish();
  }
  function assertActive(current: Operation): void {
    if (disposed || current.controller.signal.aborted) throw new BrowserMemoryCameraError(current.reason);
  }
  function acquire(nextPhase: BrowserMemoryCameraState["phase"], needsPreview = false): Operation {
    if (disposed) throw new BrowserMemoryCameraError("disposed");
    if (operation || (cameraLease !== undefined && (!needsPreview || cameraLease !== lease))) throw new BrowserMemoryCameraError("busy");
    if (needsPreview && (!stream || !video || phase !== "preview" || !currentFrame(video))) throw new BrowserMemoryCameraError("invalid_layout");
    const current: Operation = { controller: new AbortController(), reason: "cancelled" };
    cameraLease = lease;
    operation = current;
    phase = nextPhase;
    failure = undefined;
    publishAdmission();
    return current;
  }
  function watchStream(value: MediaStream): void {
    const tracks = value.getTracks();
    if (tracks.length !== 1 || tracks[0].kind !== "video" || tracks[0].readyState !== "live") {
      throw new BrowserMemoryCameraError("capture_failed");
    }
    const settings = tracks[0].getSettings();
    if (settings.width !== undefined && settings.height !== undefined) {
      assertInputSize({ width: settings.width, height: settings.height });
    }
    const interrupted = () => {
      cancel("camera_interrupted");
      try { options.onInterrupted?.(); } catch { /* do not expose callback errors */ }
    };
    value.addEventListener("inactive", interrupted);
    tracks[0].addEventListener("ended", interrupted);
    tracks[0].addEventListener("mute", interrupted);
    removeStreamListeners = () => {
      value.removeEventListener("inactive", interrupted);
      tracks[0].removeEventListener("ended", interrupted);
      tracks[0].removeEventListener("mute", interrupted);
    };
  }

  async function execute<T>(current: Operation, work: (beginConsumer: () => void) => Promise<T>, consumerOnly = false,
    consumerTimeoutMs = options.consumerTimeoutMs ?? BROWSER_CONSUMER_TIMEOUT_MS): Promise<T> {
    let timer = setTimeout(() => cancel("timeout"), consumerOnly
      ? consumerTimeoutMs
      : options.captureTimeoutMs ?? BROWSER_CAPTURE_TIMEOUT_MS);
    const beginConsumer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => cancel("timeout"), consumerTimeoutMs);
      phase = "consuming";
      publish();
    };
    const task = Promise.resolve().then(() => { assertActive(current); return work(beginConsumer); })
      .finally(() => {
        clearTimeout(timer);
        discardImage(current);
        current.image = undefined;
        current.blob = undefined;
        if (current.canvas) {
          try { current.canvas.width = 0; } catch { /* still attempt height/reset */ }
          try { current.canvas.height = 0; } catch { /* never expose encoding diagnostics */ }
        }
        current.canvas = undefined;
        if (operation === current) operation = undefined;
        releaseIfClosed();
        publish();
      });
    // getUserMedia, play, toBlob and arrayBuffer are not reliably abortable.
    // Return cancellation promptly, retaining the lease until ACTUAL cleanup.
    return new Promise<T>((resolve, reject) => {
      const signal = current.controller.signal;
      const abort = () => reject(new BrowserMemoryCameraError(current.reason));
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) abort();
      task.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
    });
  }

  return {
    getState,
    subscribe(listener: (state: BrowserMemoryCameraState) => void): () => void {
      if (disposed) return () => {};
      listeners.add(listener);
      listener(getState());
      return () => { listeners.delete(listener); };
    },
    cancel,
    dispose(): void {
      cancel();
      disposed = true;
      listeners.clear();
      admissionListeners.delete(publish);
    },
    async open(element: HTMLVideoElement, prepare: (signal: AbortSignal) => Promise<void>): Promise<void> {
      const current = acquire("opening");
      return execute(current, async () => {
        let code: BrowserCameraErrorCode = "capture_failed";
        try {
          await prepare(current.controller.signal);
          assertActive(current);
          const acquired = await dependencies.getUserMedia({ audio: false, video: {
            ...BROWSER_CAMERA_CONSTRAINTS.video,
            facingMode: { ...BROWSER_CAMERA_CONSTRAINTS.video.facingMode },
            width: { ...BROWSER_CAMERA_CONSTRAINTS.video.width }, height: { ...BROWSER_CAMERA_CONSTRAINTS.video.height },
            frameRate: { ...BROWSER_CAMERA_CONSTRAINTS.video.frameRate },
          } });
          if (current.controller.signal.aborted || disposed) { stopStream(acquired); assertActive(current); }
          stream = acquired;
          watchStream(acquired);
          video = element;
          element.muted = true;
          element.playsInline = true;
          element.srcObject = acquired;
          const frame = waitForFrame(element, current.controller.signal);
          const playing = Promise.resolve().then(() => { assertActive(current); return element.play(); });
          try { await Promise.all([frame.ready, playing]); }
          finally {
            frame.dispose();
            // A cancelled frame waiter must not release admission while the
            // browser's non-abortable playback promise is still running.
            await playing.catch(() => {});
          }
          assertActive(current);
          code = "invalid_image";
          dimensions = { width: element.videoWidth, height: element.videoHeight };
          assertInputSize(dimensions);
          const interrupted = () => {
            cancel("camera_interrupted");
            try { options.onInterrupted?.(); } catch { /* cleanup still completed */ }
          };
          const resized = () => {
            if (element.videoWidth !== dimensions.width || element.videoHeight !== dimensions.height) interrupted();
          };
          element.addEventListener("resize", resized);
          ["error", "emptied", "ended", "pause"].forEach(event => element.addEventListener(event, interrupted));
          removeVideoListeners = () => {
            element.removeEventListener("resize", resized);
            ["error", "emptied", "ended", "pause"].forEach(event => element.removeEventListener(event, interrupted));
          };
          phase = "preview";
          publish();
        } catch (error) {
          closePreview();
          detachVideo(element); // also pause any playback that settled after cancellation
          phase = "closed";
          if (current.controller.signal.aborted || disposed) code = current.reason;
          else if (error instanceof BrowserMemoryCameraError) code = error.code;
          else if (error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError")) code = "permission_denied";
          failure = { code, message: MESSAGES[code] };
          throw new BrowserMemoryCameraError(code);
        }
      });
    },
    async capture(layout: BrowserCameraLayout, consume: (image: BrowserMemoryJpeg, signal: AbortSignal) => Promise<void>): Promise<BrowserCaptureSummary> {
      // Validate the visible layout before taking the global lease or any pixels.
      const snapshot = copyLayout(layout);
      const current = acquire("capturing", true);
      return execute(current, async beginConsumer => {
        let code: BrowserCameraErrorCode = "invalid_image";
        try {
          assertActive(current);
          const reference = video!;
          if (stream!.getTracks().some(track => track.kind !== "video" || track.readyState !== "live")) {
            throw new BrowserMemoryCameraError("invalid_image");
          }
          const crop = getBrowserGuideCrop(snapshot, { width: reference.videoWidth, height: reference.videoHeight });
          const output = getBrowserJpegSize(crop);
          code = "capture_failed";
          current.canvas = dependencies.createCanvas();
          current.canvas.width = output.width;
          current.canvas.height = output.height;
          const context = current.canvas.getContext("2d", { alpha: false });
          if (!context) throw new BrowserMemoryCameraError("capture_failed");
          context.drawImage(reference, crop.originX, crop.originY, crop.width, crop.height, 0, 0, output.width, output.height);
          code = "encode_failed";
          current.blob = await new Promise<Blob>((resolve, reject) => current.canvas!.toBlob(value => value
            ? resolve(value) : reject(new BrowserMemoryCameraError("encode_failed")), "image/jpeg", 0.86));
          assertActive(current);
          if (current.blob.type !== "image/jpeg" || current.blob.size < 4 || current.blob.size > BROWSER_MAX_JPEG_BYTES) {
            throw new BrowserMemoryCameraError("encode_failed");
          }
          current.bytes = new Uint8Array(await current.blob.arrayBuffer());
          assertActive(current);
          const bytes = current.bytes;
          if (bytes.length !== current.blob.size || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff ||
            bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) throw new BrowserMemoryCameraError("encode_failed");
          const summary: BrowserCaptureSummary = { ...output, byteLength: bytes.length, mimeType: "image/jpeg" };
          current.image = { ...summary, imageBase64: base64(bytes) };
          bytes.fill(0);
          current.bytes = undefined;
          current.blob = undefined;
          // Reset only after the asynchronous encoder is done; never recycle its
          // bitmap while toBlob is still working, including on cancellation.
          current.canvas.width = 0;
          current.canvas.height = 0;
          current.canvas = undefined;
          closePreview();
          code = "processing_failed";
          beginConsumer();
          await consume(current.image, current.controller.signal);
          assertActive(current);
          phase = "closed";
          return summary;
        } catch {
          closePreview();
          phase = "closed";
          if (current.controller.signal.aborted || disposed) code = current.reason;
          failure = { code, message: MESSAGES[code] };
          throw new BrowserMemoryCameraError(code);
        }
      });
    },
    /** No-pixel signup work and explicit registration-only retry share admission. */
    async runConsumer(consume: (signal: AbortSignal) => Promise<void>, workOptions: { timeoutMs?: number } = {}): Promise<void> {
      const current = acquire("consuming");
      return execute(current, async () => {
        try {
          await consume(current.controller.signal);
          assertActive(current);
          phase = "closed";
        } catch {
          phase = "closed";
          const code = current.controller.signal.aborted || disposed ? current.reason : "processing_failed";
          failure = { code, message: MESSAGES[code] };
          throw new BrowserMemoryCameraError(code);
        }
      }, true, workOptions.timeoutMs);
    },
  };
}

export type BrowserMemoryCameraSession = ReturnType<typeof createBrowserMemoryCameraSession>;
