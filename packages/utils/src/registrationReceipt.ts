import type { RegistrationDraft, StudentIdVerificationResponse } from "@monteai/types";

const MAX_RECEIPT_LIFETIME_MS = 600_000;

function identityBinding(draft: RegistrationDraft): string | undefined {
  if (draft.role !== "Student" || !draft.id || !draft.email || !draft.studentNumber) {
    return undefined;
  }
  // Snapshot only the bound identity. Even a case/whitespace edit requires a fresh scan.
  return JSON.stringify([
    draft.id, draft.email, draft.studentNumber, draft.firstName,
    draft.middleInitial ?? "", draft.lastName, draft.suffix ?? "",
  ]);
}

/**
 * Per-signup, memory-only receipt holder. No globals, storage, JWT decoding, or image/OCR fields.
 * Clear on successful registration, cancel, sign-out, and unmount. The server is authoritative.
 */
export function createRegistrationReceiptStore(now: () => number = Date.now) {
  let held: { binding: string; receipt: string; expiresAt: number } | undefined;

  return {
    remember(draft: RegistrationDraft, result: StudentIdVerificationResponse): boolean {
      held = undefined;
      const binding = identityBinding(draft);
      const expiresAt = Date.parse(result.expiresAt);
      const remaining = expiresAt - now();
      if (
        !binding || result.outcome !== "verified" ||
        typeof result.receipt !== "string" || !result.receipt || result.receipt.length > 4096 ||
        !Number.isFinite(remaining) || remaining <= 0 || remaining > MAX_RECEIPT_LIFETIME_MS
      ) return false;

      held = { binding, receipt: result.receipt, expiresAt };
      return true;
    },
    get(draft: RegistrationDraft): string | undefined {
      if (!held || held.expiresAt <= now() || held.binding !== identityBinding(draft)) {
        held = undefined;
        return undefined;
      }
      return held.receipt;
    },
    clear(): void {
      // JavaScript strings cannot be zeroed; discard the reference instead.
      held = undefined;
    },
  };
}
