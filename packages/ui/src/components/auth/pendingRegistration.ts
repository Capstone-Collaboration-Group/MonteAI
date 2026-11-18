// packages/ui/src/components/auth/pendingRegistration.ts
import type { RegistrationDraft } from "@monteai/types";
import { toRegistrationDraft } from "@monteai/utils";

export type PendingRegistration = {
  uid: string;
  payload: RegistrationDraft;
  createdAt: number;
};

const STORAGE_KEY = "monteai.pendingRegistration";

function projectPending(value: unknown): PendingRegistration | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const payload = toRegistrationDraft(source.payload);
  if (
    typeof source.uid !== "string" || !source.uid || !payload || payload.id !== source.uid ||
    typeof source.createdAt !== "number" || !Number.isFinite(source.createdAt) || source.createdAt < 0
  ) return null;
  return { uid: source.uid, payload, createdAt: source.createdAt };
}

function storage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getPendingRegistration(): PendingRegistration | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return null;
    const pending = projectPending(JSON.parse(raw));
    if (!pending) {
      store.removeItem(STORAGE_KEY);
      return null;
    }
    const clean = JSON.stringify(pending);
    if (clean !== raw) {
      // Remove legacy secrets before rewriting, so a failed write cannot leave them behind.
      store.removeItem(STORAGE_KEY);
      store.setItem(STORAGE_KEY, clean);
    }
    return pending;
  } catch {
    clearPendingRegistration();
    return null;
  }
}

export function savePendingRegistration(pending: PendingRegistration): void {
  const store = storage();
  if (!store) return;
  try {
    const clean = projectPending(pending);
    store.removeItem(STORAGE_KEY);
    if (clean) store.setItem(STORAGE_KEY, JSON.stringify(clean));
  } catch {
    // Storage full or blocked — resume-on-reload simply won't work.
  }
}

export function clearPendingRegistration(): void {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function hasPendingRegistrationFor(uid: string): boolean {
  const pending = getPendingRegistration();
  return pending !== null && pending.uid === uid;
}
