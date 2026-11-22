import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Camera, Loader2, ShieldCheck } from "lucide-react";
import type { StudentSignupFlow, StudentSignupState } from "@monteai/api";
import type { RegistrationDraft } from "@monteai/types";
import { Button } from "../Button";
import { awaitStudentSignupCleanup } from "./idCapture/signupCleanup";
import { BrowserMemoryCameraError, createBrowserMemoryCameraSession, getBrowserGuideCrop, getBrowserIdGuide,
  type BrowserCameraSize, type BrowserMemoryCameraSession, type BrowserMemoryCameraState } from "./idCapture/browserMemoryCamera";

export interface StudentIdVerificationProps {
  flow: StudentSignupFlow;
  details: RegistrationDraft;
  enabled: boolean;
  configured: boolean;
  useMock?: boolean;
  lifetimeSignal?: AbortSignal;
  ensureVerifiedAccount(): Promise<void>;
  onRegistered(): void;
  onEdit(): void;
}

function pageActive(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "visible" && document.hasFocus();
}
function browserSupported(): boolean {
  return typeof window !== "undefined" && window.isSecureContext && !!navigator.mediaDevices?.getUserMedia;
}
const closedCamera: BrowserMemoryCameraState = { phase: "closed", busy: false, blocked: false, width: 0, height: 0 };

/** Reusable browser ID stage. All camera/encoded data belongs to the RAM-only
 * session, and all receipts belong to the shared signup controller's closure. */
export function StudentIdVerification(props: StudentIdVerificationProps) {
  const { flow, details, enabled, configured, useMock, lifetimeSignal } = props;
  const propsRef = useRef(props);
  const mounted = useRef(false);
  const lifetime = useRef(0);
  const session = useRef<BrowserMemoryCameraSession | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  const confirmedRef = useRef(false);
  const activeRef = useRef(false);
  const [confirmed, setConfirmed] = useState(false);
  const [active, setActive] = useState(pageActive);
  const [camera, setCamera] = useState<BrowserMemoryCameraState>(closedCamera);
  const [state, setState] = useState<StudentSignupState>(flow.getState);
  const [size, setSize] = useState<BrowserCameraSize>({ width: 0, height: 0 });
  const [message, setMessage] = useState("Confirm your printed details, then explicitly open the camera.");
  const [permission, setPermission] = useState<PermissionState | "unknown">("unknown");
  const permissionRef = useRef<PermissionState | "unknown">("unknown");
  const [permissionBusy, setPermissionBusy] = useState(false);
  const [now, setNow] = useState(Date.now);
  const permissionStatus = useRef<PermissionStatus | null>(null);
  const permissionWork = useRef(false);
  const permissionQueued = useRef(false);
  const refreshRef = useRef<(() => Promise<void>) | null>(null);
  const lastFailure = useRef<string | null>(null);

  const invalidateLifetime = useCallback(() => { lifetime.current++; }, []);
  const updatePermission = useCallback((value: PermissionState | "unknown") => {
    permissionRef.current = value;
    setPermission(value);
  }, []);
  const cancel = useCallback(() => {
    invalidateLifetime();
    session.current?.cancel();
    flow.cancel();
  }, [flow, invalidateLifetime]);
  useLayoutEffect(() => {
    const previous = propsRef.current;
    propsRef.current = props;
    if (previous.configured !== configured || previous.useMock !== useMock) cancel();
  }, [cancel, configured, props, useMock]);
  const alive = useCallback((epoch: number) => mounted.current && epoch === lifetime.current && activeRef.current &&
    propsRef.current.enabled && !propsRef.current.lifetimeSignal?.aborted && confirmedRef.current, []);

  const refreshPermission = useCallback(async () => {
    if (!mounted.current || !activeRef.current) return;
    if (permissionWork.current) { permissionQueued.current = true; return; }
    if (!navigator.permissions?.query) { updatePermission("unknown"); return; }
    permissionWork.current = true;
    setPermissionBusy(true);
    const epoch = lifetime.current;
    try {
      const result = await navigator.permissions.query({ name: "camera" as PermissionName });
      if (!mounted.current || epoch !== lifetime.current || !activeRef.current) { permissionQueued.current = true; return; }
      if (permissionStatus.current) permissionStatus.current.onchange = null;
      permissionStatus.current = result;
      const changed = () => {
        if (!mounted.current || permissionStatus.current !== result) return;
        updatePermission(result.state);
        if (result.state !== "granted" && (session.current?.getState().phase !== "closed" || flow.getState().busy || flow.getState().phase === "retry-registration")) cancel();
      };
      result.onchange = changed;
      changed(); // getter/permission restoration never opens the camera
    } catch { if (mounted.current && epoch === lifetime.current) updatePermission("unknown"); }
    finally {
      permissionWork.current = false;
      if (mounted.current) setPermissionBusy(false);
      if (permissionQueued.current && mounted.current && activeRef.current) {
        permissionQueued.current = false;
        void refreshRef.current?.();
      }
    }
  }, [cancel, flow, updatePermission]);
  useLayoutEffect(() => { refreshRef.current = refreshPermission; }, [refreshPermission]);

  useEffect(() => {
    mounted.current = true;
    lifetime.current++;
    lastFailure.current = null;
    const current = createBrowserMemoryCameraSession(undefined, { onInterrupted: cancel });
    session.current = current;
    const unsubscribeCamera = current.subscribe(value => {
      if (!mounted.current) return;
      setCamera(value); // safe flags/dimensions/static error only
      if (value.failure && !flow.getState().failure) setMessage(value.failure.message);
    });
    const unsubscribeFlow = flow.subscribe(value => {
      if (!mounted.current) return;
      setState(value);
      setNow(Date.now());
      if (value.failure) setMessage(value.failure.message);
      const failureKey = value.failure?.stage === "flow" ? value.failure.code : null;
      if (failureKey && failureKey !== lastFailure.current) {
        lifetime.current++;
        current.cancel();
        if (failureKey === "details_changed") { confirmedRef.current = false; setConfirmed(false); }
      }
      lastFailure.current = failureKey;
    });
    return () => {
      mounted.current = false;
      invalidateLifetime();
      unsubscribeCamera(); unsubscribeFlow();
      if (permissionStatus.current) permissionStatus.current.onchange = null;
      permissionStatus.current = null;
      current.dispose();
      flow.cancel();
      if (session.current === current) session.current = null;
    };
  }, [cancel, flow, invalidateLifetime]);

  useEffect(() => {
    const activity = () => {
      const next = pageActive();
      activeRef.current = next;
      setActive(next);
      if (!next) cancel(); else void refreshPermission();
    };
    const inactive = () => { activeRef.current = false; setActive(false); cancel(); };
    activity();
    window.addEventListener("blur", inactive);
    window.addEventListener("focus", activity);
    window.addEventListener("pagehide", inactive);
    document.addEventListener("visibilitychange", activity);
    document.addEventListener("freeze", inactive);
    return () => {
      window.removeEventListener("blur", inactive); window.removeEventListener("focus", activity);
      window.removeEventListener("pagehide", inactive); document.removeEventListener("visibilitychange", activity);
      document.removeEventListener("freeze", inactive);
    };
  }, [cancel, refreshPermission]);

  useLayoutEffect(() => {
    if (!enabled || lifetimeSignal?.aborted) cancel();
    lifetimeSignal?.addEventListener("abort", cancel, { once: true });
    return () => lifetimeSignal?.removeEventListener("abort", cancel);
  }, [cancel, enabled, lifetimeSignal]);

  // Details are receipt-free primitives. Even non-identity/consent edits must
  // invalidate an uncertain registration; never silently reuse its receipt.
  const binding = JSON.stringify([details.id, details.role, details.email, details.firstName, details.middleInitial,
    details.lastName, details.suffix, details.studentNumber, details.position, details.institute, details.program,
    details.yearLevel, details.section, details.privacyNoticeAccepted, details.privacyNoticeVersion, details.termsAccepted, details.termsVersion]);
  const previousBinding = useRef(binding);
  useLayoutEffect(() => {
    if (previousBinding.current === binding) return;
    previousBinding.current = binding;
    confirmedRef.current = false;
    setConfirmed(false); // every edit, even when the controller repeats details_changed
    lifetime.current++;
    session.current?.cancel();
    flow.invalidate();
  }, [binding, flow]);

  useEffect(() => {
    const element = preview.current;
    if (!element) return;
    let previous: BrowserCameraSize = { width: 0, height: 0 };
    const measure = () => {
      const rect = element.getBoundingClientRect();
      const next = { width: rect.width, height: rect.height };
      if (next.width === previous.width && next.height === previous.height) return;
      if (previous.width > 0 && (session.current?.getState().phase !== "closed" || session.current?.getState().busy)) cancel();
      previous = next;
      setSize(next);
    };
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    observer?.observe(element);
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", cancel);
    return () => { observer?.disconnect(); window.removeEventListener("resize", measure); window.removeEventListener("orientationchange", cancel); };
  }, [cancel]);

  useEffect(() => {
    if (!state.retryAt || state.retryAt <= Date.now()) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [state.retryAt]);

  const canAct = () => mounted.current && propsRef.current.enabled && propsRef.current.configured && activeRef.current && confirmedRef.current &&
    !propsRef.current.lifetimeSignal?.aborted && permissionRef.current !== "denied" && !permissionWork.current && !!session.current &&
    !session.current.getState().busy && !session.current.getState().blocked && !flow.getState().busy &&
    (flow.getState().retryAt ?? 0) <= Date.now();

  async function openCamera() {
    const current = session.current;
    if (!canAct() || !current || !video.current || !browserSupported() ||
      current.getState().phase !== "closed" || flow.getState().phase !== "ready") return;
    const epoch = lifetime.current;
    setMessage("Checking your verified account, then starting the camera…");
    try {
      await current.open(video.current, async signal => {
        await propsRef.current.ensureVerifiedAccount();
        if (!alive(epoch) || signal.aborted) throw new BrowserMemoryCameraError("cancelled");
      });
      if (alive(epoch)) setMessage("Front only. Keep every edge of the portrait ID inside the guide, still and in even light.");
    } catch (error) {
      if (alive(epoch) && error instanceof BrowserMemoryCameraError) {
        if (error.code === "permission_denied") updatePermission("denied");
        setMessage(error.message);
      }
    }
  }

  async function captureFront() {
    const current = session.current;
    if (!canAct() || !current || current.getState().phase !== "preview" || flow.getState().phase !== "ready" || !configured) return;
    const epoch = lifetime.current;
    try {
      const guide = getBrowserIdGuide(size);
      await current.capture({ preview: size, guide }, (image, signal) => {
        if (!alive(epoch) || signal.aborted) throw new BrowserMemoryCameraError("cancelled");
        return awaitStudentSignupCleanup(flow, () => flow.verifyAndRegister(image, signal));
      });
      if (alive(epoch) && flow.getState().phase === "complete") propsRef.current.onRegistered();
    } catch (error) {
      if (alive(epoch) && !flow.getState().failure && error instanceof BrowserMemoryCameraError) setMessage(error.message);
    }
  }

  async function retryRegistration() {
    const current = session.current;
    if (!canAct() || !current || flow.getState().phase !== "retry-registration") return;
    const epoch = lifetime.current;
    try {
      await current.runConsumer(signal => awaitStudentSignupCleanup(flow, () => flow.retryRegistration(signal)));
      if (alive(epoch) && flow.getState().phase === "complete") propsRef.current.onRegistered();
    } catch { /* the controller exposes only safe errors; never display raw exceptions */ }
  }

  const busy = camera.busy || camera.blocked || state.busy || permissionBusy;
  const finished = state.phase === "complete";
  const cooldown = Math.max(0, Math.ceil(((state.retryAt ?? 0) - now) / 1000));
  const canUse = enabled && active && confirmed && configured && browserSupported() && !busy && !cooldown && !finished;
  const cameraOpen = camera.phase === "preview" || camera.phase === "opening";
  const cancelling = camera.phase === "closed" && (camera.busy || state.busy);
  let guide;
  let boundedCrop = false;
  if (size.width > 0 && size.height > 0) {
    guide = getBrowserIdGuide(size);
    if (camera.phase === "preview") {
      try { getBrowserGuideCrop({ preview: size, guide }, camera); boundedCrop = true; } catch { /* allocation remains disabled */ }
    }
  }
  const cancelLabel = cancelling ? null : camera.phase === "opening" ? "Cancel opening" : state.phase === "verifying" ? "Cancel verification"
    : state.phase === "registering" ? "Cancel registration" : camera.phase === "capturing" ? "Cancel capture" : cameraOpen ? "Close camera" : null;
  const status = camera.blocked ? "Earlier camera or signup cleanup is still finishing…" : cancelling ? "Finishing cancelled work…"
    : camera.phase === "opening" ? "Checking account / starting camera…" : state.phase === "verifying" ? "Verifying ID…"
    : state.phase === "registering" ? "Registering…" : camera.phase === "capturing" ? "Capturing and encoding in memory…"
    : finished ? "Registration complete" : camera.phase === "preview" ? null : "Camera closed";

  return (
    <section className="flex flex-col gap-4" aria-label="Student ID verification">
      <div className="flex flex-col items-center gap-2 text-center">
        <ShieldCheck className="h-10 w-10 text-primary" />
        <h2 className="text-2xl font-bold text-slate-900">Verify your student ID</h2>
        <p className="text-sm text-slate-600">Email verified. Check your complete printed name and exact student number. Leading zeros and the order of given names matter.</p>
      </div>
      <dl className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2">
        {[["Student number", details.studentNumber], ["First / given names", details.firstName], ["Middle initial", details.middleInitial || "None"],
          ["Last name", details.lastName], ["Suffix", details.suffix || "None"]].map(([label, value]) => (
          <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="font-semibold text-slate-900">{value}</dd></div>
        ))}
      </dl>
      <label className="flex items-start gap-3 text-sm text-slate-700">
        <input type="checkbox" aria-label="These details match my printed student ID" checked={confirmed} disabled={busy || finished}
          className="mt-1 h-4 w-4 accent-primary" onChange={event => {
            confirmedRef.current = event.target.checked;
            setConfirmed(event.target.checked);
            if (!event.target.checked) cancel();
          }} />
        These details match my printed student ID.
      </label>
      <Button type="button" variant="ghost" disabled={finished} onClick={() => { cancel(); propsRef.current.onEdit(); }}>
        Edit registration details (requires a fresh verification)
      </Button>
      <p className="text-xs text-slate-600">Camera only · authorized front of your Colegio de Montalban ID only · no gallery, files, or liveness. Capture and OCR are not saved. The short-lived verification is submitted immediately and is never saved.</p>
      <p className="text-xs text-slate-500">Browsers cannot prevent screenshots or screen recording. Do not record or share this screen; no screenshot-blocking guarantee is made.</p>
      {useMock && <p className="text-xs text-slate-600">Mock mode: camera capture is real, but no ID upload or live profile registration is made.</p>}
      {!configured && <p role="alert" className="text-sm text-red-700">ID verification is not configured. Camera capture stays disabled.</p>}
      {!browserSupported() && <p role="alert" className="text-sm text-red-700">Use a supported browser on HTTPS or localhost. There is no file or gallery fallback.</p>}
      {permission === "denied" && <p className="text-sm text-slate-600">Allow Camera for this site in your browser's permissions/settings. Returning or granting permission does not open the camera.</p>}
      <div ref={preview} className="relative h-[390px] overflow-hidden rounded-xl bg-slate-900">
        <video ref={video} muted playsInline aria-hidden="true" className="absolute inset-0 h-full w-full object-cover object-center"
          style={{ visibility: cameraOpen ? "visible" : "hidden" }} />
        {camera.phase === "preview" && guide && <div aria-hidden="true" className="pointer-events-none absolute rounded-lg border-2 border-white"
          style={{ left: guide.originX, top: guide.originY, width: guide.width, height: guide.height }} />}
        {status && <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/30 px-4 text-center text-sm font-semibold text-white" role="status">
          {busy && <Loader2 className="h-5 w-5 animate-spin" />}{status}
        </div>}
      </div>
      {camera.phase === "preview" && !boundedCrop && <p role="alert" className="text-sm text-red-700">This frame cannot meet the minimum ID resolution. Close the camera and use a higher-resolution camera; capture stays disabled.</p>}
      <p role="status" className="text-sm text-slate-700">{message}</p>
      {(cancelling || camera.blocked) && <p className="text-xs text-slate-500">The camera is closed. Wait for the earlier work to finish. Cancelling does not undo registration already received by the server.</p>}
      {state.failure?.outcome === "unmatched" && <p className="text-xs text-slate-600">Check the structured details above, edit any mistakes, or explicitly retake in clear lighting. OCR text and scores are not shown.</p>}
      {cooldown > 0 && <p role="status" className="text-sm text-slate-600">Try again in {cooldown}s. No automatic verification retry will be made.</p>}
      {state.phase === "retry-registration" ? <>
        <p className="text-xs text-slate-600">Your photo has been discarded. Retry only registration with the same in-memory verification and unchanged details. Expiry, leaving, cancellation, or any edit requires a new capture.</p>
        <Button type="button" disabled={!canUse} onClick={() => { void retryRegistration(); }}>Retry registration (no new photo)</Button>
        <Button type="button" variant="secondary" disabled={busy || !enabled || !active} onClick={cancel}>Discard verification and retake</Button>
      </> : <>
        {!cameraOpen && !finished && <Button type="button" aria-label="Open camera" disabled={!canUse || permission === "denied"} onClick={() => { void openCamera(); }} className="flex justify-center gap-2">
          <Camera className="h-4 w-4" />Open camera
        </Button>}
        {cameraOpen && <Button type="button" disabled={!canUse || camera.phase !== "preview" || !boundedCrop} onClick={() => { void captureFront(); }}>Capture front and register</Button>}
      </>}
      {permission === "denied" && <Button type="button" variant="secondary" disabled={busy || !enabled || !active} onClick={() => { void refreshPermission(); }}>Check camera permission</Button>}
      {cancelLabel && <Button type="button" variant="ghost" disabled={!enabled || !active} onClick={cancel}>{cancelLabel}</Button>}
    </section>
  );
}
