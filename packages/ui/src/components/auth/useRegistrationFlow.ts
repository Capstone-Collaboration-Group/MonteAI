import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { FirebaseError } from "firebase/app";
import { createUserWithEmailAndPassword, onIdTokenChanged, sendEmailVerification, signInWithEmailAndPassword,
  signOut, updateProfile, type Auth, type User } from "firebase/auth";
import { isAxiosError } from "axios";
import { useAuth } from "@monteai/hooks";
import { createFirebaseTokenAccessors, createStudentSignupFlow, RegistrationError, requireStudentSignupDraft,
  sanitizeRegistrationError, STUDENT_SIGNUP_TIMEOUT_MS, type RegistrationRequestOptions, type StudentSignupFlow,
  type StudentSignupState } from "@monteai/api";
import { PRIVACY_NOTICE_VERSION, TERMS_AND_CONDITIONS_VERSION, type RegistrationDraft,
  type RegistrationRole, type RegisterUserRequest, type StudentIdVerificationRequest,
  type StudentIdVerificationResponse } from "@monteai/types";
import { FACULTY_EMAIL_DOMAIN, isValidEmailForRole, toRegistrationDraft } from "@monteai/utils";
import { clearPendingRegistration, getActivePendingRegistration, savePendingRegistration, subscribePendingRegistration,
  type PendingRegistration } from "./pendingRegistration";
import { BROWSER_CAPTURE_TIMEOUT_MS, BrowserMemoryCameraError, createBrowserMemoryCameraSession,
  type BrowserMemoryCameraSession } from "./idCapture/browserMemoryCamera";
import { awaitBrowserSignupCleanup, retireStudentSignupFlow } from "./idCapture/signupCleanup";

export interface RegistrationIdVerification {
  configured: boolean;
  useMock?: boolean;
  verify(request: StudentIdVerificationRequest, draft: RegistrationDraft, signal: AbortSignal): Promise<StudentIdVerificationResponse>;
}

export interface RegistrationFormProps {
  auth: Auth;
  register(dto: RegisterUserRequest, options?: RegistrationRequestOptions): Promise<unknown>;
  onSuccess(): void;
  /** Null or HTTP 404 means no profile. Other failures must not silently proceed. */
  checkExistingProfile?(draft: RegistrationDraft, signal: AbortSignal): Promise<unknown>;
  onGoToLogin?(): void;
  /** Explicit opt-in. Omitting it leaves student capture unsupported (desktop). */
  studentIdVerification?: RegistrationIdVerification;
  /** Aborted synchronously on the web modal's close request, not after animation. */
  lifetimeSignal?: AbortSignal;
}

export type RegistrationPhase = "form" | "verify" | "id" | "completing" | "completeError";
export type RegistrationMessage = { type: "success" | "error"; text: string } | null;
export const RESEND_COOLDOWN_SECONDS = 60;
const POLL_INTERVAL_MS = 4000;

export const initialRegistrationForm = {
  role: "Student" as RegistrationRole, firstName: "", middleInitial: "", lastName: "", suffix: "", email: "",
  studentNumber: "", institute: "", program: "BS Information Technology", year: "1", section: "", password: "", confirmPassword: "",
};
type RegistrationFields = typeof initialRegistrationForm;

export function currentRegistrationConsent(draft: RegistrationDraft): boolean {
  return draft.privacyNoticeAccepted && draft.privacyNoticeVersion === PRIVACY_NOTICE_VERSION &&
    draft.termsAccepted && draft.termsVersion === TERMS_AND_CONDITIONS_VERSION;
}

export function registrationFormProblem(form: RegistrationFields, privacy: boolean, terms: boolean, ownedAccount: boolean): string | null {
  if (!privacy) return "Please read and accept the privacy notice to create an account.";
  if (!terms) return "Please read and accept the terms and conditions to create an account.";
  if (!form.firstName.trim() || !form.lastName.trim()) return "Enter your complete first / given names and last name.";
  if (form.firstName.trim().length > 50 || form.lastName.trim().length > 50) return "First and last names must each be at most 50 characters.";
  if (!ownedAccount && form.password.length < 8) return "Password must be at least 8 characters long.";
  if (!ownedAccount && form.password !== form.confirmPassword) return "Passwords do not match.";
  if (form.email.trim().length > 100 || !isValidEmailForRole(form.email, form.role)) return form.role === "Student"
    ? "Enter a valid email address you can verify. Personal student emails are allowed."
    : `Faculty must register with a ${FACULTY_EMAIL_DOMAIN} email address.`;
  if (form.middleInitial && !/^[A-Za-z]$/.test(form.middleInitial)) return "Middle initial must be a single letter.";
  if (form.suffix.trim().length > 10) return "Suffix must be at most 10 characters.";
  if (!form.institute || form.institute.length > 100) return "Please select your institute.";
  if (form.role === "Student") {
    if (!/^\d{2}-\d{5}$/.test(form.studentNumber)) return "Student number must be exactly NN-NNNNN, including leading zeros (for example, 00-00123).";
    if (!form.program || form.program.length > 100) return "Please select a program.";
    if (!/^[1-4]$/.test(form.year)) return "Select a year level from 1 to 4.";
    if (!/^[A-Za-z]$/.test(form.section)) return "Section must be a single letter.";
  }
  return null;
}

function payloadFor(form: RegistrationFields, uid: string, privacy: boolean, terms: boolean): RegistrationDraft {
  const draft = toRegistrationDraft({
    id: uid, email: form.email.trim(), firstName: form.firstName.trim(), lastName: form.lastName.trim(),
    middleInitial: form.middleInitial || undefined, suffix: form.suffix.trim() || undefined, role: form.role, institute: form.institute,
    privacyNoticeAccepted: privacy, privacyNoticeVersion: PRIVACY_NOTICE_VERSION, termsAccepted: terms, termsVersion: TERMS_AND_CONDITIONS_VERSION,
    ...(form.role === "Student" ? { studentNumber: form.studentNumber, position: "Member", program: form.program,
      yearLevel: Number(form.year), section: form.section } : {}),
  });
  if (!draft) throw new RegistrationError("invalid_request");
  return draft;
}

function matchesAccount(draft: RegistrationDraft, user: User | null): boolean {
  return !!user && draft.id === user.uid && draft.email.trim().toLowerCase() === user.email?.trim().toLowerCase();
}

function describeAccountError(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "auth/email-already-in-use": return "An account with this email already exists. Log in with your password or use a different email.";
      case "auth/invalid-credential":
      case "auth/wrong-password": return "This email already has a Firebase account. Resume with its password, or log in instead.";
      case "auth/invalid-email": return "That email address is not valid.";
      case "auth/weak-password": return "Password must be at least 8 characters long.";
      case "auth/quota-exceeded":
      case "auth/too-many-requests": return "Too many attempts. Please wait a moment and try again.";
      case "auth/network-request-failed": return "Network error. Check your connection and try again.";
      case "auth/operation-not-allowed": return "Email/password signup is unavailable for this application.";
    }
  }
  return sanitizeRegistrationError(error).message; // never Firebase/HTTP/raw exception messages
}

function describeSignupWorkError(error: unknown): string {
  return error instanceof BrowserMemoryCameraError && error.code === "timeout"
    ? "Signup work took too long. Wait for cleanup, then explicitly try again."
    : describeAccountError(error);
}

function pageActive(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "visible" && document.hasFocus();
}

export function useRegistrationFlow(props: RegistrationFormProps) {
  const { auth, lifetimeSignal } = props;
  const { user, loading: authLoading } = useAuth();
  const accessors = useMemo(() => createFirebaseTokenAccessors(auth), [auth]);
  const [form, setForm] = useState(initialRegistrationForm);
  const [phase, setPhase] = useState<RegistrationPhase>("form");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [message, setMessage] = useState<RegistrationMessage>(null);
  const [accountExists, setAccountExists] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [active, setActive] = useState(pageActive);
  const [studentFlow, setStudentFlow] = useState<StudentSignupFlow | null>(null);
  const [studentState, setStudentState] = useState<StudentSignupState>({ phase: "ready", busy: false });
  const [signupBusy, setSignupBusy] = useState(false);
  const [cleanupWake, setCleanupWake] = useState(0);
  const [resettingAccount, setResettingAccount] = useState(false);
  const [pendingSnapshot, setPendingSnapshot] = useState<PendingRegistration | null>(null);
  const propsRef = useRef(props);
  const formRef = useRef(form);
  const consentRef = useRef({ privacy: privacyAccepted, terms: termsAccepted });
  const mounted = useRef(false);
  const activeRef = useRef(active);
  const phaseRef = useRef(phase);
  const revision = useRef(0);
  const pending = useRef<PendingRegistration | null>(null);
  const submitting = useRef(false);
  const checkingRef = useRef(false);
  const expectingEmail = useRef<string | null>(null);
  const preparation = useRef<AbortController | null>(null);
  const flowRef = useRef<StudentSignupFlow | null>(null);
  const signupWork = useRef<BrowserMemoryCameraSession | null>(null);
  const completing = useRef(false);
  const resetting = useRef(false);

  const goPhase = useCallback((value: RegistrationPhase) => { phaseRef.current = value; setPhase(value); }, []);
  // Event/async guards use the synchronous owner; rendering uses a receipt-free
  // snapshot. Never overwrite either owner with a speculative render's values.
  const setPending = useCallback((value: PendingRegistration | null) => {
    pending.current = value;
    if (mounted.current) setPendingSnapshot(value ? { ...value, payload: { ...value.payload } } : null);
  }, []);
  const invalidate = useCallback((detailsChanged = false) => {
    revision.current++;
    preparation.current?.abort();
    if (detailsChanged) flowRef.current?.invalidate(); else flowRef.current?.cancel();
    signupWork.current?.cancel();
  }, []);
  useLayoutEffect(() => {
    const previous = propsRef.current;
    propsRef.current = props;
    if (previous.auth !== auth || previous.lifetimeSignal !== lifetimeSignal || previous.checkExistingProfile !== props.checkExistingProfile ||
      previous.register !== props.register || previous.studentIdVerification?.verify !== props.studentIdVerification?.verify ||
      previous.studentIdVerification?.configured !== props.studentIdVerification?.configured ||
      previous.studentIdVerification?.useMock !== props.studentIdVerification?.useMock) invalidate();
  }, [auth, invalidate, lifetimeSignal, props]);
  const assertActive = useCallback((epoch: number, signal?: AbortSignal) => {
    if (!mounted.current || !activeRef.current || epoch !== revision.current || signal?.aborted || propsRef.current.lifetimeSignal?.aborted) {
      throw new RegistrationError("cancelled");
    }
  }, []);
  const assertPendingAccount = useCallback((draft: RegistrationDraft, epoch: number, signal?: AbortSignal) => {
    assertActive(epoch, signal);
    if (!pending.current || JSON.stringify(draft) !== JSON.stringify(pending.current.payload) || !matchesAccount(draft, auth.currentUser)) {
      throw new RegistrationError("identity_mismatch");
    }
  }, [assertActive, auth]);
  const assertDraft = useCallback((draft: RegistrationDraft, epoch: number, signal?: AbortSignal) => {
    assertPendingAccount(draft, epoch, signal);
    if (!auth.currentUser?.emailVerified) throw new RegistrationError("email_unverified");
    if (!currentRegistrationConsent(draft)) throw new RegistrationError("terms_required");
  }, [assertPendingAccount, auth]);
  const getVerifiedDraft = useCallback(async (): Promise<RegistrationDraft> => {
    const epoch = revision.current;
    const draft = pending.current ? toRegistrationDraft(pending.current.payload) : null;
    assertActive(epoch);
    if (!draft || !matchesAccount(draft, auth.currentUser)) throw new RegistrationError("authentication_required");
    const token = await accessors.getFreshFirebaseIdToken();
    assertDraft(draft, epoch);
    if (!token) throw new RegistrationError("authentication_required");
    return draft;
  }, [accessors, assertActive, assertDraft, auth]);

  const submitBoundRegistration = useCallback(async (request: RegisterUserRequest, signal: AbortSignal) => {
    const epoch = revision.current;
    const clean = toRegistrationDraft(request);
    if (!clean || Object.entries(clean).some(([key, value]) => request[key as keyof RegisterUserRequest] !== value)) {
      throw new RegistrationError("identity_mismatch");
    }
    assertDraft(clean, epoch, signal);
    if (clean.role === "Student" && (typeof request.idVerificationReceipt !== "string" || !request.idVerificationReceipt || request.idVerificationReceipt.length > 4096)) {
      throw new RegistrationError("invalid_receipt");
    }
    const profile: RegisterUserRequest = { ...clean,
      ...(clean.role === "Student" ? { idVerificationReceipt: request.idVerificationReceipt } : {}) };
    const discard = () => { profile.idVerificationReceipt = undefined; };
    signal.addEventListener("abort", discard, { once: true });
    try {
      assertDraft(clean, epoch, signal);
      await propsRef.current.register(profile, { signal });
      assertDraft(clean, epoch, signal);
    } finally { signal.removeEventListener("abort", discard); discard(); }
  }, [assertDraft]);

  const hydrateForm = useCallback((draft: RegistrationDraft) => {
    const fields = { role: draft.role, firstName: draft.firstName, middleInitial: draft.middleInitial ?? "", lastName: draft.lastName,
      suffix: draft.suffix ?? "", email: draft.email, studentNumber: draft.studentNumber ?? "", institute: draft.institute,
      program: draft.program ?? initialRegistrationForm.program, year: String(draft.yearLevel ?? 1), section: draft.section ?? "",
      password: "", confirmPassword: "" };
    formRef.current = fields;
    setForm(fields);
    const privacy = draft.privacyNoticeAccepted && draft.privacyNoticeVersion === PRIVACY_NOTICE_VERSION;
    const terms = draft.termsAccepted && draft.termsVersion === TERMS_AND_CONDITIONS_VERSION;
    consentRef.current = { privacy, terms };
    setPrivacyAccepted(privacy);
    setTermsAccepted(terms);
  }, []);

  const finish = useCallback((draft: RegistrationDraft, epoch: number) => {
    assertDraft(draft, epoch);
    setPending(null);
    clearPendingRegistration();
    setMessage({ type: "success", text: "Registration complete." });
    propsRef.current.onSuccess(); // synchronous final guard; no unowned navigation timer
  }, [assertDraft, setPending]);

  const completeFacultyRegistration = useCallback(async () => {
    const current = signupWork.current;
    if (resetting.current || completing.current || submitting.current && phaseRef.current === "completing" || !current ||
      current.getState().busy || current.getState().blocked || flowRef.current?.getState().busy) return;
    completing.current = true;
    const epoch = revision.current;
    goPhase("completing");
    setMessage(null);
    let failure: unknown;
    try {
      await current.runConsumer(async signal => {
        try {
          const draft = await getVerifiedDraft();
          assertActive(epoch, signal);
          if (draft.role !== "Faculty" || !isValidEmailForRole(draft.email, "Faculty")) throw new RegistrationError("faculty_email_required");
          await submitBoundRegistration(draft, signal);
        } catch (error) { failure = sanitizeRegistrationError(error); throw failure; }
      });
      const draft = pending.current?.payload;
      if (!draft) throw new RegistrationError("identity_mismatch");
      finish(draft, epoch);
    } catch {
      if (mounted.current && epoch === revision.current && activeRef.current) {
        setMessage({ type: "error", text: sanitizeRegistrationError(failure).message });
        goPhase("completeError");
      }
    } finally { completing.current = false; }
  }, [assertActive, finish, getVerifiedDraft, goPhase, submitBoundRegistration]);

  const advanceVerified = useCallback(async (epoch: number) => {
    assertActive(epoch);
    const draft = pending.current?.payload;
    if (!draft || !matchesAccount(draft, auth.currentUser) || !auth.currentUser?.emailVerified) throw new RegistrationError("authentication_required");
    if (!currentRegistrationConsent(draft)) {
      hydrateForm(draft);
      goPhase("form");
      setMessage({ type: "error", text: "Please review and accept the current privacy notice and terms before completing registration." });
      return;
    }
    if (draft.role === "Student") {
      try { requireStudentSignupDraft(draft); }
      catch (error) { hydrateForm(draft); goPhase("form"); setMessage({ type: "error", text: sanitizeRegistrationError(error).message }); return; }
      goPhase("id"); // NEVER register or open a camera from email checks, polling, or restore
      setMessage(null);
    } else await completeFacultyRegistration();
  }, [assertActive, auth, completeFacultyRegistration, goPhase, hydrateForm]);

  useEffect(() => {
    mounted.current = true;
    const activity = () => {
      const next = pageActive() && !lifetimeSignal?.aborted;
      if (!next) invalidate();
      activeRef.current = next;
      setActive(next);
    };
    const inactive = () => { activeRef.current = false; setActive(false); invalidate(); };
    activity();
    window.addEventListener("blur", inactive);
    window.addEventListener("focus", activity);
    window.addEventListener("pagehide", inactive);
    document.addEventListener("visibilitychange", activity);
    document.addEventListener("freeze", inactive);
    lifetimeSignal?.addEventListener("abort", inactive, { once: true });
    return () => {
      mounted.current = false;
      invalidate();
      window.removeEventListener("blur", inactive);
      window.removeEventListener("focus", activity);
      window.removeEventListener("pagehide", inactive);
      document.removeEventListener("visibilitychange", activity);
      document.removeEventListener("freeze", inactive);
      lifetimeSignal?.removeEventListener("abort", inactive);
    };
  }, [invalidate, lifetimeSignal]);

  useEffect(() => {
    // Effect-owned instances survive StrictMode replay by being replaced, never
    // by reviving a disposed controller or an earlier receipt closure.
    const flow = createStudentSignupFlow({
      getVerifiedDraft,
      verify: (request, draft, signal) => {
        const verify = propsRef.current.studentIdVerification?.verify;
        if (!verify) throw new RegistrationError("invalid_request");
        assertDraft(draft, revision.current, signal);
        return verify(request, draft, signal);
      },
      register: submitBoundRegistration,
    });
    flowRef.current = flow;
    setStudentFlow(flow);
    const unsubscribe = flow.subscribe(state => { if (mounted.current) setStudentState(state); });
    const work = createBrowserMemoryCameraSession(undefined, { consumerTimeoutMs: STUDENT_SIGNUP_TIMEOUT_MS });
    signupWork.current = work;
    let wasBusy = false;
    const unsubscribeWork = work.subscribe(state => {
      const busy = state.busy || state.blocked;
      if (mounted.current) {
        setSignupBusy(busy);
        // Wake a blocked restore only on actual idle, never when its own work
        // begins (which would cancel the effect through a dependency replay).
        if (wasBusy && !busy) setCleanupWake(value => value + 1);
      }
      wasBusy = busy;
    });
    return () => {
      unsubscribe();
      unsubscribeWork();
      retireStudentSignupFlow(flow);
      work.dispose();
      if (flowRef.current === flow) flowRef.current = null;
      if (signupWork.current === work) signupWork.current = null;
    };
  }, [assertDraft, getVerifiedDraft, submitBoundRegistration]);

  useEffect(() => {
    let previous = auth.currentUser ? JSON.stringify([auth.currentUser.uid, auth.currentUser.email]) : null;
    let wasVerified = auth.currentUser?.emailVerified ?? false;
    return onIdTokenChanged(auth, current => {
      const key = current ? JSON.stringify([current.uid, current.email]) : null;
      const owned = pending.current;
      const expected = submitting.current && expectingEmail.current === current?.email?.trim().toLowerCase();
      if ((previous !== key && !expected) || (wasVerified && current && !current.emailVerified)) invalidate();
      previous = key;
      wasVerified = current?.emailVerified ?? false;
      if (owned && !matchesAccount(owned.payload, current)) {
        setPending(null);
        goPhase("form");
        setMessage({ type: "error", text: "The signed-in account changed. Resume your own signup before continuing." });
      } else if (owned && current && !current.emailVerified && phaseRef.current === "id") goPhase("verify");
    });
  }, [auth, goPhase, invalidate, setPending]);

  useEffect(() => subscribePendingRegistration(() => {
    const next = getActivePendingRegistration();
    if (!pending.current || JSON.stringify(next) === JSON.stringify(pending.current)) return;
    invalidate(true);
    setPending(null);
    goPhase("form");
    setMessage({ type: "error", text: "The pending registration changed or ended. Resume and verify your ID again." });
  }), [goPhase, invalidate, setPending]);

  useEffect(() => {
    const work = signupWork.current;
    if (authLoading || !user || !work || work.getState().busy || work.getState().blocked || resetting.current ||
      submitting.current || !activeRef.current || pending.current || phaseRef.current !== "form") return;
    const restored = getActivePendingRegistration();
    if (!restored || !matchesAccount(restored.payload, auth.currentUser) || restored.uid !== user.uid) return;
    const current = auth.currentUser;
    if (!current) return;
    const epoch = revision.current;
    let cancelled = false;
    let ownsCleanup = true;
    const canRestore = (signal?: AbortSignal) => !cancelled && mounted.current && activeRef.current && epoch === revision.current &&
      !signal?.aborted && !submitting.current && !resetting.current && !pending.current && phaseRef.current === "form" &&
      matchesAccount(restored.payload, auth.currentUser) && !propsRef.current.lifetimeSignal?.aborted &&
      JSON.stringify(getActivePendingRegistration()) === JSON.stringify(restored);
    const hydrateRestored = () => {
      setPending(restored);
      hydrateForm(restored.payload);
      goPhase("verify");
      setResendIn(RESEND_COOLDOWN_SECONDS);
    };
    void (async () => {
      // Synchronize with Firebase before hydrating. An edit, submit, account
      // change, or StrictMode cleanup while reload is pending cannot overwrite
      // the current form, nor can a cached verified flag finish signup.
      let freshlyVerified = false;
      try {
        await work.runConsumer(async signal => {
          try {
            if (!canRestore(signal)) return;
            let freshlyReloaded = false;
            let failureMessage: string | undefined;
            try { await current.reload(); freshlyReloaded = true; }
            catch (error) { failureMessage = describeAccountError(error); }
            if (!canRestore(signal)) return;
            hydrateRestored();
            if (failureMessage) setMessage({ type: "error", text: failureMessage });
            freshlyVerified = freshlyReloaded && !!auth.currentUser?.emailVerified;
          } finally { ownsCleanup = false; }
        }, { timeoutMs: BROWSER_CAPTURE_TIMEOUT_MS });
        if (freshlyVerified && JSON.stringify(pending.current) === JSON.stringify(restored)) await advanceVerified(epoch);
      } catch (error) {
        if (canRestore()) {
          hydrateRestored(); // safe draft only; never advance a failed/timed-out cached flag
          setMessage({ type: "error", text: describeSignupWorkError(error) });
        }
      }
    })();
    return () => { cancelled = true; if (ownsCleanup) work.cancel(); };
  }, [active, advanceVerified, auth, authLoading, cleanupWake, goPhase, hydrateForm, setPending, user]);

  const recheckVerification = useCallback(async (manual = true) => {
    const work = signupWork.current;
    if (!work || work.getState().busy || work.getState().blocked || resetting.current || checkingRef.current || completing.current ||
      submitting.current || !activeRef.current || !pending.current || phaseRef.current !== "verify") return;
    checkingRef.current = true;
    setChecking(true);
    const epoch = revision.current;
    const draft = { ...pending.current.payload };
    let verified = false;
    let failureMessage: string | undefined;
    try {
      await work.runConsumer(async signal => {
        try {
          assertPendingAccount(draft, epoch, signal);
          const current = auth.currentUser;
          if (!current) throw new RegistrationError("authentication_required");
          await current.reload();
          assertPendingAccount(draft, epoch, signal);
          verified = !!auth.currentUser?.emailVerified;
        } catch (error) { failureMessage = describeAccountError(error); throw new RegistrationError("service_unavailable"); }
      }, { timeoutMs: BROWSER_CAPTURE_TIMEOUT_MS });
      assertActive(epoch);
      if (verified) await advanceVerified(epoch);
      else if (manual) setMessage({ type: "error", text: "Email not verified yet. Open the link we sent you, then try again." });
    } catch (error) {
      if (manual && mounted.current && activeRef.current && epoch === revision.current) {
        setMessage({ type: "error", text: failureMessage ?? describeSignupWorkError(error) });
      }
    } finally { checkingRef.current = false; if (mounted.current) setChecking(false); }
  }, [advanceVerified, assertActive, assertPendingAccount, auth]);

  useEffect(() => {
    if (phase !== "verify" || !active) return;
    const id = window.setInterval(() => { void recheckVerification(false); }, POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [active, phase, recheckVerification]);
  useEffect(() => {
    if (phase !== "verify" || resendIn <= 0) return;
    const id = window.setTimeout(() => setResendIn(value => value - 1), 1000);
    return () => window.clearTimeout(id);
  }, [phase, resendIn]);

  const ownedAccount = !!pendingSnapshot && matchesAccount(pendingSnapshot.payload, user) &&
    form.email.trim().toLowerCase() === pendingSnapshot.payload.email.trim().toLowerCase();

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    let next = value;
    if (name === "middleInitial" || name === "section") next = value.replace(/[^a-zA-Z]/g, "").slice(0, 1).toUpperCase();
    if (name === "suffix") next = value.slice(0, 10);
    invalidate(true); // even an edit followed by restoring the original text invalidates receipts
    formRef.current = { ...formRef.current, [name]: next };
    setForm(formRef.current);
    setMessage(null);
    setAccountExists(false);
  };
  const handleRoleChange = (role: RegistrationRole) => {
    invalidate(true);
    formRef.current = { ...formRef.current, role };
    setForm(formRef.current);
    consentRef.current.terms = false;
    setTermsAccepted(false);
    setMessage(null);
    setAccountExists(false);
  };
  const changePrivacy = (accepted: boolean) => { invalidate(true); consentRef.current.privacy = accepted; setPrivacyAccepted(accepted); };
  const changeTerms = (accepted: boolean) => { invalidate(true); consentRef.current.terms = accepted; setTermsAccepted(accepted); };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const work = signupWork.current;
    if (!work || resetting.current || submitting.current || completing.current || flowRef.current?.getState().busy || work.getState().busy ||
      work.getState().blocked || !mounted.current || !activeRef.current || propsRef.current.lifetimeSignal?.aborted) return;
    setMessage(null);
    setAccountExists(false);
    const fields = { ...formRef.current };
    const consent = { ...consentRef.current };
    const owned = !!pending.current && matchesAccount(pending.current.payload, auth.currentUser) &&
      fields.email.trim().toLowerCase() === pending.current.payload.email.trim().toLowerCase();
    const problem = registrationFormProblem(fields, consent.privacy, consent.terms, owned);
    if (problem) { setMessage({ type: "error", text: problem }); return; }
    invalidate(true);
    const epoch = revision.current;
    const controller = new AbortController();
    preparation.current = controller;
    submitting.current = true;
    expectingEmail.current = owned ? null : fields.email.trim().toLowerCase();
    setLoading(true);
    let verified = false;
    let failureMessage: string | undefined;
    try {
      // Account preparation uses the same opaque admission as capture and
      // registration. A prompt cancellation cannot free a late Firebase owner.
      await work.runConsumer(async signal => {
        try {
          assertActive(epoch, signal);
          let current: User;
          let resumed = owned;
          if (owned && auth.currentUser) current = auth.currentUser;
          else {
            setPending(null);
            try { current = (await createUserWithEmailAndPassword(auth, fields.email.trim(), fields.password)).user; }
            catch (error) {
              assertActive(epoch, signal);
              if (!(error instanceof FirebaseError) || error.code !== "auth/email-already-in-use") throw error;
              resumed = true;
              current = (await signInWithEmailAndPassword(auth, fields.email.trim(), fields.password)).user;
            }
          }
          expectingEmail.current = null; // subsequent changes must match the acquired UID, not just an email
          assertActive(epoch, signal);
          const draft = payloadFor(fields, current.uid, consent.privacy, consent.terms);
          if (!matchesAccount(draft, auth.currentUser)) throw new RegistrationError("identity_mismatch");
          await current.reload();
          assertActive(epoch, signal);
          if (!matchesAccount(draft, auth.currentUser)) throw new RegistrationError("identity_mismatch");
          if (resumed && propsRef.current.checkExistingProfile) {
            let exists: unknown;
            try { exists = await propsRef.current.checkExistingProfile(draft, signal); }
            catch (error) {
              if (!isAxiosError(error) || error.response?.status !== 404) throw error;
              exists = null;
            }
            assertActive(epoch, signal);
            if (!matchesAccount(draft, auth.currentUser)) throw new RegistrationError("identity_mismatch");
            if (exists !== null) {
              if (!exists || typeof exists !== "object" || !("id" in exists) || exists.id !== draft.id) throw new RegistrationError("identity_mismatch");
              setPending(null);
              clearPendingRegistration(); // authoritative existing profile; login, not another signup
              setAccountExists(true);
              setMessage({ type: "error", text: "This email is already registered. Please log in to continue." });
              return;
            }
          }
          const nextPending = { uid: current.uid, payload: draft, createdAt: pending.current?.createdAt ?? Date.now() };
          setPending(nextPending);
          savePendingRegistration(nextPending);
          // Credentials are never part of a pending draft and need not stay in the form.
          hydrateForm(draft);
          if (auth.currentUser?.emailVerified) { verified = true; return; }
          try { await updateProfile(current, { displayName: `${draft.firstName} ${draft.lastName}` }); }
          catch { /* cosmetic only; next guard still owns the account */ }
          assertActive(epoch, signal);
          if (!matchesAccount(draft, auth.currentUser)) throw new RegistrationError("identity_mismatch");
          goPhase("verify");
          setResendIn(RESEND_COOLDOWN_SECONDS);
          try { await sendEmailVerification(current); }
          catch (error) {
            assertActive(epoch, signal);
            setMessage({ type: "error", text: describeAccountError(error) });
            // Retain the Firebase account/draft. Resend is explicit; no account deletion.
            setResendIn(0);
          }
          assertActive(epoch, signal);
        } catch (error) {
          failureMessage = describeAccountError(error);
          throw new RegistrationError("service_unavailable");
        } finally {
          fields.password = "";
          fields.confirmPassword = "";
        }
      });
      assertActive(epoch, controller.signal);
      if (verified) await advanceVerified(epoch); // only after preparation's actual admission is released
    } catch (error) {
      if (mounted.current && epoch === revision.current) { setMessage({ type: "error", text: failureMessage ?? describeSignupWorkError(error) }); goPhase("form"); }
    } finally {
      submitting.current = false;
      expectingEmail.current = null;
      if (preparation.current === controller) preparation.current = null;
      if (mounted.current) setLoading(false);
    }
  };

  const resendVerification = async () => {
    const work = signupWork.current;
    if (!work || work.getState().busy || work.getState().blocked || resetting.current || checkingRef.current || submitting.current ||
      resendIn > 0 || !pending.current || !activeRef.current || phaseRef.current !== "verify") return;
    checkingRef.current = true;
    setChecking(true);
    const epoch = revision.current;
    const draft = { ...pending.current.payload };
    let failureMessage: string | undefined;
    try {
      await work.runConsumer(async signal => {
        try {
          assertPendingAccount(draft, epoch, signal);
          const current = auth.currentUser;
          if (!current) throw new RegistrationError("authentication_required");
          await sendEmailVerification(current);
          assertPendingAccount(draft, epoch, signal);
        } catch (error) { failureMessage = describeAccountError(error); throw new RegistrationError("service_unavailable"); }
      }, { timeoutMs: BROWSER_CAPTURE_TIMEOUT_MS });
      assertPendingAccount(draft, epoch);
      setMessage({ type: "success", text: "A new verification link was sent. Check your inbox." });
      setResendIn(RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      if (mounted.current && activeRef.current && epoch === revision.current) {
        setMessage({ type: "error", text: failureMessage ?? describeSignupWorkError(error) });
      }
    }
    finally { checkingRef.current = false; if (mounted.current) setChecking(false); }
  };

  const startOver = async () => {
    if (resetting.current) return;
    const owned = pending.current && matchesAccount(pending.current.payload, auth.currentUser) ? { ...pending.current.payload } : null;
    const work = signupWork.current;
    invalidate();
    const epoch = revision.current;
    setPending(null);
    clearPendingRegistration();
    const fields = { ...formRef.current, email: "", password: "", confirmPassword: "" };
    formRef.current = fields;
    setForm(fields);
    consentRef.current = { privacy: false, terms: false };
    setPrivacyAccepted(false); setTermsAccepted(false);
    goPhase("form"); setMessage(null); setAccountExists(false); setResendIn(0);
    if (!owned || !work) return;
    resetting.current = true;
    setResettingAccount(true);
    const controller = new AbortController();
    preparation.current = controller;
    try {
      await awaitBrowserSignupCleanup(work, controller.signal);
      assertActive(epoch, controller.signal);
      if (!matchesAccount(owned, auth.currentUser)) return;
      await work.runConsumer(async signal => {
        assertActive(epoch, signal);
        if (!matchesAccount(owned, auth.currentUser)) throw new RegistrationError("identity_mismatch");
        await signOut(auth); // a started SDK sign-out keeps admission until it really settles
      });
    } catch { /* cancelled/switched requests never sign out an unrelated account */ }
    finally {
      if (preparation.current === controller) preparation.current = null;
      resetting.current = false;
      if (mounted.current) setResettingAccount(false);
    }
  };

  const editDetails = () => { invalidate(true); goPhase("form"); setMessage(null); };
  const onRegistered = () => {
    const draft = pending.current?.payload;
    if (!draft || flowRef.current?.getState().phase !== "complete") return;
    try { finish(draft, revision.current); } catch { /* cancelled/switched signup never navigates */ }
  };
  const goToLogin = () => { invalidate(); propsRef.current.onGoToLogin?.(); };

  return { form, phase, loading, checking, resendIn, message, accountExists, privacyAccepted, termsAccepted, active,
    studentFlow, studentState, signupBusy: signupBusy || resettingAccount, ownedAccount, pendingDraft: pendingSnapshot?.payload,
    handleChange, handleRoleChange, handleSubmit, recheckVerification: () => recheckVerification(true), resendVerification,
    startOver, editDetails, onRegistered, goToLogin, changePrivacy, changeTerms, completeFacultyRegistration,
    ensureVerifiedAccount: async () => { await getVerifiedDraft(); } };
}
