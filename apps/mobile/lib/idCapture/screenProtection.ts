interface ScreenProtection {
  prevent(key: string): Promise<void>;
  allow(key: string): Promise<void>;
}

// Expo records a key before its native promise settles. Serialize acquisition/
// release across effect replay and route remounts, and never reuse a failed key.
// This queue contains lifecycle flags/keys only, never image or receipt data.
let sequence = 0;
let tail = Promise.resolve();
function enqueue(action: () => Promise<void>): Promise<boolean> {
  const work = tail.then(action).then(() => true, () => false);
  tail = work.then(() => {});
  return work;
}

export function acquireSignupScreenProtection(native: ScreenProtection) {
  const key = `monteai-student-signup-id-${++sequence}`;
  const ready = enqueue(() => native.prevent(key));
  let released = false;
  return {
    ready,
    release(): void {
      if (released) return;
      released = true;
      void enqueue(() => native.allow(key));
    },
  };
}
