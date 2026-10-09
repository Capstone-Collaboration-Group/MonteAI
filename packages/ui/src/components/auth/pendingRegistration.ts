// packages/ui/src/components/auth/pendingRegistration.ts
import type { RegisterUserRequest } from "@monteai/types";

export type PendingRegistration = {
  uid: string;
  payload: RegisterUserRequest;
  createdAt: number;
};

const STORAGE_KEY = "monteai.pendingRegistration";

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
    const parsed = JSON.parse(raw) as Partial<PendingRegistration> | null;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.uid !== "string" ||
      !parsed.payload ||
      typeof parsed.payload !== "object" ||
      typeof parsed.payload.email !== "string"
    ) {
      return null;
    }
    return parsed as PendingRegistration;
  } catch {
    return null;
  }
}

export function savePendingRegistration(pending: PendingRegistration): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(pending));
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
