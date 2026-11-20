import {
  PRIVACY_NOTICE_VERSION,
  TERMS_AND_CONDITIONS_VERSION,
  type RegistrationDraft,
  type RegisterUserRequest,
  type StudentIdVerificationRequest,
  type StudentIdVerificationResponse,
} from "@monteai/types";
import { createRegistrationReceiptStore, isValidEmailForRole, toRegistrationDraft } from "@monteai/utils";
import { sanitizeIdVerificationError } from "../id-verification/liveIdVerificationService";
import { RegistrationError, sanitizeRegistrationError } from "./registrationError";

export interface OwnedSignupCapture { imageBase64: string }

export interface StudentSignupDependencies {
  /** Reload/force-refresh Firebase and return only the current, verified user's safe draft. */
  getVerifiedDraft(): Promise<RegistrationDraft>;
  verify(request: StudentIdVerificationRequest, draft: RegistrationDraft, signal: AbortSignal): Promise<StudentIdVerificationResponse>;
  register(request: RegisterUserRequest, signal: AbortSignal): Promise<void>;
}

export interface StudentSignupFailure {
  stage: "verification" | "registration" | "flow";
  code: string;
  message: string;
  outcome?: "error" | "retake" | "unmatched";
  status?: number;
}

/** Safe UI state: never a receipt, capture, OCR result, request, or raw exception. */
export interface StudentSignupState {
  phase: "ready" | "verifying" | "registering" | "retry-registration" | "complete";
  busy: boolean;
  failure?: StudentSignupFailure;
  retryAt?: number;
}

export const STUDENT_SIGNUP_TIMEOUT_MS = 45_000;

const FLOW_MESSAGES = {
  busy: "An earlier verification is still finishing. Please wait.",
  disposed: "Resume signup and verify your ID again.",
  cancelled: "Capture and verification discarded. Reopen the camera to continue.",
  timeout: "Verification or registration took too long. Reopen the camera to try again.",
  receipt_expired: "Your ID verification expired. Capture the front of your ID again.",
  details_changed: "Registration details changed. Confirm them and verify your ID again.",
} as const;

type FlowCode = keyof typeof FLOW_MESSAGES;
type AbortReason = "cancelled" | "timeout" | "receipt_expired" | "details_changed";

export class StudentSignupError extends Error {
  readonly code: FlowCode;
  constructor(code: FlowCode) {
    const safeCode = Object.prototype.hasOwnProperty.call(FLOW_MESSAGES, code) ? code : "cancelled";
    super(FLOW_MESSAGES[safeCode]);
    this.name = "StudentSignupError";
    this.code = safeCode;
  }
}

export function requireStudentSignupDraft(value: RegistrationDraft): RegistrationDraft {
  const draft = toRegistrationDraft(value);
  if (!draft || draft.role !== "Student" || !isValidEmailForRole(draft.email, "Student") ||
    !/^\d{2}-\d{5}$/.test(draft.studentNumber ?? "") || !/^[A-Za-z]$/.test(draft.section ?? "") ||
    (draft.middleInitial !== undefined && !/^[A-Za-z]$/.test(draft.middleInitial)) ||
    draft.firstName.length > 50 || draft.lastName.length > 50 || draft.email.length > 100 ||
    (draft.suffix?.length ?? 0) > 10 || draft.institute.length > 100 || (draft.program?.length ?? 0) > 100) {
    throw new RegistrationError("invalid_request");
  }
  if (!draft.privacyNoticeAccepted || draft.privacyNoticeVersion !== PRIVACY_NOTICE_VERSION) {
    throw new RegistrationError("privacy_notice_required");
  }
  if (!draft.termsAccepted || draft.termsVersion !== TERMS_AND_CONDITIONS_VERSION) {
    throw new RegistrationError("terms_required");
  }
  return draft;
}

// Do not canonicalize away even a whitespace/case edit when deciding whether an
// uncertain registration can reuse a receipt. Only validated primitive fields
// participate; no source object, toJSON, image, receipt, or unknown field is kept.
function exactDraftBinding(value: RegistrationDraft): string {
  const keys = ["id", "role", "email", "firstName", "middleInitial", "lastName", "suffix",
    "studentNumber", "position", "institute", "program", "yearLevel", "section",
    "privacyNoticeAccepted", "privacyNoticeVersion", "termsAccepted", "termsVersion"] as const;
  return JSON.stringify(keys.map(key => {
    const field = value[key];
    return typeof field === "string" || typeof field === "boolean" || typeof field === "number" ? field : null;
  }));
}

function discardCapture(image?: OwnedSignupCapture): void {
  if (image) { try { image.imageBase64 = ""; } catch { /* drop immutable SDK references, never diagnostics */ } }
}

interface Operation {
  controller: AbortController;
  reason: AbortReason;
  stage: "verification" | "registration";
  image?: OwnedSignupCapture;
  verificationRequest?: StudentIdVerificationRequest;
  registrationRequest?: RegisterUserRequest;
}

/**
 * Per-signup orchestration, shared by platform-specific camera UIs. Receipt storage
 * is closure-only. An uncertain registration may be retried explicitly with the
 * SAME unexpired receipt and exact draft, without another OCR request.
 */
export function createStudentSignupFlow(dependencies: StudentSignupDependencies, options: {
  now?: () => number;
  timeoutMs?: number;
} = {}) {
  const now = options.now ?? Date.now;
  const receipts = createRegistrationReceiptStore(now);
  const listeners = new Set<(state: StudentSignupState) => void>();
  let state: StudentSignupState = { phase: "ready", busy: false };
  let operation: Operation | undefined;
  let disposed = false;
  let receiptDraft: RegistrationDraft | undefined;
  let receiptBinding: string | undefined;
  let receiptTimer: ReturnType<typeof setTimeout> | undefined;

  function getState(): StudentSignupState {
    return { ...state, failure: state.failure ? { ...state.failure } : undefined };
  }

  function publish(patch: Partial<StudentSignupState>): void {
    state = { ...state, ...patch, busy: operation !== undefined };
    if (!disposed) listeners.forEach(listener => {
      try { listener(getState()); } catch { /* UI callbacks cannot change cleanup ownership */ }
    });
  }

  function forgetReceipt(): void {
    receipts.clear();
    receiptDraft = undefined;
    receiptBinding = undefined;
    if (receiptTimer !== undefined) clearTimeout(receiptTimer);
    receiptTimer = undefined;
  }

  function clearRequests(current: Operation): void {
    discardCapture(current.image);
    current.image = undefined;
    if (current.verificationRequest) current.verificationRequest.imageBase64 = "";
    current.verificationRequest = undefined;
    if (current.registrationRequest) current.registrationRequest.idVerificationReceipt = undefined;
    current.registrationRequest = undefined;
  }

  function cancel(reason: AbortReason = "cancelled"): void {
    forgetReceipt();
    if (state.phase === "complete") return;
    if (operation && !operation.controller.signal.aborted) {
      operation.reason = reason;
      clearRequests(operation);
      operation.controller.abort();
    }
    publish({ phase: "ready", failure: { stage: "flow", code: reason, message: FLOW_MESSAGES[reason] } });
  }

  function assertActive(current: Operation): void {
    if (disposed || current.controller.signal.aborted) throw new StudentSignupError(current.reason);
  }

  async function checkedDraft(current: Operation): Promise<{ draft: RegistrationDraft; binding: string }> {
    const value = await dependencies.getVerifiedDraft();
    assertActive(current);
    const draft = Object.freeze(requireStudentSignupDraft(value));
    const binding = exactDraftBinding(value);
    if (receiptBinding && binding !== receiptBinding) {
      forgetReceipt();
      throw new StudentSignupError("details_changed");
    }
    return { draft, binding };
  }

  async function registerHeldReceipt(current: Operation): Promise<void> {
    current.stage = "registration";
    const { draft } = await checkedDraft(current);
    const receipt = receipts.get(draft);
    if (!receipt) throw new RegistrationError("invalid_receipt");
    publish({ phase: "registering", failure: undefined });
    current.registrationRequest = { ...draft, idVerificationReceipt: receipt };
    try {
      await dependencies.register(current.registrationRequest, current.controller.signal);
      assertActive(current);
      forgetReceipt();
      publish({ phase: "complete", failure: undefined, retryAt: undefined });
    } finally {
      if (current.registrationRequest) current.registrationRequest.idVerificationReceipt = undefined;
      current.registrationRequest = undefined;
    }
  }

  function reportFailure(current: Operation, error: unknown): Error {
    if (current.controller.signal.aborted || disposed) return new StudentSignupError(current.reason);
    if (error instanceof StudentSignupError) {
      const safe = new StudentSignupError(error.code);
      forgetReceipt();
      publish({ phase: "ready", failure: { stage: "flow", code: safe.code, message: safe.message } });
      return safe;
    }
    if (current.stage === "verification" && !(error instanceof RegistrationError)) {
      const safe = sanitizeIdVerificationError(error);
      forgetReceipt();
      const retryAt = safe.retryAfterSeconds === undefined ? undefined
        : Math.min(Number.MAX_SAFE_INTEGER, now() + safe.retryAfterSeconds * 1000);
      publish({ phase: "ready", retryAt, failure: { stage: "verification", code: safe.code,
        message: safe.message, outcome: safe.outcome, status: safe.status } });
      return safe;
    }
    const safe = sanitizeRegistrationError(error);
    const canRetry = safe.code === "service_unavailable" && receiptDraft && receipts.get(receiptDraft);
    if (!canRetry) forgetReceipt();
    publish({ phase: canRetry ? "retry-registration" : "ready", failure: {
      stage: "registration", code: safe.code, message: safe.message, status: safe.status,
    } });
    return safe;
  }

  async function execute(work: (current: Operation) => Promise<void>, image?: OwnedSignupCapture,
    signal?: AbortSignal): Promise<void> {
    if (disposed || state.phase === "complete" || operation) {
      discardCapture(image);
      throw new StudentSignupError(disposed || state.phase === "complete" ? "disposed" : "busy");
    }
    if (signal?.aborted || (state.retryAt ?? 0) > now()) {
      discardCapture(image);
      if (signal?.aborted) cancel();
      throw new StudentSignupError(signal?.aborted ? "cancelled" : "busy");
    }
    const current: Operation = { controller: new AbortController(), reason: "cancelled",
      stage: image ? "verification" : "registration", image };
    operation = current;
    const externalAbort = () => { if (operation === current) cancel(); };
    signal?.addEventListener("abort", externalAbort, { once: true });
    if (signal?.aborted) externalAbort();
    const timeout = setTimeout(() => { if (operation === current) cancel("timeout"); }, options.timeoutMs ?? STUDENT_SIGNUP_TIMEOUT_MS);
    publish({ phase: image ? "verifying" : "registering", failure: undefined, retryAt: undefined });
    const task = Promise.resolve().then(() => { assertActive(current); return work(current); })
      .catch(error => { throw reportFailure(current, error); })
      .finally(() => {
        clearTimeout(timeout);
        signal?.removeEventListener("abort", externalAbort);
        clearRequests(current);
        if (operation === current) operation = undefined;
        publish({});
      });
    // Reject promptly, but retain cleanup/single-flight ownership until a slow
    // token provider or transport settles. Late receipts can never register.
    return new Promise<void>((resolve, reject) => {
      const abort = () => reject(new StudentSignupError(current.reason));
      current.controller.signal.addEventListener("abort", abort, { once: true });
      if (current.controller.signal.aborted) abort();
      task.then(resolve, reject).finally(() => current.controller.signal.removeEventListener("abort", abort));
    });
  }

  return {
    getState,
    subscribe(listener: (value: StudentSignupState) => void): () => void {
      if (disposed) return () => {};
      listeners.add(listener);
      listener(getState());
      return () => { listeners.delete(listener); };
    },
    async verifyAndRegister(image: OwnedSignupCapture, signal?: AbortSignal): Promise<void> {
      return execute(async current => {
        forgetReceipt();
        const { draft, binding } = await checkedDraft(current);
        if (typeof image.imageBase64 !== "string" || !image.imageBase64 || image.imageBase64.length > 4 * 1024 * 1024) {
          throw new RegistrationError("invalid_request");
        }
        current.verificationRequest = { student: { studentNumber: draft.studentNumber!,
          firstName: draft.firstName, middleInitial: draft.middleInitial ?? "", lastName: draft.lastName,
          suffix: draft.suffix ?? "" }, imageBase64: image.imageBase64 };
        let result: StudentIdVerificationResponse | undefined;
        try {
          result = await dependencies.verify(current.verificationRequest, draft, current.controller.signal);
          assertActive(current);
          if (!result || result.templateId !== "cdm-front-v1" || !receipts.remember(draft, result)) {
            throw new RegistrationError("invalid_receipt");
          }
          receiptDraft = draft;
          receiptBinding = binding;
          const remaining = Date.parse(result.expiresAt) - now();
          receiptTimer = setTimeout(() => {
            if (operation) cancel("receipt_expired");
            else {
              forgetReceipt();
              publish({ phase: "ready", failure: { stage: "flow", code: "receipt_expired", message: FLOW_MESSAGES.receipt_expired } });
            }
          }, Math.max(0, remaining));
        } finally {
          discardCapture(image);
          if (current.verificationRequest) current.verificationRequest.imageBase64 = "";
          current.verificationRequest = undefined;
          if (result) { try { result.receipt = ""; } catch { /* drop the local response reference */ } }
          // eslint-disable-next-line no-useless-assignment -- release even immutable responses before registration awaits
          result = undefined;
        }
        await registerHeldReceipt(current);
      }, image, signal);
    },
    async retryRegistration(signal?: AbortSignal): Promise<void> {
      if (state.phase !== "retry-registration") throw new RegistrationError("invalid_receipt");
      return execute(registerHeldReceipt, undefined, signal);
    },
    cancel,
    invalidate(): void {
      cancel("details_changed");
    },
    dispose(): void {
      cancel();
      disposed = true;
      listeners.clear();
    },
  };
}

export type StudentSignupFlow = ReturnType<typeof createStudentSignupFlow>;
