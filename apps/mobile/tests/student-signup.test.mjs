import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import { setImmediate, setTimeout as delay } from 'node:timers/promises';
import { describe, test } from 'node:test';
import { createStudentSignupFlow } from '../../../packages/api/src/auth/studentSignupFlow.ts';
import { RegistrationError } from '../../../packages/api/src/auth/registrationError.ts';
import { createPendingSignupSession } from '../lib/registration/pendingSignupSession.ts';
import { createPendingRegistrationStore, PENDING_REGISTRATION_KEY } from '../lib/registration/pendingRegistrationStore.ts';
import { hasCurrentSignupConsent, matchesSignupAccount, parsePendingStudentRegistration,
  toPendingStudentRegistration, toSignupRegistrationDraft } from '../lib/registration/pendingRegistration.ts';
import { describeSignupAccountError, getResumeSignupStep } from '../lib/registration/signupSteps.ts';
import { createMemoryCaptureSession, getIdCaptureGuide, MemoryCaptureError } from '../lib/idCapture/memoryCapture.ts';
import { observeCaptureActivity } from '../lib/idCapture/captureProof.ts';
import { acquireSignupScreenProtection } from '../lib/idCapture/screenProtection.ts';
import { submitPendingSignupRegistration } from '../lib/registration/submitRegistration.ts';

const SECRET = 'synthetic-mobile-signup-sensitive-marker';
const pending = { firebaseUid: 'test-signup-uid', email: 'personal@example.com', firstName: 'Maria',
  middleInitial: 'Q', lastName: 'Dela Cruz', suffix: 'Jr.', studentNumber: '00-00123',
  position: 'Member', institute: 'Institute of Computing Studies', program: 'BS Computer Science',
  yearLevel: 4, section: 'A', privacyNoticeAccepted: true, privacyNoticeVersion: '2026-10-23',
  termsAccepted: true, termsVersion: '2026-10-23' };
const account = { uid: pending.firebaseUid, email: pending.email, emailVerified: true };
const result = () => ({ outcome: 'verified', receipt: SECRET, expiresAt: new Date(Date.now() + 590_000).toISOString(),
  templateId: 'cdm-front-v1', requestId: 'test-request' });
function deferred() {
  let resolve;
  const promise = new Promise(yes => { resolve = yes; });
  return { resolve, promise };
}
function safe(code, Type = Error) {
  return error => {
    assert.ok(error instanceof Type);
    assert.equal(error.code, code);
    assert.ok(!inspect(error).includes(SECRET));
    assert.ok(!JSON.stringify(error).includes(SECRET));
    return true;
  };
}
function storageFixture(initial, overrides = {}) {
  const values = new Map(initial ? [[PENDING_REGISTRATION_KEY, initial]] : []);
  const events = [];
  const storage = {
    async getItem(key) { return values.get(key) ?? null; },
    async setItem(key, value) { events.push('save'); values.set(key, value); },
    async removeItem(key) { events.push('remove'); values.delete(key); },
    ...overrides,
  };
  return { store: createPendingRegistrationStore(storage), values, events, storage };
}

describe('receipt-free mobile signup draft and resume', () => {
  test('storage projection never copies passwords, receipts, captures, OCR, or toJSON', async () => {
    const source = { ...pending, password: SECRET, idVerificationReceipt: SECRET, imageBase64: SECRET,
      ocrText: SECRET, unknown: SECRET, toJSON() { throw new Error(SECRET); } };
    const clean = toPendingStudentRegistration(source);
    assert.deepEqual(clean, pending);
    const f = storageFixture();
    await f.store.write(source);
    assert.ok(!f.values.get(PENDING_REGISTRATION_KEY).includes(SECRET));
    assert.deepEqual(await f.store.read(), pending);
    assert.equal(toSignupRegistrationDraft(clean, account.uid).idVerificationReceipt, undefined);
  });

  test('legacy consent defaults false and old drafts return to genuine acceptance', () => {
    const legacy = { ...pending };
    for (const key of ['firebaseUid', 'privacyNoticeAccepted', 'privacyNoticeVersion', 'termsAccepted', 'termsVersion']) delete legacy[key];
    const clean = parsePendingStudentRegistration(JSON.stringify(legacy));
    assert.equal(hasCurrentSignupConsent(clean), false);
    assert.equal(clean.privacyNoticeAccepted, false);
    assert.equal(clean.termsAccepted, false);
    assert.equal(getResumeSignupStep(clean, true, true), 5);
    assert.equal(matchesSignupAccount(clean, account), true);
  });

  test('resume never treats a receipt-free persisted draft as a verification receipt', () => {
    assert.equal(getResumeSignupStep(pending, false, true), 4);
    assert.equal(getResumeSignupStep(pending, true, false), 6);
    assert.equal(getResumeSignupStep(pending, true, true), 7);
    assert.equal(getResumeSignupStep(null, false, false), 1);
    assert.equal(getResumeSignupStep({ ...pending, termsVersion: 'old' }, true, true), 5);
    assert.equal(toSignupRegistrationDraft(pending, account.uid).studentNumber, '00-00123');
  });

  for (const firebaseUid of ['', {}, 'x'.repeat(129)]) {
    test('a corrupt stored Firebase UID fails closed rather than becoming a legacy email-only draft', () => {
      assert.equal(toPendingStudentRegistration({ ...pending, firebaseUid }), null);
    });
  }

  test('a supplied UID binds the draft even when a different account has the same email', () => {
    assert.equal(matchesSignupAccount(pending, { ...account, uid: 'other' }), false);
    assert.equal(matchesSignupAccount(pending, { ...account, email: 'other@example.com' }), false);
    assert.equal(matchesSignupAccount(pending, { ...account, email: ' PERSONAL@EXAMPLE.COM ' }), true);
  });

  test('legacy unknown fields are removed before a clean storage rewrite', async () => {
    const f = storageFixture(JSON.stringify({ ...pending, idVerificationReceipt: SECRET, ocrText: SECRET }));
    assert.deepEqual(await f.store.read(), pending);
    assert.deepEqual(f.events, ['remove', 'save']);
    assert.ok(!f.values.get(PENDING_REGISTRATION_KEY).includes(SECRET));
  });

  test('a failed rewrite does not return the legacy draft or leave its secret when removal works', async () => {
    const f = storageFixture(JSON.stringify({ ...pending, idVerificationReceipt: SECRET }), {
      async setItem() { throw new Error(SECRET); },
    });
    assert.equal(await f.store.read(), null);
    assert.equal(f.values.has(PENDING_REGISTRATION_KEY), false);
  });

  for (const initial of ['{', JSON.stringify({ firstName: 'Missing fields', receipt: SECRET })]) {
    test('invalid stored signup is discarded without throwing raw diagnostics', async () => {
      const f = storageFixture(initial);
      assert.equal(await f.store.read(), null);
      assert.equal(f.values.has(PENDING_REGISTRATION_KEY), false);
    });
  }

  test('queued saves are projected immediately; a later cancel cannot be undone by a slow save', async () => {
    const entered = deferred();
    const slow = deferred();
    const f = storageFixture();
    f.storage.setItem = async (key, value) => { entered.resolve(); await slow.promise; f.values.set(key, value); };
    const source = { ...pending, idVerificationReceipt: SECRET };
    const save = f.store.write(source);
    await entered.promise;
    source.firstName = SECRET;
    const cancel = f.store.write(null);
    slow.resolve();
    await Promise.all([save, cancel]);
    assert.equal(f.values.has(PENDING_REGISTRATION_KEY), false);
  });

  test('account-error UI uses only known static text, never arbitrary messages or reflected codes', () => {
    for (const raw of [new Error(SECRET), { code: SECRET, message: SECRET }, { response: { data: { message: SECRET } } }]) {
      assert.ok(!describeSignupAccountError(raw).includes(SECRET));
    }
    assert.match(describeSignupAccountError({ code: 'auth/invalid-email', message: SECRET }), /valid email/);
  });
});

describe('pending Firebase signup session gate', () => {
  test('verified Firebase users stay outside the session until the profile commit succeeds', () => {
    const gate = createPendingSignupSession();
    gate.replace(pending);
    gate.observeAccount(account);
    assert.equal(gate.gatesSession(account), true);
    const ticket = gate.ticket(account);
    let cancels = 0;
    gate.onInvalidate(() => cancels++);
    assert.deepEqual(gate.complete(ticket, account), pending);
    assert.equal(gate.gatesSession(account), false);
    assert.equal(gate.getPending(), null);
    assert.equal(cancels, 0); // completion cannot abort receipt cleanup
  });

  test('unverified Firebase accounts cannot issue a registration draft', () => {
    const gate = createPendingSignupSession();
    gate.replace(pending);
    assert.throws(() => gate.ticket({ ...account, emailVerified: false }), safe('email_unverified', RegistrationError));
  });

  test('restore ignores an unrelated pending draft without modifying the normal account', () => {
    const gate = createPendingSignupSession();
    const normal = { ...account, uid: 'normal-app-user', email: 'normal@example.com' };
    gate.replace(pending);
    const original = { ...normal };
    gate.observeAccount(normal);
    assert.equal(gate.getPending(), null);
    assert.equal(gate.gatesSession(normal), false);
    assert.deepEqual(normal, original);
  });

  for (const [label, next] of [['UID', { ...account, uid: 'other' }], ['email', { ...account, email: 'other@example.com' }], ['sign-out', null]]) {
    test(`${label} switch invalidates an in-flight registration ticket`, () => {
      const gate = createPendingSignupSession();
      gate.replace(pending);
      gate.observeAccount(account);
      const ticket = gate.ticket(account);
      let cancels = 0;
      gate.onInvalidate(() => cancels++);
      gate.observeAccount(next);
      assert.equal(cancels, 1);
      assert.throws(() => gate.complete(ticket, next), error => error instanceof RegistrationError);
    });
  }

  test('profile/consent edits invalidate old tickets even if the details are later restored', () => {
    const gate = createPendingSignupSession();
    gate.replace(pending);
    const ticket = gate.ticket(account);
    gate.replace({ ...pending, section: 'B' });
    gate.replace(pending);
    assert.throws(() => gate.complete(ticket, account), safe('identity_mismatch', RegistrationError));
    assert.equal(gate.gatesSession(account), true);
  });

  test('a failed-login invalidation cancels the receipt without dropping the pending session gate', () => {
    const gate = createPendingSignupSession();
    gate.replace(pending);
    const ticket = gate.ticket(account);
    gate.invalidate();
    assert.deepEqual(gate.getPending(), pending);
    assert.equal(gate.gatesSession(account), true);
    assert.throws(() => gate.complete(ticket, account), safe('identity_mismatch', RegistrationError));
  });

  test('cancelled HTTP results cannot open the session, even for the unchanged account', () => {
    const gate = createPendingSignupSession();
    gate.replace(pending);
    const ticket = gate.ticket(account);
    const controller = new AbortController();
    controller.abort(new Error(SECRET));
    assert.throws(() => gate.complete(ticket, account, controller.signal), safe('cancelled', RegistrationError));
    assert.equal(gate.gatesSession(account), true);
  });

  test('safe snapshots cannot mutate the real gate, and no receipt-bearing caller object is retained', () => {
    const gate = createPendingSignupSession();
    const source = { ...pending, idVerificationReceipt: SECRET, imageBase64: SECRET };
    gate.replace(source);
    source.firstName = SECRET;
    const copy = gate.getPending();
    copy.firstName = SECRET;
    assert.equal(gate.getPending().firstName, pending.firstName);
    assert.ok(!inspect(gate.getPending()).includes(SECRET));
    assert.ok(!JSON.stringify(gate).includes(SECRET));
  });
});

describe('provider registration request boundary', () => {
  test('only an allowlisted copy reaches transport; the receipt is wiped before return', async () => {
    const gate = createPendingSignupSession();
    gate.replace(pending);
    const request = { ...gate.ticket(account).draft, idVerificationReceipt: SECRET,
      imageBase64: SECRET, ocrText: SECRET, password: SECRET, toJSON() { throw new Error(SECRET); } };
    let submitted;
    const ticket = await submitPendingSignupRegistration(gate, () => account, request,
      new AbortController().signal, async profile => {
        submitted = profile;
        assert.notEqual(profile, request);
        assert.equal(profile.idVerificationReceipt, SECRET);
        for (const field of ['imageBase64', 'ocrText', 'password', 'toJSON']) assert.equal(profile[field], undefined);
      });
    assert.equal(submitted.idVerificationReceipt, undefined);
    assert.equal(ticket.draft.id, account.uid);
    assert.ok(!inspect(ticket).includes(SECRET));
  });

  for (const receipt of [undefined, {}, '', 'x'.repeat(4097)]) {
    test('runtime receipt type/size failures never call transport', async () => {
      const gate = createPendingSignupSession();
      gate.replace(pending);
      await assert.rejects(submitPendingSignupRegistration(gate, () => account,
        { ...gate.ticket(account).draft, idVerificationReceipt: receipt }, new AbortController().signal,
        () => assert.fail('Must not submit')), safe('invalid_receipt', RegistrationError));
    });
  }

  test('runtime draft comparison rejects even a whitespace edit before transport', async () => {
    const gate = createPendingSignupSession();
    gate.replace(pending);
    await assert.rejects(submitPendingSignupRegistration(gate, () => account,
      { ...gate.ticket(account).draft, firstName: ' Maria ', idVerificationReceipt: SECRET },
      new AbortController().signal, () => assert.fail('Must not submit')), safe('identity_mismatch'));
  });

  test('abort wipes the transport copy while slow registration is still pending', async () => {
    const gate = createPendingSignupSession();
    gate.replace(pending);
    const entered = deferred();
    const slow = deferred();
    const abort = new AbortController();
    let submitted;
    const rejection = assert.rejects(submitPendingSignupRegistration(gate, () => account,
      { ...gate.ticket(account).draft, idVerificationReceipt: SECRET }, abort.signal,
      async profile => { submitted = profile; entered.resolve(); await slow.promise; }), safe('cancelled'));
    await entered.promise;
    abort.abort(new Error(SECRET));
    assert.equal(submitted.idVerificationReceipt, undefined);
    slow.resolve();
    await rejection;
    assert.equal(gate.gatesSession(account), true);
  });

  test('a late registration cannot return a completion ticket after provider invalidation', async () => {
    const gate = createPendingSignupSession();
    gate.replace(pending);
    const entered = deferred();
    const slow = deferred();
    const rejection = assert.rejects(submitPendingSignupRegistration(gate, () => account,
      { ...gate.ticket(account).draft, idVerificationReceipt: SECRET }, new AbortController().signal,
      async () => { entered.resolve(); await slow.promise; }), safe('identity_mismatch'));
    await entered.promise;
    gate.invalidate();
    slow.resolve();
    await rejection;
  });
});

describe('screen protection effect replay', () => {
  test('a new acquisition waits for prior native protection/release to settle', async () => {
    const slow = deferred();
    const events = [];
    const native = {
      async prevent(key) { events.push(['prevent', key]); if (events.length === 1) await slow.promise; },
      async allow(key) { events.push(['allow', key]); },
    };
    const first = acquireSignupScreenProtection(native);
    await setImmediate();
    first.release();
    first.release();
    const second = acquireSignupScreenProtection(native);
    let ready = false;
    void second.ready.then(() => { ready = true; });
    await setImmediate();
    assert.equal(ready, false);
    assert.equal(events.length, 1);
    slow.resolve();
    assert.equal(await second.ready, true);
    assert.deepEqual(events.map(([type]) => type), ['prevent', 'allow', 'prevent']);
    assert.notEqual(events[0][1], events[2][1]);
    second.release();
    await setImmediate();
    assert.equal(events.at(-1)[0], 'allow');
  });

  test('failed native protection never enables capture or reuses its failed Expo key', async () => {
    const keys = [];
    const native = {
      async prevent(key) { keys.push(key); if (keys.length === 1) throw new Error(SECRET); },
      async allow() {},
    };
    const first = acquireSignupScreenProtection(native);
    assert.equal(await first.ready, false);
    first.release();
    const second = acquireSignupScreenProtection(native);
    assert.equal(await second.ready, true);
    assert.notEqual(keys[0], keys[1]);
    second.release();
    await setImmediate();
  });
});

const preview = { width: 400, height: 600 };
const layout = { preview, guide: getIdCaptureGuide(preview) };
function captureFixture(t, options = {}, budgets) {
  const events = [];
  const image = { width: 720, height: 1120, byteLength: 4, mimeType: 'image/jpeg', imageBase64: '/9j/2Q==' };
  const picture = { width: 3000, height: 4000, nativeRefType: 'image', release() { events.push('release'); } };
  const session = createMemoryCaptureSession({
    async capture() { events.push('capture'); return picture; },
    async encode() { events.push('encode'); return image; },
    disposePicture() { events.push('dispose'); },
    ...options,
  }, budgets?.captureMs ?? 15_000, { consumerTimeoutMs: budgets?.consumerMs });
  t.after(() => session.dispose());
  return { session, image, picture, events };
}

describe('RAM capture -> guarded signup integration (synthetic native/Firebase/services)', () => {
  test('explicit signup consumer budget exceeds the proof deadline without retaining pixels', async t => {
    const f = captureFixture(t, {}, { captureMs: 20, consumerMs: 100 });
    await f.session.capture(layout, async () => {
      assert.deepEqual(f.events.slice(-2), ['dispose', 'release']);
      await delay(35); // longer than the capture watchdog, less than the consumer watchdog
    });
    assert.equal(f.image.imageBase64, '');
  });

  test('a cancelled owner blocks still allocation in a newly mounted camera until cleanup settles', async t => {
    const slow = deferred();
    const first = captureFixture(t, { capture: () => slow.promise });
    const rejection = assert.rejects(first.session.capture(layout, async () => {}), safe('cancelled', MemoryCaptureError));
    first.session.dispose();
    await rejection;
    const reopened = captureFixture(t);
    await assert.rejects(reopened.session.capture(layout, async () => {}), safe('busy', MemoryCaptureError));
    assert.deepEqual(reopened.events, []);
    slow.resolve(first.picture);
    await setImmediate();
    await reopened.session.capture(layout, async () => {});
    assert.equal(first.events.at(-1), 'release');
  });

  test('JPEG stays off UI/storage; receipt is submitted immediately and then discarded', async t => {
    const storage = storageFixture();
    const gate = createPendingSignupSession();
    gate.replace(pending);
    gate.observeAccount(account);
    await storage.store.write(gate.getPending());
    const f = captureFixture(t);
    let submitted;
    const flow = createStudentSignupFlow({
      async getVerifiedDraft() { return gate.ticket(account).draft; },
      async verify(request, _draft, signal) {
        assert.equal(request.imageBase64, '/9j/2Q==');
        assert.equal(signal.aborted, false);
        assert.equal(f.events.at(-1), 'release');
        return result();
      },
      async register(request, signal) {
        const ticket = gate.ticket(account);
        assert.equal(request.idVerificationReceipt, SECRET);
        submitted = request;
        gate.complete(ticket, account, signal);
        await storage.store.write(null);
      },
    });
    t.after(() => flow.dispose());
    await f.session.capture(layout, (image, signal) => flow.verifyAndRegister(image, signal));
    assert.equal(flow.getState().phase, 'complete');
    assert.equal(gate.gatesSession(account), false);
    assert.equal(submitted.idVerificationReceipt, undefined);
    assert.equal(f.image.imageBase64, '');
    assert.equal(storage.values.has(PENDING_REGISTRATION_KEY), false);
  });

  for (const event of ['background', 'blur']) {
    test(`${event} after encoding aborts verification while the preview is already closed`, async t => {
      const f = captureFixture(t);
      const entered = deferred();
      const slow = deferred();
      let posts = 0;
      let upload;
      const flow = createStudentSignupFlow({
        async getVerifiedDraft() { return toSignupRegistrationDraft(pending, account.uid); },
        async verify(request) { upload = request; entered.resolve(); return slow.promise; },
        async register() { posts++; },
      });
      t.after(() => flow.dispose());
      const listeners = new Map();
      const source = { currentState: 'active', addEventListener(type, listener) {
        listeners.set(type, listener); return { remove() { listeners.delete(type); } };
      } };
      const stop = observeCaptureActivity(source, active => { if (!active) { f.session.cancel(); flow.cancel(); } });
      t.after(stop);
      const rejection = assert.rejects(f.session.capture(layout, (image, signal) => flow.verifyAndRegister(image, signal)), safe('cancelled', MemoryCaptureError));
      await entered.promise;
      if (event === 'background') { source.currentState = 'background'; listeners.get('change')('background'); }
      else listeners.get('blur')();
      assert.equal(f.image.imageBase64, '');
      assert.equal(upload.imageBase64, '');
      await rejection;
      slow.resolve(result());
      await setImmediate();
      assert.equal(posts, 0);
      assert.notEqual(flow.getState().phase, 'complete');
    });
  }

  test('an account switch drops a held retry receipt and cannot promote the new account', async t => {
    const gate = createPendingSignupSession();
    gate.replace(pending);
    gate.observeAccount(account);
    const flow = createStudentSignupFlow({
      async getVerifiedDraft() { return gate.ticket(account).draft; },
      async verify() { return result(); },
      async register() { throw new RegistrationError('service_unavailable'); },
    });
    t.after(() => flow.dispose());
    const unsubscribe = gate.onInvalidate(() => flow.invalidate());
    t.after(unsubscribe);
    await assert.rejects(flow.verifyAndRegister({ imageBase64: SECRET }), safe('service_unavailable'));
    assert.equal(flow.getState().phase, 'retry-registration');
    gate.observeAccount({ ...account, uid: 'other-account' });
    assert.equal(flow.getState().phase, 'ready');
    await assert.rejects(flow.retryRegistration(), safe('invalid_receipt'));
  });
});
