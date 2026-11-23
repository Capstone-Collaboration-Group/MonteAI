// Actual shared React form/camera + web App/Register/pending/protected routes.
// Only Firebase, browser DOM/media, history, static assets, unrelated page
// content, and HTTP boundaries are synthetic. This is NOT live web acceptance.
import "./support/web-runtime-loader.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";
const React = (await import("react")).default;
const { act } = (await import("react-test-renderer")).default;
const { default: axios, AxiosError } = await import("axios");
const { runtime, firebaseAuth, setUser, notifyToken, authError, SyntheticStream,
  PENDING_KEY, MFA_KEY, SYNTHETIC_PRIVATE, SYNTHETIC_RECEIPT, SYNTHETIC_FIREBASE_TOKEN,
  SYNTHETIC_MFA_TOKEN } = await import("./support/web-runtime-mocks.mjs");
const { assertNoSensitiveUi, button, change, check, checkbox, cleanup, click, clock, deferred, flush,
  hasText, mount, submit, unmount } = await import("./support/web-runtime-helpers.mjs");

// Install blocking adapters BEFORE production modules construct their clients.
axios.defaults.adapter = async config => {
  if (runtime.http) return runtime.http(config);
  runtime.unexpectedRequests++;
  throw new Error("Unexpected synthetic runtime HTTP request.");
};
globalThis.fetch = async () => { runtime.unexpectedRequests++; throw new Error("Unexpected synthetic runtime fetch."); };
const { AuthProvider, queryClient } = await import("@monteai/hooks");
const { RegistrationForm } = await import("../../packages/ui/src/components/auth/RegistrationForm.tsx");
const { StudentIdVerification } = await import("../../packages/ui/src/components/auth/StudentIdVerification.tsx");
const { Modal } = await import("../../packages/ui/src/components/auth/Modal.tsx");
const { createStudentSignupFlow, IdVerificationError, RegistrationError } = await import("@monteai/api");
const { createBrowserMemoryCameraSession } = await import("../../packages/ui/src/components/auth/idCapture/browserMemoryCamera.ts");
const { retireStudentSignupFlow } = await import("../../packages/ui/src/components/auth/idCapture/signupCleanup.ts");
const { clearPendingRegistration, getActivePendingRegistration, savePendingRegistration,
  subscribePendingRegistration } = await import("../../packages/ui/src/components/auth/pendingRegistration.ts");
const { setTokenProvider } = await import("../../apps/web/src/lib/apiClient.ts");
const { default: App } = await import("../../apps/web/src/App.tsx");
const queryDefaults = queryClient.getDefaultOptions();
queryClient.setDefaultOptions({ ...queryDefaults, queries: { ...queryDefaults.queries, retry: false, gcTime: Infinity } });
const independentFlows = new Set();

const privacyLabel = "I agree to the privacy notice";
const termsLabel = "I agree to the terms and conditions";
const confirmationLabel = "These details match my printed student ID";
function draft(overrides = {}) {
  return { id: "synthetic-web-uid", role: "Student", email: "personal@example.com", firstName: "Maria Ana",
    middleInitial: "M", lastName: "Dela Cruz", suffix: "Jr.", studentNumber: "00-00123", position: "Member",
    institute: "Institute of Computing Studies", program: "BS Computer Science", yearLevel: 1, section: "A",
    privacyNoticeAccepted: true, privacyNoticeVersion: "2026-10-23", termsAccepted: true, termsVersion: "2026-10-23", ...overrides };
}
function saveDraft(value = draft()) { savePendingRegistration({ uid: value.id, payload: value, createdAt: Date.now() }); }
function formProps(overrides = {}) {
  return { auth: firebaseAuth,
    async register(request, options) { runtime.registrationCalls++; await runtime.register(request, options?.signal); },
    async checkExistingProfile(value, signal) { runtime.profileChecks++; return runtime.checkProfile(value, signal); },
    onSuccess() { runtime.successes++; }, onGoToLogin() { runtime.loginRequests++; },
    studentIdVerification: { configured: true, useMock: false,
      async verify(request, value, signal) { runtime.verificationCalls++; return runtime.verify(request, value, signal); } },
    ...overrides };
}
const formElement = props => React.createElement(AuthProvider, { auth: firebaseAuth }, React.createElement(RegistrationForm, props));
async function form(overrides) { return mount(formElement(formProps(overrides))); }
async function fill(renderer, overrides = {}) {
  for (const [name, value] of Object.entries({ firstName: "Maria Ana", middleInitial: "M", lastName: "Dela Cruz", suffix: "Jr.",
    email: "personal@example.com", studentNumber: "00-00123", institute: "Institute of Computing Studies",
    program: "BS Computer Science", section: "A", password: "synthetic-password", confirmPassword: "synthetic-password", ...overrides })) {
    await change(renderer, name, value);
  }
}
async function accept(renderer, label) { await check(renderer, label); await click(renderer, "I have read and agree"); }
async function acceptBoth(renderer) { await accept(renderer, privacyLabel); await accept(renderer, termsLabel); }
async function verifiedForm(overrides) {
  setUser(runtime.user()); saveDraft();
  const renderer = await form(overrides);
  assert.ok(hasText(renderer, "Verify your student ID"));
  assert.equal(runtime.mediaRequests, 0);
  return renderer;
}
async function open(renderer) { await check(renderer, confirmationLabel); await click(renderer, "Open camera"); }
async function capture(renderer) { await click(renderer, "Capture front and register"); }
function response(config, data, status = 200, headers = {}) { return { config, data, status, headers, statusText: "Synthetic" }; }
function httpError(config, status, code = "service_unavailable", extra = {}) {
  const error = new AxiosError(SYNTHETIC_PRIVATE, "SYNTHETIC", config, { sensitive: SYNTHETIC_PRIVATE },
    response(config, { code, message: SYNTHETIC_PRIVATE, imageBase64: SYNTHETIC_PRIVATE, receipt: SYNTHETIC_PRIVATE, ...extra }, status));
  return error;
}

beforeEach(t => {
  runtime.reset(); clearPendingRegistration(); queryClient.clear(); setTokenProvider(null);
  t.mock.method(console, "error", (...args) => {
    if (typeof args[0] === "string" && args[0].startsWith("react-test-renderer is deprecated")) return;
    runtime.unexpectedDiagnostics++;
  });
});
afterEach(async () => {
  await act(async () => { independentFlows.forEach(flow => retireStudentSignupFlow(flow)); independentFlows.clear(); });
  await cleanup(); queryClient.clear(); setTokenProvider(null);
  assert.equal(runtime.unexpectedRequests, 0, "Every HTTP/fetch boundary must be explicitly synthetic and handled.");
  assert.equal(runtime.unexpectedDiagnostics, 0, "No unexpected React or payload diagnostic is permitted.");
  assert.equal(runtime.authListenerCount, 0, "Firebase listeners must detach on unmount.");
  assert.equal(runtime.observers.size, 0, "Layout observers must detach on unmount.");
  assert.equal(runtime.window.listenerCount + runtime.document.listenerCount, 0, "Page/permission/modal listeners must detach.");
  assert.ok(runtime.streams.every(stream => stream.tracks.every(track => track.readyState === "ended")), "All acquired synthetic camera tracks must stop.");
  const probe = createBrowserMemoryCameraSession();
  assert.equal(probe.getState().blocked, false, "Actual late cleanup must release cross-remount admission.");
  probe.dispose();
});

describe("actual shared form, account setup, and genuine consent", () => {
  for (const label of [privacyLabel, termsLabel]) {
    for (const dismissal of ["Not now", "Close", "overlay", "Escape"]) {
      test(`${label}: ${dismissal} is not acceptance`, async () => {
        const renderer = await form();
        await check(renderer, label);
        assert.equal(checkbox(renderer, label).props.checked, false);
        const dialog = renderer.root.findByProps({ role: "dialog" });
        if (dismissal === "overlay") await act(async () => dialog.props.onClick());
        else if (dismissal === "Escape") await act(async () => runtime.emit("keydown", { key: "Escape" }));
        else await click(renderer, dismissal);
        assert.equal(checkbox(renderer, label).props.checked, false);
        assert.equal(renderer.root.findAllByProps({ role: "dialog" }).length, 0);
        assert.equal(runtime.createCalls, 0);
      });
    }
  }
  test("notice acceptance is explicit, revocable, and role changes require the relevant terms again", async () => {
    const renderer = await form(); await fill(renderer); await acceptBoth(renderer);
    assert.equal(checkbox(renderer, privacyLabel).props.checked, true);
    assert.equal(checkbox(renderer, termsLabel).props.checked, true);
    await check(renderer, privacyLabel, false);
    await submit(renderer); assert.equal(runtime.createCalls, 0);
    await accept(renderer, privacyLabel);
    await click(renderer, "Faculty");
    assert.equal(checkbox(renderer, privacyLabel).props.checked, true);
    assert.equal(checkbox(renderer, termsLabel).props.checked, false);
  });
  test("personal student email and exact leading zeros survive setup; no ID or registration starts before email verification", async () => {
    const renderer = await form(); await fill(renderer); await acceptBoth(renderer); await submit(renderer);
    assert.equal(runtime.createCalls, 1); assert.equal(runtime.resends, 1);
    assert.ok(hasText(renderer, "Verify your email"));
    const pending = getActivePendingRegistration();
    assert.equal(pending.payload.email, "personal@example.com");
    assert.equal(pending.payload.studentNumber, "00-00123");
    assert.equal(pending.payload.firstName, "Maria Ana");
    assert.equal(runtime.mediaRequests + runtime.verificationCalls + runtime.registrationCalls, 0);
    assertNoSensitiveUi(renderer);
  });
  for (const number of ["0-00123", "00-0123", "00-0012O", "0000123", " 00-00123", "00-00123 "]) {
    test(`invalid student number ${JSON.stringify(number)} cannot create an account`, async () => {
      const renderer = await form(); await fill(renderer, { studentNumber: number }); await acceptBoth(renderer); await submit(renderer);
      assert.equal(runtime.createCalls, 0); assert.ok(hasText(renderer, "exactly NN-NNNNN"));
    });
  }
  test("a same-turn final field edit, both consent actions, and double submission use synchronous guards", async () => {
    const renderer = await form(); await fill(renderer); await acceptBoth(renderer);
    const wait = deferred();
    runtime.create = async email => { await wait.promise; const user = runtime.user({ email, emailVerified: false }); setUser(user); return user; };
    await act(async () => {
      renderer.root.findAll(node => node.type === "input" && node.props.name === "studentNumber")[0].props.onChange({ target: { name: "studentNumber", value: "00-00124" } });
      const send = renderer.root.findByType("form").props.onSubmit;
      void send({ preventDefault() {} }); void send({ preventDefault() {} });
    });
    assert.equal(runtime.createCalls, 1);
    wait.finish(); await flush();
    assert.equal(getActivePendingRegistration().payload.studentNumber, "00-00124");
  });
  test("failed verification-email delivery retains the account/draft and offers explicit resend, not deletion", async () => {
    runtime.resend = async () => { throw authError("auth/network-request-failed"); };
    const renderer = await form(); await fill(renderer); await acceptBoth(renderer); await submit(renderer);
    assert.ok(hasText(renderer, "Verify your email")); assert.ok(getActivePendingRegistration());
    assert.equal(runtime.deletes, 0); assert.equal(runtime.signOuts, 0);
    assertNoSensitiveUi(renderer);
    runtime.resend = async () => {};
    await click(renderer, "Resend email"); assert.equal(runtime.resends, 2);
  });
  test("manual email verification enters the ID stage closed, with no auto-registration", async () => {
    const renderer = await form(); await fill(renderer); await acceptBoth(renderer); await submit(renderer);
    await act(async () => { firebaseAuth.currentUser.emailVerified = true; notifyToken(); });
    await click(renderer, "I've verified my email");
    assert.ok(hasText(renderer, "Verify your student ID"));
    assert.equal(runtime.mediaRequests + runtime.verificationCalls + runtime.registrationCalls, 0);
    assert.equal(button(renderer, "Open camera").props.disabled, true);
  });
  test("email polling enters a closed ID stage but never allocates a camera", async t => {
    const time = clock(t);
    const renderer = await form(); await fill(renderer); await acceptBoth(renderer); await submit(renderer);
    firebaseAuth.currentUser.emailVerified = true;
    await time.tick(4000);
    assert.ok(hasText(renderer, "Verify your student ID"));
    assert.equal(runtime.mediaRequests + runtime.registrationCalls, 0);
  });
  test("a cached verified flag is not enough when Firebase reload reports unverified", async () => {
    const user = runtime.user({ async reload() { runtime.reloads++; this.emailVerified = false; } });
    setUser(user); saveDraft();
    const renderer = await form();
    assert.ok(hasText(renderer, "Verify your email"));
    assert.equal(runtime.mediaRequests + runtime.registrationCalls, 0);
  });
  test("a failed Firebase restore reload cannot advance a cached verified flag", async () => {
    setUser(runtime.user({ async reload() { throw authError("auth/network-request-failed"); } })); saveDraft();
    const renderer = await form();
    assert.ok(hasText(renderer, "Verify your email"));
    assert.equal(hasText(renderer, "Verify your student ID"), false);
    assert.equal(runtime.mediaRequests + runtime.registrationCalls, 0); assertNoSensitiveUi(renderer);
  });
  test("a pending draft cleared during restore cannot be hydrated by its late reload", async () => {
    const wait = deferred();
    setUser(runtime.user({ async reload() { runtime.reloads++; await wait.promise; } })); saveDraft();
    const renderer = await form();
    await act(async () => clearPendingRegistration());
    await act(async () => wait.finish()); await flush();
    assert.equal(getActivePendingRegistration(), null);
    assert.equal(hasText(renderer, "Verify your student ID"), false);
    assert.equal(checkbox(renderer, privacyLabel).props.checked, false);
    assert.equal(runtime.mediaRequests + runtime.registrationCalls, 0);
  });
  test("a remount cannot overlap a cancelled restore's real Firebase reload", async () => {
    const wait = deferred(); let first = true;
    setUser(runtime.user({ async reload() { runtime.reloads++; if (first) { first = false; await wait.promise; } } })); saveDraft();
    const renderer = await form(); await unmount(renderer);
    const probe = createBrowserMemoryCameraSession();
    try { assert.equal(probe.getState().blocked, true); } finally { probe.dispose(); }
    const next = await form();
    assert.equal(button(next, "Create account").props.disabled, true);
    assert.equal(runtime.reloads, 1);
    await act(async () => wait.finish()); await flush();
    assert.ok(hasText(next, "Verify your student ID"));
    assert.equal(checkbox(next, confirmationLabel).props.checked, false);
    assert.equal(runtime.mediaRequests + runtime.registrationCalls + runtime.signOuts + runtime.deletes, 0);
  });
  test("StrictMode restore replays safely and still offers a usable, explicitly opened camera", async () => {
    const renderer = await verifiedForm(); await open(renderer); await capture(renderer);
    assert.equal(runtime.mediaRequests, 1); assert.equal(runtime.encodings, 1);
    assert.equal(runtime.verificationCalls, 1); assert.equal(runtime.registrationCalls, 1); assert.equal(runtime.successes, 1);
    assert.equal(getActivePendingRegistration(), null);
    assertNoSensitiveUi(renderer);
  });
  test("legacy missing consent is not silently accepted during verified restore", async () => {
    setUser(runtime.user()); saveDraft(draft({ privacyNoticeAccepted: false, privacyNoticeVersion: undefined,
      termsAccepted: false, termsVersion: undefined }));
    const renderer = await form();
    assert.equal(checkbox(renderer, privacyLabel).props.checked, false);
    assert.equal(checkbox(renderer, termsLabel).props.checked, false);
    assert.equal(runtime.mediaRequests + runtime.registrationCalls, 0);
    assert.ok(hasText(renderer, "current privacy notice and terms"));
  });
  test("without the explicit browser opt-in, shared/desktop students stop at unsupported capture", async () => {
    const renderer = await verifiedForm({ studentIdVerification: undefined });
    assert.ok(hasText(renderer, "Student ID capture is not enabled"));
    assert.equal(renderer.root.findAllByType("video").length, 0);
    assert.equal(runtime.mediaRequests + runtime.registrationCalls, 0);
  });
  test("faculty personal email is rejected before Firebase; @pnm.edu.ph completes without an ID receipt", async () => {
    const renderer = await form(); await click(renderer, "Faculty");
    for (const [name, value] of Object.entries({ firstName: "Maria", lastName: "Cruz", email: "faculty@example.com",
      institute: "Institute of Computing Studies", password: "synthetic-password", confirmPassword: "synthetic-password" })) await change(renderer, name, value);
    await acceptBoth(renderer); await submit(renderer); assert.equal(runtime.createCalls, 0);
    await change(renderer, "email", "faculty@pnm.edu.ph");
    runtime.create = async email => { const user = runtime.user({ email }); setUser(user); return user; };
    runtime.register = async request => { assert.equal(request.role, "Faculty"); assert.equal(request.idVerificationReceipt, undefined); assert.equal(request.studentNumber, undefined); };
    await submit(renderer);
    assert.equal(runtime.createCalls, 1); assert.equal(runtime.registrationCalls, 1); assert.equal(runtime.successes, 1);
    assert.equal(runtime.mediaRequests + runtime.verificationCalls, 0);
  });
  test("an existing Firebase account uses its password and an authoritative missing-profile check before resuming", async () => {
    runtime.create = async () => { throw authError("auth/email-already-in-use"); };
    const renderer = await form(); await fill(renderer); await acceptBoth(renderer); await submit(renderer);
    assert.equal(runtime.passwordSignIns, 1); assert.equal(runtime.profileChecks, 1);
    assert.ok(hasText(renderer, "Verify your student ID")); assert.equal(runtime.registrationCalls + runtime.mediaRequests, 0);
  });
  test("an authoritative existing profile goes to login, never a second registration", async () => {
    runtime.create = async () => { throw authError("auth/email-already-in-use"); };
    runtime.checkProfile = async value => ({ id: value.id, ignored: SYNTHETIC_PRIVATE });
    const renderer = await form(); await fill(renderer); await acceptBoth(renderer); await submit(renderer);
    assert.ok(hasText(renderer, "already registered")); assert.equal(getActivePendingRegistration(), null);
    await click(renderer, "Go to login"); assert.equal(runtime.loginRequests, 1);
    assert.equal(runtime.registrationCalls + runtime.mediaRequests, 0); assertNoSensitiveUi(renderer);
  });
  for (const status of [401, 403, 500, undefined]) {
    test(`profile-check ${status ?? "network"} failure is not treated as absent`, async () => {
      runtime.create = async () => { throw authError("auth/email-already-in-use"); };
      runtime.checkProfile = async () => { if (status === undefined) throw new Error(SYNTHETIC_PRIVATE); throw httpError({}, status); };
      const renderer = await form(); await fill(renderer); await acceptBoth(renderer); await submit(renderer);
      assert.equal(getActivePendingRegistration(), null); assert.equal(runtime.mediaRequests + runtime.registrationCalls, 0);
      assertNoSensitiveUi(renderer);
    });
  }
  test("only a profile-check HTTP 404 or explicit null can resume signup; undefined fails closed", async () => {
    runtime.create = async () => { throw authError("auth/email-already-in-use"); };
    runtime.checkProfile = async () => undefined;
    const renderer = await form(); await fill(renderer); await acceptBoth(renderer); await submit(renderer);
    assert.equal(getActivePendingRegistration(), null);
    runtime.checkProfile = async () => { throw httpError({}, 404); };
    await submit(renderer); assert.ok(hasText(renderer, "Verify your student ID"));
  });
  test("start over discards the safe draft and signs out only the owned account; no account is deleted", async () => {
    const renderer = await verifiedForm(); await click(renderer, "Use a different email");
    assert.equal(getActivePendingRegistration(), null); assert.equal(runtime.signOuts, 1); assert.equal(runtime.deletes, 0);
    assert.equal(firebaseAuth.currentUser, null);
    assert.equal(checkbox(renderer, privacyLabel).props.checked, false);
    assert.equal(checkbox(renderer, termsLabel).props.checked, false);
  });
  test("slow owned sign-out blocks a remounted account setup until its real cleanup settles", async () => {
    const renderer = await verifiedForm(); const wait = deferred();
    runtime.logout = async () => { await wait.promise; setUser(null); };
    await click(renderer, "Use a different email"); await unmount(renderer);
    const next = await form(); await fill(next, { email: "new@example.com" }); await acceptBoth(next);
    assert.equal(button(next, "Create account").props.disabled, true);
    await submit(next); assert.equal(runtime.createCalls, 0);
    await act(async () => wait.finish()); await flush();
    assert.equal(button(next, "Create account").props.disabled, false);
    assert.equal(runtime.signOuts, 1); assert.equal(runtime.deletes, 0);
  });
  for (const action of ["unmount", "account switch"]) {
    test(`${action} cancels a deferred sign-out before earlier verification cleanup releases admission`, async () => {
      const wait = deferred(runtime.response());
      runtime.verify = () => wait.promise;
      const renderer = await verifiedForm(); await open(renderer); await capture(renderer);
      await click(renderer, "Use a different email");
      assert.equal(runtime.signOuts, 0); assert.equal(getActivePendingRegistration(), null);
      const other = runtime.user({ uid: "synthetic-other-uid", email: "other@example.com" });
      if (action === "unmount") await unmount(renderer);
      else await act(async () => setUser(other));
      await act(async () => wait.finish()); await flush();
      assert.equal(runtime.signOuts + runtime.deletes + runtime.registrationCalls + runtime.successes, 0);
      if (action === "account switch") { assert.equal(firebaseAuth.currentUser, other); assertNoSensitiveUi(renderer); }
    });
  }
  test("cancelled late account creation blocks remounted signup but never sends mail or saves a stale draft", async () => {
    const wait = deferred();
    runtime.create = async email => { await wait.promise; const user = runtime.user({ email, emailVerified: false }); setUser(user); return user; };
    const renderer = await form(); await fill(renderer); await acceptBoth(renderer); await submit(renderer);
    await click(renderer, "Cancel account setup"); await unmount(renderer);
    const next = await form(); await fill(next); await acceptBoth(next);
    assert.equal(button(next, "Create account").props.disabled, true);
    await submit(next); assert.equal(runtime.createCalls, 1);
    await act(async () => wait.finish()); await flush();
    assert.equal(getActivePendingRegistration(), null); assert.equal(runtime.resends + runtime.profileUpdates + runtime.registrationCalls, 0);
    assert.equal(button(next, "Create account").props.disabled, false); assert.equal(runtime.signOuts + runtime.deletes, 0);
  });
  for (const stage of ["password sign-in", "account reload", "existing profile", "profile update", "email delivery"]) {
    test(`cancelled ${stage} holds remount admission and cannot revive mail, draft, or navigation`, async () => {
      const wait = deferred();
      if (stage === "password sign-in" || stage === "existing profile") runtime.create = async () => { throw authError("auth/email-already-in-use"); };
      if (stage === "password sign-in") runtime.passwordSignIn = async email => {
        await wait.promise; const user = runtime.user({ email, emailVerified: false }); setUser(user); return user;
      };
      if (stage === "account reload") runtime.create = async email => {
        const user = runtime.user({ email, emailVerified: false, async reload() { await wait.promise; } }); setUser(user); return user;
      };
      if (stage === "existing profile") runtime.checkProfile = () => wait.promise;
      if (stage === "profile update") runtime.updateProfile = () => wait.promise;
      if (stage === "email delivery") runtime.resend = () => wait.promise;
      const renderer = await form(); await fill(renderer); await acceptBoth(renderer); await submit(renderer);
      await click(renderer, stage === "email delivery" ? "Use a different email" : "Cancel account setup"); await unmount(renderer);
      const next = await form(); await fill(next); await acceptBoth(next);
      assert.equal(button(next, "Create account").props.disabled, true);
      await submit(next); assert.equal(runtime.createCalls, 1);
      await act(async () => wait.finish(stage === "existing profile" ? null : undefined)); await flush();
      assert.equal(getActivePendingRegistration(), null); assert.equal(runtime.registrationCalls + runtime.mediaRequests + runtime.successes, 0);
      assert.equal(runtime.resends, stage === "email delivery" ? 1 : 0);
      assert.equal(button(next, "Create account").props.disabled, false);
      assert.equal(runtime.signOuts + runtime.deletes, 0); assertNoSensitiveUi(next);
    });
  }
  test("a same-turn consent revocation invalidates late Firebase setup without a stale draft", async () => {
    const wait = deferred();
    runtime.create = async email => { await wait.promise; const user = runtime.user({ email, emailVerified: false }); setUser(user); return user; };
    const renderer = await form(); await fill(renderer); await acceptBoth(renderer);
    const revoke = checkbox(renderer, privacyLabel).props.onChange;
    await submit(renderer);
    await act(async () => revoke({ target: { checked: false } }));
    await act(async () => wait.finish()); await flush();
    assert.equal(getActivePendingRegistration(), null); assert.equal(checkbox(renderer, privacyLabel).props.checked, false);
    assert.equal(runtime.resends + runtime.profileUpdates + runtime.registrationCalls + runtime.successes + runtime.deletes, 0);
  });
  for (const action of ["email recheck", "email resend"]) {
    test(`cancelled ${action} retains real cleanup admission across unmount`, async () => {
      const wait = deferred();
      setUser(runtime.user({ emailVerified: false })); saveDraft();
      const renderer = await form();
      if (action === "email recheck") firebaseAuth.currentUser.reload = async () => { runtime.reloads++; await wait.promise; };
      else { runtime.resend = () => wait.promise; }
      if (action === "email resend") {
        // A failed initial delivery makes an explicit resend available without
        // advancing real time or operating Firebase.
        await unmount(renderer); clearPendingRegistration(); setUser(null);
        runtime.resend = async () => { throw authError("auth/network-request-failed"); };
        const fresh = await form(); await fill(fresh); await acceptBoth(fresh); await submit(fresh);
        runtime.resend = () => wait.promise;
        await click(fresh, "Resend email"); await unmount(fresh);
      } else { await click(renderer, "I've verified my email"); await unmount(renderer); }
      const probe = createBrowserMemoryCameraSession();
      try { assert.equal(probe.getState().blocked, true); } finally { probe.dispose(); }
      await act(async () => wait.finish()); await flush();
      assert.equal(runtime.registrationCalls + runtime.mediaRequests + runtime.successes + runtime.signOuts + runtime.deletes, 0);
    });
  }
  test("cancelled faculty registration retains transport admission and cannot promote a late success", async () => {
    const wait = deferred();
    setUser(runtime.user({ email: "faculty@pnm.edu.ph" })); saveDraft(draft({ role: "Faculty", email: "faculty@pnm.edu.ph" }));
    runtime.register = () => wait.promise;
    const renderer = await form();
    assert.equal(runtime.registrationCalls, 1);
    await click(renderer, "Cancel registration"); await unmount(renderer);
    const probe = createBrowserMemoryCameraSession();
    try { assert.equal(probe.getState().blocked, true); } finally { probe.dispose(); }
    await act(async () => wait.finish()); await flush();
    assert.equal(getActivePendingRegistration(), null);
    assert.equal(runtime.successes + runtime.mediaRequests + runtime.verificationCalls + runtime.signOuts + runtime.deletes, 0);
  });
  test("resumed profile lookup rechecks ownership even if an SDK account notification is delayed", async () => {
    runtime.create = async () => { throw authError("auth/email-already-in-use"); };
    runtime.checkProfile = async () => { firebaseAuth.currentUser = runtime.user({ uid: "synthetic-other", email: "other@example.com" }); return null; };
    const renderer = await form(); await fill(renderer); await acceptBoth(renderer); await submit(renderer);
    assert.equal(getActivePendingRegistration(), null); assert.equal(runtime.resends + runtime.registrationCalls + runtime.mediaRequests, 0);
    assert.ok(hasText(renderer, "do not match the signed-in account")); assert.equal(runtime.signOuts + runtime.deletes, 0);
  });
  test("account switches invalidate signup without signing out or deleting the unrelated session", async () => {
    const renderer = await verifiedForm();
    const other = runtime.user({ uid: "synthetic-other-uid", email: "other@example.com" });
    await act(async () => setUser(other));
    assert.equal(firebaseAuth.currentUser, other); assert.equal(runtime.signOuts + runtime.deletes, 0);
    assert.ok(hasText(renderer, "signed-in account changed")); assert.equal(runtime.mediaRequests + runtime.registrationCalls, 0);
  });
});

describe("actual browser ID stage, explicit recovery, and private retry ownership", () => {
  test("confirmation and focus restoration alone never open the camera", async () => {
    const renderer = await verifiedForm(); await check(renderer, confirmationLabel);
    await act(async () => { runtime.focused = false; runtime.emit("blur"); });
    await act(async () => { runtime.focused = true; runtime.emit("focus"); }); await flush();
    assert.equal(runtime.mediaRequests, 0); assert.equal(runtime.canvasAllocations, 0);
    await click(renderer, "Open camera"); assert.equal(runtime.mediaRequests, 1);
  });
  test("site permission denial has an explicit getter/recovery, and grant does not reopen", async () => {
    runtime.permission.state = "denied";
    const renderer = await verifiedForm(); await check(renderer, confirmationLabel);
    assert.equal(button(renderer, "Open camera").props.disabled, true);
    runtime.permission.state = "granted";
    await click(renderer, "Check camera permission");
    assert.equal(runtime.mediaRequests, 0);
    await click(renderer, "Open camera"); assert.equal(runtime.mediaRequests, 1);
  });
  test("same-turn permission revocation blocks an already queued Open camera callback", async () => {
    const renderer = await verifiedForm(); await check(renderer, confirmationLabel);
    const queuedOpen = button(renderer, "Open camera").props.onClick;
    await act(async () => { runtime.setPermission("denied"); queuedOpen(); }); await flush();
    assert.equal(runtime.mediaRequests + runtime.encodings, 0);
    assert.equal(button(renderer, "Open camera").props.disabled, true);
  });
  test("a retired Open camera handler cannot bypass a committed configuration disable", async () => {
    const flow = createStudentSignupFlow({ getVerifiedDraft: async () => draft(), verify: async () => runtime.response(), register: async () => {} });
    independentFlows.add(flow);
    const props = { flow, details: draft(), enabled: true, configured: true, ensureVerifiedAccount: async () => {}, onRegistered() {}, onEdit() {} };
    const renderer = await mount(React.createElement(StudentIdVerification, props)); await check(renderer, confirmationLabel);
    const queuedOpen = button(renderer, "Open camera").props.onClick;
    await act(async () => renderer.update(React.createElement(React.StrictMode, null, React.createElement(StudentIdVerification, { ...props, configured: false }))));
    await act(async () => queuedOpen()); await flush();
    assert.equal(runtime.mediaRequests + runtime.encodings, 0);
  });
  test("a real browser prompt denial is safely surfaced; returning after granting still needs Open camera", async () => {
    runtime.permission.state = "prompt";
    runtime.getMedia = async () => { throw new DOMException(SYNTHETIC_PRIVATE, "NotAllowedError"); };
    const renderer = await verifiedForm(); await open(renderer);
    assert.ok(hasText(renderer, "Camera access was not allowed")); assert.equal(runtime.mediaRequests, 1);
    runtime.permission.state = "granted";
    runtime.getMedia = async () => { const stream = new SyntheticStream(); runtime.streams.push(stream); return stream; };
    await act(async () => runtime.emit("focus")); await flush();
    assert.equal(runtime.mediaRequests, 1); await click(renderer, "Open camera"); assert.equal(runtime.mediaRequests, 2);
    assertNoSensitiveUi(renderer);
  });
  for (const condition of ["unconfigured", "insecure", "no media API"]) {
    test(`${condition} has no file alternative and cannot allocate a camera`, async () => {
      if (condition === "insecure") runtime.secure = false;
      if (condition === "no media API") globalThis.navigator.mediaDevices = undefined;
      const renderer = await verifiedForm(condition === "unconfigured" ? { studentIdVerification: { ...formProps().studentIdVerification, configured: false } } : undefined);
      await check(renderer, confirmationLabel);
      assert.equal(button(renderer, "Open camera").props.disabled, true);
      assert.equal(renderer.root.findAll(node => node.type === "input" && node.props.type === "file").length, 0);
      assert.equal(runtime.mediaRequests, 0);
    });
  }
  test("bounded capture closes the stream and wipes image/response before receipt-bearing registration and navigation", async () => {
    let imageRequest; const verified = runtime.response(); let registered;
    runtime.verify = async request => { imageRequest = request; assert.ok(request.imageBase64); assert.ok(runtime.streams[0].tracks[0].readyState === "ended"); return verified; };
    runtime.register = async (request, signal) => {
      registered = request; assert.equal(request.idVerificationReceipt === SYNTHETIC_RECEIPT, true);
      assert.equal(imageRequest.imageBase64, ""); assert.equal(verified.receipt, ""); assert.equal(signal.aborted, false);
      assert.ok(runtime.canvases.every(canvas => canvas.width === 0 && canvas.height === 0));
    };
    const renderer = await verifiedForm(); await open(renderer); await capture(renderer);
    assert.equal(runtime.successes, 1); assert.equal(registered.idVerificationReceipt, undefined);
    assert.ok(runtime.tokenCalls.length >= 2 && runtime.tokenCalls.every(force => force === true));
    assertNoSensitiveUi(renderer);
  });
  for (const [outcome, code] of [["retake", "image_quality"], ["unmatched", "student_number_mismatch"]]) {
    test(`${outcome} discards the image, has a safe explanation, and requires an explicit new capture`, async () => {
      let held;
      runtime.verify = async request => { held = request; throw new IdVerificationError({ code, outcome, message: SYNTHETIC_PRIVATE, status: 422 }); };
      const renderer = await verifiedForm(); await open(renderer); await capture(renderer);
      assert.equal(held.imageBase64, ""); assert.equal(runtime.registrationCalls, 0); assert.equal(runtime.mediaRequests, 1);
      assert.equal(button(renderer, "Open camera").props.disabled, false);
      assertNoSensitiveUi(renderer); await click(renderer, "Open camera"); assert.equal(runtime.mediaRequests, 2);
    });
  }
  test("quota countdown never retries verification automatically", async t => {
    const time = clock(t);
    runtime.verify = async () => { throw new IdVerificationError({ code: "busy", message: SYNTHETIC_PRIVATE, status: 429, retryAfterSeconds: 5 }); };
    const renderer = await verifiedForm(); await open(renderer); await capture(renderer);
    assert.ok(hasText(renderer, "Try again in 5s")); assert.equal(button(renderer, "Open camera").props.disabled, true);
    await time.tick(5000);
    assert.equal(runtime.verificationCalls, 1); assert.equal(runtime.mediaRequests, 1);
    assert.equal(button(renderer, "Open camera").props.disabled, false);
  });
  test("uncertain registration retries only registration with the exact unchanged, unexpired closure receipt", async () => {
    const receipts = [];
    runtime.register = async request => { receipts.push(request.idVerificationReceipt === SYNTHETIC_RECEIPT); if (receipts.length === 1) throw new RegistrationError("service_unavailable"); };
    const renderer = await verifiedForm(); await open(renderer); await capture(renderer);
    assert.equal(runtime.successes, 0); assert.equal(runtime.verificationCalls, 1); assert.equal(runtime.mediaRequests, 1);
    assertNoSensitiveUi(renderer);
    await click(renderer, "Retry registration (no new photo)");
    assert.deepEqual(receipts, [true, true]); assert.equal(runtime.successes, 1);
    assert.equal(runtime.verificationCalls, 1); assert.equal(runtime.mediaRequests, 1); assert.equal(runtime.encodings, 1);
  });
  test("expiry removes the registration-only retry and requires a new capture", async t => {
    const time = clock(t);
    runtime.verify = async () => runtime.response({ expiresAt: new Date(Date.now() + 1000).toISOString() });
    runtime.register = async () => { throw new RegistrationError("service_unavailable"); };
    const renderer = await verifiedForm(); await open(renderer); await capture(renderer);
    assert.ok(hasText(renderer, "Retry registration (no new photo)"));
    await time.tick(1000);
    assert.ok(hasText(renderer, "verification expired"));
    assert.equal(renderer.root.findAll(node => node.type === "button" && node.props.children === "Retry registration (no new photo)").length, 0);
    assert.equal(runtime.registrationCalls, 1); assert.equal(runtime.mediaRequests, 1);
  });
  for (const code of ["invalid_receipt", "registration_conflict", "authentication_required", "identity_mismatch"]) {
    test(`registration ${code} cannot offer receipt reuse`, async () => {
      runtime.register = async () => { throw new RegistrationError(code); };
      const renderer = await verifiedForm(); await open(renderer); await capture(renderer);
      assert.equal(hasText(renderer, "Retry registration (no new photo)"), false);
      assert.equal(runtime.successes, 0); assert.equal(runtime.registrationCalls, 1); assertNoSensitiveUi(renderer);
    });
  }
  test("editing then restoring identical text discards receipt reuse and re-confirms the details", async () => {
    runtime.register = async () => { throw new RegistrationError("service_unavailable"); };
    const renderer = await verifiedForm(); await open(renderer); await capture(renderer);
    await click(renderer, "Edit registration details (requires a fresh verification)");
    await change(renderer, "firstName", "Maria Ana "); await change(renderer, "firstName", "Maria Ana");
    await submit(renderer);
    assert.ok(hasText(renderer, "Verify your student ID"));
    assert.equal(checkbox(renderer, confirmationLabel).props.checked, false);
    assert.equal(hasText(renderer, "Retry registration (no new photo)"), false);
    assert.equal(runtime.verificationCalls, 1); assert.equal(runtime.registrationCalls, 1);
  });
  test("changed details props invalidate an already-open reusable camera before another capture", async () => {
    let value = draft();
    const flow = createStudentSignupFlow({ getVerifiedDraft: async () => value, verify: async () => runtime.response(), register: async () => {} });
    independentFlows.add(flow);
    const props = { flow, details: value, enabled: true, configured: true, ensureVerifiedAccount: async () => {}, onRegistered() {}, onEdit() {} };
    const renderer = await mount(React.createElement(StudentIdVerification, props)); await open(renderer);
    value = draft({ firstName: "Maria Ana Updated" });
    await act(async () => renderer.update(React.createElement(React.StrictMode, null, React.createElement(StudentIdVerification, { ...props, details: value }))));
    assert.equal(checkbox(renderer, confirmationLabel).props.checked, false);
    assert.equal(runtime.streams[0].tracks[0].readyState, "ended"); assert.equal(runtime.encodings, 0);
  });
  test("every reusable details change clears confirmation, including repeated same-code invalidations", async () => {
    let value = draft();
    const flow = createStudentSignupFlow({ getVerifiedDraft: async () => value, verify: async () => runtime.response(), register: async () => {} });
    independentFlows.add(flow);
    const props = { flow, details: value, enabled: true, configured: true, ensureVerifiedAccount: async () => {}, onRegistered() {}, onEdit() {} };
    const renderer = await mount(React.createElement(StudentIdVerification, props));
    for (const firstName of ["Maria Ana Updated", "Maria Ana"]) {
      await check(renderer, confirmationLabel);
      value = draft({ firstName });
      await act(async () => renderer.update(React.createElement(React.StrictMode, null, React.createElement(StudentIdVerification, { ...props, details: value }))));
      assert.equal(checkbox(renderer, confirmationLabel).props.checked, false);
      assert.equal(button(renderer, "Open camera").props.disabled, true);
    }
    assert.equal(runtime.mediaRequests, 0);
  });
});

describe("actual lifecycle cancellation, stage controls, and late-cleanup admission", () => {
  for (const event of ["blur", "pagehide", "freeze", "orientationchange", "permission", "resize"]) {
    test(`${event} cancels verification; a late receipt cannot register or reopen`, async () => {
      const wait = deferred(runtime.response()); let signal; let request;
      runtime.verify = async (image, _draft, current) => { request = image; signal = current; return wait.promise; };
      const renderer = await verifiedForm(); await open(renderer); await capture(renderer);
      if (event === "permission") await act(async () => runtime.setPermission("denied"));
      else if (event === "resize") await act(async () => runtime.resize({ width: 390, height: 390 }));
      else await act(async () => runtime.emit(event, {}, event === "freeze" ? runtime.document : runtime.window));
      assert.equal(signal.aborted, true); assert.equal(request.imageBase64, "");
      assert.equal(runtime.registrationCalls, 0); assert.equal(button(renderer, "Open camera").props.disabled, true);
      wait.finish(); await flush();
      assert.equal(runtime.registrationCalls + runtime.successes, 0); assert.equal(runtime.mediaRequests, 1);
      assertNoSensitiveUi(renderer);
    });
  }
  test("cancel opening returns promptly but a late getUserMedia keeps remounted signup blocked until stopped", async () => {
    const stream = new SyntheticStream(); runtime.streams.push(stream);
    const wait = deferred(stream); runtime.getMedia = () => wait.promise;
    const renderer = await verifiedForm(); await open(renderer);
    await click(renderer, "Cancel opening"); assert.ok(hasText(renderer, "Finishing cancelled work"));
    await unmount(renderer);
    const reloads = runtime.reloads;
    const resumed = await form();
    assert.equal(button(resumed, "Create account").props.disabled, true);
    assert.equal(hasText(resumed, "Verify your student ID"), false);
    assert.ok(hasText(resumed, "Earlier camera or signup work is still finishing"));
    assert.equal(runtime.reloads, reloads);
    await act(async () => wait.finish()); await flush();
    assert.equal(stream.tracks[0].stops, 1); assert.equal(runtime.mediaRequests, 1);
    assert.ok(hasText(resumed, "Verify your student ID"));
    assert.equal(checkbox(resumed, confirmationLabel).props.checked, false);
    assert.ok(hasText(resumed, "Camera closed"));
    assert.equal(button(resumed, "Open camera").props.disabled, true);
    await check(resumed, confirmationLabel);
    assert.equal(button(resumed, "Open camera").props.disabled, false);
    assert.equal(runtime.mediaRequests, 1); assertNoSensitiveUi(resumed);
  });
  test("late toBlob after unmount cannot consume pixels; a remount waits for actual encoder cleanup", async () => {
    const wait = deferred(new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xff, 0xd9])], { type: "image/jpeg" }));
    runtime.encode = () => wait.promise;
    const renderer = await verifiedForm(); await open(renderer); await capture(renderer);
    assert.ok(hasText(renderer, "Cancel capture"));
    await unmount(renderer);
    const reloads = runtime.reloads;
    const resumed = await form();
    assert.equal(button(resumed, "Create account").props.disabled, true);
    assert.equal(hasText(resumed, "Verify your student ID"), false);
    assert.ok(hasText(resumed, "Earlier camera or signup work is still finishing"));
    assert.equal(runtime.reloads, reloads);
    assert.ok(runtime.canvases[0].width > 0);
    await act(async () => wait.finish()); await flush();
    assert.equal(runtime.canvases[0].width, 0); assert.equal(runtime.verificationCalls, 0);
    assert.ok(hasText(resumed, "Verify your student ID"));
    assert.equal(checkbox(resumed, confirmationLabel).props.checked, false);
    assert.ok(hasText(resumed, "Camera closed"));
    assert.equal(button(resumed, "Open camera").props.disabled, true);
    await check(resumed, confirmationLabel);
    assert.equal(button(resumed, "Open camera").props.disabled, false);
    assert.equal(runtime.mediaRequests, 1); assertNoSensitiveUi(resumed);
  });
  test("Cancel registration clears in-flight receipt references and late success cannot navigate", async () => {
    const wait = deferred(); let held; let signal;
    runtime.register = async (request, current) => { held = request; signal = current; await wait.promise; };
    const renderer = await verifiedForm(); await open(renderer); await capture(renderer);
    await click(renderer, "Cancel registration");
    assert.equal(signal.aborted, true); assert.equal(held.idVerificationReceipt, undefined);
    assert.equal(button(renderer, "Open camera").props.disabled, true);
    wait.finish(); await flush(); assert.equal(runtime.successes, 0);
    assert.equal(getActivePendingRegistration().payload.id, "synthetic-web-uid");
  });
  test("account switch while a verification request is slow cancels it and preserves the unrelated user", async () => {
    const wait = deferred(runtime.response()); let signal;
    runtime.verify = async (_request, _value, current) => { signal = current; return wait.promise; };
    const renderer = await verifiedForm(); await open(renderer); await capture(renderer);
    const other = runtime.user({ uid: "synthetic-other", email: "other@example.com" });
    await act(async () => setUser(other));
    assert.equal(signal.aborted, true); wait.finish(); await flush();
    assert.equal(runtime.registrationCalls + runtime.successes + runtime.signOuts + runtime.deletes, 0);
    assert.equal(firebaseAuth.currentUser, other); assertNoSensitiveUi(renderer);
  });
  test("15-second opening watchdog and 45-second signup budget preserve late-cleanup blocking", async t => {
    const time = clock(t);
    const media = deferred(new SyntheticStream()); runtime.getMedia = () => media.promise;
    const renderer = await verifiedForm(); await open(renderer);
    await time.tick(15_000);
    assert.ok(hasText(renderer, "took too long")); assert.equal(button(renderer, "Open camera").props.disabled, true);
    media.finish(); await flush();
    runtime.getMedia = async () => { const stream = new SyntheticStream(); runtime.streams.push(stream); return stream; };
    const verify = deferred(runtime.response()); runtime.verify = () => verify.promise;
    await click(renderer, "Open camera"); await capture(renderer);
    await time.tick(45_000);
    assert.ok(hasText(renderer, "Verification or registration took too long"));
    assert.equal(button(renderer, "Open camera").props.disabled, true);
    verify.finish(); await flush();
    assert.equal(runtime.registrationCalls + runtime.successes, 0);
    assert.equal(button(renderer, "Open camera").props.disabled, false);
  });
  test("15-second restore watchdog cannot advance its late cached verified flag", async t => {
    const time = clock(t); const wait = deferred(); let slow = true;
    setUser(runtime.user({ async reload() { runtime.reloads++; if (slow) await wait.promise; } })); saveDraft();
    const renderer = await form();
    await time.tick(14_999); assert.equal(hasText(renderer, "Verify your email"), false);
    await time.tick(1);
    assert.ok(hasText(renderer, "Verify your email")); assert.ok(hasText(renderer, "Signup work took too long"));
    assert.equal(button(renderer, "I've verified my email").props.disabled, true);
    await time.tick(4000); assert.equal(runtime.reloads, 1);
    slow = false; await act(async () => wait.finish()); await flush();
    assert.equal(hasText(renderer, "Verify your student ID"), false);
    assert.equal(button(renderer, "I've verified my email").props.disabled, false);
    await click(renderer, "I've verified my email");
    assert.ok(hasText(renderer, "Verify your student ID")); assert.equal(checkbox(renderer, confirmationLabel).props.checked, false);
    assert.equal(runtime.mediaRequests + runtime.registrationCalls + runtime.successes, 0);
    await unmount(renderer); assert.equal(time.timerCount, 0);
  });
  test("15-second email recheck watchdog rejects late verification and keeps cleanup single-flight", async t => {
    const time = clock(t); const wait = deferred();
    setUser(runtime.user({ emailVerified: false })); saveDraft();
    const renderer = await form();
    firebaseAuth.currentUser.reload = async function () { runtime.reloads++; await wait.promise; this.emailVerified = true; };
    await click(renderer, "I've verified my email");
    await time.tick(14_999); assert.ok(hasText(renderer, "Checking…"));
    await time.tick(1); assert.ok(hasText(renderer, "Signup work took too long"));
    assert.equal(button(renderer, "I've verified my email").props.disabled, true);
    assert.equal(runtime.reloads, 2);
    await act(async () => wait.finish()); await flush();
    assert.equal(hasText(renderer, "Verify your student ID"), false);
    firebaseAuth.currentUser.reload = async () => { runtime.reloads++; };
    await click(renderer, "I've verified my email");
    assert.ok(hasText(renderer, "Verify your student ID")); assert.equal(runtime.reloads, 3);
    assert.equal(runtime.mediaRequests + runtime.registrationCalls + runtime.successes, 0);
    await unmount(renderer); assert.equal(time.timerCount, 0);
  });
  test("15-second email resend watchdog cannot show late success or automatically resend", async t => {
    const time = clock(t); const wait = deferred();
    setUser(runtime.user({ emailVerified: false })); saveDraft();
    const renderer = await form(); await time.tick(60_000);
    runtime.resend = () => wait.promise;
    await click(renderer, "Resend email");
    await time.tick(14_999); assert.equal(runtime.resends, 1);
    await time.tick(1); assert.ok(hasText(renderer, "Signup work took too long"));
    assert.equal(button(renderer, "Resend email").props.disabled, true);
    await act(async () => wait.finish()); await flush();
    assert.equal(hasText(renderer, "A new verification link was sent"), false); assert.equal(runtime.resends, 1);
    runtime.resend = async () => {};
    await click(renderer, "Resend email");
    assert.equal(runtime.resends, 2); assert.ok(hasText(renderer, "A new verification link was sent"));
    assert.equal(runtime.mediaRequests + runtime.registrationCalls + runtime.successes, 0);
    await unmount(renderer); assert.equal(time.timerCount, 0);
  });
  test("45-second Firebase setup watchdog retains a late account without stale mail or draft", async t => {
    const time = clock(t); const wait = deferred();
    runtime.create = async email => { await wait.promise; const user = runtime.user({ email, emailVerified: false }); setUser(user); return user; };
    const renderer = await form(); await fill(renderer); await acceptBoth(renderer); await submit(renderer);
    await time.tick(44_999); assert.ok(hasText(renderer, "Preparing signup…"));
    await time.tick(1); assert.ok(hasText(renderer, "Signup work took too long"));
    assert.equal(button(renderer, "Create account").props.disabled, true);
    await submit(renderer); assert.equal(runtime.createCalls, 1);
    await act(async () => wait.finish()); await flush();
    assert.ok(firebaseAuth.currentUser); assert.equal(getActivePendingRegistration(), null);
    assert.equal(runtime.resends + runtime.profileUpdates + runtime.registrationCalls + runtime.successes + runtime.signOuts + runtime.deletes, 0);
    assert.equal(button(renderer, "Create account").props.disabled, false); assertNoSensitiveUi(renderer);
    await unmount(renderer); assert.equal(time.timerCount, 0);
  });
  test("45-second started sign-out watchdog does not free admission ahead of the SDK", async t => {
    const time = clock(t); const wait = deferred();
    const renderer = await verifiedForm();
    runtime.logout = async () => { await wait.promise; setUser(null); };
    await click(renderer, "Use a different email");
    await time.tick(44_999); assert.equal(button(renderer, "Create account").props.disabled, true);
    await time.tick(1); await unmount(renderer);
    const next = await form(); assert.equal(button(next, "Create account").props.disabled, true);
    assert.equal(runtime.signOuts, 1);
    await act(async () => wait.finish()); await flush();
    assert.equal(button(next, "Create account").props.disabled, false);
    assert.equal(getActivePendingRegistration(), null);
    assert.equal(runtime.createCalls + runtime.registrationCalls + runtime.successes + runtime.deletes, 0);
    await unmount(next); assert.equal(time.timerCount, 0);
  });
  test("registration-only retry uses the 45-second controller inside the 50-second consumer", async t => {
    const time = clock(t); const wait = deferred(); let request; let signal;
    runtime.register = async () => { throw new RegistrationError("service_unavailable"); };
    const renderer = await verifiedForm(); await open(renderer); await capture(renderer);
    runtime.register = async (held, current) => { request = held; signal = current; await wait.promise; };
    await click(renderer, "Retry registration (no new photo)");
    await time.tick(15_000); assert.equal(signal.aborted, false);
    await time.tick(29_999); assert.equal(signal.aborted, false);
    await time.tick(1); assert.equal(signal.aborted, true); assert.equal(request.idVerificationReceipt, undefined);
    assert.ok(hasText(renderer, "Verification or registration took too long"));
    assert.equal(button(renderer, "Open camera").props.disabled, true);
    await act(async () => wait.finish()); await flush();
    assert.equal(runtime.mediaRequests, 1); assert.equal(runtime.verificationCalls, 1); assert.equal(runtime.registrationCalls, 2);
    assert.equal(runtime.successes, 0); assert.equal(button(renderer, "Open camera").props.disabled, false);
    assertNoSensitiveUi(renderer); await unmount(renderer); assert.equal(time.timerCount, 0);
  });
  test("faculty's 45-second registration watchdog cannot promote a late transport success", async t => {
    const time = clock(t); const wait = deferred(); let signal;
    setUser(runtime.user({ email: "faculty@pnm.edu.ph" })); saveDraft(draft({ role: "Faculty", email: "faculty@pnm.edu.ph" }));
    runtime.register = async (_request, current) => { signal = current; await wait.promise; };
    const renderer = await form();
    await time.tick(44_999); assert.equal(signal.aborted, false);
    await time.tick(1); assert.equal(signal.aborted, true);
    assert.equal(button(renderer, "Try again").props.disabled, true);
    await act(async () => wait.finish()); await flush();
    assert.equal(runtime.successes + runtime.verificationCalls + runtime.mediaRequests + runtime.signOuts + runtime.deletes, 0);
    assert.equal(runtime.registrationCalls, 1); assert.equal(button(renderer, "Try again").props.disabled, false);
    assertNoSensitiveUi(renderer); await unmount(renderer); assert.equal(time.timerCount, 0);
  });
});

describe("actual web route gate, modal ownership, and existing-session compatibility", () => {
  test("App gates pending signup before a cached profile can mount protected content", async () => {
    setUser(runtime.user()); saveDraft(); runtime.route = "/home";
    queryClient.setQueryData(["userProfile", firebaseAuth.currentUser.uid], { id: firebaseAuth.currentUser.uid, role: "Student" });
    const renderer = await mount(React.createElement(App));
    assert.equal(runtime.currentPath, "/register"); assert.ok(hasText(renderer, "Verify your student ID"));
    assert.equal(runtime.unrelatedMounts, 0); assert.equal(runtime.mediaRequests, 0);
    assertNoSensitiveUi(renderer);
  });
  test("normal cached sessions still reach protected routes and leave existing synthetic MFA storage unchanged", async () => {
    const user = runtime.user(); setUser(user); runtime.route = "/home";
    runtime.store.set(MFA_KEY, JSON.stringify({ accessToken: SYNTHETIC_MFA_TOKEN, refreshToken: "synthetic-web-mfa-refresh",
      expiresAt: new Date(Date.now() + 600_000).toISOString() }));
    const previous = runtime.store.get(MFA_KEY);
    queryClient.setQueryData(["userProfile", user.uid], { id: user.uid, role: "Student" });
    const renderer = await mount(React.createElement(App));
    assert.equal(runtime.currentPath, "/home"); assert.ok(hasText(renderer, "Home"));
    assert.equal(runtime.store.get(MFA_KEY), previous); assert.equal(runtime.createCalls + runtime.mediaRequests, 0);
  });
  test("active pending drafts notify the gate even when localStorage writes are blocked", async () => {
    const user = runtime.user(); setUser(user); runtime.route = "/home";
    queryClient.setQueryData(["userProfile", user.uid], { id: user.uid, role: "Student" });
    const renderer = await mount(React.createElement(App));
    runtime.writeBlocked = true;
    await act(async () => saveDraft()); await flush();
    assert.equal(runtime.currentPath, "/register"); assert.ok(hasText(renderer, "Verify your student ID"));
    assert.ok(getActivePendingRegistration()); assert.equal(runtime.store.has(PENDING_KEY), false);
  });
  test("a cross-tab clear invalidates an active signup and never forwards raw storage event values", async () => {
    const wait = deferred(runtime.response()); let signal;
    runtime.verify = async (_request, _value, current) => { signal = current; return wait.promise; };
    const renderer = await verifiedForm(); await open(renderer); await capture(renderer);
    runtime.store.delete(PENDING_KEY);
    await act(async () => runtime.emit("storage", { key: PENDING_KEY, newValue: SYNTHETIC_PRIVATE, oldValue: SYNTHETIC_PRIVATE }));
    assert.equal(signal.aborted, true); wait.finish(); await flush();
    assert.equal(runtime.registrationCalls + runtime.successes, 0); assertNoSensitiveUi(renderer);
  });
  test("safe pending-storage notifications publish the post-write value, including clear", () => {
    const seen = [];
    const unsubscribe = subscribePendingRegistration(() => seen.push(getActivePendingRegistration()?.uid ?? null));
    saveDraft(); clearPendingRegistration(); unsubscribe();
    assert.deepEqual(seen, ["synthetic-web-uid", null]);
  });
  test("web Register uses receipt-bearing transport and fresh Firebase, never the generic MFA provider", async () => {
    setUser(runtime.user()); saveDraft(); let uploads = 0; let registrations = 0; let ordinaryTokenReads = 0;
    runtime.http = async config => {
      if (config.url === "Auth/me") {
        assert.equal(registrations, 1, "Only completed signup may mount its ordinary protected profile lookup.");
        assert.equal(config.headers.get("Authorization") === `Bearer ${SYNTHETIC_MFA_TOKEN}`, true);
        return response(config, { id: "synthetic-web-uid", role: "Student" });
      }
      assert.equal(ordinaryTokenReads, 0, "Signup must not consult the generic MFA provider.");
      assert.equal(config.headers.get("Authorization") === `Bearer ${SYNTHETIC_FIREBASE_TOKEN}`, true);
      if (config.url === "https://idv.example.test/api/v1/id-verification") { uploads++; return response(config, runtime.response()); }
      if (config.url === "/auth/register") { registrations++; assert.equal(JSON.parse(config.data).idVerificationReceipt === SYNTHETIC_RECEIPT, true); return response(config, { id: "synthetic-web-uid" }); }
      runtime.unexpectedRequests++; throw new Error("Unexpected synthetic endpoint.");
    };
    const renderer = await mount(React.createElement(App));
    // Ordinary completed-session profile requests retain their MFA-preferred
    // path. The verification/registration assertions above still forbid it.
    setTokenProvider(async () => { ordinaryTokenReads++; return SYNTHETIC_MFA_TOKEN; });
    await open(renderer); await capture(renderer);
    assert.equal(uploads, 1); assert.equal(registrations, 1);
    assert.equal(runtime.currentPath, "/home"); assert.deepEqual(runtime.navigation, [["/home", true]]);
    assert.equal(getActivePendingRegistration(), null);
    assert.equal(runtime.createCalls, 0);
  });
  test("modal close cancels immediately, before its 300ms animation or a late verification result", async t => {
    const time = clock(t);
    setUser(runtime.user()); saveDraft();
    const wait = deferred(); let signal; let registrations = 0;
    runtime.http = async config => {
      if (config.url === "https://idv.example.test/api/v1/id-verification") { signal = config.signal; await wait.promise; return response(config, runtime.response()); }
      if (config.url === "/auth/register") { registrations++; return response(config, {}); }
      runtime.unexpectedRequests++; throw new Error("Unexpected synthetic endpoint.");
    };
    const renderer = await mount(React.createElement(App)); await open(renderer); await capture(renderer);
    await click(renderer, "Close");
    assert.equal(signal.aborted, true); assert.equal(runtime.navigation.length, 0);
    wait.finish(); await flush(); assert.equal(registrations, 0); assert.ok(getActivePendingRegistration());
    await time.tick(300); assert.deepEqual(runtime.navigation, [["/", false]]); assert.equal(runtime.currentPath, "/");
  });
  test("same-turn repeated modal closes are single-flight; unmount cancels the navigation timer", async t => {
    const time = clock(t); let requests = 0; let closes = 0;
    const renderer = await mount(React.createElement(Modal, { onCloseRequest() { requests++; }, onClose() { closes++; } }, "Synthetic content"));
    const close = button(renderer, "Close").props.onClick;
    await act(async () => { close(); close(); });
    assert.equal(requests, 1); await unmount(renderer); await time.tick(300);
    assert.equal(closes, 0);
  });
});
