// Actual web registration/verification/profile transports with synthetic
// Firebase/HTTP boundaries. No environment files, network, JWT decoding, or
// registration writes. Every service variant uses fresh in-memory modules.
import "./support/web-runtime-loader.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";
import { inspect } from "node:util";
const { default: axios, AxiosError } = await import("axios");
const { runtime, firebaseAuth, setUser, SYNTHETIC_PRIVATE, SYNTHETIC_RECEIPT,
  SYNTHETIC_FIREBASE_TOKEN, SYNTHETIC_MFA_TOKEN, MFA_KEY } = await import("./support/web-runtime-mocks.mjs");
const { deferred, cleanup } = await import("./support/web-runtime-helpers.mjs");
axios.defaults.adapter = async config => {
  if (runtime.http) return runtime.http(config);
  runtime.unexpectedRequests++;
  throw new Error("An unhandled synthetic HTTP boundary is forbidden.");
};
globalThis.fetch = async () => { runtime.unexpectedRequests++; throw new Error("Fetch is forbidden in this synthetic transport suite."); };
const { IdVerificationError, RegistrationError } = await import("@monteai/api");

const defaults = { VITE_USE_MOCK: "false", VITE_API_BASE_URL: "https://api.example.test/api/v1",
  VITE_ID_VERIFICATION_ENDPOINT: "https://idv.example.test/api/v1/id-verification" };
let serial = 0;
async function service(env = {}) {
  globalThis.__MONTEAI_WEB_TEST_ENV__ = { ...defaults, ...env };
  const query = `?testCase=${++serial}`;
  const registration = await import(`../../apps/web/src/lib/registrationService.ts${query}`);
  const client = await import(`../../apps/web/src/lib/apiClient.ts${query}`);
  client.setTokenProvider(async () => { throw new Error("Signup must never consult the generic MFA token provider."); });
  return registration;
}
function draft(overrides = {}) {
  return { id: "synthetic-web-uid", role: "Student", email: "personal@example.com", firstName: "Maria Ana", middleInitial: "M",
    lastName: "Dela Cruz", suffix: "Jr.", studentNumber: "00-00123", position: "Member", institute: "Institute of Computing Studies",
    program: "BS Computer Science", yearLevel: 1, section: "A", privacyNoticeAccepted: true, privacyNoticeVersion: "2026-10-23",
    termsAccepted: true, termsVersion: "2026-10-23", ...overrides };
}
function image(value = draft()) {
  return { student: { studentNumber: value.studentNumber, firstName: value.firstName, middleInitial: value.middleInitial ?? "",
    lastName: value.lastName, suffix: value.suffix ?? "" }, imageBase64: SYNTHETIC_PRIVATE };
}
const request = value => ({ ...(value ?? draft()), idVerificationReceipt: SYNTHETIC_RECEIPT });
function response(config, data, status = 200, headers = {}) { return { config, data, status, headers, statusText: "Synthetic" }; }
function httpError(config, status, data = {}, headers = {}) {
  return new AxiosError(SYNTHETIC_PRIVATE, "ERR_BAD_RESPONSE", config, { body: SYNTHETIC_PRIVATE },
    response(config, { message: SYNTHETIC_PRIVATE, ...data }, status, headers));
}
function safe(Type, code) {
  return error => {
    assert.ok(error instanceof Type, "The boundary must expose only its safe error type.");
    if (code) assert.equal(error.code, code);
    for (const marker of [SYNTHETIC_PRIVATE, SYNTHETIC_RECEIPT, SYNTHETIC_FIREBASE_TOKEN, SYNTHETIC_MFA_TOKEN]) {
      assert.equal(inspect(error).includes(marker), false, "Synthetic sensitive diagnostics must be discarded.");
      assert.equal(JSON.stringify(error).includes(marker), false);
    }
    for (const key of ["config", "request", "response", "cause", "receipt", "idVerificationReceipt", "imageBase64", "ocrText"]) assert.equal(error[key], undefined);
    return true;
  };
}
const operations = [
  { label: "verification", Type: IdVerificationError, endpoint: defaults.VITE_ID_VERIFICATION_ENDPOINT,
    call: (api, signal, value = draft()) => api.verifyRegistrationId(image(value), value, signal), data: () => runtime.response() },
  { label: "registration", Type: RegistrationError, endpoint: "/auth/register",
    call: (api, signal, value = draft()) => api.registerPendingProfile(request(value), { signal }), data: () => ({ id: draft().id }) },
  { label: "profile lookup", Type: RegistrationError, endpoint: "/auth/me",
    call: (api, signal, value = draft()) => api.checkExistingSignupProfile(value, signal), data: () => ({ id: draft().id }) },
];

beforeEach(t => {
  runtime.reset(); setUser(runtime.user()); globalThis.__MONTEAI_WEB_TEST_ENV__ = { ...defaults };
  runtime.store.set(MFA_KEY, JSON.stringify({ accessToken: SYNTHETIC_MFA_TOKEN, refreshToken: "synthetic-refresh",
    expiresAt: new Date(Date.now() + 600_000).toISOString() }));
  t.mock.method(console, "error", () => { runtime.unexpectedDiagnostics++; });
  t.mock.method(console, "warn", () => { runtime.unexpectedDiagnostics++; });
});
afterEach(async () => {
  await cleanup();
  assert.equal(runtime.unexpectedRequests, 0, "Only explicitly handled synthetic HTTP is allowed.");
  assert.equal(runtime.unexpectedDiagnostics, 0, "Transport failures must not print payloads or raw diagnostics.");
  assert.equal(runtime.storageEvents.some(([action, key]) => key === MFA_KEY), false, "Signup must not read or mutate MFA storage.");
});

describe("actual web configuration and explicit mock/live consistency", () => {
  for (const key of ["VITE_ID_VERIFICATION_ENDPOINT", "VITE_API_BASE_URL"]) {
    for (const [label, value] of [["missing", undefined], ["empty", " "], ["relative", "/api/v1"], ["malformed", "not a URL"],
      ["non-HTTP", "ftp://example.test/api"], ["file", "file:///synthetic"], ["credentials", "https://user:password@example.test/api"],
      ["query", "https://example.test/api?unsafe=synthetic"], ["fragment", "https://example.test/api#synthetic"]]) {
      test(`${key}: ${label} keeps live verification disabled and never falls back`, async () => {
        const api = await service({ [key]: value });
        assert.equal(api.studentIdVerification.configured, false); assert.equal(api.registrationUsesMock, false);
        await assert.rejects(operations[0].call(api, new AbortController().signal), safe(IdVerificationError, "client_not_configured"));
        assert.equal(runtime.reloads + runtime.tokenCalls.length, 0);
        if (key === "VITE_API_BASE_URL") {
          await assert.rejects(operations[1].call(api, new AbortController().signal), safe(RegistrationError, "service_unavailable"));
          await assert.rejects(operations[2].call(api, new AbortController().signal), safe(RegistrationError, "service_unavailable"));
          assert.equal(runtime.tokenCalls.length, 0);
        }
      });
    }
  }
  test("HTTP loopback and HTTPS are accepted without weakening browser certificate/security policy", async () => {
    for (const protocol of ["http:", "https:"]) {
      const api = await service({ VITE_API_BASE_URL: `${protocol}//127.0.0.1:5086/api/v1`,
        VITE_ID_VERIFICATION_ENDPOINT: ` ${protocol}//127.0.0.1:7073/api/v1/id-verification ` });
      assert.equal(api.studentIdVerification.configured, true);
      // Configuration-only check: these local-looking URLs are NEVER requested.
    }
  });
  test("explicit mock works without endpoints, refreshes Firebase, and makes no upload or registration request", async t => {
    const now = Date.parse("2026-11-22T00:00:00Z"); t.mock.method(Date, "now", () => now);
    const api = await service({ VITE_USE_MOCK: "true", VITE_API_BASE_URL: undefined, VITE_ID_VERIFICATION_ENDPOINT: undefined });
    assert.equal(api.registrationUsesMock, true); assert.equal(api.studentIdVerification.configured, true);
    const result = await operations[0].call(api, new AbortController().signal);
    assert.equal(result.receipt === "mock-id-verification-receipt", true); assert.equal(Date.parse(result.expiresAt) - now, 600_000);
    await api.registerPendingProfile({ ...draft(), idVerificationReceipt: result.receipt }); result.receipt = "";
    assert.equal(await operations[2].call(api, new AbortController().signal), null);
    assert.deepEqual(runtime.tokenCalls, [true, true, true]);
  });
  for (const toggle of [undefined, "false", "TRUE", "1", " true "]) {
    test(`non-explicit mock toggle ${JSON.stringify(toggle)} never creates mock success`, async () => {
      const api = await service({ VITE_USE_MOCK: toggle, VITE_API_BASE_URL: undefined, VITE_ID_VERIFICATION_ENDPOINT: undefined });
      assert.equal(api.registrationUsesMock, false);
      await assert.rejects(operations[0].call(api, new AbortController().signal), safe(IdVerificationError, "client_not_configured"));
    });
  }
  test("faculty registration still works with a valid API when ID verification is unconfigured", async () => {
    const value = draft({ role: "Faculty", email: "faculty@pnm.edu.ph" }); setUser(runtime.user({ email: value.email }));
    const api = await service({ VITE_ID_VERIFICATION_ENDPOINT: undefined }); let posts = 0;
    runtime.http = async config => {
      assert.equal(config.url, "/auth/register"); posts++;
      const body = JSON.parse(config.data);
      assert.equal(body.role, "Faculty"); assert.equal(body.idVerificationReceipt, undefined); assert.equal(body.studentNumber, undefined);
      return response(config, { id: value.id });
    };
    await api.registerPendingProfile(value); assert.equal(posts, 1);
  });
});

describe("actual fresh Firebase binding across each asynchronous boundary", () => {
  for (const operation of operations) {
    test(`${operation.label} uses a forced Firebase token and leaves ordinary MFA sessions untouched`, async () => {
      const api = await service(); let calls = 0;
      runtime.http = async config => {
        assert.equal(config.url, operation.endpoint); calls++;
        assert.equal(config.headers.get("Authorization") === `Bearer ${SYNTHETIC_FIREBASE_TOKEN}`, true);
        return response(config, operation.data());
      };
      await operation.call(api, new AbortController().signal);
      assert.equal(calls, 1); assert.deepEqual(runtime.tokenCalls, [true]); assert.equal(runtime.reloads, 1);
    });
    test(`${operation.label} pre-abort fails before Firebase/HTTP and exposes no abort reason`, async () => {
      const api = await service(); const abort = new AbortController(); abort.abort(new Error(SYNTHETIC_PRIVATE));
      await assert.rejects(operation.call(api, abort.signal), safe(operation.Type, "cancelled"));
      assert.equal(runtime.reloads + runtime.tokenCalls.length, 0);
    });
    for (const stage of ["restore", "reload", "token"]) {
      for (const action of ["cancel", "account switch"]) {
        test(`${operation.label}: ${action} during ${stage} prevents the next HTTP request`, async () => {
          const wait = deferred(); const entered = deferred(); const abort = new AbortController();
          const delayed = async () => { entered.finish(); await wait.promise; };
          if (stage === "restore") runtime.ready = delayed;
          if (stage === "reload") firebaseAuth.currentUser.reload = delayed;
          if (stage === "token") firebaseAuth.currentUser.getIdToken = async force => { runtime.tokenCalls.push(force); await delayed(); return SYNTHETIC_FIREBASE_TOKEN; };
          const api = await service();
          const rejection = assert.rejects(operation.call(api, abort.signal), safe(operation.Type));
          await entered.promise;
          if (action === "cancel") abort.abort(new Error(SYNTHETIC_PRIVATE));
          else setUser(runtime.user({ uid: "synthetic-other-uid", email: "other@example.com" }));
          wait.finish(); await rejection;
          assert.equal(runtime.signOuts + runtime.deletes, 0);
        });
      }
    }
    test(`${operation.label}: an account switch during HTTP cannot transfer a late success`, async () => {
      const api = await service(); let calls = 0;
      runtime.http = async config => { calls++; setUser(runtime.user({ uid: "synthetic-other-uid", email: "other@example.com" })); return response(config, operation.data()); };
      await assert.rejects(operation.call(api, new AbortController().signal), safe(operation.Type));
      assert.equal(calls, 1); assert.equal(runtime.signOuts + runtime.deletes, 0);
    });
    test(`${operation.label}: cancellation during HTTP cannot return its late response`, async () => {
      const api = await service(); const abort = new AbortController(); let calls = 0;
      runtime.http = async config => { calls++; abort.abort(new Error(SYNTHETIC_PRIVATE)); return response(config, operation.data()); };
      await assert.rejects(operation.call(api, abort.signal), safe(operation.Type, "cancelled"));
      assert.equal(calls, 1);
    });
    for (const useMock of ["false", "true"]) {
      for (const stage of ["restore", "reload", "token"]) {
        test(`${operation.label}: ${useMock === "true" ? "mock" : "live"} ${stage} exceptions are rebuilt safely`, async () => {
          const raw = Object.assign(new Error(SYNTHETIC_PRIVATE), { cause: SYNTHETIC_RECEIPT, response: { data: SYNTHETIC_PRIVATE } });
          if (stage === "restore") runtime.ready = async () => { throw raw; };
          if (stage === "reload") firebaseAuth.currentUser.reload = async () => { throw raw; };
          if (stage === "token") firebaseAuth.currentUser.getIdToken = async () => { throw raw; };
          const api = await service({ VITE_USE_MOCK: useMock });
          await assert.rejects(operation.call(api, new AbortController().signal), safe(operation.Type, "service_unavailable"));
        });
      }
    }
  }
  for (const operation of operations) {
    test(`${operation.label}: UID and email mismatches are blocked before refreshing another account`, async () => {
      const api = await service();
      for (const update of [{ id: "synthetic-other" }, { email: "other@example.com" }]) {
        await assert.rejects(operation.call(api, new AbortController().signal, draft(update)), safe(operation.Type));
      }
      assert.equal(runtime.reloads + runtime.tokenCalls.length, 0);
    });
  }
});

describe("verification-only 401 retry and safe live failures", () => {
  test("verification retries HTTP 401 once with another fresh Firebase token, never MFA", async () => {
    const api = await service(); let calls = 0;
    runtime.http = async config => {
      calls++; assert.equal(config.url, defaults.VITE_ID_VERIFICATION_ENDPOINT);
      assert.equal(config.headers.get("Authorization") === `Bearer ${SYNTHETIC_FIREBASE_TOKEN}`, true);
      if (calls === 1) throw httpError(config, 401);
      return response(config, runtime.response());
    };
    const result = await operations[0].call(api, new AbortController().signal); result.receipt = "";
    assert.equal(calls, 2); assert.deepEqual(runtime.tokenCalls, [true, true]); assert.equal(runtime.reloads, 2);
  });
  test("a second verification 401 never makes a third attempt", async () => {
    const api = await service(); let calls = 0;
    runtime.http = async config => { calls++; throw httpError(config, 401); };
    await assert.rejects(operations[0].call(api, new AbortController().signal), safe(IdVerificationError, "authentication_required"));
    assert.equal(calls, 2); assert.equal(runtime.tokenCalls.length, 2);
  });
  for (const action of ["cancel", "account switch"]) {
    test(`${action} after verification 401 prevents the retry upload`, async () => {
      const api = await service(); const abort = new AbortController(); let calls = 0;
      runtime.http = async config => {
        calls++;
        if (action === "cancel") abort.abort(); else setUser(runtime.user({ uid: "synthetic-other", email: "other@example.com" }));
        throw httpError(config, 401);
      };
      await assert.rejects(operations[0].call(api, abort.signal), safe(IdVerificationError));
      assert.equal(calls, 1); assert.equal(runtime.tokenCalls.length, 1);
    });
  }
  for (const [status, code, outcome] of [[403, "origin_not_allowed", "error"], [413, "image_too_large", "error"],
    [422, "image_quality", "retake"], [422, "student_name_mismatch", "unmatched"], [429, "busy", "error"],
    [503, "verification_timeout", "error"], [503, "verification_disabled", "error"]]) {
    test(`verification ${status} ${code} has no scan retry or live-to-mock fallback`, async () => {
      const api = await service(); let calls = 0;
      runtime.http = async config => { calls++; throw httpError(config, status, { code, outcome, receipt: SYNTHETIC_RECEIPT, ocrText: SYNTHETIC_PRIVATE }, { "retry-after": "7" }); };
      await assert.rejects(operations[0].call(api, new AbortController().signal), error => {
        safe(IdVerificationError, code)(error); assert.equal(error.outcome, outcome); assert.equal(error.retryAfterSeconds, 7); return true;
      });
      assert.equal(calls, 1); assert.equal(runtime.tokenCalls.length, 1);
    });
  }
  for (const operation of operations) {
    test(`${operation.label} network failure discards raw payload diagnostics and cannot become mock success`, async () => {
      const api = await service(); let calls = 0;
      runtime.http = async config => { calls++; throw new AxiosError(SYNTHETIC_PRIVATE, "ECONNABORTED", config, { body: SYNTHETIC_RECEIPT }); };
      await assert.rejects(operation.call(api, new AbortController().signal), safe(operation.Type, "service_unavailable"));
      assert.equal(calls, 1);
    });
  }
  for (const operation of operations.slice(1)) {
    test(`${operation.label} HTTP 401 has no automatic authentication/registration retry`, async () => {
      const api = await service(); let calls = 0;
      runtime.http = async config => { calls++; throw httpError(config, 401); };
      await assert.rejects(operation.call(api, new AbortController().signal), safe(RegistrationError, "authentication_required"));
      assert.equal(calls, 1); assert.equal(runtime.tokenCalls.length, 1);
    });
  }
});

describe("strict allowlists, genuine consent, and authoritative existing-profile checks", () => {
  test("verification strips unknown envelope/identity/toJSON fields and returns only the safe response contract", async () => {
    const api = await service(); let hooks = 0;
    const capture = image(); capture.toJSON = () => { hooks++; throw new Error(SYNTHETIC_PRIVATE); };
    capture.receipt = SYNTHETIC_RECEIPT; capture.ocrText = SYNTHETIC_PRIVATE;
    capture.student.toJSON = capture.toJSON; capture.student.unknown = SYNTHETIC_PRIVATE;
    runtime.http = async config => {
      const body = JSON.parse(config.data);
      assert.deepEqual(Object.keys(body).sort(), ["imageBase64", "student"]);
      assert.deepEqual(Object.keys(body.student).sort(), ["firstName", "lastName", "middleInitial", "studentNumber", "suffix"]);
      assert.equal(body.imageBase64 === SYNTHETIC_PRIVATE, true);
      return response(config, { ...runtime.response(), imageBase64: SYNTHETIC_PRIVATE, ocrText: SYNTHETIC_PRIVATE, internal: SYNTHETIC_PRIVATE });
    };
    const result = await api.verifyRegistrationId(capture, draft(), new AbortController().signal);
    assert.equal(hooks, 0); assert.deepEqual(Object.keys(result).sort(), ["expiresAt", "outcome", "receipt", "requestId", "templateId"]); result.receipt = "";
  });
  for (const field of ["studentNumber", "firstName", "middleInitial", "lastName", "suffix"]) {
    test(`verification ${field} mismatch cannot upload a capture under another draft`, async () => {
      const api = await service(); const capture = image(); capture.student[field] = "changed";
      await assert.rejects(api.verifyRegistrationId(capture, draft(), new AbortController().signal), safe(IdVerificationError, "invalid_request"));
      assert.equal(runtime.tokenCalls.length, 0);
    });
  }
  test("registration never serializes unknown fields, capture/OCR, credentials, or source toJSON", async () => {
    const api = await service(); let hooks = 0;
    runtime.http = async config => {
      const body = JSON.parse(config.data);
      assert.deepEqual(Object.keys(body).sort(), [...Object.keys(draft()), "idVerificationReceipt"].sort());
      assert.equal(body.idVerificationReceipt === SYNTHETIC_RECEIPT, true); return response(config, {});
    };
    await api.registerPendingProfile({ ...request(), password: SYNTHETIC_PRIVATE, imageBase64: SYNTHETIC_PRIVATE, ocrText: SYNTHETIC_PRIVATE,
      future: { secret: SYNTHETIC_PRIVATE }, toJSON() { hooks++; throw new Error(SYNTHETIC_PRIVATE); } });
    assert.equal(hooks, 0);
  });
  for (const [label, update, code] of [["missing privacy", { privacyNoticeAccepted: false }, "privacy_notice_required"],
    ["old privacy", { privacyNoticeVersion: "old" }, "privacy_notice_required"], ["missing terms", { termsAccepted: false }, "terms_required"],
    ["old terms", { termsVersion: "old" }, "terms_required"], ["missing receipt", { idVerificationReceipt: undefined }, "invalid_receipt"],
    ["overlong receipt", { idVerificationReceipt: "x".repeat(4097) }, "invalid_receipt"], ["non-string receipt", { idVerificationReceipt: {} }, "invalid_receipt"],
    ["number normalization", { studentNumber: " 00-00123 " }, "identity_mismatch"]]) {
    test(`registration ${label} fails locally before Firebase or HTTP`, async () => {
      const api = await service();
      await assert.rejects(api.registerPendingProfile({ ...request(), ...update }), safe(RegistrationError, code)); assert.equal(runtime.tokenCalls.length, 0);
    });
  }
  for (const operation of operations) {
    test(`${operation.label}: unverified Firebase identity cannot upload/register, but may authoritatively check its profile`, async () => {
      firebaseAuth.currentUser.emailVerified = false; const api = await service();
      if (operation.label === "profile lookup") {
        runtime.http = async config => response(config, { id: draft().id });
        assert.deepEqual(await operation.call(api, new AbortController().signal), { id: draft().id });
      } else await assert.rejects(operation.call(api, new AbortController().signal), safe(operation.Type, "email_unverified"));
    });
  }
  test("profile lookup strips arbitrary returned profile fields and accepts only its own UID", async () => {
    const api = await service();
    runtime.http = async config => response(config, { id: draft().id, receipt: SYNTHETIC_RECEIPT, ocrText: SYNTHETIC_PRIVATE });
    assert.deepEqual(await operations[2].call(api, new AbortController().signal), { id: draft().id });
    runtime.http = async config => response(config, { id: "synthetic-other" });
    await assert.rejects(operations[2].call(api, new AbortController().signal), safe(RegistrationError, "identity_mismatch"));
  });
  for (const status of [404, 401, 403, 500]) {
    test(`profile HTTP ${status}: only authenticated, still-bound 404 means no profile`, async () => {
      const api = await service();
      runtime.http = async config => { throw httpError(config, status); };
      if (status === 404) assert.equal(await operations[2].call(api, new AbortController().signal), null);
      else await assert.rejects(operations[2].call(api, new AbortController().signal), safe(RegistrationError));
      runtime.http = async config => { setUser(runtime.user({ uid: "synthetic-other", email: "other@example.com" })); throw httpError(config, status); };
      await assert.rejects(operations[2].call(api, new AbortController().signal), safe(RegistrationError, "identity_mismatch"));
    });
  }
});
