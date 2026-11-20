import { parsePendingStudentRegistration, toPendingStudentRegistration,
  type PendingStudentRegistration } from './pendingRegistration';

export const PENDING_REGISTRATION_KEY = 'monteai.pendingRegistration';
interface DraftStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/** Serialize writes so a late save cannot resurrect a signed-out/cancelled draft. */
export function createPendingRegistrationStore(storage: DraftStorage) {
  let tail = Promise.resolve();
  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const work = tail.then(task);
    tail = work.then(() => {}, () => {});
    return work;
  }

  async function remove(): Promise<void> {
    try { await storage.removeItem(PENDING_REGISTRATION_KEY); } catch { /* no diagnostics */ }
  }

  return {
    read(): Promise<PendingStudentRegistration | null> {
      return enqueue(async () => {
        try {
          const raw = await storage.getItem(PENDING_REGISTRATION_KEY);
          if (!raw) return null;
          const pending = parsePendingStudentRegistration(raw);
          if (!pending) { await remove(); return null; }
          const clean = JSON.stringify(pending);
          if (clean !== raw) {
            // Remove first: failed rewrites must not leave legacy secret fields.
            await storage.removeItem(PENDING_REGISTRATION_KEY);
            await storage.setItem(PENDING_REGISTRATION_KEY, clean);
          }
          return pending;
        } catch { return null; }
      });
    },
    write(value: PendingStudentRegistration | null): Promise<void> {
      // Projection happens synchronously, before enqueueing. Never retain a
      // caller's DTO/password/receipt/capture in a pending storage operation.
      const pending = value ? toPendingStudentRegistration(value) : null;
      const clean = pending ? JSON.stringify(pending) : null;
      return enqueue(async () => {
        if (clean === null) { await remove(); return; }
        try { await storage.setItem(PENDING_REGISTRATION_KEY, clean); } catch { /* memory gate remains active */ }
      });
    },
  };
}
