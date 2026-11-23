// Offline dev-page coverage. No Vite/env files, browser, Firebase, camera,
// live HTTP, real tokens/receipts, or registration writes are used.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { setImmediate } from "node:timers/promises";
import { after, afterEach, beforeEach, test } from "node:test";
import axios, { AxiosError, CanceledError } from "axios";

const ENDPOINT = "https://monteai-id-verifier.azurewebsites.net/api/v1/id-verification";
const PRIVATE = "synthetic-private-do-not-display";
const INVALID_AUTH = "Bearer idv-connection-check-not-a-real-token";
const settings = { development: true, endpoint: ENDPOINT, apiBaseUrl: "https://api.example.test/api/v1", pageOrigin: "https://192.168.100.8:5173", useMock: false };
const ids = ["shared-check", "shared-result", "shared-endpoint-status", "shared-api-status", "shared-mode"];
const originals = new Map(["window", "document", "navigator", "fetch"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const originalAdapter = axios.defaults.adapter;
const originalTransforms = axios.defaults.transformResponse;
let fixture;

// Fail closed if this diagnostic ever starts importing auth/application code.
const guard = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("firebase/") || specifier === "@monteai/api" || /(?:^|\/)firebase(?:Services)?(?:\.|$)/.test(specifier)) {
      throw new Error("Firebase/application auth is forbidden in this offline probe.");
    }
    return nextResolve(specifier, context);
  },
});
axios.defaults.adapter = async config => {
  assert.ok(fixture, "Requests must belong to an offline fixture.");
  fixture.requests.push(config);
  assert.ok(fixture.http, "Every Axios boundary must be explicitly synthetic.");
  return fixture.http(config);
};
const { installSharedClientCheck } = await import("../../apps/web/idv-shared-client-check.ts");
const html = readFileSync(new URL("../../apps/web/idv-connection-check.html", import.meta.url), "utf8");
const bootstrapSource = html.match(/<script type="module">([\s\S]*?)<\/script>/)[1]
  .replace(/import\.meta\.env/g, "env")
  .replace('import("./idv-shared-client-check.ts")', "loadModule()");
const bootstrap = new Function("document", "env", "loadModule", bootstrapSource);
const flush = async () => { await setImmediate(); await setImmediate(); };
function response(config, data, status = 200) { return { config, data, status, statusText: "Synthetic", headers: {} }; }
function rejection(config, status, body) { return new AxiosError(PRIVATE, "SYNTHETIC", config, undefined, response(config, body, status)); }
function install(overrides = {}) { fixture.dispose = installSharedClientCheck({ ...settings, ...overrides }); }
async function click() {
  const promise = fixture.nodes["shared-check"].listeners.get("click")?.();
  if (promise) fixture.tasks.push(promise);
  await promise;
}
function assertProbeRequest(config) {
  assert.equal(config.url, ENDPOINT);
  assert.equal(config.method, "post");
  assert.equal(config.data, "{}", "No photo or student fields may be transmitted.");
  assert.equal(config.headers.get("Authorization") === INVALID_AUTH, true, "Only the fixed invalid marker is permitted.");
  assert.equal(config.headers.get("Content-Type"), "application/json");
  assert.equal(config.withCredentials, false);
  assert.equal(config.withXSRFToken, false);
  assert.equal(config.responseType, "text");
  assert.equal(config.timeout, 30_000);
  assert.ok(config.signal);
}
function pendingUntilAbort(config) {
  return new Promise((_, reject) => config.signal.addEventListener("abort", () => reject(new CanceledError(PRIVATE, config)), { once: true }));
}

beforeEach(t => {
  const target = () => ({
    textContent: "", dataset: {}, disabled: true, listeners: new Map(),
    addEventListener(name, handler) { this.listeners.set(name, handler); },
    removeEventListener(name, handler) { if (this.listeners.get(name) === handler) this.listeners.delete(name); },
  });
  fixture = { nodes: Object.fromEntries(ids.map(id => [id, target()])), requests: [], tasks: [], forbiddenAccess: 0, diagnostics: 0 };
  fixture.window = { ...target(), location: { origin: "https://192.168.100.8:5173" }, setTimeout: (...args) => globalThis.setTimeout(...args), clearTimeout: id => globalThis.clearTimeout(id) };
  fixture.document = { getElementById: id => fixture.nodes[id] };
  const forbidden = () => { fixture.forbiddenAccess++; throw new Error("Private state/capture/network access is forbidden."); };
  Object.defineProperty(fixture.window, "localStorage", { get: forbidden });
  Object.defineProperty(fixture.document, "cookie", { get: forbidden });
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: fixture.window }, document: { configurable: true, value: fixture.document },
    navigator: { configurable: true, value: { get mediaDevices() { return forbidden(); } } },
    fetch: { configurable: true, value: forbidden },
  });
  t.mock.method(console, "error", () => { fixture.diagnostics++; });
  t.mock.method(console, "warn", () => { fixture.diagnostics++; });
});
afterEach(async () => {
  fixture.dispose?.();
  await Promise.allSettled(fixture.tasks);
  assert.equal(fixture.forbiddenAccess + fixture.diagnostics, 0, "No credentials, capture APIs, live fetch, or raw diagnostics are permitted.");
  assert.equal(axios.defaults.transformResponse, originalTransforms, "Probe transforms must never mutate Axios defaults.");
  for (const node of Object.values(fixture.nodes)) assert.equal(node.textContent.includes(PRIVATE), false);
  assert.equal(fixture.nodes["shared-check"].listeners.size + fixture.window.listeners.size, 0);
  for (const [key, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
  }
  fixture = undefined;
});
after(() => { axios.defaults.adapter = originalAdapter; guard.deregister(); });

test("configured shared service maps paused response, sends only {}, and never starts automatically", async () => {
  fixture.http = async config => { assertProbeRequest(config); throw rejection(config, 503, JSON.stringify({ code: "verification_disabled", message: PRIVATE, receipt: PRIVATE })); };
  install();
  assert.equal(fixture.requests.length, 0);
  assert.equal(fixture.nodes["shared-check"].disabled, false);
  await click();
  assert.equal(fixture.requests.length, 1, "A paused response must never trigger a retry.");
  assert.equal(fixture.nodes["shared-result"].dataset.state, "pass");
  assert.ok(fixture.nodes["shared-result"].textContent.includes("503 / verification_disabled"));
  assert.ok(fixture.nodes["shared-result"].textContent.includes("ID verification is temporarily paused."));
  assert.equal(fixture.nodes["shared-check"].disabled, false);
});

for (const [label, overrides] of [
  ["production", { development: false }], ["mock mode", { useMock: true }],
  ["missing endpoint", { endpoint: undefined }], ["empty endpoint", { endpoint: "  " }],
  ["different host", { endpoint: "https://other.example.test/api/v1/id-verification" }],
  ["HTTP target", { endpoint: ENDPOINT.replace("https:", "http:") }],
  ["credentials in URL", { endpoint: ENDPOINT.replace("https://", `https://${PRIVATE}@`) }],
  ["query in URL", { endpoint: `${ENDPOINT}?private=${PRIVATE}` }], ["fragment in URL", { endpoint: `${ENDPOINT}#${PRIVATE}` }],
]) {
  test(`${label} blocks the diagnostic without displaying configured values`, async () => {
    install(overrides); await click();
    assert.equal(fixture.requests.length, 0);
    assert.equal(fixture.nodes["shared-check"].disabled, true);
    assert.equal(fixture.nodes["shared-result"].dataset.state, "fail");
    assert.ok(fixture.nodes["shared-result"].textContent.includes("request sent"));
  });
}

for (const [label, value, expected] of [
  ["trailing slash", `${ENDPOINT}/`, "trailing slash"],
  ["wrong scheme", ENDPOINT.replace("https:", "http:"), 'scheme "http:" (expected "https:")'],
  ["local verifier URL", "http://localhost:7073/api/v1/id-verification", "port 7073 present"],
  ["wrong host", ENDPOINT.replace("azurewebsites.net", "azurewebsites-test.net"), "host differs"],
  ["wrong path", `${ENDPOINT}/extra`, "path differs"],
  ["query string", `${ENDPOINT}?private=${PRIVATE}`, "query string present"],
  ["fragment", `${ENDPOINT}#${PRIVATE}`, "fragment present"],
  ["credentials", `https://${PRIVATE}@monteai-id-verifier.azurewebsites.net/api/v1/id-verification`, "embedded credentials"],
  ["relative value", "/api/v1/id-verification", "not an absolute http(s) URL"],
  ["private path segment", `${ENDPOINT}/${PRIVATE}`, "path differs"],
  ["casing-only difference", ENDPOINT.replace("https", "HTTPS"), "same URL parts but different characters"],
]) {
  test(`${label} reports only a structural mismatch`, async () => {
    install({ endpoint: value }); await click();
    assert.equal(fixture.requests.length, 0, "Any mismatch must block the request.");
    const status = fixture.nodes["shared-endpoint-status"].textContent;
    assert.ok(status.includes(expected), `Expected ${JSON.stringify(expected)} in ${JSON.stringify(status)}`);
    assert.ok(fixture.nodes["shared-result"].textContent.includes(`Expected exactly: ${ENDPOINT}.`));
    assert.equal(status.includes(PRIVATE), false, "Configured URL parts must never be displayed.");
  });
}

test("local-verifier leftover URL reports scheme and port but never the path", async () => {
  install({ endpoint: "http://localhost:7073/api/v1/id-verification" });
  await click();
  const status = fixture.nodes["shared-endpoint-status"].textContent;
  assert.equal(fixture.requests.length, 0);
  assert.ok(status.includes('scheme "http:" (expected "https:")'), status);
  assert.ok(status.includes("host differs"), status);
  assert.ok(status.includes("port 7073 present"), status);
  assert.equal(status.includes("path differs"), false, "The identical path must not be misreported.");
});

test("surrounding whitespace still matches the app's trimmed setting, but is reported", async () => {
  fixture.http = async config => { assertProbeRequest(config); throw rejection(config, 503, '{"code":"verification_disabled"}'); };
  install({ endpoint: `  ${ENDPOINT}  ` });
  assert.ok(fixture.nodes["shared-endpoint-status"].textContent.includes("stray whitespace"));
  await click();
  assert.equal(fixture.requests.length, 1);
  assert.equal(fixture.nodes["shared-result"].dataset.state, "pass");
});

test("missing main-API setting does not contact it or prevent this verification-only check", async () => {
  fixture.http = async config => { assertProbeRequest(config); throw rejection(config, 503, '{"code":"verification_disabled"}'); };
  install({ apiBaseUrl: undefined, endpoint: `  ${ENDPOINT}  ` }); await click();
  assert.equal(fixture.requests.length, 1);
  assert.equal(fixture.nodes["shared-result"].dataset.state, "pass");
  assert.ok(fixture.nodes["shared-api-status"].textContent.includes("signup stays disabled"));
  assert.ok(fixture.nodes["shared-result"].textContent.includes("signup remains disabled"));
});

test("main-API setting is reported as a bare origin, never its path", async () => {
  install({ apiBaseUrl: "https://api.example.test:7085/api/v1" });
  const status = fixture.nodes["shared-api-status"].textContent;
  assert.equal(fixture.requests.length, 0, "Reading the setting must not contact the API.");
  assert.ok(status.includes("Origin https://api.example.test:7085"), status);
  assert.ok(status.includes("not contacted"), status);
  assert.equal(status.includes("/api/v1"), false, "The configured path must not be displayed.");
});

test("loopback, mixed-content, and CORS risks are named without echoing the URL", async () => {
  install({ apiBaseUrl: "http://localhost:5084/api/v1" });
  const status = fixture.nodes["shared-api-status"].textContent;
  assert.ok(status.includes("Origin http://localhost:5084"), status);
  assert.ok(status.includes("mixed content"), status);
  assert.ok(status.includes("loopback"), status);
  assert.ok(status.includes("CORS"), status);
  assert.equal(status.includes("/api/v1"), false);
});

test("API settings with credentials or a query are rejected without revealing them", async () => {
  install({ apiBaseUrl: `http://${PRIVATE}@localhost:5084/api/v1` });
  const withCredentials = fixture.nodes["shared-api-status"].textContent;
  fixture.dispose();
  install({ apiBaseUrl: `http://localhost:5084/api/v1?token=${PRIVATE}` });
  const withQuery = fixture.nodes["shared-api-status"].textContent;
  for (const status of [withCredentials, withQuery]) {
    assert.ok(status.includes("Missing/invalid"), status);
    assert.equal(status.includes("localhost"), false, "An invalid setting must not reveal its host.");
    assert.equal(status.includes(PRIVATE), false);
  }
  assert.equal(fixture.requests.length, 0);
});

test("paused PASS names the main API origin so a phone can spot a PC-local API", async () => {
  fixture.http = async config => { assertProbeRequest(config); throw rejection(config, 503, '{"code":"verification_disabled"}'); };
  install({ apiBaseUrl: "http://localhost:5084/api/v1" }); await click();
  assert.equal(fixture.requests.length, 1);
  assert.equal(fixture.nodes["shared-result"].dataset.state, "pass");
  assert.ok(fixture.nodes["shared-result"].textContent.includes("Main API origin: http://localhost:5084"));
  assert.ok(fixture.nodes["shared-result"].textContent.includes("mixed content"));
});

for (const [label, body, code] of [
  ["service failure", '{"code":"service_unavailable"}', "service_unavailable"],
  ["origin rejection", '{"code":"origin_not_allowed"}', "origin_not_allowed"],
  ["unknown code", JSON.stringify({ code: PRIVATE, message: PRIVATE }), "service_unavailable"],
  ["HTML body", `<html>${PRIVATE}</html>`, "service_unavailable"],
  ["non-text body", { code: "verification_disabled" }, "service_unavailable"],
  ["oversized error", JSON.stringify({ code: "verification_disabled", padding: "x".repeat(4096) }), "service_unavailable"],
  ["UTF-8 byte bound", JSON.stringify({ code: "verification_disabled", padding: "é".repeat(2100) }), "service_unavailable"],
]) {
  test(`${label} is not misreported as paused`, async () => {
    fixture.http = async config => { assertProbeRequest(config); throw rejection(config, 503, body); };
    install(); await click();
    assert.equal(fixture.requests.length, 1);
    assert.equal(fixture.nodes["shared-result"].dataset.state, "fail");
    assert.ok(fixture.nodes["shared-result"].textContent.includes(`503 / ${code}`));
    assert.equal(fixture.nodes["shared-result"].textContent.includes("temporarily paused"), false);
  });
}

test("network rejection is distinct from a readable 503", async () => {
  fixture.http = async config => { assertProbeRequest(config); throw new AxiosError(PRIVATE, "ERR_NETWORK", config); };
  install(); await click();
  assert.equal(fixture.requests.length, 1);
  assert.ok(fixture.nodes["shared-result"].textContent.includes("no readable HTTP response"));
  assert.equal(fixture.nodes["shared-result"].textContent.includes("503"), false);
});

test("the real shared client's HTTP 401 retry occurs once, with the same invalid marker", async () => {
  fixture.http = async config => { assertProbeRequest(config); throw rejection(config, 401, '{"code":"authentication_required"}'); };
  install(); await click();
  assert.equal(fixture.requests.length, 2);
  assert.ok(fixture.nodes["shared-result"].textContent.includes("401 / authentication_required"));
});

test("an unexpected success never parses or reads receipt fields", async () => {
  let reads = 0;
  const body = new Proxy({}, { get() { reads++; throw new Error("Synthetic receipt fields must not be read."); } });
  fixture.http = async config => { assertProbeRequest(config); return response(config, body); };
  install(); await click();
  assert.equal(reads, 0);
  assert.equal(fixture.requests.length, 1);
  assert.ok(fixture.nodes["shared-result"].textContent.includes("unexpected HTTP 200"));
  assert.ok(fixture.nodes["shared-result"].textContent.includes("discarded without parsing"));
});

test("same-turn repeated clicks are single-flight", async () => {
  let finish;
  fixture.http = async config => { assertProbeRequest(config); await new Promise(resolve => { finish = resolve; }); throw rejection(config, 503, '{"code":"verification_disabled"}'); };
  install();
  const first = click(); const second = click(); await flush();
  assert.equal(fixture.requests.length, 1); assert.equal(fixture.nodes["shared-check"].disabled, true);
  finish(); await first; await second;
  assert.equal(fixture.requests.length, 1);
});

test("pagehide aborts the pending shared request, without a retry", async () => {
  fixture.http = pendingUntilAbort; install(); const running = click(); await flush();
  fixture.window.listeners.get("pagehide")(); await running;
  assert.equal(fixture.requests.length, 1); assert.equal(fixture.requests[0].signal.aborted, true);
  assert.ok(fixture.nodes["shared-result"].textContent.includes("cancelled"));
});

test("30-second watchdog aborts and restores the button", async () => {
  let timeout; let cleared = false;
  fixture.window.setTimeout = (callback, ms) => { assert.equal(ms, 30_000); timeout = callback; return 1; };
  fixture.window.clearTimeout = id => { assert.equal(id, 1); cleared = true; };
  fixture.http = pendingUntilAbort; install(); const running = click(); await flush(); timeout(); await running;
  assert.equal(fixture.requests.length, 1); assert.equal(fixture.requests[0].signal.aborted, true);
  assert.ok(fixture.nodes["shared-result"].textContent.includes("timed out after 30 seconds"));
  assert.equal(fixture.nodes["shared-check"].disabled, false); assert.equal(cleared, true);
});

test("diagnostic transforms do not affect unrelated Axios calls and are ejected", async t => {
  let requestEjections = 0; let responseEjections = 0;
  const ejectRequest = axios.interceptors.request.eject.bind(axios.interceptors.request);
  const ejectResponse = axios.interceptors.response.eject.bind(axios.interceptors.response);
  t.mock.method(axios.interceptors.request, "eject", id => { requestEjections++; ejectRequest(id); });
  t.mock.method(axios.interceptors.response, "eject", id => { responseEjections++; ejectResponse(id); });
  fixture.http = async config => config.url === ENDPOINT
    ? Promise.reject(rejection(config, 503, '{"code":"verification_disabled"}'))
    : response(config, '{"ordinary":true}');
  install(); await click();
  const ordinary = await axios.get("https://unrelated.example.test/health");
  assert.deepEqual(ordinary.data, { ordinary: true });
  assert.equal(requestEjections, 1); assert.equal(responseEjections, 1);
});

test("actual HTML bootstrap passes only public URL/mode settings to the real helper", async () => {
  let loads = 0;
  bootstrap(fixture.document, { DEV: true, VITE_ID_VERIFICATION_ENDPOINT: ENDPOINT, VITE_USE_MOCK: "false" }, async () => {
    loads++;
    return { installSharedClientCheck(value) { assert.deepEqual(value, { development: true, endpoint: ENDPOINT, apiBaseUrl: undefined, pageOrigin: "https://192.168.100.8:5173", useMock: false }); fixture.dispose = installSharedClientCheck(value); } };
  });
  await flush();
  assert.equal(loads, 1); assert.equal(fixture.requests.length, 0);
  assert.equal(fixture.nodes["shared-check"].disabled, false);
  fixture.http = async config => { assertProbeRequest(config); throw rejection(config, 503, '{"code":"verification_disabled"}'); };
  await click(); assert.equal(fixture.nodes["shared-result"].dataset.state, "pass");
});

test("HTML module-load failure is safe and sends nothing", async () => {
  bootstrap(fixture.document, { DEV: true }, async () => { throw new Error(PRIVATE); }); await flush();
  assert.equal(fixture.requests.length, 0); assert.equal(fixture.nodes["shared-check"].disabled, true);
  assert.ok(fixture.nodes["shared-result"].textContent.includes("helper could not load"));
});

test("production HTML does not load the shared module or send a request", async () => {
  let loads = 0;
  bootstrap(fixture.document, { DEV: false }, async () => { loads++; throw new Error(PRIVATE); }); await flush();
  assert.equal(loads, 0); assert.equal(fixture.requests.length, 0);
  assert.equal(fixture.nodes["shared-check"].disabled, true);
  assert.ok(fixture.nodes["shared-result"].textContent.includes("development-only"));
});
