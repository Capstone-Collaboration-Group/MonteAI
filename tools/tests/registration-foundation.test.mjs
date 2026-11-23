import assert from "node:assert/strict";
import { inspect } from "node:util";
import { describe, test } from "node:test";
import axios, { AxiosError } from "axios";
import { toRegistrationDraft, toStudentRegistrationDraft, parseStudentRegistrationDraft } from "../../packages/utils/src/registrationDraft.ts";
import { createRegistrationReceiptStore } from "../../packages/utils/src/registrationReceipt.ts";
import { getPendingRegistration, savePendingRegistration } from "../../packages/ui/src/components/auth/pendingRegistration.ts";
import { createFirebaseTokenAccessors } from "../../packages/api/src/auth/firebaseTokenAccessors.ts";
import { createAuthService } from "../../packages/api/src/auth/authService.ts";
import { RegistrationError, sanitizeRegistrationError } from "../../packages/api/src/auth/registrationError.ts";
import { createApiClient } from "../../packages/api/src/client.ts";
import { createIdVerificationService, LiveIdVerificationService, IdVerificationError } from "../../packages/api/src/id-verification/index.ts";

// Synthetic markers only. Never use real receipts, tokens, captures, or OCR text in this suite.
const SECRET = "synthetic-sensitive-marker";
const STORAGE_KEY = "monteai.pendingRegistration";
const draft = {
  id: "test-student-1", email: "student.personal@example.com", firstName: "Maria",
  middleInitial: "Q", lastName: "Dela Cruz", suffix: "Jr.", role: "Student",
  studentNumber: "00-00123", position: "Member", institute: "Institute of Computing Studies",
  program: "BS Computer Science", yearLevel: 4, section: "A",
  privacyNoticeAccepted: true, privacyNoticeVersion: "2026-10-23",
  termsAccepted: true, termsVersion: "2026-10-23",
};
const request = {
  student: { studentNumber: draft.studentNumber, firstName: draft.firstName,
    middleInitial: draft.middleInitial, lastName: draft.lastName, suffix: draft.suffix },
  imageBase64: SECRET,
};

function verification(expiresAt = new Date(Date.now() + 590_000).toISOString()) {
  return { outcome: "verified", receipt: SECRET, expiresAt, templateId: "cdm-front-v1", requestId: "test-request" };
}

function response(config, data, status = 200, headers = {}) {
  return { config, data, status, statusText: String(status), headers };
}

function httpError(config, status, data = { message: SECRET }, headers = {}) {
  return new AxiosError(SECRET, "ERR_BAD_RESPONSE", config, { body: SECRET }, response(config, data, status, headers));
}

function assertSanitized(error, ErrorType) {
  assert.ok(error instanceof ErrorType);
  for (const key of ["config", "request", "response", "cause", "imageBase64", "receipt"]) {
    assert.equal(error[key], undefined);
  }
  assert.ok(!inspect(error).includes(SECRET));
  assert.ok(!JSON.stringify(error).includes(SECRET));
  return true;
}

function fakeAuth(overrides = {}) {
  const events = [];
  const user = {
    uid: draft.id, email: draft.email, emailVerified: true,
    async reload() { events.push("reload"); },
    async getIdToken(force) { events.push(["token", force]); return force ? "fresh-firebase-token" : "cached-firebase-token"; },
    ...overrides,
  };
  const auth = { currentUser: user, async authStateReady() { events.push("ready"); } };
  return { auth, user, events };
}

function storageFixture(t, initial) {
  const values = new Map(initial ? [[STORAGE_KEY, initial]] : []);
  const store = {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, value); },
    removeItem(key) { values.delete(key); },
  };
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: store } });
  t.after(() => previous ? Object.defineProperty(globalThis, "window", previous) : delete globalThis.window);
  return { values, store };
}

function verificationAdapter(t, adapter) {
  const previous = axios.defaults.adapter;
  axios.defaults.adapter = adapter;
  t.after(() => { axios.defaults.adapter = previous; });
}

describe("receipt-free draft projection and storage", () => {
  test("new drafts whitelist primitives; secret, unknown, and toJSON fields never serialize", () => {
    const source = { ...draft, password: SECRET, idVerificationReceipt: SECRET, imageBase64: SECRET,
      ocrText: SECRET, futureField: { value: SECRET }, toJSON() { throw new Error("Must not call source toJSON"); } };
    const web = toRegistrationDraft(source);
    const mobile = toStudentRegistrationDraft(source);
    assert.deepEqual(web, draft);
    for (const value of [web, mobile]) {
      assert.ok(!JSON.stringify(value).includes(SECRET));
      assert.notEqual(value, source);
    }
    assert.equal(mobile.id, undefined);
    assert.equal(mobile.role, undefined);
  });

  test("faculty drafts omit all student-only fields", () => {
    const value = toRegistrationDraft({ ...draft, role: "Faculty" });
    for (const key of ["studentNumber", "program", "yearLevel", "section", "position"]) {
      assert.equal(value[key], undefined);
    }
  });

  test("legacy missing consent is not automatically accepted", () => {
    const source = { ...draft };
    for (const key of ["privacyNoticeAccepted", "privacyNoticeVersion", "termsAccepted", "termsVersion"]) delete source[key];
    const value = toRegistrationDraft(source);
    assert.equal(value.privacyNoticeAccepted, false);
    assert.equal(value.termsAccepted, false);
    assert.equal(value.privacyNoticeVersion, "");
    assert.equal(value.termsVersion, "");
  });

  test("optional empty names are omitted and only whitelisted strings are trimmed", () => {
    const value = toRegistrationDraft({ ...draft, firstName: " Maria ", middleInitial: " ", suffix: null });
    assert.equal(value.firstName, "Maria");
    assert.equal(value.middleInitial, undefined);
    assert.equal(value.suffix, undefined);
  });

  for (const [label, input] of [
    ["null", null], ["array", []], ["missing names", { ...draft, firstName: "" }],
    ["nested profile", { ...draft, institute: { data: SECRET } }],
    ["nested program", { ...draft, program: { data: SECRET } }],
    ["non-finite year", { ...draft, yearLevel: Infinity }], ["fractional year", { ...draft, yearLevel: 1.5 }],
  ]) {
    test(`invalid ${label} drafts are discarded`, () => {
      assert.equal(toRegistrationDraft(input), null);
      assert.equal(toStudentRegistrationDraft(input), null);
    });
  }

  test("mobile legacy JSON is projected; corrupt JSON does not throw", () => {
    const value = parseStudentRegistrationDraft(JSON.stringify({ ...draft, password: SECRET, idVerificationReceipt: SECRET }));
    assert.ok(value);
    assert.ok(!JSON.stringify(value).includes(SECRET));
    assert.equal(parseStudentRegistrationDraft("{"), null);
  });

  test("web/desktop saves cannot serialize a receipt-bearing request or envelope extras", (t) => {
    const { values } = storageFixture(t);
    savePendingRegistration({ uid: draft.id, payload: { ...draft, idVerificationReceipt: SECRET, password: SECRET },
      createdAt: 123, futureField: SECRET });
    assert.ok(!values.get(STORAGE_KEY).includes(SECRET));
    assert.deepEqual(getPendingRegistration(), { uid: draft.id, payload: draft, createdAt: 123 });
  });

  test("legacy web/desktop receipt-bearing drafts are rewritten without secrets", (t) => {
    const { values } = storageFixture(t, JSON.stringify({ uid: draft.id, createdAt: 123,
      payload: { ...draft, idVerificationReceipt: SECRET, imageBase64: SECRET }, futureField: SECRET }));
    assert.deepEqual(getPendingRegistration(), { uid: draft.id, payload: draft, createdAt: 123 });
    assert.ok(!values.get(STORAGE_KEY).includes(SECRET));
  });

  for (const [label, raw] of [
    ["corrupt JSON", "{"], ["UID mismatch", JSON.stringify({ uid: "other", createdAt: 123, payload: draft })],
    ["bad timestamp", JSON.stringify({ uid: draft.id, createdAt: SECRET, payload: draft })],
  ]) {
    test(`stored ${label} is removed instead of returned`, (t) => {
      const { values } = storageFixture(t, raw);
      assert.equal(getPendingRegistration(), null);
      assert.equal(values.has(STORAGE_KEY), false);
    });
  }

  test("failed cleanup rewrite leaves no legacy secret when removal is available", (t) => {
    const { values, store } = storageFixture(t, JSON.stringify({ uid: draft.id, createdAt: 123,
      payload: { ...draft, idVerificationReceipt: SECRET } }));
    store.setItem = () => { throw new Error("Storage full"); };
    assert.equal(getPendingRegistration(), null);
    assert.equal(values.has(STORAGE_KEY), false);
  });

  test("blocked storage is non-fatal", (t) => {
    const { store } = storageFixture(t);
    store.getItem = store.setItem = store.removeItem = () => { throw new Error("Blocked"); };
    assert.equal(getPendingRegistration(), null);
    assert.doesNotThrow(() => savePendingRegistration({ uid: draft.id, payload: draft, createdAt: 123 }));
  });
});

describe("memory-only, identity-bound receipts", () => {
  test("receipts are isolated, not serializable, cleared explicitly, and expire at the deadline", () => {
    let now = 1_700_000_000_000;
    const holder = createRegistrationReceiptStore(() => now);
    assert.equal(holder.remember(draft, verification(new Date(now + 600_000).toISOString())), true);
    assert.equal(holder.get(draft), SECRET);
    assert.equal(JSON.stringify(holder), "{}");
    assert.equal(createRegistrationReceiptStore(() => now).get(draft), undefined);
    now += 600_000;
    assert.equal(holder.get(draft), undefined);
    holder.remember(draft, verification(new Date(now + 1000).toISOString()));
    holder.clear();
    assert.equal(holder.get(draft), undefined);
  });

  for (const key of ["id", "email", "studentNumber", "firstName", "middleInitial", "lastName", "suffix", "role"]) {
    test(`changing ${key} invalidates the receipt even if the original details are restored`, () => {
      const holder = createRegistrationReceiptStore();
      holder.remember(draft, verification());
      assert.equal(holder.get({ ...draft, [key]: "changed" }), undefined);
      assert.equal(holder.get(draft), undefined);
    });
  }

  test("invalid, expired, or overlong receipts cannot replace a valid receipt", () => {
    const now = 1_700_000_000_000;
    const holder = createRegistrationReceiptStore(() => now);
    for (const invalid of [verification("invalid"), verification(new Date(now).toISOString()),
      verification(new Date(now + 600_001).toISOString()), { ...verification(), receipt: "" },
      { ...verification(), receipt: "x".repeat(4097) }]) {
      holder.remember(draft, verification(new Date(now + 1000).toISOString()));
      assert.equal(holder.remember(draft, invalid), false);
      assert.equal(holder.get(draft), undefined);
    }
    assert.equal(holder.remember({ ...draft, role: "Faculty" }, verification()), false);
  });

  test("binding snapshots do not retain mutable draft objects", () => {
    const holder = createRegistrationReceiptStore();
    const mutable = { ...draft };
    holder.remember(mutable, verification());
    mutable.firstName = "changed";
    assert.equal(holder.get(mutable), undefined);
  });
});

describe("Firebase-only registration authentication", () => {
  test("fresh accessors wait for restore, reload, then force-refresh; cached aliases stay cached", async () => {
    const { auth, events } = fakeAuth();
    const tokens = createFirebaseTokenAccessors(auth);
    assert.deepEqual(events, []);
    assert.equal(await tokens.getFreshFirebaseIdToken(), "fresh-firebase-token");
    assert.deepEqual(events, ["ready", "reload", ["token", true]]);
    assert.equal(await tokens.getAuthToken(), "cached-firebase-token");
    assert.equal(await tokens.refreshAuthToken(), "fresh-firebase-token");
    assert.deepEqual(events.slice(3), [["token", undefined], ["token", true]]);
  });

  test("restoring Firebase users are awaited rather than treated as signed out", async () => {
    const { auth, user, events } = fakeAuth();
    let release;
    auth.currentUser = null;
    auth.authStateReady = () => new Promise((resolve) => { release = () => { auth.currentUser = user; resolve(); }; });
    const pending = createFirebaseTokenAccessors(auth).getFreshFirebaseIdToken();
    assert.deepEqual(events, []);
    release();
    assert.equal(await pending, "fresh-firebase-token");
  });

  for (const stage of ["reload", "token"]) {
    test(`account switches during ${stage} cannot return the old account's token`, async () => {
      const { auth, user } = fakeAuth();
      if (stage === "reload") user.reload = async () => { auth.currentUser = { ...user, uid: "other" }; };
      else user.getIdToken = async () => { auth.currentUser = null; return SECRET; };
      assert.equal(await createFirebaseTokenAccessors(auth).getFreshFirebaseIdToken(), undefined);
    });
  }

  test("email changes during force-refresh cannot return a token for the previous email", async () => {
    const { auth, user } = fakeAuth();
    user.getIdToken = async () => { user.email = "changed@example.com"; return SECRET; };
    assert.equal(await createFirebaseTokenAccessors(auth).getFreshFirebaseIdToken(), undefined);
  });

  test("registration bypasses the MFA provider and returns the profile, not a boolean", async () => {
    const { auth, user, events } = fakeAuth({ emailVerified: false });
    user.reload = async () => { events.push("reload"); user.emailVerified = true; };
    let mfaCalls = 0;
    let posts = 0;
    const profile = { id: draft.id, email: draft.email, role: "Student", studentNumber: draft.studentNumber };
    const client = createApiClient({ baseURL: "https://api.example.test", getAuthToken: async () => { mfaCalls++; return "mfa-session-token"; } });
    client.defaults.adapter = async (config) => {
      posts++;
      assert.equal(config.headers.get("Authorization"), "Bearer fresh-firebase-token");
      assert.equal(JSON.parse(config.data).idVerificationReceipt, SECRET);
      return response(config, profile, 201);
    };
    assert.deepEqual(await createAuthService(client, auth).register({ ...draft, idVerificationReceipt: SECRET }), profile);
    assert.deepEqual(events, ["ready", "reload", ["token", true]]);
    assert.equal(mfaCalls, 0);
    assert.equal(posts, 1);
  });

  test("faculty registration still uses Firebase without an ID receipt", async () => {
    const { auth } = fakeAuth({ email: "teacher@pnm.edu.ph" });
    const client = axios.create();
    client.defaults.adapter = async (config) => {
      assert.equal(JSON.parse(config.data).idVerificationReceipt, undefined);
      return response(config, { id: draft.id, role: "Faculty" }, 201);
    };
    await createAuthService(client, auth).register(toRegistrationDraft({ ...draft, email: "teacher@pnm.edu.ph", role: "Faculty" }));
  });

  for (const [label, userChanges, payloadChanges, code] of [
    ["unverified email", { emailVerified: false }, {}, "email_unverified"],
    ["UID mismatch", {}, { id: "other" }, "identity_mismatch"],
    ["email mismatch", {}, { email: "other@example.com" }, "identity_mismatch"],
  ]) {
    test(`${label} cannot send a registration request`, async () => {
      const { auth } = fakeAuth(userChanges);
      const client = axios.create();
      client.defaults.adapter = () => { throw new Error("Must not post"); };
      await assert.rejects(createAuthService(client, auth).register({ ...draft, ...payloadChanges, idVerificationReceipt: SECRET }), (error) => {
        assert.equal(error.code, code);
        return assertSanitized(error, RegistrationError);
      });
    });
  }

  test("signed-out users cannot send a registration request", async () => {
    const { auth } = fakeAuth();
    auth.currentUser = null;
    await assert.rejects(createAuthService(axios.create(), auth).register(draft), (error) => {
      assert.equal(error.code, "authentication_required");
      return assertSanitized(error, RegistrationError);
    });
  });

  for (const stage of ["reload", "token", "network"]) {
    test(`${stage} failures never expose receipts or raw exceptions`, async () => {
      const { auth, user } = fakeAuth();
      const client = axios.create();
      const raw = new AxiosError(SECRET, "ECONNABORTED", { data: SECRET }, { body: SECRET });
      if (stage === "reload") user.reload = async () => { throw raw; };
      if (stage === "token") user.getIdToken = async () => { throw raw; };
      client.defaults.adapter = async () => { throw raw; };
      await assert.rejects(createAuthService(client, auth).register({ ...draft, idVerificationReceipt: SECRET }), (error) => assertSanitized(error, RegistrationError));
    });
  }

  test("known receipt errors retain a safe rescan hint; arbitrary echoed messages do not", () => {
    assert.equal(sanitizeRegistrationError(httpError({}, 400, { Message: "The student ID verification receipt is invalid or expired." })).code, "invalid_receipt");
    for (const body of [{ message: SECRET }, SECRET, { Message: { receipt: SECRET } }]) {
      assertSanitized(sanitizeRegistrationError(httpError({}, 400, body)), RegistrationError);
    }
  });

  test("even decorated/mutated registration errors are rebuilt without untrusted fields", () => {
    const raw = Object.assign(new RegistrationError("invalid_request", 400), {
      code: SECRET, status: SECRET, config: { data: SECRET }, cause: SECRET,
    });
    const safe = sanitizeRegistrationError(raw);
    assert.equal(safe.code, "service_unavailable");
    assert.equal(safe.status, undefined);
    assertSanitized(safe, RegistrationError);
  });
});

describe("API client authentication overrides", () => {
  test("explicit Firebase credentials are neither overwritten nor retried with MFA", async () => {
    let providerCalls = 0;
    let refreshCalls = 0;
    let expiredCalls = 0;
    let posts = 0;
    const client = createApiClient({ baseURL: "https://api.example.test",
      getAuthToken: async () => { providerCalls++; return "mfa-token"; },
      refreshAuthToken: async () => { refreshCalls++; return "mfa-refreshed"; },
      onAuthExpired: () => { expiredCalls++; },
    });
    client.defaults.adapter = async (config) => {
      posts++;
      assert.equal(config.headers.get("Authorization"), "Bearer explicit-firebase");
      throw httpError(config, 401);
    };
    await assert.rejects(client.post("/auth/register", {}, { headers: { authorization: "Bearer explicit-firebase" } }));
    assert.equal(providerCalls, 0);
    assert.equal(refreshCalls, 0);
    assert.equal(expiredCalls, 0);
    assert.equal(posts, 1);
  });

  test("ordinary authenticated calls still refresh once without overwriting the new token", async () => {
    let providerCalls = 0;
    let refreshCalls = 0;
    let calls = 0;
    const client = createApiClient({ baseURL: "https://api.example.test",
      getAuthToken: async () => { providerCalls++; return "cached-session"; },
      refreshAuthToken: async () => { refreshCalls++; return "fresh-session"; },
    });
    client.defaults.adapter = async (config) => {
      calls++;
      if (calls === 1) {
        assert.equal(config.headers.get("Authorization"), "Bearer cached-session");
        throw httpError(config, 401);
      }
      assert.equal(config.headers.get("Authorization"), "Bearer fresh-session");
      return response(config, {});
    };
    await client.get("/user/me");
    assert.equal(calls, 2);
    assert.equal(providerCalls, 1);
    assert.equal(refreshCalls, 1);
  });
});

describe("ID-verification transport authentication and safe failures", () => {
  test("uses a freshly reloaded Firebase identity before posting an in-memory capture", async (t) => {
    const { auth, events } = fakeAuth();
    verificationAdapter(t, async (config) => {
      assert.equal(config.headers.get("Authorization"), "Bearer fresh-firebase-token");
      assert.equal(config.timeout, 30_000);
      assert.deepEqual(JSON.parse(config.data), request);
      return response(config, verification());
    });
    const service = new LiveIdVerificationService({ endpoint: "https://idv.example.test/api/v1/id-verification",
      getFreshFirebaseIdToken: createFirebaseTokenAccessors(auth).getFreshFirebaseIdToken });
    assert.equal((await service.verifyStudentId(request)).outcome, "verified");
    assert.deepEqual(events, ["ready", "reload", ["token", true]]);
  });

  test("retries an authentication rejection once with another fresh Firebase token", async (t) => {
    let tokens = 0;
    let posts = 0;
    verificationAdapter(t, async (config) => {
      posts++;
      assert.equal(config.headers.get("Authorization"), `Bearer firebase-${posts}`);
      if (posts === 1) throw httpError(config, 401);
      return response(config, verification());
    });
    const service = new LiveIdVerificationService({ endpoint: "https://idv.example.test",
      getFreshFirebaseIdToken: async () => `firebase-${++tokens}` });
    await service.verifyStudentId(request);
    assert.equal(posts, 2);
    assert.equal(tokens, 2);
  });

  for (const [status, code, outcome] of [
    [422, "image_quality", "retake"], [422, "student_name_mismatch", "unmatched"],
    [429, "daily_limit", "error"], [503, "service_unavailable", "error"],
  ]) {
    test(`${status} ${code} honors cooldown without repeating OCR or exposing response text`, async (t) => {
      let posts = 0;
      verificationAdapter(t, async (config) => {
        posts++;
        throw httpError(config, status, { code, outcome, message: SECRET }, { "retry-after": "60" });
      });
      const service = new LiveIdVerificationService({ endpoint: "https://idv.example.test", getFreshFirebaseIdToken: async () => "firebase-token" });
      await assert.rejects(service.verifyStudentId(request), (error) => {
        assert.equal(error.code, code);
        assert.equal(error.outcome, outcome);
        assert.equal(error.retryAfterSeconds, 60);
        return assertSanitized(error, IdVerificationError);
      });
      assert.equal(posts, 1);
    });
  }

  test("a second 401 is sanitized and never triggers a third request", async (t) => {
    let posts = 0;
    verificationAdapter(t, async (config) => { posts++; throw httpError(config, 401); });
    const service = new LiveIdVerificationService({ endpoint: "https://idv.example.test", getFreshFirebaseIdToken: async () => "firebase-token" });
    await assert.rejects(service.verifyStudentId(request), (error) => assertSanitized(error, IdVerificationError));
    assert.equal(posts, 2);
  });

  for (const stage of ["initial token", "retry token", "network"]) {
    test(`${stage} provider/transport failures are sanitized on every path`, async (t) => {
      let tokens = 0;
      let posts = 0;
      verificationAdapter(t, async (config) => {
        posts++;
        if (stage === "retry token") throw httpError(config, 401);
        throw new AxiosError(SECRET, "ECONNABORTED", config, { body: SECRET });
      });
      const service = new LiveIdVerificationService({ endpoint: "https://idv.example.test", getFreshFirebaseIdToken: async () => {
        tokens++;
        if (stage === "initial token" || (stage === "retry token" && tokens === 2)) {
          throw Object.assign(new Error(SECRET), { config: { data: SECRET }, cause: SECRET });
        }
        return "firebase-token";
      } });
      await assert.rejects(service.verifyStudentId(request), (error) => assertSanitized(error, IdVerificationError));
      assert.equal(posts, stage === "initial token" ? 0 : 1);
    });
  }

  test("reflected codes/messages and invalid Retry-After values cannot leak into errors", async (t) => {
    verificationAdapter(t, async (config) => { throw httpError(config, 503, { code: SECRET, message: SECRET, outcome: "retake" }, { "retry-after": "-1" }); });
    const service = new LiveIdVerificationService({ endpoint: "https://idv.example.test", getFreshFirebaseIdToken: async () => "firebase-token" });
    await assert.rejects(service.verifyStudentId(request), (error) => {
      assert.equal(error.code, "service_unavailable");
      assert.equal(error.outcome, "error");
      assert.equal(error.retryAfterSeconds, undefined);
      return assertSanitized(error, IdVerificationError);
    });
  });

  test("token-provider verification errors are rebuilt instead of retaining decorations", async () => {
    const service = new LiveIdVerificationService({ endpoint: "https://idv.example.test", getFreshFirebaseIdToken: async () => {
      throw Object.assign(new IdVerificationError({ code: "authentication_required", message: SECRET }), {
        config: { data: SECRET }, cause: SECRET, status: SECRET,
      });
    } });
    await assert.rejects(service.verifyStudentId(request), (error) => {
      assert.equal(error.code, "authentication_required");
      assert.equal(error.status, undefined);
      return assertSanitized(error, IdVerificationError);
    });
  });

  test("missing auth or endpoint fails before posting any capture", async (t) => {
    verificationAdapter(t, () => { throw new Error("Must not post"); });
    for (const config of [{ endpoint: "https://idv.example.test", getFreshFirebaseIdToken: async () => undefined },
      { getFreshFirebaseIdToken: async () => { throw new Error("Must not fetch token"); } }]) {
      await assert.rejects(new LiveIdVerificationService(config).verifyStudentId(request), (error) => assertSanitized(error, IdVerificationError));
    }
  });

  test("mock mode preserves the factory toggle and does not request authentication/network", async () => {
    const service = createIdVerificationService({ useMock: true,
      getFreshFirebaseIdToken: async () => { throw new Error("Mock must not authenticate"); } });
    assert.equal((await service.verifyStudentId(request)).receipt, "mock-id-verification-receipt");
  });
});
