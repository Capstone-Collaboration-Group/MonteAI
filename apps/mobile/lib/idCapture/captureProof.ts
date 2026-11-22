import { MemoryCaptureError } from './memoryCapture';

// Proof-only consumer: it can never finish as a successful capture. The session's
// existing watchdog bounds retention if the tester does not cancel. No image or
// native reference is captured by this listener; the session owns its envelope.
export function holdUntilCaptureAbort(signal: AbortSignal): Promise<never> {
  return new Promise((_resolve, reject) => {
    const abort = () => {
      signal.removeEventListener('abort', abort);
      reject(new MemoryCaptureError('cancelled'));
    };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
}

interface ActivitySubscription { remove(): void }
interface CaptureActivitySource {
  readonly currentState: string;
  addEventListener(type: 'change', listener: (state: string) => void): ActivitySubscription;
  addEventListener(type: 'blur' | 'focus', listener: () => void): ActivitySubscription;
}

// Android's notification drawer can blur the window while currentState remains
// "active". Focus returning only enables an explicit reopen; it never opens a
// camera. This adapter carries lifecycle flags only, never an image or receipt.
export function observeCaptureActivity(source: CaptureActivitySource, onActive: (active: boolean) => void): () => void {
  let state = source.currentState;
  let focused = true;
  let disposed = false;
  const publish = () => { if (!disposed) onActive(state === 'active' && focused); };
  const subscriptions = [
    source.addEventListener('change', next => { state = next; publish(); }),
    source.addEventListener('blur', () => { focused = false; publish(); }),
    source.addEventListener('focus', () => { state = source.currentState; focused = true; publish(); }),
  ];
  publish();
  return () => {
    if (disposed) return;
    disposed = true;
    subscriptions.forEach(subscription => subscription.remove());
  };
}
