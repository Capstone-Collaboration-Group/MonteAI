// Dev-page only: import the actual verification transport, not the API barrel
// (which would also load Firebase/auth services). No app/session is initialized.
import axios from "axios";
import type { StudentIdVerificationRequest } from "@monteai/types";
import { LiveIdVerificationService, sanitizeIdVerificationError } from "../../packages/api/src/id-verification/liveIdVerificationService";
import { IdVerificationError } from "../../packages/api/src/id-verification/types";

const APPROVED_ENDPOINT = "https://monteai-id-verifier.azurewebsites.net/api/v1/id-verification";
const INVALID_TOKEN = "idv-connection-check-not-a-real-token";
const TIMEOUT_MS = 30_000;

export interface SharedClientCheckSettings {
  development: boolean;
  endpoint?: string;
  apiBaseUrl?: string;
  /** Public origin of the page hosting this diagnostic (already shown in section 1). */
  pageOrigin?: string;
  useMock: boolean;
}

// Accepts only an absolute http(s) base with no credentials, query, or fragment —
// the same rule the app's own live-config check uses.
function parseHttpUrl(value: string | undefined): URL | undefined {
  if (!value?.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    if (url.username || url.password || url.search || url.hash) return undefined;
    return url;
  } catch { return undefined; }
}

// Reachability notes use only public structural facts (scheme, host, port,
// page origin). The configured path, query, and credentials are never included.
function describeApiReachability(url: URL, pageOrigin: string | undefined): string {
  const notes: string[] = [];
  let page: URL | undefined;
  if (pageOrigin) {
    try { page = new URL(pageOrigin); } catch { page = undefined; }
  }
  if (page?.protocol === "https:" && url.protocol === "http:") {
    notes.push("mixed content: an HTTPS page cannot call an HTTP API");
  }
  const loopback = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  if (loopback) notes.push("loopback: reachable only from the machine running the API, not from other devices");
  if (page && page.origin !== url.origin) {
    notes.push("cross-origin: the API's CORS allowlist must include this page's origin");
  }
  return notes.join("; ");
}

// Describe only structural differences. Never echo the configured value: it is
// private user input and could contain credentials, query secrets, or a path token.
function describeEndpointMismatch(raw: string): string {
  const details: string[] = [];
  let candidate = raw.trim();
  if (!candidate) return "empty value";
  if (candidate.endsWith("/")) {
    details.push("trailing slash");
    candidate = candidate.replace(/\/+$/, "");
  }
  if (candidate === APPROVED_ENDPOINT) return details.join("; ");
  let parsed: URL;
  try { parsed = new URL(candidate); }
  catch { return [...details, "not an absolute http(s) URL"].join("; "); }
  const approved = new URL(APPROVED_ENDPOINT);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") details.push("scheme is not http(s)");
  if (parsed.protocol !== approved.protocol) details.push(`scheme "${parsed.protocol}" (expected "${approved.protocol}")`);
  if (parsed.username || parsed.password) details.push("embedded credentials");
  if (parsed.host !== approved.host) details.push("host differs");
  if (parsed.port) details.push(`port ${parsed.port} present`);
  if (parsed.pathname !== approved.pathname) details.push("path differs");
  if (parsed.search) details.push("query string present");
  if (parsed.hash) details.push("fragment present");
  if (details.length === 0) details.push("same URL parts but different characters (casing or an invisible character)");
  return details.join("; ");
}

// XHR returns text. Drop every non-error body before parsing/receipt validation;
// for errors, retain only a bounded code passed through the shared sanitizer.
function errorCodeOnly(body: unknown, _headers: unknown, status?: number) {
  if (!status || status < 400 || typeof body !== "string" || body.length > 4096 ||
    new TextEncoder().encode(body).byteLength > 4096) return undefined;
  try {
    const code: unknown = JSON.parse(body)?.code;
    if (typeof code !== "string") return undefined;
    const safe = sanitizeIdVerificationError(new IdVerificationError({ code, message: "", status }));
    return { code: safe.code };
  } catch { return undefined; }
}

/** Settings are passed by Vite's dev HTML; this module never reads an env file. */
export function installSharedClientCheck(settings: SharedClientCheckSettings): () => void {
  const button = document.getElementById("shared-check") as HTMLButtonElement | null;
  const result = document.getElementById("shared-result");
  const endpointStatus = document.getElementById("shared-endpoint-status");
  const apiStatus = document.getElementById("shared-api-status");
  const mode = document.getElementById("shared-mode");
  if (!button || !result || !endpointStatus || !apiStatus || !mode) throw new Error("Diagnostic elements are missing.");

  const rawEndpoint = settings.endpoint;
  const endpoint = rawEndpoint?.trim();
  const mismatch = endpoint && endpoint !== APPROVED_ENDPOINT ? describeEndpointMismatch(rawEndpoint ?? "") : undefined;
  const apiUrl = parseHttpUrl(settings.apiBaseUrl);
  const apiReach = apiUrl ? describeApiReachability(apiUrl, settings.pageOrigin) : "";
  const apiNote = !apiUrl
    ? "\nNormal live signup remains disabled: the main API URL is missing/invalid."
    : apiReach ? `\nMain API origin: ${apiUrl.origin} — ${apiReach}.` : "";
  let disposed = false;
  let activeController: AbortController | undefined;
  const show = (message: string, state: "pass" | "fail" | "checking" | "ready") => {
    if (disposed) return;
    result.textContent = message;
    result.dataset.state = state;
  };

  button.disabled = true;
  // Never echo arbitrary configured URLs: they could contain private values.
  endpointStatus.textContent = endpoint === APPROVED_ENDPOINT
    // Trimming matches how the app itself reads this setting, but stray
    // whitespace is still worth surfacing so the private file can be cleaned.
    ? rawEndpoint && rawEndpoint !== endpoint ? "Matches the approved Azure verifier (stray whitespace in the setting)"
      : "Matches the approved Azure verifier"
    : !endpoint ? "Missing"
      : `Different or invalid URL (${mismatch}) — no request allowed`;
  // Origin only (scheme://host:port): enough to spot loopback/plain-HTTP/LAN
  // problems without displaying the private path, query, or credentials.
  apiStatus.textContent = apiUrl
    ? `Origin ${apiUrl.origin} (not contacted)${apiReach ? ` — ${apiReach}` : ""}`
    : "Missing/invalid — normal live signup stays disabled";
  mode.textContent = settings.useMock ? "Mock mode" : "Live mode";
  if (!settings.development || settings.useMock || endpoint !== APPROVED_ENDPOINT) {
    show(!settings.development ? "FAIL — this check is development-only. No request sent."
      : settings.useMock ? "FAIL — mock mode is enabled. No live request sent."
        : `FAIL — VITE_ID_VERIFICATION_ENDPOINT is missing or is not the approved Azure endpoint.${mismatch ? ` Mismatch: ${mismatch}.` : ""} Expected exactly: ${APPROVED_ENDPOINT}. Fix the setting privately and restart Vite. No request sent.`, "fail");
    return () => { disposed = true; };
  }

  button.disabled = false;
  show("Ready. Press Check shared client. Firebase and the main API will not be used.", "ready");

  async function check() {
    if (disposed || activeController) return;
    const controller = new AbortController();
    activeController = controller;
    button!.disabled = true;
    let timedOut = false;
    const timer = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, TIMEOUT_MS);

    // Scoped to this empty, fake-token probe only. Leave the shared service and
    // its default browser adapter/401 retry unchanged; eject both on completion.
    const requestInterceptor = axios.interceptors.request.use(config => {
      if (config.signal !== controller.signal) return config;
      config.withCredentials = false;
      config.withXSRFToken = false;
      config.responseType = "text";
      config.transformResponse = [errorCodeOnly];
      return config;
    });
    const responseInterceptor = axios.interceptors.response.use(response => {
      if (response.config.signal !== controller.signal) return response;
      response.data = undefined;
      // A success is never passed to the shared service's receipt validation.
      throw new IdVerificationError({ code: "service_unavailable", message: "", status: response.status });
    });
    show("Checking configured URL → shared Axios client → paused Azure verifier…", "checking");

    try {
      const service = new LiveIdVerificationService({
        endpoint,
        timeoutMs: TIMEOUT_MS,
        getFreshFirebaseIdToken: async () => INVALID_TOKEN,
      });
      // Deliberately incomplete: exactly {}, never a photo or student details.
      await service.verifyStudentId(Object.freeze({}) as StudentIdVerificationRequest, { signal: controller.signal });
      show("FAIL — unexpected shared-client completion. No result was displayed or registered.", "fail");
    } catch (error) {
      const safe = sanitizeIdVerificationError(error);
      if (timedOut) {
        show("FAIL — shared-client check timed out after 30 seconds. No readable HTTP response was accepted.", "fail");
      } else if (safe.code === "cancelled") {
        show("FAIL — shared-client check cancelled. No result was accepted.", "fail");
      } else if (safe.status === 503 && safe.code === "verification_disabled") {
        show(`PASS — shared Axios client read HTTP 503 / verification_disabled.\nShared signup message: ${safe.message}\nNo photo, Firebase session, or registration was used.${apiNote}`, "pass");
      } else if (safe.status !== undefined && safe.status < 400) {
        show(`FAIL — unexpected HTTP ${safe.status}. Expected the paused 503 response. Successful body was discarded without parsing.`, "fail");
      } else if (safe.status !== undefined) {
        show(`FAIL — shared Axios client read HTTP ${safe.status} / ${safe.code}.\n${safe.message}\nThis is not the expected paused contract. No photo was sent.`, "fail");
      } else {
        show("FAIL — shared Axios client has no readable HTTP response. Possible CORS, network, DNS, or TLS failure. Firebase was not used.", "fail");
      }
    } finally {
      window.clearTimeout(timer);
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
      activeController = undefined;
      if (!disposed) button!.disabled = false;
    }
  }

  const abort = () => activeController?.abort();
  button.addEventListener("click", check);
  window.addEventListener("pagehide", abort);
  return () => {
    disposed = true;
    button.disabled = true;
    abort();
    button.removeEventListener("click", check);
    window.removeEventListener("pagehide", abort);
  };
}
