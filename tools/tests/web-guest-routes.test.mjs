// Offline React/router regressions. Firebase, browser history, and HTTP are
// synthetic; the App routes, guest guard, and login/MFA components are real.
import "./support/web-runtime-loader.mjs";
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

const React = (await import("react")).default;
const { act } = (await import("react-test-renderer")).default;
const { default: axios, AxiosError } = await import("axios");
const { runtime, firebaseAuth, setUser, MFA_KEY, SYNTHETIC_MFA_TOKEN } =
  await import("./support/web-runtime-mocks.mjs");
const { button, change, check, cleanup, click, deferred, flush, hasText, mount, submit } =
  await import("./support/web-runtime-helpers.mjs");

axios.defaults.adapter = async config => {
  if (runtime.http) return runtime.http(config);
  runtime.unexpectedRequests++;
  throw new Error("Unexpected synthetic guest-route HTTP request.");
};
globalThis.fetch = async () => {
  runtime.unexpectedRequests++;
  throw new Error("Unexpected synthetic guest-route fetch.");
};

const { AuthProvider, QueryClientProvider, queryClient, MfaFlowProvider,
  MfaFlowContext, MfaLoginFlowGate } = await import("@monteai/hooks");
const { BrowserRouter, Routes, Route, useNavigate, useNavigationType } = await import("react-router-dom");
const { GuestRoute } = await import("../../packages/ui/src/components/auth/GuestRoute.tsx");
const { ProtectedRoute } = await import("../../packages/ui/src/components/auth/ProtectedRoute.tsx");
const { LoginForm } = await import("../../packages/ui/src/components/auth/LoginForm.tsx");
const { clearPendingRegistration, savePendingRegistration } =
  await import("../../packages/ui/src/components/auth/pendingRegistration.ts");
const { setTokenProvider } = await import("../../apps/web/src/lib/apiClient.ts");
const { default: App } = await import("../../apps/web/src/App.tsx");
const defaults = queryClient.getDefaultOptions();
queryClient.setDefaultOptions({ ...defaults, queries: { ...defaults.queries, retry: false, gcTime: Infinity } });

function profile(user = firebaseAuth.currentUser) { return { id: user.uid, role: "Student" }; }
function cachedSession() {
  const user = runtime.user();
  setUser(user);
  queryClient.setQueryData(["userProfile", user.uid], profile(user));
  return user;
}
function pendingSignup() {
  savePendingRegistration({ uid: "synthetic-web-uid", createdAt: Date.now(), payload: {
    id: "synthetic-web-uid", role: "Student", email: "personal@example.com",
    firstName: "Maria", lastName: "Cruz", studentNumber: "00-00123", position: "Member",
    institute: "Institute of Computing Studies", program: "BS Computer Science", yearLevel: 1, section: "A",
    privacyNoticeAccepted: true, privacyNoticeVersion: "2026-10-23",
    termsAccepted: true, termsVersion: "2026-10-23",
  } });
}
function response(config, data) { return { config, data, status: 200, headers: {}, statusText: "Synthetic" }; }

beforeEach(t => {
  runtime.reset(); clearPendingRegistration(); queryClient.clear(); setTokenProvider(null);
  t.mock.method(console, "error", (...args) => {
    if (typeof args[0] === "string" && args[0].startsWith("react-test-renderer is deprecated")) return;
    runtime.unexpectedDiagnostics++;
  });
});
afterEach(async () => {
  await cleanup(); queryClient.clear(); setTokenProvider(null);
  assert.equal(runtime.unexpectedRequests, 0, "No real HTTP request is permitted.");
  assert.equal(runtime.unexpectedDiagnostics, 0, "No unexpected React diagnostic is permitted.");
  assert.equal(runtime.authListenerCount, 0);
  assert.equal(runtime.window.listenerCount + runtime.document.listenerCount, 0);
});

for (const path of ["/", "/login", "/register"]) {
  test(`signed-out users can still visit ${path}`, async () => {
    runtime.route = path;
    const renderer = await mount(React.createElement(App));
    assert.equal(runtime.currentPath, path);
    if (path === "/register") assert.ok(hasText(renderer, "Create account"));
  });
  test(`completed sessions redirect ${path} to /home without mounting guest content`, async () => {
    cachedSession(); runtime.route = path;
    const renderer = await mount(React.createElement(App));
    assert.equal(runtime.currentPath, "/home");
    assert.ok(hasText(renderer, "Home"));
    assert.equal(renderer.root.findAllByType("form").length, 0);
    assert.equal(renderer.root.findAllByProps({ "data-test-page": "LandingPage" }).length, 0);
    assert.equal(renderer.root.findAllByProps({ "data-test-page": "Login" }).length, 0);
  });
  test(`pending signup can visit ${path} even with a cached application profile`, async () => {
    cachedSession(); pendingSignup(); runtime.route = path;
    const renderer = await mount(React.createElement(App));
    assert.equal(runtime.currentPath, path);
    if (path === "/register") assert.ok(hasText(renderer, "Verify your student ID"));
    assert.equal(runtime.mediaRequests, 0);
  });
}

for (const path of ["/about", "/tutorial", "/download-app"]) {
  test(`informational page ${path} remains public for completed sessions`, async () => {
    cachedSession(); runtime.route = path;
    await mount(React.createElement(App));
    assert.equal(runtime.currentPath, path);
  });
}

test("a restored session waits for its profile before showing landing or redirecting", async () => {
  setUser(runtime.user()); runtime.route = "/";
  const wait = deferred();
  runtime.http = async config => {
    assert.equal(config.url, "Auth/me");
    runtime.profileChecks++;
    await wait.promise;
    return response(config, profile());
  };
  const renderer = await mount(React.createElement(App));
  assert.equal(runtime.currentPath, "/");
  assert.ok(hasText(renderer, "Loading..."));
  assert.equal(runtime.unrelatedMounts, 0);
  await act(async () => wait.finish());
  // The profile query resolves asynchronously; wait (bounded) for the
  // GuestRoute redirect to /home to be committed before asserting.
  for (let attempt = 0; attempt < 25 && runtime.currentPath !== "/home"; attempt++) {
    await flush();
  }
  assert.equal(runtime.currentPath, "/home");
  assert.equal(runtime.profileChecks, 1);
});

for (const status of [401, 403, 404, 500]) {
  test(`profile lookup ${status} does not redirect into a protected-route loop`, async () => {
    setUser(runtime.user()); runtime.route = "/login";
    runtime.http = async config => {
      assert.equal(config.url, "Auth/me");
      runtime.profileChecks++;
      throw new AxiosError("Synthetic profile failure", "SYNTHETIC", config, {},
        { ...response(config, {}), status });
    };
    await mount(React.createElement(App)); await flush();
    assert.equal(runtime.currentPath, "/login");
    assert.equal(runtime.profileChecks, 1);
  });
}

test("restored MFA tokens stay intact when landing redirects to home", async () => {
  cachedSession(); runtime.route = "/";
  const tokens = JSON.stringify({ accessToken: SYNTHETIC_MFA_TOKEN, refreshToken: "synthetic-refresh",
    expiresAt: new Date(Date.now() + 600_000).toISOString() });
  runtime.store.set(MFA_KEY, tokens);
  await mount(React.createElement(App));
  assert.equal(runtime.currentPath, "/home");
  assert.equal(runtime.store.get(MFA_KEY), tokens);
});

test("new Firebase account creation does not unmount the active registration form", async () => {
  runtime.route = "/register";
  queryClient.setQueryData(["userProfile", "synthetic-web-uid"], { id: "synthetic-web-uid", role: "Student" });
  const renderer = await mount(React.createElement(App));
  for (const [name, value] of Object.entries({ firstName: "Maria", lastName: "Cruz", email: "personal@example.com",
    studentNumber: "00-00123", institute: "Institute of Computing Studies", program: "BS Computer Science",
    section: "A", password: "synthetic-password", confirmPassword: "synthetic-password" })) {
    await change(renderer, name, value);
  }
  for (const label of ["I agree to the privacy notice", "I agree to the terms and conditions"]) {
    await check(renderer, label); await click(renderer, "I have read and agree");
  }
  await submit(renderer);
  assert.equal(runtime.currentPath, "/register");
  assert.ok(hasText(renderer, "Verify your email"));
  assert.equal(runtime.createCalls, 1);
});

const testProfileService = {
  async getCurrentProfile() { runtime.profileChecks++; return profile(); },
};
const mfaResult = { accessToken: SYNTHETIC_MFA_TOKEN, refreshToken: "synthetic-refresh",
  expiresAt: "2099-01-01T00:00:00Z" };
function TestLogin({ challenge }) {
  const navigate = useNavigate();
  return React.createElement(React.Fragment, null,
    React.createElement(MfaLoginFlowGate, { verifyMfa: async () => mfaResult }, ({ verify, onCancel }) =>
      React.createElement(React.Fragment, null,
        React.createElement("button", { onClick: async () => { await verify("123456"); navigate("/home"); } }, "Verify second factor"),
        React.createElement("button", { onClick: onCancel }, "Cancel second factor"))),
    React.createElement(LoginForm, { auth: firebaseAuth, mfa: { challenge,
      onCancel: () => setUser(null) }, onSuccess: () => navigate("/home") }));
}
function TestHome() {
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  return React.createElement("div", null, `Home ${navigationType}`,
    React.createElement("button", { onClick: () => navigate("/") }, "Visit landing"),
    React.createElement("button", { onClick: () => navigate(-1) }, "Back"));
}
function loginHarness(challenge, flow = null) {
  runtime.route = "/login";
  const routes = React.createElement(BrowserRouter, null, React.createElement(Routes, null,
    React.createElement(Route, { element: React.createElement(GuestRoute, { profileService: testProfileService }) },
      React.createElement(Route, { path: "/", element: React.createElement("p", null, "Landing") }),
      React.createElement(Route, { path: "/login", element: React.createElement(TestLogin, { challenge }) })),
    React.createElement(Route, { element: React.createElement(ProtectedRoute, { profileService: testProfileService }) },
      React.createElement(Route, { path: "/home", element: React.createElement(TestHome) }))));
  return React.createElement(QueryClientProvider, { client: queryClient },
    React.createElement(AuthProvider, { auth: firebaseAuth }, flow
      ? React.createElement(MfaFlowContext.Provider, { value: flow }, routes)
      : React.createElement(MfaFlowProvider, { onComplete: () => { runtime.successes++; } }, routes)));
}
async function logIn(renderer) {
  await change(renderer, "email", "personal@example.com");
  await change(renderer, "password", "synthetic-password");
  await submit(renderer);
}

test("Firebase sign-in does not interrupt the challenge request or pending MFA code step", async () => {
  queryClient.setQueryData(["userProfile", "synthetic-web-uid"], { id: "synthetic-web-uid", role: "Student" });
  const wait = deferred({ mfaRequired: true, pendingToken: "synthetic-pending-token" });
  const renderer = await mount(loginHarness(() => wait.promise));
  await logIn(renderer);
  assert.equal(runtime.currentPath, "/login");
  assert.equal(button(renderer, "Signing in...").props.disabled, true);
  assert.equal(runtime.profileChecks, 0);
  await act(async () => wait.finish()); await flush();
  assert.ok(hasText(renderer, "Verify second factor"));
  assert.equal(runtime.currentPath, "/login");
  await click(renderer, "Verify second factor");
  assert.equal(runtime.successes, 1);
  assert.equal(runtime.currentPath, "/home");
});

test("entering login with pending MFA does not redirect despite a cached profile", async () => {
  cachedSession();
  const renderer = await mount(loginHarness(async () => ({ mfaRequired: false }), {
    pending: { idToken: "synthetic-id-token", pendingToken: "synthetic-pending-token" },
    setPending() {}, onComplete() {},
  }));
  assert.equal(runtime.currentPath, "/login");
  assert.ok(hasText(renderer, "Verify second factor"));
  assert.equal(runtime.profileChecks, 0);
});

test("cancelling MFA returns to the login form instead of redirecting a cached session", async () => {
  queryClient.setQueryData(["userProfile", "synthetic-web-uid"], { id: "synthetic-web-uid", role: "Student" });
  const renderer = await mount(loginHarness(async () => ({ mfaRequired: true, pendingToken: "synthetic-pending-token" })));
  await logIn(renderer);
  await click(renderer, "Cancel second factor");
  assert.equal(firebaseAuth.currentUser, null);
  assert.equal(runtime.currentPath, "/login");
  assert.equal(button(renderer, "Login").props.disabled, false);
  assert.equal(runtime.successes, 0);
});

test("non-MFA login completes and revisiting landing or going Back redirects with replace", async () => {
  queryClient.setQueryData(["userProfile", "synthetic-web-uid"], { id: "synthetic-web-uid", role: "Student" });
  const renderer = await mount(loginHarness(async () => ({ mfaRequired: false })));
  await logIn(renderer); await flush();
  assert.equal(runtime.currentPath, "/home");
  await click(renderer, "Back");
  assert.equal(runtime.currentPath, "/home");
  assert.ok(hasText(renderer, "Home REPLACE"));
  await click(renderer, "Visit landing");
  assert.equal(runtime.currentPath, "/home");
  assert.ok(hasText(renderer, "Home REPLACE"));
});

test("an unverified Firebase sign-in stays on the email-verification form", async () => {
  runtime.passwordSignIn = async email => {
    const user = runtime.user({ email, emailVerified: false }); setUser(user); return user;
  };
  const renderer = await mount(loginHarness(async () => ({ mfaRequired: false })));
  await logIn(renderer);
  assert.equal(runtime.currentPath, "/login");
  assert.ok(hasText(renderer, "Verify your email"));
  assert.equal(runtime.profileChecks, 0);
});
