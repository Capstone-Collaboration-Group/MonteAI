import { isAxiosError } from "axios";
import { createIdVerificationService, IdVerificationError, RegistrationError, requireStudentSignupDraft,
  sanitizeIdVerificationError, sanitizeRegistrationError } from "@monteai/api";
import type { RegistrationDraft, RegisterUserRequest, StudentIdVerificationRequest, StudentIdVerificationResponse } from "@monteai/types";
import { PRIVACY_NOTICE_VERSION, TERMS_AND_CONDITIONS_VERSION } from "@monteai/types";
import { isValidEmailForRole, toRegistrationDraft } from "@monteai/utils";
import type { RegistrationIdVerification } from "@monteai/ui";
import { auth } from "./firebase";
import { apiClient } from "./apiClient";
import { authService, getFreshFirebaseIdToken } from "./authService";

// Verification AND registration share the explicit toggle. A failed/missing
// live service never falls back to a mock receipt or a mock registration.
export const registrationUsesMock = import.meta.env.VITE_USE_MOCK === "true";
export const idVerificationEndpoint = import.meta.env.VITE_ID_VERIFICATION_ENDPOINT?.trim();
const registrationApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

function httpEndpoint(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password && !url.search && !url.hash;
  } catch { return false; }
}
const liveConfigured = httpEndpoint(idVerificationEndpoint) && httpEndpoint(registrationApiBaseUrl);

function exactRegistrationDraft(value: RegistrationDraft): RegistrationDraft {
  const draft = toRegistrationDraft(value);
  if (!draft || Object.entries(draft).some(([key, field]) => value[key as keyof RegistrationDraft] !== field)) {
    throw new RegistrationError("identity_mismatch");
  }
  return Object.freeze(draft);
}

function requireBoundAccount(draft: RegistrationDraft, signal: AbortSignal, verified = true): void {
  if (signal.aborted) throw new RegistrationError("cancelled");
  const user = auth.currentUser;
  if (!user || user.uid !== draft.id || user.email?.trim().toLowerCase() !== draft.email.trim().toLowerCase()) {
    throw new RegistrationError("identity_mismatch");
  }
  if (verified && !user.emailVerified) throw new RegistrationError("email_unverified");
}

async function freshBoundToken(draft: RegistrationDraft, signal: AbortSignal, verified = true): Promise<string> {
  requireBoundAccount(draft, signal, verified);
  const token = await getFreshFirebaseIdToken();
  requireBoundAccount(draft, signal, verified);
  if (!token) throw new RegistrationError("authentication_required");
  return token;
}

export async function verifyRegistrationId(request: StudentIdVerificationRequest, draft: RegistrationDraft, signal: AbortSignal) {
  let capture: StudentIdVerificationRequest | undefined;
  let result: StudentIdVerificationResponse | undefined;
  const discard = () => { if (capture) capture.imageBase64 = ""; };
  try {
    if (signal.aborted) throw new RegistrationError("cancelled");
    const bound = exactRegistrationDraft(draft);
    requireBoundAccount(bound, signal);
    if (!registrationUsesMock && !liveConfigured) throw new IdVerificationError({ code: "client_not_configured", message: "" });
    requireStudentSignupDraft(bound);
    const student = { studentNumber: bound.studentNumber!, firstName: bound.firstName, middleInitial: bound.middleInitial ?? "",
      lastName: bound.lastName, suffix: bound.suffix ?? "" };
    if (!request?.student || Object.entries(student).some(([key, field]) => request.student[key as keyof typeof student] !== field) ||
      typeof request.imageBase64 !== "string" || !request.imageBase64 || request.imageBase64.length > 4 * 1024 * 1024 ||
      request.imageBase64.startsWith("data:")) throw new IdVerificationError({ code: "invalid_request", message: "" });
    // Own only the strict envelope, never unknown fields or source toJSON hooks.
    capture = { student, imageBase64: request.imageBase64 };
    signal.addEventListener("abort", discard, { once: true });
    if (registrationUsesMock) await freshBoundToken(bound, signal);
    const service = createIdVerificationService({
      endpoint: idVerificationEndpoint,
      useMock: registrationUsesMock,
      // Bind BOTH refreshes (including the one allowed verification 401 retry)
      // to this signup, never the generic MFA/session token provider.
      getFreshFirebaseIdToken: () => freshBoundToken(bound, signal),
    });
    result = await service.verifyStudentId(capture, { signal });
    requireBoundAccount(bound, signal); // a late success cannot cross an account change
    return result; // receipt ownership transfers only to the signup controller
  } catch (error) {
    if (result) { try { result.receipt = ""; } catch { /* drop immutable response ownership */ } }
    if (error instanceof RegistrationError) {
      const safe = sanitizeRegistrationError(error);
      const code = safe.code === "identity_mismatch" ? "authentication_required"
        : safe.code === "cancelled" || safe.code === "email_unverified" || safe.code === "authentication_required" || safe.code === "service_unavailable"
          ? safe.code : "invalid_request";
      throw sanitizeIdVerificationError(new IdVerificationError({ code, message: "" }));
    }
    throw sanitizeIdVerificationError(error);
  } finally { signal.removeEventListener("abort", discard); discard(); capture = undefined; }
}

export const studentIdVerification: RegistrationIdVerification = {
  configured: registrationUsesMock || liveConfigured,
  useMock: registrationUsesMock,
  verify: verifyRegistrationId,
};

export async function registerPendingProfile(request: RegisterUserRequest, options: { signal?: AbortSignal } = {}): Promise<void> {
  const signal = options.signal ?? new AbortController().signal;
  let profile: RegisterUserRequest | undefined;
  const discard = () => { if (profile) profile.idVerificationReceipt = undefined; };
  try {
    // Runtime allowlist: never let unknown fields or a caller's toJSON hook
    // turn a registration request into a capture/diagnostics storage path.
    const draft = exactRegistrationDraft(request);
    requireBoundAccount(draft, signal);
    if (!draft.privacyNoticeAccepted || draft.privacyNoticeVersion !== PRIVACY_NOTICE_VERSION) throw new RegistrationError("privacy_notice_required");
    if (!draft.termsAccepted || draft.termsVersion !== TERMS_AND_CONDITIONS_VERSION) throw new RegistrationError("terms_required");
    if (draft.role === "Student") {
      requireStudentSignupDraft(draft);
      if (typeof request.idVerificationReceipt !== "string" || !request.idVerificationReceipt || request.idVerificationReceipt.length > 4096) {
        throw new RegistrationError("invalid_receipt");
      }
    } else if (!isValidEmailForRole(draft.email, "Faculty")) throw new RegistrationError("faculty_email_required");
    if (!registrationUsesMock && !httpEndpoint(registrationApiBaseUrl)) throw new RegistrationError("service_unavailable");
    profile = { ...draft, ...(draft.role === "Student" ? { idVerificationReceipt: request.idVerificationReceipt } : {}) };
    signal.addEventListener("abort", discard, { once: true });
    if (registrationUsesMock) {
      // Keep Firebase identity checks, but NEVER send a mock receipt to the API.
      await freshBoundToken(draft, signal);
    } else await authService.register(profile, { signal }); // explicit fresh Firebase header; no automatic registration retry
    requireBoundAccount(draft, signal);
  } catch (error) { throw sanitizeRegistrationError(error); }
  finally { signal.removeEventListener("abort", discard); discard(); profile = undefined; }
}

/** An existing-account check cannot use a stale MFA JWT from another session,
 * or interpret network/auth failures as "no profile". Only 404 means absent. */
export async function checkExistingSignupProfile(draft: RegistrationDraft, signal: AbortSignal): Promise<{ id: string } | null> {
  let bound: RegistrationDraft | undefined;
  try {
    bound = exactRegistrationDraft(draft);
    if (!registrationUsesMock && !httpEndpoint(registrationApiBaseUrl)) throw new RegistrationError("service_unavailable");
    const token = await freshBoundToken(bound, signal, false);
    if (registrationUsesMock) return null;
    const { data } = await apiClient.get<{ id?: unknown }>("/auth/me", { signal, headers: { Authorization: `Bearer ${token}` } });
    requireBoundAccount(bound, signal, false);
    if (!data || data.id !== bound.id) throw new RegistrationError("identity_mismatch");
    return { id: bound.id }; // do not retain arbitrary profile/response fields
  } catch (error) {
    if (bound) requireBoundAccount(bound, signal, false);
    if (isAxiosError(error) && error.response?.status === 404) return null;
    throw sanitizeRegistrationError(error);
  }
}
