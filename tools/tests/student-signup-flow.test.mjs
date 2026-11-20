import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import { setImmediate, setTimeout as delay } from 'node:timers/promises';
import { describe, test } from 'node:test';
import axios, { AxiosError, CanceledError } from 'axios';
import { createStudentSignupFlow, requireStudentSignupDraft, StudentSignupError,
  STUDENT_SIGNUP_TIMEOUT_MS } from '../../packages/api/src/auth/studentSignupFlow.ts';
import { createAuthService } from '../../packages/api/src/auth/authService.ts';
import { RegistrationError } from '../../packages/api/src/auth/registrationError.ts';
import { LiveIdVerificationService, IdVerificationError } from '../../packages/api/src/id-verification/index.ts';

// Synthetic markers only. These tests have no Firebase, OCR, Azure, disk image,
// or live registration dependency and never decode a JWT.
const SECRET = 'synthetic-signup-sensitive-marker';
const draft = {
  id: 'signup-test-user', role: 'Student', email: 'personal@example.com', firstName: 'Maria',
  middleInitial: 'Q', lastName: 'Dela Cruz', suffix: 'Jr.', studentNumber: '00-00123',
  institute: 'Institute of Computing Studies', program: 'BS Computer Science', position: 'Member',
  yearLevel: 4, section: 'A', privacyNoticeAccepted: true, privacyNoticeVersion: '2026-10-23',
  termsAccepted: true, termsVersion: '2026-10-23',
};
const capture = () => ({ imageBase64: SECRET });
const verification = (ttl = 590_000) => ({ outcome: 'verified', receipt: SECRET,
  expiresAt: new Date(Date.now() + ttl).toISOString(), templateId: 'cdm-front-v1', requestId: 'test-request' });
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function safeError(code, Type = Error) {
  return error => {
    assert.ok(error instanceof Type);
    if (code) assert.equal(error.code, code);
    assert.ok(!inspect(error).includes(SECRET));
    assert.ok(!JSON.stringify(error).includes(SECRET));
    for (const key of ['config', 'request', 'response', 'cause', 'receipt', 'imageBase64']) {
      assert.equal(error[key], undefined);
    }
    return true;
  };
}
function fixture(t, overrides = {}, options) {
  const events = [];
  const dependencies = {
    async getVerifiedDraft() { events.push('verified-draft'); return { ...draft }; },
    async verify(request, bound, signal) {
      events.push('verify');
      assert.equal(request.imageBase64, SECRET);
      assert.equal(bound.id, draft.id);
      assert.equal(signal.aborted, false);
      return verification();
    },
    async register(request, signal) {
      events.push('register');
      assert.equal(request.idVerificationReceipt, SECRET);
      assert.equal(signal.aborted, false);
    },
    ...overrides,
  };
  const flow = createStudentSignupFlow(dependencies, options);
  t.after(() => flow.dispose());
  return { flow, events, dependencies };
}

describe('Android-independent student signup orchestration', () => {
  test('verified identity -> verification -> immediate registration; only safe state is public', async t => {
    const f = fixture(t);
    const states = [];
    f.flow.subscribe(state => states.push(state));
    const image = capture();
    assert.equal(await f.flow.verifyAndRegister(image), undefined);
    assert.deepEqual(f.events, ['verified-draft', 'verify', 'verified-draft', 'register']);
    assert.equal(image.imageBase64, '');
    assert.equal(f.flow.getState().phase, 'complete');
    assert.equal(f.flow.getState().busy, false);
    assert.ok(states.some(state => state.phase === 'verifying'));
    assert.ok(states.some(state => state.phase === 'registering'));
    assert.ok(!inspect(states).includes(SECRET));
    assert.ok(!JSON.stringify(f.flow).includes(SECRET));
    const extra = capture();
    await assert.rejects(f.flow.verifyAndRegister(extra), safeError('disposed', StudentSignupError));
    assert.equal(extra.imageBase64, '');
  });

  test('image/request/response references are wiped before registration token refresh', async t => {
    const entered = deferred();
    const release = deferred();
    const result = verification();
    let reads = 0;
    let request;
    let registration;
    const f = fixture(t, {
      async getVerifiedDraft() {
        if (++reads === 2) { entered.resolve(); await release.promise; }
        return { ...draft };
      },
      async verify(value) { request = value; return result; },
      async register(value) { registration = value; assert.equal(value.idVerificationReceipt, SECRET); },
    });
    const image = capture();
    const task = f.flow.verifyAndRegister(image);
    await entered.promise;
    assert.equal(image.imageBase64, '');
    assert.equal(request.imageBase64, '');
    assert.equal(result.receipt, '');
    release.resolve();
    await task;
    assert.equal(registration.idVerificationReceipt, undefined);
  });

  test('uncertain registration allows only explicit same-receipt retry, without another OCR request', async t => {
    const payloads = [];
    const f = fixture(t, {
      async register(request) {
        payloads.push({ ...request });
        if (payloads.length === 1) throw new AxiosError(SECRET, 'ECONNABORTED', { data: SECRET });
      },
    });
    const image = capture();
    await assert.rejects(f.flow.verifyAndRegister(image), safeError('service_unavailable', RegistrationError));
    assert.equal(image.imageBase64, '');
    assert.equal(f.flow.getState().phase, 'retry-registration');
    assert.equal(payloads.length, 1); // no automatic registration retry
    await f.flow.retryRegistration();
    assert.deepEqual(payloads[1], payloads[0]);
    assert.equal(f.events.filter(event => event === 'verify').length, 1);
    assert.equal(f.flow.getState().phase, 'complete');
  });

  for (const [key, value] of [
    ['id', 'other-user'], ['email', 'PERSONAL@example.com'], ['studentNumber', '00-00999'],
    ['firstName', ' Maria '], ['middleInitial', 'M'], ['lastName', 'Different'], ['suffix', 'Sr.'],
    ['institute', 'Other Institute'], ['program', 'Other Program'], ['position', 'Leader'],
    ['yearLevel', 3], ['section', 'B'],
  ]) {
    test(`registration retry refuses an exact-draft ${key} edit, even if later restored`, async t => {
      let current = { ...draft };
      let posts = 0;
      const f = fixture(t, {
        async getVerifiedDraft() { return { ...current }; },
        async register() { posts++; throw new RegistrationError('service_unavailable'); },
      });
      await assert.rejects(f.flow.verifyAndRegister(capture()), safeError('service_unavailable'));
      current = { ...draft, [key]: value };
      await assert.rejects(f.flow.retryRegistration(), safeError('details_changed', StudentSignupError));
      current = { ...draft };
      await assert.rejects(f.flow.retryRegistration(), safeError('invalid_receipt', RegistrationError));
      assert.equal(posts, 1);
    });
  }

  test('identity is rechecked after verification, so an account change cannot register a late receipt', async t => {
    let reads = 0;
    let posts = 0;
    const f = fixture(t, {
      async getVerifiedDraft() { return { ...draft, id: ++reads === 1 ? draft.id : 'other-user' }; },
      async register() { posts++; },
    });
    await assert.rejects(f.flow.verifyAndRegister(capture()), safeError('details_changed', StudentSignupError));
    assert.equal(posts, 0);
    assert.equal(f.flow.getState().phase, 'ready');
  });

  for (const code of ['invalid_receipt', 'registration_conflict', 'identity_mismatch', 'authentication_required', 'email_unverified']) {
    test(`${code} clears the receipt rather than offering registration-only retry`, async t => {
      const f = fixture(t, { async register() { throw new RegistrationError(code); } });
      await assert.rejects(f.flow.verifyAndRegister(capture()), safeError(code, RegistrationError));
      assert.equal(f.flow.getState().phase, 'ready');
      await assert.rejects(f.flow.retryRegistration(), safeError('invalid_receipt'));
    });
  }

  for (const [code, outcome] of [['image_quality', 'retake'], ['student_name_mismatch', 'unmatched'], ['busy', 'error']]) {
    test(`${outcome} verification never registers and exposes only a whitelisted failure`, async t => {
      let posts = 0;
      const f = fixture(t, {
        async verify() { throw new IdVerificationError({ code, outcome, message: SECRET, status: 422 }); },
        async register() { posts++; },
      });
      const image = capture();
      await assert.rejects(f.flow.verifyAndRegister(image), safeError(code, IdVerificationError));
      assert.equal(image.imageBase64, '');
      assert.equal(posts, 0);
      assert.equal(f.flow.getState().failure.outcome, outcome);
      assert.ok(!inspect(f.flow.getState()).includes(SECRET));
    });
  }

  test('quota cooldown survives cancellation and blocks a second scan before the deadline', async t => {
    let now = Date.now();
    let scans = 0;
    const f = fixture(t, {
      async verify() { scans++; throw new IdVerificationError({ code: 'daily_limit', message: SECRET, status: 429, retryAfterSeconds: 60 }); },
    }, { now: () => now });
    await assert.rejects(f.flow.verifyAndRegister(capture()), safeError('daily_limit'));
    assert.equal(f.flow.getState().retryAt, now + 60_000);
    f.flow.cancel();
    const rejected = capture();
    await assert.rejects(f.flow.verifyAndRegister(rejected), safeError('busy'));
    assert.equal(rejected.imageBase64, '');
    assert.equal(scans, 1);
    now += 60_000;
    await assert.rejects(f.flow.verifyAndRegister(capture()), safeError('daily_limit'));
    assert.equal(scans, 2);
  });

  for (const action of ['cancel', 'invalidate', 'dispose', 'external-abort']) {
    test(`${action} wipes an in-flight capture and suppresses late verification success`, async t => {
      const entered = deferred();
      const slow = deferred();
      const external = new AbortController();
      let request;
      let signal;
      let posts = 0;
      const f = fixture(t, {
        async verify(value, _draft, abort) { request = value; signal = abort; entered.resolve(); return slow.promise; },
        async register() { posts++; },
      });
      const image = capture();
      const task = f.flow.verifyAndRegister(image, external.signal);
      const rejection = assert.rejects(task, safeError(action === 'invalidate' ? 'details_changed' : 'cancelled', StudentSignupError));
      await entered.promise;
      if (action === 'external-abort') external.abort(new Error(SECRET));
      else f.flow[action]();
      assert.equal(image.imageBase64, '');
      assert.equal(request.imageBase64, '');
      assert.equal(signal.aborted, true);
      await rejection;
      assert.equal(f.flow.getState().busy, true); // slow transport still owns cleanup
      const late = verification();
      slow.resolve(late);
      await setImmediate();
      assert.equal(late.receipt, '');
      assert.equal(posts, 0);
      assert.equal(f.flow.getState().busy, false);
      assert.notEqual(f.flow.getState().phase, 'complete');
    });
  }

  test('cancellation during Firebase refresh retains single-flight ownership until refresh settles', async t => {
    const entered = deferred();
    const slow = deferred();
    let scans = 0;
    const f = fixture(t, {
      async getVerifiedDraft() { entered.resolve(); return slow.promise; },
      async verify() { scans++; return verification(); },
    });
    const image = capture();
    const rejection = assert.rejects(f.flow.verifyAndRegister(image), safeError('cancelled'));
    await entered.promise;
    f.flow.cancel();
    await rejection;
    assert.equal(image.imageBase64, '');
    const second = capture();
    await assert.rejects(f.flow.verifyAndRegister(second), safeError('busy'));
    assert.equal(second.imageBase64, '');
    slow.resolve({ ...draft });
    await setImmediate();
    assert.equal(f.flow.getState().busy, false);
    assert.equal(scans, 0);
  });

  test('a rejected second, pre-aborted capture cannot cancel the first capture', async t => {
    const entered = deferred();
    const slow = deferred();
    let signal;
    const f = fixture(t, { async verify(_request, _draft, abort) { signal = abort; entered.resolve(); return slow.promise; } });
    const first = f.flow.verifyAndRegister(capture());
    await entered.promise;
    const external = new AbortController();
    external.abort();
    await assert.rejects(f.flow.verifyAndRegister(capture(), external.signal), safeError('busy'));
    assert.equal(signal.aborted, false);
    slow.resolve(verification());
    await first;
  });

  test('registration cancellation clears the held request and never reports late success', async t => {
    const entered = deferred();
    const slow = deferred();
    let request;
    const f = fixture(t, { async register(value) { request = value; entered.resolve(); await slow.promise; } });
    const rejection = assert.rejects(f.flow.verifyAndRegister(capture()), safeError('cancelled'));
    await entered.promise;
    f.flow.cancel();
    assert.equal(request.idVerificationReceipt, undefined);
    await rejection;
    slow.resolve();
    await setImmediate();
    assert.notEqual(f.flow.getState().phase, 'complete');
    await assert.rejects(f.flow.retryRegistration(), safeError('invalid_receipt'));
  });

  test('45s operation policy has a prompt watchdog and ignores a late receipt', async t => {
    assert.equal(STUDENT_SIGNUP_TIMEOUT_MS, 45_000);
    const entered = deferred();
    const slow = deferred();
    const f = fixture(t, { async verify() { entered.resolve(); return slow.promise; } }, { timeoutMs: 15 });
    const image = capture();
    const rejection = assert.rejects(f.flow.verifyAndRegister(image), safeError('timeout', StudentSignupError));
    await entered.promise;
    await rejection;
    assert.equal(image.imageBase64, '');
    assert.equal(f.flow.getState().failure.code, 'timeout');
    slow.resolve(verification());
    await setImmediate();
    assert.notEqual(f.flow.getState().phase, 'complete');
  });

  test('receipt expiry while waiting for explicit retry forgets it without another request', async t => {
    let posts = 0;
    const f = fixture(t, {
      async verify() { return verification(30); },
      async register() { posts++; throw new RegistrationError('service_unavailable'); },
    });
    await assert.rejects(f.flow.verifyAndRegister(capture()), safeError('service_unavailable'));
    await delay(45);
    assert.equal(f.flow.getState().phase, 'ready');
    assert.equal(f.flow.getState().failure.code, 'receipt_expired');
    await assert.rejects(f.flow.retryRegistration(), safeError('invalid_receipt'));
    assert.equal(posts, 1);
  });

  test('expiry during registration aborts its request and suppresses late completion', async t => {
    const slow = deferred();
    let request;
    let signal;
    const f = fixture(t, {
      async verify() { return verification(30); },
      async register(value, abort) { request = value; signal = abort; await slow.promise; },
    });
    await assert.rejects(f.flow.verifyAndRegister(capture()), safeError('receipt_expired'));
    assert.equal(request.idVerificationReceipt, undefined);
    assert.equal(signal.aborted, true);
    slow.resolve();
    await setImmediate();
    assert.notEqual(f.flow.getState().phase, 'complete');
  });

  for (const [label, update, code] of [
    ['malformed student number', { studentNumber: '0-00123' }, 'invalid_request'],
    ['OCR O/zero substitution', { studentNumber: 'OO-00123' }, 'invalid_request'],
    ['missing privacy consent', { privacyNoticeAccepted: false }, 'privacy_notice_required'],
    ['old privacy version', { privacyNoticeVersion: 'old' }, 'privacy_notice_required'],
    ['missing terms consent', { termsAccepted: false }, 'terms_required'],
    ['old terms version', { termsVersion: 'old' }, 'terms_required'],
    ['faculty draft', { role: 'Faculty' }, 'invalid_request'],
  ]) {
    test(`${label} fails before any verification or registration`, async t => {
      const f = fixture(t, { async getVerifiedDraft() { return { ...draft, ...update }; } });
      const image = capture();
      await assert.rejects(f.flow.verifyAndRegister(image), safeError(code, RegistrationError));
      assert.equal(image.imageBase64, '');
      assert.equal(f.events.length, 0);
    });
  }

  test('projection accepts personal student email and does not keep unknown sensitive fields', () => {
    const clean = requireStudentSignupDraft({ ...draft, imageBase64: SECRET, idVerificationReceipt: SECRET,
      toJSON() { throw new Error(SECRET); } });
    assert.equal(clean.email, draft.email);
    assert.ok(!JSON.stringify(clean).includes(SECRET));
  });

  for (const [label, update] of [
    ['wrong template', { templateId: 'other' }], ['expired', { expiresAt: new Date(0).toISOString() }],
    ['overlong TTL', { expiresAt: new Date(Date.now() + 700_000).toISOString() }],
    ['missing receipt', { receipt: '' }], ['overlong receipt', { receipt: 'x'.repeat(4097) }],
  ]) {
    test(`${label} verification success is discarded and cannot register`, async t => {
      let posts = 0;
      const result = { ...verification(), ...update };
      const f = fixture(t, { async verify() { return result; }, async register() { posts++; } });
      await assert.rejects(f.flow.verifyAndRegister(capture()), safeError('invalid_receipt', RegistrationError));
      assert.equal(result.receipt, '');
      assert.equal(posts, 0);
    });
  }

  test('mutated flow errors and observer failures cannot retain raw sensitive diagnostics', async t => {
    const raw = Object.assign(new StudentSignupError('cancelled'), { code: SECRET, cause: SECRET, config: { data: SECRET } });
    const f = fixture(t, { async verify() { throw raw; } });
    const unsubscribe = f.flow.subscribe(() => {});
    unsubscribe();
    f.flow.subscribe(state => { if (state.busy) throw new Error(SECRET); });
    await assert.rejects(f.flow.verifyAndRegister(capture()), safeError('cancelled', StudentSignupError));
    assert.ok(!inspect(f.flow.getState()).includes(SECRET));
    const state = f.flow.getState();
    state.failure.message = SECRET;
    assert.ok(!inspect(f.flow.getState()).includes(SECRET));
  });
});

function response(config, data, status = 200) { return { config, data, status, statusText: String(status), headers: {} }; }
function adapter(t, value) {
  const previous = axios.defaults.adapter;
  axios.defaults.adapter = value;
  t.after(() => { axios.defaults.adapter = previous; });
}
const service = getFreshFirebaseIdToken => new LiveIdVerificationService({ endpoint: 'https://idv.example.test/api/v1/id-verification', getFreshFirebaseIdToken });
const request = () => ({ student: { studentNumber: draft.studentNumber, firstName: draft.firstName,
  middleInitial: draft.middleInitial, lastName: draft.lastName, suffix: draft.suffix }, imageBase64: SECRET });

describe('abortable shared verification and registration transports', () => {
  test('a pre-aborted verification never refreshes or posts', async t => {
    adapter(t, () => assert.fail('Must not post'));
    const abort = new AbortController();
    abort.abort(new Error(SECRET));
    await assert.rejects(service(() => assert.fail('Must not refresh')).verifyStudentId(request(), { signal: abort.signal }), safeError('cancelled', IdVerificationError));
  });

  for (const refresh of ['initial', '401 retry']) {
    test(`abort during ${refresh} refresh blocks the next capture upload`, async t => {
      const slow = deferred();
      const entered = deferred();
      const abort = new AbortController();
      let tokens = 0;
      let posts = 0;
      adapter(t, async config => {
        posts++;
        throw new AxiosError(SECRET, 'ERR_BAD_RESPONSE', config, {}, response(config, { message: SECRET }, 401));
      });
      const task = service(async () => {
        if (++tokens === (refresh === 'initial' ? 1 : 2)) { entered.resolve(); return slow.promise; }
        return 'synthetic-firebase-token';
      }).verifyStudentId(request(), { signal: abort.signal });
      const rejection = assert.rejects(task, safeError('cancelled', IdVerificationError));
      await entered.promise;
      abort.abort(new Error(SECRET));
      slow.resolve('synthetic-firebase-token');
      await rejection;
      assert.equal(posts, refresh === 'initial' ? 0 : 1);
    });
  }

  test('verification forwards abort to HTTP and sanitizes cancellation diagnostics', async t => {
    const abort = new AbortController();
    adapter(t, config => new Promise((_resolve, reject) => {
      assert.equal(config.signal, abort.signal);
      config.signal.addEventListener('abort', () => reject(new CanceledError(SECRET, config, { data: SECRET })), { once: true });
      abort.abort();
    }));
    await assert.rejects(service(async () => 'synthetic-token').verifyStudentId(request(), { signal: abort.signal }), safeError('cancelled', IdVerificationError));
  });

  test('success projection never forwards reflected capture/OCR/unknown fields', async t => {
    adapter(t, async config => response(config, { ...verification(), imageBase64: SECRET, ocrText: SECRET, internal: { secret: SECRET } }));
    const result = await service(async () => 'synthetic-token').verifyStudentId(request());
    assert.deepEqual(Object.keys(result).sort(), ['outcome', 'receipt', 'expiresAt', 'templateId', 'requestId'].sort());
  });

  for (const data of [null, {}, { ...verification(), receipt: {} }, { ...verification(), expiresAt: 'invalid' }]) {
    test('malformed verification success becomes a safe failure', async t => {
      adapter(t, async config => response(config, data));
      await assert.rejects(service(async () => 'synthetic-token').verifyStudentId(request()), safeError('service_unavailable', IdVerificationError));
    });
  }

  test('registration abort during Firebase refresh never posts the receipt', async () => {
    const slow = deferred();
    const entered = deferred();
    const abort = new AbortController();
    const user = { uid: draft.id, email: draft.email, emailVerified: true,
      async reload() { entered.resolve(); await slow.promise; }, async getIdToken() { return 'synthetic-firebase-token'; } };
    const auth = { currentUser: user, async authStateReady() {} };
    const client = axios.create();
    client.defaults.adapter = () => assert.fail('Must not post a cancelled receipt');
    const rejection = assert.rejects(createAuthService(client, auth).register({ ...draft, idVerificationReceipt: SECRET }, { signal: abort.signal }), safeError('cancelled', RegistrationError));
    await entered.promise;
    abort.abort(new Error(SECRET));
    slow.resolve();
    await rejection;
  });
});
