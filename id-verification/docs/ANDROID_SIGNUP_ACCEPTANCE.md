# Phase 3: Android student signup acceptance

Checkpoint: **2026-11-19**. Android signup integration and offline regressions are implemented.
**No live Firebase → camera → OCR → receipt → registration run has been accepted.** Every live row
below is pending; synthetic tests and the accepted Phase-2 proof are distinct evidence, not substitutes.

Scope: Android only, camera only, front side only, no liveness/gallery/file fallback. Web/desktop
integration, iOS capture, Azure deployment, production migrations, and production signing/HMAC setup
are not included. Phase 1 remains committed as `db33d6c`; Phase-2/Phase-3 changes remain uncommitted.

## Implemented path

- `packages/api/src/auth/studentSignupFlow.ts`: shared, abortable, single-flight verification and
  immediate registration. A sensitive receipt belongs to a per-signup closure, never global state.
  Only an explicit registration-only retry may reuse it, while unexpired and with the exact unchanged
  draft. All other failure/invalidation paths require fresh verification.
- `apps/mobile/app/sign-up.tsx`: effect-owned controller; subscribes to account/draft invalidation and
  disposes on unmount. An existing normal session does not start signup. An owned signup survives
  session promotion until native cleanup finishes before navigation.
- `apps/mobile/components/{SignUpFlow,SignupConsent,StudentIdCapture}.tsx`: separate genuine notice
  acceptance, owned Firebase preparation/email verification, explicit printed-detail confirmation,
  user-operated camera permission/open/capture, safe cooldown/retake/retry UI, and lifecycle cleanup.
  Privacy and terms versions remain **2026-10-23**; reading/dismissing/Back does not accept either.
- `apps/mobile/lib/registration/` and `apps/mobile/contexts/AuthSessionContext.tsx`: projected profile/consent-only
  pending storage and an account-bound session gate. Registration derives the authoritative Firebase
  UID, submits a fresh allowlisted DTO, clears its receipt reference on abort/finally, and suppresses
  late cancelled session promotion. Firebase preparation/cleanup and profile-cache writes/removals
  are serialized; cleanup joins overlapping calls and checks ownership before deleting/signing out.
- `apps/mobile/lib/{mfaSession,mfaService}.ts` and `apps/mobile/components/MfaSecuritySection.tsx`: account/lifetime-
  bound MFA work, guarded serialized token writes/removals, revision-guarded reads/refreshes, and
  single-flight verification/setup. Settings requests use captured account headers; status after
  enrollment uses the newly issued token. Signup cancellation cannot erase unrelated account tokens.

Personal student emails, Firebase email verification, and faculty's `@pnm.edu.ph` policy are preserved.
Verification (including its single HTTP-401 retry) and registration use fresh Firebase ID tokens,
**not** MFA JWTs. Real failures/unconfigured live services never fall back to mock.

## Capture and sensitive-data boundaries

The integration reuses the [audited Phase-2 primitive and native encoder](ANDROID_CAPTURE_PROOF.md),
without changing the pinned camera/native encoder sources:

- `expo-camera@17.0.10`; `pictureRef: true`, `skipProcessing: false`, `exif: false`, `base64: false`.
  Native encoding takes `SharedRef<Bitmap>`, not a URI/file; ordinary capture/save APIs and
  capture-then-delete are forbidden.
- Portrait guide **720/1120**, default `FILL_CENTER`, no camera `ratio` prop. Requested stills are
  at most 6 MP; actual input is rechecked at 12 MP and 6000 pixels/edge. JPEG output is bounded to
  2 MiB, at most 1600 pixels/edge, and at least 450 pixels on the shorter side, without upscaling.
- The preview closes after encoding, but its cleanup owner remains alive for the consumer. Cancellation
  rejects promptly; native cleanup must settle before another still allocation, even after remount.
  The mutable JPEG envelope and owned request/response references are cleared on all exit paths.
- Capture/encoding has a 15-second watchdog. Only signup's post-encoding consumer gets 50 seconds
  around the shared controller's 45-second budget. The proof still has a total 15-second deadline.
- Screen protection must succeed before preview mount. App-state `change`, Android window `blur`/
  `focus`, route focus, permission loss, edits, sign-out/account switch, and unmount invalidate work.
  Returning focus/permission does not automatically reopen a camera or start verification.

Receipts are **signed, not encrypted**, RS256 JWTs with a **600-second TTL**. Never persist, decode,
log, analyze, copy into URLs, or expose them to UI/context, crash reporting, analytics, or payload
inspection. No captured image or OCR text may be persisted, even in a temporary file later deleted.

This is not a claim of cryptographic RAM erasure: immutable JS/JNI strings, SDK-owned bytes, camera-
driver buffers, and OS internals are outside controlled zeroization. Phase-2 zero-write evidence is a
scoped source/observer result, not a universal filesystem guarantee. Signup intentionally persists
allowlisted profile/consent fields, Firebase's normal auth session, and existing MFA credentials where
applicable; these are **not** permission to serialize a capture, OCR, or receipt. A whole-signup file
counter cannot distinguish approved session/profile writes from forbidden data. Any ambiguous interval
must remain pending until investigated without reading payload/file contents.

Aborting a client request does not guarantee the server did not already commit it. Suppression of a
late client result is not remote rollback evidence; reconcile uncertain registrations only against an
approved test API/database, using safe outcome/count checks and server idempotency.

## Recorded offline validation

Latest recorded checks on **2026-11-19**. JavaScript/TypeScript/lint/whitespace checks were repeated
after documentation updates; server and Phase-2 device entries retain their separately recorded evidence.

| Check | Result | Evidence boundary |
| --- | --- | --- |
| `pnpm test:signup` | **159 passed**: 59 shared, 39 mobile helper, 61 React runtime | Actual orchestration/TS/TSX with synthetic boundaries, not a live device/services run |
| `pnpm test:registration` | **62 passed** | Projection, receipt lifetime/binding, Firebase-only transport, and safe errors |
| `pnpm test:capture` | **50 passed** | Installed pinned-camera source guards and capture ownership/lifecycle regressions |
| `pnpm typecheck:all` | **Passed** | All shared packages and web/mobile/desktop apps |
| `pnpm lint` | **0 errors** | Only pre-existing warnings in desktop `src/types/electron.d.ts` and mobile `AnimatedSplashScreen.tsx` |
| `git diff --check` | **Passed** | Tracked changes have no whitespace errors; new-file whitespace is checked separately |
| Full `server/server.Tests` suite with both Python contract opt-ins | **73 passed, 0 skipped** | Real Python signer/main-API trust and ASP.NET registration with synthetic Firebase and SQLite `:memory:` |
| Phase-2 isolated native checks | **5 JVM + 8 instrumentation tests passed** | Previously recorded native buffer/JPEG/disposal/observer checks; not rerun as live signup |
| Phase-2 user-operated physical-camera matrix | **Passed on TECNO LJ8k / Android API 35** | Prior capture-only acceptance; no verification/registration request |

The React runtime uses pinned **development-only `react-test-renderer@19.1.0`** and actual production
TS/TSX for the provider, wizard, consent, capture UI, routes, MFA storage/refresh, and security settings.
Synthetic SDK/native/service boundaries use in-memory storage and network-blocking adapters; all
images/tokens/receipts are synthetic. Coverage includes delayed native/service responses, aborts,
permission/focus restoration, route ownership, pending-session promotion, Firebase preparation and
cleanup races, DTO wiping, duplicate MFA actions, and stale MFA/profile-storage writes/refreshes.

Repeat from the repository root:

```powershell
pnpm test:signup
pnpm test:registration
pnpm test:capture
pnpm typecheck:all
pnpm lint
git diff --check
```

Python receipt-contract opt-ins and their no-live-database limits are documented in
[the integration contract](INTEGRATION.md#local-regression-checks). None of these checks establishes
live Firebase authentication, physical OCR matching, Function reachability, or Azure readiness.

## Configuration and approval gate

Read-only development audits on **2026-11-19** reported only status flags, not credentials/payloads:

- Mobile explicitly selects live mode; its main-API base URL is configured, non-loopback, and plain HTTP.
- **`EXPO_PUBLIC_ID_VERIFICATION_ENDPOINT` is absent.** Live capture stays disabled/fails closed.
- Client Firebase fields are present and its project matches the Function. The main-API Admin
  credential's project also matches. Layered main-API `Firebase:ProjectId` is unset; this alone is not
  a confirmed Firebase authentication mismatch or proof of successful live authentication.
- The local Function is enabled and quota storage is configured for the emulator. Reachability was not
  established by these read-only checks.
- Existing development receipt issuer/audience/key ID/public trust match the local signer; lifetime
  and allowed-template policy match. No configuration, signing/HMAC key, or trust was replaced.
- The configured main-API database is **nonlocal**. No approved acceptance database target exists;
  do not infer authorization to create users, consume receipts, or migrate that database.

Development signing/HMAC material was surfaced by an earlier broad search of a gitignored settings
file. Treat it as exposed; its values must not be repeated. **Rotation/revocation needs separate explicit
approval**, including how to update development trust without silently breaking existing use.
Production must use separate material and the deployed issuer, never this exposed development setup.

Before live acceptance, obtain:

1. The approved **full verification endpoint**, main-API `/api/v1` base URL, and exact allowed
   non-production API/database target; agree on any local-only schema preparation separately.
2. Approval for the test Firebase account/project, test identity/card, verification/quota costs, expected
   registration writes, and any required cleanup. A blank Phase-2 proof card cannot establish successful
   OCR/registration. Do not paste personal identity details or credentials into acceptance reports.
3. A separate decision on exposed development-material rotation and authorization to use the resulting
   development trust. This is not approval to deploy or change production keys/databases.
4. The user's availability to operate camera permission and physical tests in the **isolated** package
   `com.monteskolar.mobile.captureproof`. Recheck the explicit ADB serial and APK package when approved;
   do not reset/replace `com.monteskolar.mobile`, grant permissions automatically, or assume an old
   wireless serial remains valid. The last recorded proof permission was denied; restoration is manual.

When live testing is approved, follow the
[existing isolated build instructions](ANDROID_CAPTURE_PROOF.md#local-checks-and-isolated-device-build).
Start/restart only an owned Metro process; do not edit/reload during a capture interval. The diagnostic
proof route and `/sign-up` remain separate; enabling the proof flag does not turn its prior evidence
into live signup acceptance.

## Pending user-operated live matrix

For every row, record only scenario/date, safe UI outcome, HTTP status/cooldown or request counts when
available without bodies/headers, and approved aggregate registration/write-observer counts. No
screenshots, screen recordings, hierarchy dumps containing personal details, OCR, image/base64,
Firebase/MFA tokens, receipts, or raw network/crash diagnostics. Do not ask the agent to capture a card.

Controlled failures/delays/401/quota/kill-switch rows require separately approved development-only
fault setup. Do not exhaust real quotas, alter production policy, or intercept sensitive traffic to
force them. If a row cannot be exercised safely, leave it pending instead of counting synthetic
coverage or a similar Phase-2 row as a live pass.

| Scenario | Expected live behavior | Status/evidence |
| --- | --- | --- |
| Genuine privacy and terms acceptance | Each requires its own action; reading/dismissal/Back and missing legacy consent do not accept | **Pending — not run** |
| Personal email and structured identity | Personal student email allowed; leading zeros and ordered given names retained; faculty policy unchanged | **Pending — not run** |
| Unverified Firebase account | Verification email/resend works; no camera, profile registration, or normal-session promotion | **Pending — not run** |
| Verified/restored pending signup | Reload/force-refresh owned Firebase account; still gated pending until receipt-bearing registration | **Pending — not run** |
| Printed-detail confirmation and permission | User explicitly confirms details, grants permission, and opens camera after screen protection | **Pending — not run** |
| Permission denied/restored | No capture/file fallback; restoring permission alone leaves preview closed | **Pending — not run** |
| Successful front capture → verification → registration | Bounded RAM JPEG, preview closes, live OCR matches, immediate receipt submission, cleanup before navigation | **Pending — not run** |
| Capture/encoding privacy interval | Approved scoped observation and source/boundary checks show no capture/OCR/receipt persistence; no payload inspection or universal-zero-write claim | **Pending — not run** |
| `retake` / `unmatched` | Safe message only, no OCR/scores; image discarded; explicit new capture/edit, no mock fallback | **Pending — not run** |
| Verification HTTP 401 | At most one fresh Firebase-token retry; never MFA-token substitution or mock fallback | **Pending — not run** |
| Verification offline/503 and 429 cooldown | Safe failure/cooldown; no automatic scan/retry, no retained capture | **Pending — not run** |
| Uncertain registration and explicit retry | Same valid receipt/exact draft, registration only, no second OCR; approved aggregate checks show no duplicate creation | **Pending — not run** |
| Receipt expiry while awaiting retry | After TTL, held verification is discarded and a fresh capture is required | **Pending — not run** |
| Identity/profile/consent edit after verification | Any change invalidates the receipt; reconfirmation and fresh verification required | **Pending — not run** |
| Cancel during native capture/encoding | Preview closes; late native work is disposed; no new still until cleanup settles | **Pending — not run** |
| Cancel during verification/registration | References cleared; no late client session/navigation; reconcile any server commit on approved test target | **Pending — not run** |
| Home/background and notification drawer | App-state/window blur invalidate; returning focus does not reopen or finish stale work | **Pending — not run** |
| Leave route/unmount then reopen | Cleanup ownership survives late work; new flow has no old receipt/capture or automatic camera opening | **Pending — not run** |
| Double tap/reopen while native work is late | Single-flight capture/verification/registration; no overlapping still allocation | **Pending — not run** |
| Sign-out/account switch/preparation cancellation | Only owned UID cleanup; no stale signup promotion, newer-account token/profile erasure, or unrelated-account deletion | **Pending — not run** |
| Normal-account MFA regression | Login verification/setup remain usable; stale reads/writes/refreshes cannot replace or erase newer credentials | **Pending — not run** |

Live sign-off remains **blocked/pending** until approved targets and the development-key decision are
provided, and the user supplies safe evidence for the required rows. No live signup, Azure deployment,
production migration, normal-app reset, permission grant, or signing-key replacement occurred at this
checkpoint.
