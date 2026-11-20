// Actual React provider, wizard, consent, camera UI, and routes. The only mocks
// are native/Firebase/service boundaries; every image/token/receipt is synthetic
// and stays in memory. These tests are NOT live Android signup acceptance.
import './support/runtime-loader.mjs';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { setImmediate } from 'node:timers/promises';

const React = (await import('react')).default;
const { act, create } = (await import('react-test-renderer')).default;
const axios = (await import('axios')).default;
const { runtime, firebaseAuth, setUser, authError, MFA_STORAGE_KEY } = await import('./support/runtime-mocks.mjs');
let unexpectedRequests = 0;
const noRequest = async () => { unexpectedRequests++; throw new Error('Unexpected runtime-test network request.'); };
// Set adapters BEFORE production modules construct their Axios instances.
const runtimeAdapter = async config => {
  if (config.url === '/auth/refresh' && runtime.refresh) return runtime.refresh(config);
  return noRequest();
};
axios.defaults.adapter = runtimeAdapter;
globalThis.fetch = noRequest;
const { AuthSessionProvider, useAuthSession } = await import('../contexts/AuthSessionContext.tsx');
const { default: SignUpFlow } = await import('../components/SignUpFlow.tsx');
const { default: SignupConsent } = await import('../components/SignupConsent.tsx');
const { default: StudentIdCapture } = await import('../components/StudentIdCapture.tsx');
const { default: MfaSecuritySection } = await import('../components/MfaSecuritySection.tsx');
const { default: SignUpRoute } = await import('../app/sign-up.tsx');
const { default: IndexRoute } = await import('../app/index.tsx');
const { default: TabLayout } = await import('../app/(tabs)/_layout.tsx');
const { createStudentSignupFlow } = await import('../../../packages/api/src/auth/studentSignupFlow.ts');
const { RegistrationError } = await import('../../../packages/api/src/auth/registrationError.ts');
const { createMemoryCaptureSession, MEMORY_PICTURE_OPTIONS } = await import('../lib/idCapture/memoryCapture.ts');
const { PENDING_REGISTRATION_KEY } = await import('../lib/registration/pendingRegistrationStore.ts');
const { toPendingStudentRegistration, toSignupRegistrationDraft } = await import('../lib/registration/pendingRegistration.ts');
const { clearMfaTokens, getMfaAccessToken, refreshMfaAccessToken, storeMfaTokens } = await import('../lib/mfaSession.ts');

const h = React.createElement;
const SENSITIVE = 'synthetic-runtime-sensitive-marker';
const pending = { firebaseUid: 'synthetic-firebase-uid', email: 'personal@example.com', firstName: 'Maria Ana',
  middleInitial: 'Q', lastName: 'Dela Cruz', suffix: 'Jr.', studentNumber: '00-00123', position: 'Member',
  institute: 'Institute of Computing Studies', program: 'BS Computer Science', yearLevel: 4, section: 'A',
  privacyNoticeAccepted: true, privacyNoticeVersion: '2026-10-23', termsAccepted: true, termsVersion: '2026-10-23' };
const preview = { width: 400, height: 600 };
const renderers = new Set();
const flows = new Set();
const waits = new Set();
let unexpectedDiagnostics = 0;
let originalConsoleError;

beforeEach(() => {
  runtime.reset();
  unexpectedRequests = 0;
  unexpectedDiagnostics = 0;
  // A missed service mock must fail closed, not contact a real endpoint.
  axios.defaults.adapter = runtimeAdapter;
  globalThis.fetch = noRequest;
  originalConsoleError = console.error;
  console.error = message => {
    if (typeof message === 'string' && message.startsWith('react-test-renderer is deprecated.')) return;
    // Never print component props or exception payloads, even from a test.
    unexpectedDiagnostics++;
  };
});

afterEach(async () => {
  try {
    await act(async () => {
      renderers.forEach(renderer => renderer.unmount());
      renderers.clear();
      flows.forEach(flow => flow.dispose());
      flows.clear();
      waits.forEach(wait => wait.resolve(wait.cleanupValue));
      waits.clear();
      await setImmediate();
      await clearMfaTokens(); // drain the actual storage queue before changing fixtures
    });
    assert.equal(runtime.listenerCount('change'), 0);
    assert.equal(runtime.listenerCount('blur'), 0);
    assert.equal(runtime.listenerCount('focus'), 0);
    assert.equal(unexpectedRequests, 0, 'Runtime tests must never make network requests.');
    assert.equal(unexpectedDiagnostics, 0, 'Unexpected React diagnostic (payload deliberately not printed).');
  } finally { console.error = originalConsoleError; }
});

function deferred(cleanupValue) {
  let finish;
  const promise = new Promise(resolve => { finish = resolve; });
  const wait = { promise, cleanupValue, resolve(value) { waits.delete(wait); finish(value); } };
  waits.add(wait);
  return wait;
}
async function flush() { await act(async () => { await setImmediate(); }); }
async function fire(action) { await act(async () => { action(); await setImmediate(); }); }
async function mount(element, strict = false) {
  let renderer;
  await act(async () => {
    renderer = create(strict ? h(React.StrictMode, null, element) : element);
    renderers.add(renderer);
    await setImmediate();
  });
  return renderer;
}
async function unmount(renderer) {
  await fire(() => { renderer.unmount(); renderers.delete(renderer); });
}
function text(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  return (node.children ?? []).map(text).join('');
}
function control(renderer, label) {
  const matches = renderer.root.findAll(node => (node.type === 'Pressable' || node.type === 'Text') &&
    typeof node.props.onPress === 'function' && (node.props.accessibilityLabel === label || text(node) === label));
  assert.equal(matches.length, 1, `Expected one control: ${label}`);
  return matches[0];
}
async function press(renderer, label) {
  const node = control(renderer, label);
  assert.ok(!node.props.disabled, `Control must be enabled: ${label}`);
  await fire(() => { void node.props.onPress(); });
}
async function input(renderer, placeholder, value) {
  const node = renderer.root.findByProps({ placeholder });
  assert.ok(node.props.editable !== false, 'Input must be editable.');
  await fire(() => node.props.onChangeText(value));
}
function camera(renderer) { return renderer.root.findByType('CameraView'); }
function cameras(renderer) { return renderer.root.findAllByType('CameraView'); }
function assertNoSensitiveUi(renderer) {
  const rendered = JSON.stringify(renderer.toJSON()); // synthetic values only, never written or logged
  assert.ok(!rendered.includes(SENSITIVE));
  assert.ok(!rendered.includes('/9j/2Q=='));
  assert.ok(!rendered.includes('synthetic-runtime-receipt'));
}
function assertSafeError(code) {
  return error => {
    assert.equal(error.code, code);
    assert.ok(!JSON.stringify(error).includes(SENSITIVE));
    assert.ok(!String(error).includes(SENSITIVE));
    return true;
  };
}
function signupFlow(overrides = {}) {
  const flow = createStudentSignupFlow({
    async getVerifiedDraft() { return toSignupRegistrationDraft(pending, pending.firebaseUid); },
    async verify(request, draft, signal) { runtime.verificationCalls++; return runtime.verify(request, draft, signal); },
    async register(profile, signal) { runtime.registrationCalls++; await runtime.register(profile, signal); },
    ...overrides,
  });
  flows.add(flow);
  return flow;
}
async function captureFixture(overrides = {}, strict = false) {
  const props = { flow: signupFlow(), details: pending, enabled: true, accountReady: true, emailVerified: true,
    async ensureVerifiedAccount() {}, onRegistered() {}, onEdit() {}, ...overrides };
  const renderer = await mount(h(StudentIdCapture, props), strict);
  return { renderer, props, async update(changes = {}) {
    Object.assign(props, changes);
    await fire(() => renderer.update(strict ? h(React.StrictMode, null, h(StudentIdCapture, props)) : h(StudentIdCapture, props)));
  } };
}
async function prepareCamera(renderer) {
  const layout = renderer.root.findAll(node => node.type === 'View' && typeof node.props.onLayout === 'function');
  assert.equal(layout.length, 1);
  await fire(() => layout[0].props.onLayout({ nativeEvent: { layout: preview } }));
  await press(renderer, 'These details match my printed student ID');
  await press(renderer, 'Open camera');
  await fire(() => camera(renderer).props.onCameraReady());
  assert.equal(camera(renderer).props.pictureSize, '2000x1500');
  await fire(() => camera(renderer).props.onCameraReady());
  assert.ok(!control(renderer, 'Capture front and register').props.disabled);
}
async function providerFixture(child = null, strict = false) {
  let value;
  function Probe() { value = useAuthSession(); return null; }
  const tree = current => h(AuthSessionProvider, null, h(Probe), current);
  const renderer = await mount(tree(child), strict);
  assert.equal(value.restoring, false);
  return { renderer, get value() { return value; }, async updateChild(next) {
    await fire(() => renderer.update(strict ? h(React.StrictMode, null, tree(next)) : tree(next)));
  } };
}
function restorePending(verified = true, draft = pending) {
  runtime.store.set(PENDING_REGISTRATION_KEY, JSON.stringify(draft));
  firebaseAuth.currentUser = runtime.user({ uid: draft.firebaseUid, email: draft.email, emailVerified: verified });
}
async function wizardFixture(overrides = {}) {
  const props = { flow: signupFlow(), pendingRegistration: pending, accountReady: true, emailVerified: false,
    async onBeginRegistration() { return { verificationRequired: true }; }, onRegistered() {},
    async ensureVerifiedAccount() {}, async onCheckVerification() { return false; },
    async onResendVerification() {}, async onCancelRegistration() {}, ...overrides };
  const renderer = await mount(h(SignUpFlow, props));
  return { renderer, props, async update(changes) {
    Object.assign(props, changes);
    await fire(() => renderer.update(h(SignUpFlow, props)));
  } };
}
async function accept(renderer, notice) {
  await press(renderer, `Read ${notice}`);
  await press(renderer, 'I have read and agree');
}

function mfaTokens(label, expired = false) {
  return { accessToken: `synthetic-${label}-access`, refreshToken: `synthetic-${label}-refresh`,
    expiresAt: new Date(Date.now() + (expired ? -1000 : 600_000)).toISOString() };
}
function refreshResponse(data, config) { return { data, config, status: 200, statusText: 'OK', headers: {} }; }

describe('actual MFA storage/refresh ownership', () => {
  test('clear invalidates a pending token read before removal, without returning or refreshing the stale token', async () => {
    const old = mfaTokens('old');
    runtime.store.set(MFA_STORAGE_KEY, JSON.stringify(old));
    const slow = deferred();
    runtime.read = async key => {
      const value = runtime.store.get(key) ?? null;
      if (key === MFA_STORAGE_KEY) await slow.promise;
      return value;
    };
    const read = getMfaAccessToken();
    await flush();
    const clearing = clearMfaTokens();
    const newer = storeMfaTokens(mfaTokens('new'), () => true);
    slow.resolve();
    assert.equal(await read, undefined);
    await Promise.all([clearing, newer]);
    assert.equal(runtime.mfaToken, mfaTokens('new').accessToken);
    assert.equal(await getMfaAccessToken(), mfaTokens('new').accessToken);
  });

  test('a guarded write cancelled while AsyncStorage is pending is removed before a newer account write', async () => {
    const slow = deferred();
    let first = true;
    let current = true;
    runtime.save = async (key, value) => {
      if (key === MFA_STORAGE_KEY && first) { first = false; await slow.promise; }
      runtime.store.set(key, value);
    };
    const stale = storeMfaTokens(mfaTokens('old'), () => current);
    await flush();
    current = false;
    const newer = storeMfaTokens(mfaTokens('new'), () => true);
    slow.resolve();
    await Promise.all([stale, newer]);
    assert.equal(runtime.mfaToken, mfaTokens('new').accessToken);
    assert.deepEqual(runtime.storageEvents.map(([action]) => action), ['save', 'remove', 'save']);
    const events = runtime.storageEvents.length;
    await storeMfaTokens(mfaTokens('late-old'), () => false);
    assert.equal(runtime.storageEvents.length, events);
    assert.equal(await getMfaAccessToken(), mfaTokens('new').accessToken);
  });

  test('clear and newer-account writes stay ordered behind a pending old write', async () => {
    const slow = deferred();
    let first = true;
    runtime.save = async (key, value) => {
      if (key === MFA_STORAGE_KEY && first) { first = false; await slow.promise; }
      runtime.store.set(key, value);
    };
    const stale = storeMfaTokens(mfaTokens('old'), () => true);
    await flush();
    const clearing = clearMfaTokens();
    const newer = storeMfaTokens(mfaTokens('new'), () => true);
    slow.resolve();
    await Promise.all([stale, clearing, newer]);
    assert.equal(runtime.mfaToken, mfaTokens('new').accessToken);
    assert.deepEqual(runtime.storageEvents.map(([action]) => action), ['save', 'remove', 'remove', 'save']);
  });

  test('a late successful refresh cannot resurrect tokens after clear', async () => {
    await storeMfaTokens(mfaTokens('old', true), () => true);
    const slow = deferred();
    let requests = 0;
    runtime.refresh = async config => { requests++; await slow.promise; return refreshResponse(mfaTokens('refreshed-old'), config); };
    const refreshing = getMfaAccessToken();
    await flush();
    assert.equal(requests, 1);
    await clearMfaTokens();
    slow.resolve();
    assert.equal(await refreshing, undefined);
    assert.equal(runtime.store.has(MFA_STORAGE_KEY), false);
  });

  for (const succeeds of [false, true]) {
    test(`a late ${succeeds ? 'successful' : 'failed'} refresh cannot overwrite or clear newer account tokens`, async () => {
      await storeMfaTokens(mfaTokens('old', true), () => true);
      const slow = deferred();
      runtime.refresh = async config => {
        await slow.promise;
        if (!succeeds) throw new Error(SENSITIVE);
        return refreshResponse(mfaTokens('refreshed-old'), config);
      };
      const refreshing = refreshMfaAccessToken();
      await flush();
      await storeMfaTokens(mfaTokens('new'), () => true);
      const removals = runtime.mfaClears;
      slow.resolve();
      assert.equal(await refreshing, undefined);
      assert.equal(runtime.mfaClears, removals);
      assert.equal(await getMfaAccessToken(), mfaTokens('new').accessToken);
    });
  }

  test('an old refresh finally cannot release the newer revision\'s single-flight ownership', async () => {
    await storeMfaTokens(mfaTokens('old', true), () => true);
    const old = deferred();
    const newer = deferred();
    let requests = 0;
    runtime.refresh = async config => {
      requests++;
      if (requests === 1) { await old.promise; return refreshResponse(mfaTokens('refreshed-old'), config); }
      await newer.promise;
      return refreshResponse(mfaTokens('refreshed-new'), config);
    };
    const oldWork = getMfaAccessToken();
    await flush();
    await clearMfaTokens();
    await storeMfaTokens(mfaTokens('new', true), () => true);
    const newWork = getMfaAccessToken();
    await flush();
    assert.equal(requests, 2);
    old.resolve();
    assert.equal(await oldWork, undefined);
    const sameRevision = refreshMfaAccessToken();
    await flush();
    assert.equal(requests, 2);
    newer.resolve();
    assert.deepEqual(await Promise.all([newWork, sameRevision]),
      [mfaTokens('refreshed-new').accessToken, mfaTokens('refreshed-new').accessToken]);
    assert.equal(await getMfaAccessToken(), mfaTokens('refreshed-new').accessToken);
  });

  test('a stale malformed read cannot remove the newer account write queued behind it', async () => {
    runtime.store.set(MFA_STORAGE_KEY, '{"accessToken":null}');
    const slow = deferred();
    runtime.read = async key => {
      const raw = runtime.store.get(key) ?? null;
      if (key === MFA_STORAGE_KEY) await slow.promise;
      return raw;
    };
    const stale = getMfaAccessToken();
    await flush();
    const newer = storeMfaTokens(mfaTokens('new'), () => true);
    slow.resolve();
    assert.equal(await stale, undefined);
    await newer;
    assert.equal(runtime.mfaClears, 0);
    assert.equal(runtime.mfaToken, mfaTokens('new').accessToken);
  });
});

describe('native signup consent runtime', () => {
  test('reading, dismissing, and Android back never imply acceptance; each notice requires its own action', async () => {
    let accepted;
    function Harness() {
      const [privacy, setPrivacy] = React.useState(false);
      const [terms, setTerms] = React.useState(false);
      accepted = [privacy, terms];
      return h(SignupConsent, { privacyAccepted: privacy, termsAccepted: terms,
        onPrivacyChange: setPrivacy, onTermsChange: setTerms });
    }
    const renderer = await mount(h(Harness));
    await press(renderer, 'Read privacy notice');
    assert.deepEqual(accepted, [false, false]);
    await fire(() => renderer.root.findByType('Modal').props.onRequestClose());
    assert.deepEqual(accepted, [false, false]);
    await press(renderer, 'I have read and agree to the privacy notice');
    await press(renderer, 'Not now');
    assert.deepEqual(accepted, [false, false]);
    await accept(renderer, 'privacy notice');
    assert.deepEqual(accepted, [true, false]);
    await accept(renderer, 'terms and conditions');
    assert.deepEqual(accepted, [true, true]);
    await press(renderer, 'I have read and agree to the privacy notice');
    assert.deepEqual(accepted, [false, true]);
    assert.equal(renderer.root.findAllByType('Modal').length, 0);
  });

  test('a notice opened before a busy render cannot be accepted while disabled', async () => {
    let changes = 0;
    const props = { privacyAccepted: false, termsAccepted: false, onPrivacyChange() { changes++; }, onTermsChange() { changes++; } };
    const renderer = await mount(h(SignupConsent, props));
    await press(renderer, 'Read privacy notice');
    await fire(() => renderer.update(h(SignupConsent, { ...props, disabled: true })));
    assert.ok(control(renderer, 'I have read and agree').props.disabled);
    await press(renderer, 'Not now');
    assert.equal(changes, 0);
  });
});

describe('student signup wizard runtime', () => {
  test('new signup accepts personal email and exact leading zeros; email verification never registers or opens a camera', async () => {
    let submitted;
    let registrations = 0;
    const f = await wizardFixture({ pendingRegistration: null, accountReady: false, emailVerified: false,
      async onBeginRegistration(payload) {
        assert.ok(payload.password === SENSITIVE);
        submitted = toPendingStudentRegistration(payload);
        return { verificationRequired: true };
      }, async onCheckVerification() { return true; }, onRegistered() { registrations++; } });
    await press(f.renderer, 'Next');
    await input(f.renderer, 'All given names, in the printed order', pending.firstName);
    await input(f.renderer, 'One letter, or leave empty', pending.middleInitial);
    await input(f.renderer, 'Enter your printed last name', pending.lastName);
    await input(f.renderer, 'Jr., Sr., II, III', pending.suffix);
    await press(f.renderer, 'Next');
    for (const [label, selection] of [['Institute', pending.institute], ['Program', pending.program], ['Year level', '4th Year']]) {
      await press(f.renderer, label);
      await press(f.renderer, selection);
    }
    await input(f.renderer, 'e.g. A', 'A');
    await press(f.renderer, 'Next');
    await input(f.renderer, 'NN-NNNNN (e.g. 00-00123)', '0O-00123');
    await input(f.renderer, 'Create a password', SENSITIVE);
    await input(f.renderer, 'Confirm your password', SENSITIVE);
    await press(f.renderer, 'Next');
    assert.ok(text(f.renderer.root).includes('Use exactly NN-NNNNN'));
    assert.equal(f.renderer.root.findByProps({ placeholder: 'NN-NNNNN (e.g. 00-00123)' }).props.value, '0O-00123');
    await input(f.renderer, 'NN-NNNNN (e.g. 00-00123)', pending.studentNumber);
    await press(f.renderer, 'Next');
    await input(f.renderer, 'Your personal email address', pending.email);
    await press(f.renderer, 'Create Firebase account');
    assert.equal(submitted, undefined);
    await accept(f.renderer, 'privacy notice');
    await accept(f.renderer, 'terms and conditions');
    await press(f.renderer, 'Create Firebase account');
    assert.equal(submitted.studentNumber, '00-00123');
    assert.equal(submitted.firstName, 'Maria Ana');
    assert.equal(submitted.suffix, 'Jr.');
    assert.equal(submitted.email, 'personal@example.com');
    assert.ok(!JSON.stringify(submitted).includes(SENSITIVE));
    await f.update({ pendingRegistration: submitted, accountReady: true });
    await press(f.renderer, 'I have verified my email');
    assert.equal(f.renderer.root.findByType(StudentIdCapture).props.enabled, true);
    assert.equal(registrations, 0);
    assert.equal(runtime.captureCalls, 0);
    assert.equal(runtime.verificationCalls, 0);
    assert.equal(runtime.permissionRequests, 0);
    assert.equal(cameras(f.renderer).length, 0);
    assertNoSensitiveUi(f.renderer);
  });

  test('legacy consent resumes at real acceptance with a locked, bound Firebase email', async () => {
    let calls = 0;
    const f = await wizardFixture({ pendingRegistration: { ...pending, privacyNoticeVersion: 'old', termsVersion: 'old' },
      emailVerified: true, async onBeginRegistration(payload) {
        calls++;
        assert.equal(payload.password, '');
        assert.equal(payload.privacyNoticeVersion, '2026-10-23');
        assert.equal(payload.termsVersion, '2026-10-23');
        return { verificationRequired: false };
      } });
    assert.equal(f.renderer.root.findByProps({ placeholder: 'Your personal email address' }).props.editable, false);
    await press(f.renderer, 'Resume signup');
    assert.equal(calls, 0);
    await accept(f.renderer, 'privacy notice');
    await accept(f.renderer, 'terms and conditions');
    await press(f.renderer, 'Resume signup');
    assert.equal(calls, 1);
    assert.equal(f.renderer.root.findByType(StudentIdCapture).props.enabled, true);
    assert.equal(runtime.captureCalls, 0);
  });

  test('signed-out resume asks only for the existing password, not a new password confirmation', async () => {
    let calls = 0;
    const f = await wizardFixture({ accountReady: false, emailVerified: false,
      async onBeginRegistration(payload) {
        calls++;
        assert.ok(payload.password === 'six123');
        assert.equal(payload.position, pending.position);
        return { verificationRequired: false };
      } });
    assert.equal(f.renderer.root.findAllByProps({ placeholder: 'Confirm your password' }).length, 0);
    await press(f.renderer, 'Next');
    assert.equal(calls, 0);
    await input(f.renderer, 'Enter your existing password', 'six123');
    await press(f.renderer, 'Next');
    await press(f.renderer, 'Resume signup');
    assert.equal(calls, 1);
    assert.equal(cameras(f.renderer).length, 0);
    assertNoSensitiveUi(f.renderer);
  });

  test('backing out during an email check suppresses its late step change and duplicate checks', async () => {
    const slow = deferred(false);
    let checks = 0;
    const f = await wizardFixture({ async onCheckVerification() { checks++; return slow.promise; } });
    const handler = control(f.renderer, 'I have verified my email').props.onPress;
    await fire(() => { handler(); handler(); });
    assert.equal(checks, 1);
    await press(f.renderer, 'Go back');
    slow.resolve(true);
    await flush();
    assert.equal(f.renderer.root.findByType(StudentIdCapture).props.enabled, false);
    assert.ok(control(f.renderer, 'Resume signup'));
  });

  test('background completion of email checking cannot advance to ID capture', async () => {
    const slow = deferred(false);
    const f = await wizardFixture({ async onCheckVerification() { return slow.promise; } });
    await press(f.renderer, 'I have verified my email');
    await fire(() => runtime.emit('change', 'background'));
    slow.resolve(true);
    await flush();
    assert.equal(f.renderer.root.findByType(StudentIdCapture).props.enabled, false);
    await fire(() => runtime.emit('change', 'active'));
    assert.equal(cameras(f.renderer).length, 0);
  });

  test('closing during Firebase preparation clears credentials and ignores a late successful result', async () => {
    const slow = deferred({ verificationRequired: false });
    let exits = 0;
    const f = await wizardFixture({ accountReady: false, initialStep: 4,
      async onBeginRegistration() { return slow.promise; }, onExit() { exits++; } });
    await input(f.renderer, 'Enter your existing password', SENSITIVE);
    await press(f.renderer, 'Next');
    await press(f.renderer, 'Resume signup');
    await press(f.renderer, 'Close');
    slow.resolve({ verificationRequired: false });
    await flush();
    assert.equal(exits, 1);
    assert.equal(f.renderer.root.findByType(StudentIdCapture).props.enabled, false);
    await press(f.renderer, 'Go back');
    assert.equal(f.renderer.root.findByProps({ placeholder: 'Enter your existing password' }).props.value, '');
    assertNoSensitiveUi(f.renderer);
  });

  for (const platform of ['ios', 'web']) {
    test(`${platform} fails closed without native camera, permission, or account creation`, async () => {
      runtime.platform = platform;
      const f = await wizardFixture({ pendingRegistration: null, accountReady: false });
      assert.ok(control(f.renderer, 'Next').props.disabled);
      assert.equal(cameras(f.renderer).length, 0);
      assert.equal(runtime.permissionRequests, 0);
      assert.equal(runtime.protectionEvents.length, 0);
      assert.equal(runtime.createCalls, 0);
    });
  }
});

describe('Firebase signup provider runtime', () => {
  test('Firebase supplies the authoritative UID; profile-only storage gates verified accounts and bypasses MFA tokens', async () => {
    const f = await providerFixture();
    let reloads = 0;
    let forced = false;
    const user = runtime.user({ emailVerified: false, async reload() { reloads++; },
      async getIdToken(force) { forced = force; return 'synthetic-firebase-token'; } });
    runtime.create = async () => { setUser(user); return user; };
    await act(async () => {
      await f.value.beginRegistration({ ...pending, firebaseUid: 'forged-caller-uid', password: SENSITIVE,
        idVerificationReceipt: SENSITIVE, imageBase64: SENSITIVE, ocrText: SENSITIVE });
    });
    assert.equal(f.value.pendingRegistration.firebaseUid, user.uid);
    assert.equal(f.value.session, null);
    user.emailVerified = true;
    await fire(() => setUser(user));
    runtime.mfaToken = 'synthetic-wrong-mfa-token';
    let draft;
    await act(async () => { draft = await f.value.getVerifiedRegistrationDraft(); });
    assert.equal(draft.id, user.uid);
    assert.equal(reloads, 1);
    assert.equal(forced, true);
    assert.equal(runtime.mfaChallenges, 0);
    assert.equal(f.value.session, null);
    assert.ok(!JSON.stringify(f.value).includes(SENSITIVE));
    for (const value of runtime.store.values()) assert.ok(!value.includes(SENSITIVE));
  });

  test('the provider sends only an allowlisted request copy and wipes it before session promotion', async () => {
    restorePending();
    const f = await providerFixture();
    let draft;
    await act(async () => { draft = await f.value.getVerifiedRegistrationDraft(); });
    const request = { ...draft, idVerificationReceipt: SENSITIVE, imageBase64: SENSITIVE,
      ocrText: SENSITIVE, password: SENSITIVE, toJSON() { throw new Error(SENSITIVE); } };
    let sent;
    runtime.register = async profile => {
      sent = profile;
      assert.ok(profile !== request);
      assert.ok(profile.idVerificationReceipt === SENSITIVE);
      for (const key of ['password', 'imageBase64', 'ocrText', 'toJSON']) assert.equal(profile[key], undefined);
      assert.equal(f.value.session, null);
    };
    await act(async () => { await f.value.completeRegistration(request, new AbortController().signal); });
    assert.equal(sent.idVerificationReceipt, undefined);
    assert.equal(f.value.session.uid, pending.firebaseUid);
    assert.equal(f.value.pendingRegistration, null);
    for (const value of runtime.store.values()) assert.ok(!value.includes(SENSITIVE));
  });

  test('failed login invalidates the receipt but retains the verified pending-account session gate', async () => {
    restorePending();
    const f = await providerFixture();
    let invalidations = 0;
    const stop = f.value.subscribeRegistrationInvalidation(() => invalidations++);
    await act(async () => {
      await assert.rejects(f.value.signInWithStudentNumber('00-00123', 'incorrect'), assertSafeError('auth/invalid-credential'));
    });
    stop();
    assert.equal(invalidations, 1);
    assert.equal(f.value.pendingRegistration.firebaseUid, pending.firebaseUid);
    assert.equal(f.value.session, null);
    assert.equal(firebaseAuth.currentUser.uid, pending.firebaseUid);
    assert.equal(runtime.signOuts, 0);
    assert.equal(runtime.deletes, 0);
    assert.ok(runtime.store.has(PENDING_REGISTRATION_KEY));
  });

  test('unverified student-number login retains its resend action without needing a signup draft', async () => {
    const f = await providerFixture();
    const user = runtime.user({ emailVerified: false });
    runtime.login = async () => { setUser(user); return user; };
    await act(async () => {
      await assert.rejects(f.value.signInWithStudentNumber('00-00123', 'synthetic-password'), assertSafeError('auth/email-not-verified'));
    });
    await act(async () => { await f.value.resendVerification(); });
    assert.equal(runtime.resends, 1);
    assert.equal(f.value.pendingRegistration, null);
    assert.equal(f.value.session, null);
    assert.equal(runtime.signOuts, 0);
  });

  test('restoring an unrelated draft does not delete, sign out, or replace the normal student session', async () => {
    restorePending();
    const normal = runtime.user({ uid: 'normal-student-uid', email: 'normal@example.com' });
    firebaseAuth.currentUser = normal;
    runtime.mfaToken = 'synthetic-existing-mfa-token';
    const f = await providerFixture(h(SignUpRoute));
    assert.equal(f.value.session.uid, normal.uid);
    assert.equal(f.value.pendingRegistration, null);
    assert.equal(f.renderer.root.findByType('Redirect').props.href, '/(tabs)/home');
    await act(async () => {
      await assert.rejects(f.value.beginRegistration({ ...pending, password: SENSITIVE }), assertSafeError('auth/already-signed-in'));
      await f.value.cancelRegistration();
    });
    assert.equal(firebaseAuth.currentUser, normal);
    assert.equal(runtime.signOuts, 0);
    assert.equal(runtime.deletes, 0);
    assert.equal(runtime.createCalls, 0);
    assert.equal(runtime.protectionEvents.length, 0);
    assert.equal(runtime.mfaClears, 0);
  });

  for (const verified of [false, true]) {
    test(`explicit cancellation ${verified ? 'keeps a verified account' : 'deletes only the owned unverified account'} and removes the pending draft`, async () => {
      restorePending(verified);
      const f = await providerFixture();
      await act(async () => { await f.value.cancelRegistration(); });
      assert.equal(runtime.deletes, verified ? 0 : 1);
      assert.equal(f.value.pendingRegistration, null);
      assert.equal(f.value.session, null);
      assert.equal(firebaseAuth.currentUser, null);
      assert.equal(runtime.store.has(PENDING_REGISTRATION_KEY), false);
    });
  }

  test('a slow draft save cannot resurrect the draft after explicit cancellation', async () => {
    restorePending();
    const f = await providerFixture();
    const slow = deferred();
    let first = true;
    runtime.save = async (key, value) => {
      if (key === PENDING_REGISTRATION_KEY && first) { first = false; await slow.promise; }
      runtime.store.set(key, value);
    };
    await act(async () => { await f.value.beginRegistration({ ...pending, password: '' }); });
    await act(async () => { await f.value.cancelRegistration(); });
    slow.resolve();
    await flush();
    assert.equal(f.value.session, null);
    assert.equal(runtime.store.has(PENDING_REGISTRATION_KEY), false);
  });

  test('a cancelled, late verified-password resume cannot become a normal session', async () => {
    const f = await providerFixture();
    const slow = deferred(runtime.user());
    runtime.create = async () => { throw authError('auth/email-already-in-use'); };
    runtime.passwordSignIn = async () => { const user = await slow.promise; setUser(user); return user; };
    let failure;
    let lateSession = false;
    function Watch() { lateSession ||= !!useAuthSession().session; return null; }
    await f.updateChild(h(Watch));
    await fire(() => { failure = assert.rejects(f.value.beginRegistration({ ...pending, password: SENSITIVE }), assertSafeError('cancelled')); });
    assert.equal(runtime.passwordSignIns, 1);
    await act(async () => { await f.value.cancelRegistration(); });
    slow.resolve(runtime.user());
    await act(async () => { await failure; await setImmediate(); });
    assert.equal(lateSession, false);
    assert.equal(f.value.session, null);
    assert.equal(runtime.registrationCalls, 0);
    assert.equal(runtime.deletes, 0);
  });

  test('overlapping Firebase account preparation fails closed without disabling the normal-session MFA gate', async () => {
    restorePending();
    const f = await providerFixture();
    const slow = deferred({ mfaRequired: false });
    runtime.login = async () => firebaseAuth.currentUser;
    runtime.challenge = async () => slow.promise;
    let login;
    await fire(() => { login = f.value.signInWithStudentNumber('00-00123', 'synthetic-password'); });
    assert.equal(runtime.mfaChallenges, 1);
    await act(async () => {
      await assert.rejects(f.value.beginRegistration({ ...pending, password: '' }), assertSafeError('auth/operation-in-progress'));
    });
    slow.resolve({ mfaRequired: false });
    await act(async () => { await login; });
    const beforeSwitch = runtime.mfaChallenges;
    runtime.challenge = async () => ({ mfaRequired: true, pendingToken: 'synthetic-new-challenge' });
    await fire(() => setUser(runtime.user({ uid: 'different-normal-uid', email: 'other@example.com' })));
    assert.equal(runtime.mfaChallenges, beforeSwitch + 1);
    assert.equal(f.value.mfaPending, true);
    assert.equal(f.value.session, null);
  });

  test('cancelling MFA while its token save is pending cannot leave a stale token or promote the account', async () => {
    const f = await providerFixture();
    const user = runtime.user();
    runtime.login = async () => { setUser(user); return user; };
    runtime.challenge = async () => ({ mfaRequired: true, pendingToken: 'synthetic-challenge' });
    await act(async () => { await f.value.signInWithStudentNumber('00-00123', 'synthetic-password'); });
    const slow = deferred();
    runtime.save = async (key, value) => {
      if (key === MFA_STORAGE_KEY) await slow.promise;
      runtime.store.set(key, value);
    };
    let failure;
    await fire(() => { failure = assert.rejects(f.value.verifyMfa('123456'), assertSafeError('auth/no-current-user')); });
    let cancellation;
    await fire(() => { cancellation = f.value.cancelMfa(); });
    slow.resolve();
    await act(async () => { await Promise.all([failure, cancellation]); });
    assert.equal(f.value.session, null);
    assert.equal(runtime.mfaToken, undefined);
  });

  test('overlapping MFA verification is rejected before a second request or competing token save', async () => {
    const f = await providerFixture();
    const user = runtime.user();
    runtime.login = async () => { setUser(user); return user; };
    runtime.challenge = async () => ({ mfaRequired: true, pendingToken: 'synthetic-pending-mfa' });
    await act(async () => { await f.value.signInWithStudentNumber('00-00123', 'synthetic-password'); });
    const slow = deferred(mfaTokens('verified'));
    let requests = 0;
    runtime.mfaVerify = async () => { requests++; return slow.promise; };
    let verifying;
    await fire(() => { verifying = f.value.verifyMfa('123456'); });
    await act(async () => {
      await assert.rejects(f.value.verifyMfa('123456'), assertSafeError('auth/operation-in-progress'));
    });
    assert.equal(requests, 1);
    slow.resolve(mfaTokens('verified'));
    await act(async () => { await verifying; });
    assert.equal(runtime.mfaToken, mfaTokens('verified').accessToken);
    assert.equal(f.value.session.uid, user.uid);
  });

  for (const stage of ['token', 'challenge']) {
    test(`a failed login ${stage} check stays gated even when Firebase sign-out also fails`, async () => {
      const f = await providerFixture();
      const user = runtime.user(stage === 'token' ? {
        async getIdToken() { throw authError('auth/network-request-failed'); },
      } : {});
      runtime.login = async () => { setUser(user); return user; };
      runtime.challenge = async () => { throw authError('auth/network-request-failed'); };
      runtime.logout = async () => { throw authError('auth/network-request-failed'); };
      let opened = false;
      function Watch() { opened ||= !!useAuthSession().session; return null; }
      await f.updateChild(h(Watch));
      await act(async () => {
        await assert.rejects(f.value.signInWithStudentNumber('00-00123', 'synthetic-password'),
          assertSafeError('auth/network-request-failed'));
      });
      await fire(() => setUser(user));
      assert.equal(opened, false);
      assert.equal(f.value.session, null);
      assert.equal(runtime.deletes, 0);
    });
  }

  test('a delayed profile-cache write issued by successful signup cannot resurrect after sign-out', async () => {
    restorePending();
    const f = await providerFixture();
    const slow = deferred();
    runtime.save = async (key, value) => {
      if (key === 'monteai.auth.studentNumber') await slow.promise;
      runtime.store.set(key, value);
    };
    let draft;
    await act(async () => { draft = await f.value.getVerifiedRegistrationDraft(); });
    await act(async () => {
      await f.value.completeRegistration({ ...draft, idVerificationReceipt: 'synthetic-runtime-receipt' }, new AbortController().signal);
    });
    let signingOut;
    await fire(() => { signingOut = f.value.signOut(); });
    slow.resolve();
    await act(async () => { await signingOut; });
    assert.equal(runtime.store.has('monteai.auth.studentNumber'), false);
    assert.equal(f.value.session, null);
  });

  test('sign-out clears MFA before slow profile cleanup and never signs out or clears a newer unrelated account', async () => {
    firebaseAuth.currentUser = runtime.user();
    runtime.mfaToken = mfaTokens('old').accessToken;
    const f = await providerFixture();
    const slow = deferred();
    runtime.remove = async key => {
      if (key === 'monteai.auth.studentNumber') await slow.promise;
      runtime.store.delete(key);
    };
    let signingOut;
    await fire(() => { signingOut = f.value.signOut(); });
    assert.equal(runtime.store.has(MFA_STORAGE_KEY), false);
    const normal = runtime.user({ uid: 'new-normal-uid', email: 'other@example.com' });
    await fire(() => setUser(normal));
    await act(async () => { await storeMfaTokens(mfaTokens('new'), () => true); });
    slow.resolve();
    await act(async () => { await signingOut; await setImmediate(); });
    assert.equal(runtime.signOuts, 0);
    assert.equal(firebaseAuth.currentUser, normal);
    assert.equal(runtime.mfaToken, mfaTokens('new').accessToken);
    assert.equal(f.value.session.uid, normal.uid);
  });

  for (const action of ['cancelRegistration', 'cancelMfa']) {
    test(`${action} cannot erase newer account tokens queued during its storage cleanup`, async () => {
      if (action === 'cancelRegistration') restorePending(false);
      else {
        firebaseAuth.currentUser = runtime.user();
        runtime.challenge = async () => ({ mfaRequired: true, pendingToken: 'synthetic-pending-mfa' });
      }
      const f = await providerFixture();
      const slow = deferred();
      let first = true;
      runtime.remove = async key => {
        if (key === MFA_STORAGE_KEY && first) { first = false; await slow.promise; }
        runtime.store.delete(key);
      };
      let cancellation;
      await fire(() => { cancellation = f.value[action](); });
      const normal = runtime.user({ uid: 'new-normal-uid', email: 'other@example.com' });
      await fire(() => setUser(normal));
      const newer = storeMfaTokens(mfaTokens('new'), () => true);
      slow.resolve();
      await act(async () => { await Promise.all([cancellation, newer]); await setImmediate(); });
      assert.equal(runtime.signOuts, 0);
      assert.equal(runtime.deletes, 0);
      assert.equal(firebaseAuth.currentUser, normal);
      assert.equal(runtime.mfaToken, mfaTokens('new').accessToken);
      assert.equal(f.value.session.uid, normal.uid);
    });
  }

  test('signup cancellation with no owned signup cannot invalidate an unrelated normal-account MFA check', async () => {
    firebaseAuth.currentUser = runtime.user();
    runtime.mfaToken = mfaTokens('old').accessToken;
    const f = await providerFixture();
    const slow = deferred({ mfaRequired: false });
    runtime.challenge = async () => slow.promise;
    const normal = runtime.user({ uid: 'new-normal-uid', email: 'other@example.com' });
    await fire(() => setUser(normal));
    assert.equal(f.value.session, null);
    await act(async () => { await f.value.cancelRegistration(); });
    slow.resolve({ mfaRequired: false });
    await flush();
    assert.equal(f.value.session.uid, normal.uid);
    assert.equal(runtime.signOuts, 0);
    assert.equal(runtime.deletes, 0);
  });

  test('overlapping sign-out calls join the same owned cleanup instead of starting duplicate Firebase operations', async () => {
    firebaseAuth.currentUser = runtime.user();
    runtime.mfaToken = mfaTokens('old').accessToken;
    const f = await providerFixture();
    const slow = deferred();
    runtime.logout = async () => { await slow.promise; setUser(null); };
    let first;
    let second;
    await fire(() => { first = f.value.signOut(); second = f.value.signOut(); });
    assert.equal(runtime.signOuts, 1);
    slow.resolve();
    await act(async () => { await Promise.all([first, second]); });
    assert.equal(runtime.signOuts, 1);
    assert.equal(f.value.session, null);
    assert.equal(runtime.mfaToken, undefined);
  });
});

describe('normal-account MFA setup ownership runtime', () => {
  async function securityFixture() {
    firebaseAuth.currentUser = runtime.user();
    runtime.mfaToken = mfaTokens('normal').accessToken;
    return providerFixture(h(MfaSecuritySection));
  }
  async function prepareEnrollment(renderer) {
    await press(renderer, 'Set up authenticator');
    await input(renderer, '6-digit code', '123456');
  }

  test('a late enrollment-confirmation result after unmount cannot replace the current account token', async () => {
    const f = await securityFixture();
    await prepareEnrollment(f.renderer);
    const slow = deferred({ ...mfaTokens('late-old'), recoveryCodes: ['synthetic-late-recovery-code'] });
    runtime.mfaConfirm = async () => slow.promise;
    await press(f.renderer, 'Verify and enable');
    await f.updateChild(null);
    await act(async () => { await storeMfaTokens(mfaTokens('new'), () => true); });
    slow.resolve(slow.cleanupValue);
    await flush();
    assert.equal(runtime.mfaToken, mfaTokens('new').accessToken);
  });

  test('an account switch drops old enrollment/recovery UI and prevents a late confirmation from overwriting newer tokens', async () => {
    const f = await securityFixture();
    await prepareEnrollment(f.renderer);
    const slow = deferred({ ...mfaTokens('late-old'), recoveryCodes: ['synthetic-late-recovery-code'] });
    runtime.mfaConfirm = async () => slow.promise;
    await press(f.renderer, 'Verify and enable');
    const normal = runtime.user({ uid: 'new-normal-uid', email: 'other@example.com' });
    await fire(() => setUser(normal));
    await act(async () => { await storeMfaTokens(mfaTokens('new'), () => true); });
    slow.resolve(slow.cleanupValue);
    await flush();
    assert.equal(runtime.mfaToken, mfaTokens('new').accessToken);
    assert.ok(!text(f.renderer.root).includes('synthetic-late-recovery-code'));
    assert.ok(!text(f.renderer.root).includes('synthetic-setup-key'));
    assert.equal(firebaseAuth.currentUser, normal);
  });

  test('a double tap starts only one enrollment confirmation and keeps a usable MFA session', async () => {
    const f = await securityFixture();
    await prepareEnrollment(f.renderer);
    const handler = control(f.renderer, 'Verify and enable').props.onPress;
    await fire(() => { handler(); handler(); });
    assert.equal(runtime.mfaConfirmations, 1);
    assert.equal(runtime.mfaToken, 'synthetic-mfa-token');
    assert.ok(text(f.renderer.root).includes('synthetic-recovery-code'));
  });

  test('unmount during the actual MFA token write removes that write before newer tokens', async () => {
    const f = await securityFixture();
    await prepareEnrollment(f.renderer);
    const slow = deferred();
    let first = true;
    runtime.save = async (key, value) => {
      if (key === MFA_STORAGE_KEY && first) { first = false; await slow.promise; }
      runtime.store.set(key, value);
    };
    await press(f.renderer, 'Verify and enable');
    assert.equal(first, false);
    await f.updateChild(null);
    const newer = storeMfaTokens(mfaTokens('new'), () => true);
    slow.resolve();
    await act(async () => { await newer; await setImmediate(); });
    assert.equal(runtime.mfaToken, mfaTokens('new').accessToken);
  });

  test('settings actions use the captured account header; post-enrollment status uses the newly issued token', async () => {
    const f = await securityFixture();
    runtime.mfaEnroll = async token => {
      assert.equal(token, mfaTokens('normal').accessToken);
      return { secret: 'synthetic-setup-key', otpauthUri: 'synthetic-setup-uri' };
    };
    runtime.mfaConfirm = async (_input, token) => {
      assert.equal(token, mfaTokens('normal').accessToken);
      return { ...mfaTokens('confirmed'), recoveryCodes: ['synthetic-recovery-code'] };
    };
    runtime.mfaStatus = async token => {
      assert.equal(token, mfaTokens('confirmed').accessToken);
      return { totpEnabled: true, recoveryCodesRemaining: 1 };
    };
    await prepareEnrollment(f.renderer);
    await press(f.renderer, 'Verify and enable');
    assert.ok(text(f.renderer.root).includes('Two-factor authentication is on'));
    assert.equal(f.value.session.uid, firebaseAuth.currentUser.uid);
  });
});

describe('Android capture component runtime', () => {
  test('explicit capture uses pinned options, closes only the preview, releases pixels before verification, and discards all payloads', async () => {
    const image = runtime.jpeg();
    let registered = 0;
    let options;
    runtime.capture = async value => { options = value; return runtime.picture(); };
    runtime.encode = async () => image;
    const slow = deferred({ outcome: 'verified', receipt: 'synthetic-runtime-receipt',
      expiresAt: new Date(Date.now() + 590_000).toISOString(), templateId: 'cdm-front-v1' });
    runtime.verify = async (_request, _draft, signal) => {
      assert.equal(signal.aborted, false);
      assert.deepEqual(runtime.nativeEvents, ['encode', 'dispose', 'release']);
      return slow.promise;
    };
    const f = await captureFixture({ onRegistered() { registered++; } });
    assert.equal(cameras(f.renderer).length, 0);
    assert.equal(runtime.permissionRequests, 0);
    await prepareCamera(f.renderer);
    assert.equal(camera(f.renderer).props.ratio, undefined);
    await press(f.renderer, 'Capture front and register');
    assert.deepEqual(options, MEMORY_PICTURE_OPTIONS);
    assert.equal(cameras(f.renderer).length, 0);
    assert.equal(f.props.flow.getState().phase, 'verifying');
    assert.equal(f.props.flow.getState().busy, true);
    assert.ok(image.imageBase64.length > 0); // preview closure did not abort its cleanup owner
    assertNoSensitiveUi(f.renderer);
    slow.resolve(slow.cleanupValue);
    await flush();
    assert.equal(f.props.flow.getState().phase, 'complete');
    assert.equal(image.imageBase64, '');
    assert.equal(runtime.captureCalls, 1);
    assert.equal(runtime.registrationCalls, 1);
    assert.equal(registered, 1);
    assertNoSensitiveUi(f.renderer);
  });

  test('stale native ready/error callbacks cannot enable or close a newer bounded camera mount', async () => {
    const f = await captureFixture();
    await press(f.renderer, 'These details match my printed student ID');
    await press(f.renderer, 'Open camera');
    const old = camera(f.renderer).props;
    await fire(() => old.onCameraReady());
    assert.equal(camera(f.renderer).props.pictureSize, '2000x1500');
    assert.ok(control(f.renderer, 'Capture front and register').props.disabled);
    await fire(() => { old.onCameraReady(); old.onMountError(); });
    assert.equal(cameras(f.renderer).length, 1);
    assert.ok(control(f.renderer, 'Capture front and register').props.disabled);
    const bounded = camera(f.renderer).props;
    await fire(() => bounded.onCameraReady());
    await press(f.renderer, 'Cancel capture / close camera');
    await press(f.renderer, 'Open camera');
    await fire(() => { old.onMountError(); bounded.onMountError(); bounded.onCameraReady(); });
    assert.equal(cameras(f.renderer).length, 1);
    assert.ok(control(f.renderer, 'Capture front and register').props.disabled);
    assert.equal(runtime.captureCalls, 0);
  });

  test('a late size query from a closed preview cannot remount the new camera', async () => {
    const slow = deferred(['2000x1500']);
    let first = true;
    runtime.sizes = async () => { if (first) { first = false; return slow.promise; } return ['2000x1500']; };
    const f = await captureFixture();
    await press(f.renderer, 'These details match my printed student ID');
    await press(f.renderer, 'Open camera');
    await fire(() => camera(f.renderer).props.onCameraReady());
    await press(f.renderer, 'Cancel capture / close camera');
    await press(f.renderer, 'Open camera');
    const latestReady = camera(f.renderer).props.onCameraReady;
    slow.resolve(['1600x1200']);
    await flush();
    assert.equal(camera(f.renderer).props.onCameraReady, latestReady);
    assert.equal(camera(f.renderer).props.pictureSize, undefined);
  });

  test('StrictMode replays use fresh, serialized screen-protection leases and leave one lifecycle subscription', async () => {
    const slow = deferred();
    let first = true;
    runtime.prevent = async () => { if (first) { first = false; await slow.promise; } };
    const f = await captureFixture({}, true);
    await press(f.renderer, 'These details match my printed student ID');
    assert.ok(control(f.renderer, 'Open camera').props.disabled);
    assert.equal(runtime.protectionEvents.length, 1);
    slow.resolve();
    await flush();
    assert.deepEqual(runtime.protectionEvents.map(([type]) => type), ['prevent', 'allow', 'prevent']);
    assert.notEqual(runtime.protectionEvents[0][1], runtime.protectionEvents[2][1]);
    assert.equal(runtime.listenerCount('change'), 1);
    assert.equal(runtime.listenerCount('blur'), 1);
    assert.equal(runtime.listenerCount('focus'), 1);
    await press(f.renderer, 'Open camera');
    await unmount(f.renderer);
    assert.deepEqual(runtime.protectionEvents.map(([type]) => type), ['prevent', 'allow', 'prevent', 'allow']);
  });

  test('failed screen protection and denied permissions never open a camera or offer a file fallback', async () => {
    runtime.prevent = async () => { throw new Error(SENSITIVE); };
    runtime.permission = { granted: false, canAskAgain: false };
    const f = await captureFixture();
    await press(f.renderer, 'These details match my printed student ID');
    assert.ok(control(f.renderer, 'Allow camera').props.disabled);
    assert.ok(control(f.renderer, 'Open camera').props.disabled);
    assert.equal(runtime.permissionRequests, 0);
    assert.equal(cameras(f.renderer).length, 0);
    assert.equal(f.renderer.root.findAllByType('Image').length, 0);
    assertNoSensitiveUi(f.renderer);
  });

  test('revoking and restoring permission never automatically remounts the old camera preview', async () => {
    const f = await captureFixture();
    await prepareCamera(f.renderer);
    runtime.permission = { granted: false, canAskAgain: true };
    await f.update();
    assert.equal(cameras(f.renderer).length, 0);
    runtime.permission = { granted: true, canAskAgain: true };
    await f.update();
    assert.equal(cameras(f.renderer).length, 0);
    assert.equal(runtime.captureCalls, 0);
    assert.equal(runtime.permissionRequests, 0);
  });

  for (const event of ['background', 'blur', 'route-blur']) {
    test(`${event} after encoding cancels verification; returning focus never reopens the preview or submits a late receipt`, async () => {
      const image = runtime.jpeg();
      runtime.encode = async () => image;
      const slow = deferred({ outcome: 'verified', receipt: SENSITIVE,
        expiresAt: new Date(Date.now() + 590_000).toISOString(), templateId: 'cdm-front-v1' });
      let upload;
      let abort;
      runtime.verify = async (request, _draft, signal) => { upload = request; abort = signal; return slow.promise; };
      let registered = 0;
      const f = await captureFixture({ onRegistered() { registered++; } });
      await prepareCamera(f.renderer);
      await press(f.renderer, 'Capture front and register');
      assert.equal(f.props.flow.getState().phase, 'verifying');
      assert.equal(cameras(f.renderer).length, 0);
      if (event === 'route-blur') { runtime.focused = false; await f.update(); }
      else await fire(() => runtime.emit(event === 'background' ? 'change' : 'blur', 'background'));
      assert.equal(abort.aborted, true);
      assert.equal(upload.imageBase64, '');
      assert.equal(image.imageBase64, '');
      if (event === 'route-blur') { runtime.focused = true; await f.update(); }
      else await fire(() => { runtime.emit('change', 'active'); runtime.emit('focus'); });
      assert.equal(cameras(f.renderer).length, 0);
      assert.ok(control(f.renderer, 'Open camera').props.disabled); // transport cleanup still owns admission
      slow.resolve(slow.cleanupValue);
      await flush();
      assert.equal(runtime.registrationCalls, 0);
      assert.equal(registered, 0);
      assert.equal(f.props.flow.getState().busy, false);
      assert.equal(cameras(f.renderer).length, 0);
      assertNoSensitiveUi(f.renderer);
    });
  }

  test('unmount during native encoding blocks a remounted camera until destructive cleanup settles', async () => {
    const image = runtime.jpeg();
    const slow = deferred(image);
    runtime.encode = async () => slow.promise;
    const f = await captureFixture();
    await prepareCamera(f.renderer);
    await press(f.renderer, 'Capture front and register');
    assert.deepEqual(runtime.nativeEvents, ['encode']);
    await unmount(f.renderer);
    const next = await captureFixture();
    assert.ok(control(next.renderer, 'These details match my printed student ID').props.disabled);
    assert.ok(control(next.renderer, 'Open camera').props.disabled);
    assert.equal(runtime.captureCalls, 1);
    assert.deepEqual(runtime.nativeEvents, ['encode']); // never recycle native pixels still in use
    slow.resolve(image);
    await flush();
    assert.equal(image.imageBase64, '');
    assert.deepEqual(runtime.nativeEvents, ['encode', 'dispose', 'release']);
    await press(next.renderer, 'These details match my printed student ID');
    assert.ok(!control(next.renderer, 'Open camera').props.disabled);
    assert.equal(cameras(next.renderer).length, 0);
    assert.equal(runtime.verificationCalls, 0);
  });

  test('uncertain registration offers only an explicit registration retry with no second capture or verification', async () => {
    let attempts = 0;
    let firstReceipt;
    runtime.register = async profile => {
      attempts++;
      if (attempts === 1) { firstReceipt = profile.idVerificationReceipt; throw new RegistrationError('service_unavailable'); }
      assert.ok(profile.idVerificationReceipt === firstReceipt);
      firstReceipt = undefined;
    };
    let registered = 0;
    const f = await captureFixture({ onRegistered() { registered++; } });
    await prepareCamera(f.renderer);
    await press(f.renderer, 'Capture front and register');
    assert.equal(f.props.flow.getState().phase, 'retry-registration');
    assert.equal(attempts, 1);
    assert.equal(registered, 0);
    assertNoSensitiveUi(f.renderer);
    await press(f.renderer, 'Retry registration (no new photo)');
    assert.equal(attempts, 2);
    assert.equal(runtime.captureCalls, 1);
    assert.equal(runtime.verificationCalls, 1);
    assert.equal(registered, 1);
  });

  test('editing the printed details drops retry admission and requires explicit reconfirmation', async () => {
    runtime.register = async () => { throw new RegistrationError('service_unavailable'); };
    const f = await captureFixture();
    await prepareCamera(f.renderer);
    await press(f.renderer, 'Capture front and register');
    await f.update({ details: { ...pending, firstName: 'Maria  Ana' } });
    assert.equal(f.props.flow.getState().phase, 'ready');
    assert.ok(control(f.renderer, 'Open camera').props.disabled);
    assert.equal(control(f.renderer, 'These details match my printed student ID').props.accessibilityState.checked, false);
    await assert.rejects(f.props.flow.retryRegistration(), assertSafeError('invalid_receipt'));
  });
});

describe('signup route/controller ownership runtime', () => {
  test('pending signup redirects the index and protected tabs back to signup, not into a verified Firebase-only session', async () => {
    restorePending();
    const f = await providerFixture(h(IndexRoute));
    assert.equal(f.renderer.root.findByType('Redirect').props.href, '/sign-up');
    await f.updateChild(h(TabLayout));
    assert.equal(f.renderer.root.findByType('Redirect').props.href, '/sign-up');
    assert.equal(f.value.session, null);
  });

  test('owned signup survives session promotion and navigates only after controller and capture cleanup finish', async () => {
    restorePending();
    const f = await providerFixture(h(SignUpRoute));
    const routeFlow = f.renderer.root.findByType(SignUpFlow).props.flow;
    const admission = createMemoryCaptureSession({ async capture() {}, async encode() {}, disposePicture() {} });
    let completedWhileCaptureBusy = false;
    let navigatedBeforeControllerCleanup = false;
    const stop = routeFlow.subscribe(state => {
      if (state.phase === 'complete') {
        navigatedBeforeControllerCleanup ||= runtime.navigation.length > 0;
        completedWhileCaptureBusy ||= admission.busy;
      }
    });
    runtime.onNavigate = path => {
      assert.equal(path, '/(tabs)/home');
      assert.equal(routeFlow.getState().busy, false);
      assert.equal(admission.busy, false);
    };
    runtime.register = async profile => { assert.equal(profile.id, firebaseAuth.currentUser.uid); };
    await prepareCamera(f.renderer);
    await press(f.renderer, 'Capture front and register');
    stop();
    admission.dispose();
    assert.equal(navigatedBeforeControllerCleanup, false);
    assert.equal(completedWhileCaptureBusy, true);
    assert.equal(f.value.session.uid, pending.firebaseUid);
    assert.equal(f.renderer.root.findAllByType('Redirect').length, 0);
    assert.deepEqual(runtime.navigation, [['replace', '/(tabs)/home']]);
    assert.equal(runtime.store.has(PENDING_REGISTRATION_KEY), false);
    assert.equal(runtime.freshCalls >= 3, true);
    assertNoSensitiveUi(f.renderer);
  });

  test('route effect replay creates a usable fresh controller and still requires a user-operated camera action', async () => {
    restorePending();
    const f = await providerFixture(h(SignUpRoute), true);
    const flow = f.renderer.root.findByType(SignUpFlow).props.flow;
    assert.equal(flow.getState().busy, false);
    assert.equal(runtime.captureCalls, 0);
    assert.equal(cameras(f.renderer).length, 0);
    await prepareCamera(f.renderer);
    await press(f.renderer, 'Capture front and register');
    assert.equal(flow.getState().phase, 'complete');
    assert.deepEqual(runtime.navigation, [['replace', '/(tabs)/home']]);
  });

  for (const target of ['route', 'provider']) {
    test(`${target} unmount during registration aborts and wipes the transport copy; late success cannot promote or navigate`, async () => {
      restorePending();
      const slow = deferred();
      let sent;
      let signal;
      runtime.register = async (profile, abort) => { sent = profile; signal = abort; await slow.promise; };
      const f = await providerFixture(h(SignUpRoute));
      await prepareCamera(f.renderer);
      await press(f.renderer, 'Capture front and register');
      assert.equal(runtime.registrationCalls, 1);
      if (target === 'route') await f.updateChild(null);
      else await unmount(f.renderer);
      assert.equal(signal.aborted, true);
      assert.equal(sent.idVerificationReceipt, undefined);
      slow.resolve();
      await flush();
      assert.equal(f.value.session, null);
      assert.equal(runtime.navigation.length, 0);
      assert.ok(runtime.store.has(PENDING_REGISTRATION_KEY));
      assert.equal(firebaseAuth.currentUser.uid, pending.firebaseUid);
    });
  }

  test('an account switch during registration preserves the unrelated normal user and suppresses late signup navigation', async () => {
    restorePending();
    const slow = deferred();
    let sent;
    let signal;
    runtime.register = async (profile, abort) => { sent = profile; signal = abort; await slow.promise; };
    const f = await providerFixture(h(SignUpRoute));
    await prepareCamera(f.renderer);
    await press(f.renderer, 'Capture front and register');
    const normal = runtime.user({ uid: 'unrelated-normal-user', email: 'normal@example.com' });
    await fire(() => setUser(normal));
    assert.equal(signal.aborted, true);
    assert.equal(sent.idVerificationReceipt, undefined);
    slow.resolve();
    await flush();
    assert.equal(firebaseAuth.currentUser, normal);
    assert.equal(f.value.session.uid, normal.uid);
    assert.equal(runtime.navigation.length, 0);
    assert.equal(runtime.signOuts, 0);
    assert.equal(runtime.deletes, 0);
    assert.equal(f.value.pendingRegistration, null);
  });
});
