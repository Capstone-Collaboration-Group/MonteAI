# Phase 3: Android student signup acceptance

Checkpoint: **2026-11-22**. Android signup integration, offline regressions, and the approved isolated
local service setup are implemented. The reconnected device and restarted services passed preflight;
the user then reported successful manual front-ID capture and registration. Guarded local counts rose
from **0 to 1 student** and **0 to 1 receipt consumption**.
**The first live happy path passed with user-reported UI and aggregate-count evidence. Full live
acceptance remains pending.** Other rows require separate evidence; synthetic tests and the accepted
Phase-2 proof are distinct evidence, not substitutes.
A later bulk **ALL PASSED** report also identified permission, cancellation-control, and first-preview
issues. Camera-closed follow-up fixes pass offline checks, and the user now reports **All is working
now** and asks to move on. The UI issues are recorded as user-confirmed resolved; further device tests
are stopped at the user's request. This does not pass separately unevidenced fault/privacy scenarios.

Scope: Android only, camera only, front side only, no liveness/gallery/file fallback. Web/desktop
integration, iOS capture, Azure deployment, production migrations, and production signing/HMAC setup
are not included. Phase 1 is committed as `db33d6c`; Phase-2/Phase-3 implementation is committed as
`0c7fa1a`. The follow-up code/test fixes, current live-testing setup, and documentation remain uncommitted.

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
  A separate 15-second preview-start deadline allocates no still; timeout closes the preview and
  requires an explicit reopen. Bounded `pictureSize` updates keep one native view and a stable ref;
  capture waits for the current configuration's ready callback and a nonzero guide layout.
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

JavaScript/TypeScript/lint checks were repeated on **2026-11-22**, including the final native-watchdog
cleanup regression and Settings/retry guards. Whitespace and local documentation links were checked
after the acceptance-note updates. Server and Phase-2 native/device entries retain their separately
recorded evidence; those suites/device tests were not rerun for this UI follow-up.

| Check | Result | Evidence boundary |
| --- | --- | --- |
| `pnpm test:signup` | **191 passed, 0 skipped**: 59 shared, 39 mobile helper, 93 React runtime | Actual orchestration/TS/TSX with synthetic boundaries, not a live device/services run |
| `pnpm test:registration` | **62 passed** | Projection, receipt lifetime/binding, Firebase-only transport, and safe errors |
| `pnpm test:capture` | **50 passed** | Installed pinned-camera source guards and capture ownership/lifecycle regressions |
| `pnpm typecheck:all` | **Passed** | All shared packages and web/mobile/desktop apps |
| `pnpm lint` | **0 errors** | Only pre-existing warnings in desktop `src/types/electron.d.ts` and mobile `AnimatedSplashScreen.tsx` |
| `git diff --check` | **Passed** | All seven modified tracked files; no new tracked/untracked files |
| Local documentation links | **12 passed** | Relative targets and heading fragments across the four modified Markdown files |
| Full `server/server.Tests` suite with both Python contract opt-ins | **73 passed, 0 skipped** | Real Python signer/main-API trust and ASP.NET registration with synthetic Firebase and SQLite `:memory:` |
| Phase-2 isolated native checks | **5 JVM + 8 instrumentation tests passed** | Previously recorded native buffer/JPEG/disposal/observer checks; not rerun as live signup |
| Phase-2 user-operated physical-camera matrix | **Passed on TECNO LJ8k / Android API 35** | Prior capture-only acceptance; no verification/registration request |

The React runtime uses pinned **development-only `react-test-renderer@19.1.0`** and actual production
TS/TSX for the provider, wizard, consent, capture UI, routes, MFA storage/refresh, and security settings.
Synthetic SDK/native/service boundaries use in-memory storage and network-blocking adapters; all
images/tokens/receipts are synthetic. The permission mock models Expo's cached hook: only getter/request
results refresh it, not an ordinary render or a changed OS fixture. Camera-instance identity is modeled
to detect size-triggered remounts. Coverage includes requestable/permanent prompt denial, manual Settings
and permission checks, stale/serialized permission work, preview-start timeout, duplicate size queries,
ready/layout gating, state-specific cancellation, and admission through late native-watchdog cleanup.
Existing coverage retains delayed native/service responses, route ownership, pending-session promotion,
Firebase preparation/cleanup races, DTO wiping, duplicate MFA actions, and stale MFA/profile writes/refreshes.
These mocks cannot establish physical preview pixels, real Android prompt behavior, or live privacy.

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

Historical read-only development audits on **2026-11-19** reported only status flags, not credentials/payloads:

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
file; its values must not be repeated. On **2026-11-21**, the user separately approved development-only
rotation and matching local API public-trust replacement. That rotation is complete, with the old active
public trust removed. Production must use separate material and its deployed issuer; no production or
Android signing material was changed.

Approval checklist (satisfied only for the isolated local setup below, not other targets/accounts):

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
   wireless serial remains valid. The Phase-2 proof ended with permission denied; the 2026-11-22
   preflight below records restored permission without an automated grant.

When live testing is approved, follow the
[existing isolated build instructions](ANDROID_CAPTURE_PROOF.md#local-checks-and-isolated-device-build).
Start/restart only an owned Metro process; do not edit/reload during a capture interval. The diagnostic
proof route and `/sign-up` remain separate; enabling the proof flag does not turn its prior evidence
into live signup acceptance.

### Approved local live setup (2026-11-21)

The user explicitly approved local service preparation, creation/migrations and test registration writes
in **`MonteAI_RegistrationDev`**, development ID-verification key rotation, and one manually created
dedicated test signup in the already configured Firebase project. No software installation, Azure
deployment, nonlocal database write, production-key change, or normal-app/session reset is authorized.

- Secret-safe rotation updated only the active Function key ID/private signing key/HMAC, matching
  generator files, and corresponding development API public trust. Unrelated settings, including the
  existing nonlocal database connection, were preserved. Restricted backups and isolated configuration
  live under the user-only-ACL directory
  `C:\Users\CBB\AppData\Local\Temp\opencode\monteai-phase3-live-20261121`; never expose its secret files
  through raw reads/logs or commit them. Android keystore hashes were unchanged across rotation.
- All **3 Python/API receipt-contract tests passed, 0 skipped** after rotation, including the local
  signer/public-trust check. Authentication is synthetic and storage is SQLite `:memory:` in these tests;
  this is not live Firebase/OCR evidence. Isolated Function/API trust was independently checked using
  status flags only; the receipt lifetime remains **600 seconds**.
- The API built successfully. Existing `dotnet-ef` **10.0.9** successfully discovered the server's
  **EF 8.0.11** migrations without connecting, so no tool installation/replacement was needed.
- Local-machine/default-instance and exact database-name guards preceded database writes. A fresh
  migration run stopped at `RemoveExperimentalColumns`, which drops 12 role-table columns never added
  by the preceding history. Only the new, empty acceptance database received 12 empty nullable
  compatibility columns; the unchanged migration then removed them. All **20 migrations** are applied,
  and none of those obsolete columns remains. Repository migrations were not edited or skipped.
- Safe baseline counts, rechecked on **2026-11-22**: **0 students, 0 receipt consumptions**. Only aggregate
  counts may be queried after a manual registration; do not select profile, fingerprint, JTI, OCR, or receipt data.
- Owned services were checked as ready on **2026-11-21** and again after restart on **2026-11-22**,
  with every listed listener bound to **`127.0.0.1`** and owned by the recorded process tree:

  | Service | Local address / readiness evidence |
  | --- | --- |
  | Verification Function | `http://127.0.0.1:7073/api/v1/id-verification`; body-free `OPTIONS` → **204** |
  | Main API | `http://127.0.0.1:5086/api/v1`; unauthenticated `/auth/me` → **401** |
  | Metro | `http://127.0.0.1:8081`; `/status` → **200** |
  | Isolated Azurite | Ports **10000 / 10001 / 10002**; owned listener checks and dedicated quota-table creation |

- The acceptance API has **no Serilog sinks**, SMTP disabled, and scheduled backups disabled. Function
  file/console/user logging and instrumentation are disabled; runtime outputs are discarded, not saved
  for later inspection. Azurite is memory-only with access logging and telemetry disabled. Its dedicated
  local quota table retains the existing quota policy, not a relaxed test policy.
- Owned Metro uses process-only `EXPO_PUBLIC_USE_MOCK=false` and the two loopback endpoints above;
  `.env.local` is unchanged. CI mode prevents automatic refresh; an acceptance-only launcher binds its
  server to loopback (Expo's advertised `--localhost` alone is not a listener-binding guarantee).
  No JS inspector, raw network capture, Android logcat, or sensitive UI diagnostics are attached.
- Initial ADB serial **`192.168.100.9:41925`** was rechecked for the TECNO LJ8k on 2026-11-21. Only new
  reverse mappings for **8081 / 7073 / 5086** were added. The installed isolated package
  **`com.monteskolar.mobile.captureproof`** is reused; the normal package is not replaced or reset.
  Camera permission restoration, credentials, consent, email verification, and physical capture remain
  user-operated. Restoring permission must not automatically open the camera.

**Do not start the default development API for this test.** Its unchanged database configuration is
nonlocal; the approved local connection and logging restrictions belong to the acceptance process.
Stop only recorded owned processes after checking their executable/creation identity, and remove only
the exact ADB mappings created for this setup. Do not delete test Firebase accounts or database rows
without separate cleanup approval.

The service preflight established readiness and a safe local baseline, **not** a successful live signup
by itself. No live capture/OCR/registration request or Firebase test-account creation was performed by
the agent. The subsequent manual result is recorded below; readiness `OPTIONS`/unauthenticated 401
checks do not count as verified-token retry, quota, or OCR acceptance.

**Prior handoff (2026-11-21):** the isolated app was started without clearing its data, but the activity
launch wait timed out. This alone was not crash evidence; signup rendering was unconfirmed at that time.
Its process was running on a metadata-only check, and app-details settings opened for the isolated
package without granting permission. The wireless transport subsequently went offline. On the next
preflight, all four acceptance services were stopped and the current device had no reverse mappings.

**Reconnected preflight (2026-11-22):** both current ADB transports were checked as aliases of the same
TECNO LJ8k. The preferred explicit serial is **`192.168.100.9:43779`**; the old serial above is stale.
A metadata-only package check reports **camera permission granted**, without any agent permission
grant. A static copy of the isolated APK confirmed its package and native Metro port **8081**; no
app data or sensitive UI was inspected.

All four owned services were restarted after archiving stale process-ownership records; no unrelated
process was stopped. Memory-only Azurite's dedicated quota table was recreated without changing quota
policy. Rotated Function/API trust, the unchanged Firebase project, disabled logging, and process-only
live loopback client configuration were rechecked using status flags only. All **six acceptance
listeners** are loopback-only and belong to the owned process trees. Body-free readiness remains
Function `OPTIONS` **204**, unauthenticated API **401**, and Metro **200**. Only missing reverse mappings
for **8081 / 7073 / 5086** were added on the current serial; unrelated mappings were preserved and the
ownership record was refreshed. At preflight, guarded counts were **20 migrations / 0 students /
0 receipt consumptions**.

The user must confirm the camera is closed before any isolated-app launch/reload, then confirm that
`/sign-up` renders against the fresh owned Metro process before test-account preparation or capture.
Do not edit/reload during capture. Resume an already prepared approved pending signup rather than
creating another account; zero local registrations does not establish that no Firebase account exists.
Credentials, genuine consent, email verification, printed-detail confirmation, and authorized front
capture remain user-operated. These preflight checks do not pass any live matrix row.

### First user-operated live result (2026-11-22)

The user confirmed the camera was closed and chose to open the isolated app manually. After testing,
the user explicitly selected **Registration succeeded**, confirming manual capture of the authorized
ID front and successful registration completion. No agent-operated capture or sensitive UI inspection
was used.

A subsequent aggregate-only query passed the local-machine/default-instance and exact
**`MonteAI_RegistrationDev`** database guards:

| Aggregate | Preflight baseline | After reported success |
| --- | --- | --- |
| Students | **0** | **1** |
| Receipt consumptions | **0** | **1** |
| Applied migrations | **20** | **20** |

This reconciles the reported completion with one new local student and one receipt-consumption entry.
Evidence is limited to the safe user-reported outcome and aggregate counts: no identity/profile,
fingerprint, JTI, image, OCR, token, receipt, request/response body or header, screenshot, or raw log was
inspected. No request timing, native-cleanup observation, or whole-signup privacy interval was collected.
The counts do not establish RAM-only handling, cleanup ordering, controlled retry/idempotency behavior,
or the other live matrix scenarios. Those retain separate pending evidence requirements.

No additional Firebase account was created by the agent, and no account or database cleanup was
performed. The app/session, owned services, and mappings were left unchanged during this reconciliation.

### Bulk report and camera-closed follow-up (2026-11-22)

A 20-scenario user-operated runbook was provided with separate account/fixture, controlled-fault,
privacy-observer, cleanup, and MFA approval gates. No controlled fault or whole-signup privacy observer
was approved/prepared or armed. The user later reported **ALL PASSED**, but also reported these issues:

| Reported issue | Follow-up implementation | Current evidence |
| --- | --- | --- |
| P06: disabled **Allow camera** after denying the Android permission prompt | Serialize permission work, ignore obsolete results, explicitly reread permission on focus/foreground/pre-open, re-enable requestable denial, and offer manual Settings plus **Check camera permission** for permanent denial | Offline regressions passed; user reports issues resolved in a combined follow-up confirmation; prompt/Settings branches not separately recorded |
| Confusing cancellation/close controls | Show only the current action: **Cancel opening**, **Close camera**, **Cancel capture**, **Cancel verification**, or **Cancel registration**; show **Finishing cancelled work…** and keep reopening blocked until the real cleanup owner settles | Offline regressions passed; user reports UI working in the combined follow-up confirmation; physical native/transport cleanup remains separately unevidenced |
| Black preview on first camera open | Update bounded `pictureSize` in place without destroying/replacing the native view; stable ref/configuration guards, single-flight size query, ready/layout gating, visible startup progress, and preview-start timeout | Offline regressions passed; user reports UI working in the combined follow-up confirmation; structured first-open result and physical root cause not independently established |

The user clarified that **P06 followed denying the permission prompt**, not restoring permission in
Android Settings. The OS's ability to show another prompt was not recorded. Settings recovery is an
additional covered branch, not evidence that the reported scenario was a Settings-return failure.

The first-preview change mitigates a credible SDK 54 race: destroying a view calls process-wide
`cleanupCamera()`/`unbindAll()`, while `pictureSize` already supports in-place reconfiguration. This is
not a proven diagnosis of the physical black preview, nor does a synthetic ready event prove pixels.

The user selected **Camera closed—fix issues** before these edits. During offline fixes and preflight,
the agent did not reload the app, capture, grant/reset permission, create an account, clean up data,
change service configuration, or edit native/signing sources. The final offline checks above include
all code changes. The fixes and evidence notes remain uncommitted.

The bulk report is retained as an **incomplete sign-off**, not a pass for unarmed fault/privacy scenarios
or separately unevidenced lifecycle, retry, account-switch, legacy-consent, faculty, and MFA requirements.
The last guarded database evidence is still **20 migrations / 1 student / 1 receipt consumption**;
no count was taken after the bulk report or during the fixes.

### Targeted device retest gate

**Follow-up UI issues are user-confirmed working; further retests are stopped at the user's request.**
On **2026-11-22**, the user renewed camera-closed/no-active-work confirmation and approved safe preflight
plus a user-operated reload of only the isolated app. The user also confirmed an **existing verified,
unregistered pending signup**
and separately approved its **preview-only** use. This is not approval for new-account creation,
shutter/capture, upload, registration, or account/database cleanup.

The approved preview preflight passed without launch/reload or service/mapping changes:

- Explicit serial **`192.168.100.9:43779`** remains connected as the TECNO LJ8k; its second wireless alias
  is also present. Metadata-only package queries confirm both isolated and normal packages are installed.
- Isolated camera permission is **granted** on the OS metadata check; no permission was changed by the
  agent. SDK `canAskAgain` after a future denial is not established by this granted-state check.
- All three **8081 / 7073 / 5086** reverse mappings already exist; none was added/removed. The recorded
  static native Metro port is **8081**, not 8083; no APK installation was performed.
- All four recorded service roots retain their owned creation/executable identities. All **six listeners**
  are exclusively loopback-bound and belong to those process trees. Body-free readiness passed:
  Function `OPTIONS` **204**, unauthenticated API **401**, Metro **200**, and Azurite TCP readiness.
- Internal status-only configuration guards confirmed the local API target, disabled API sinks/SMTP/
  backups and Function logging, dedicated local quota storage, matching Firebase project,
  matching rotated receipt trust, and **600-second TTL**. No secret/configuration values or request
  payloads were output. No quota-policy/configuration change, service restart, observer/fault setup,
  or new aggregate query was performed.

The agreed preview-only retest instructions were:

1. The user manually reloads only **`com.monteskolar.mobile.captureproof`**, with the camera closed and
   no active signup work. Do not reload/reset the normal app, reinstall, sign out, or clear app data.
   If the interval is delayed or interrupted, renew camera-closed confirmation before another reload.
2. Use only the user-confirmed existing pending signup. The originally approved successful account is
   already registered, not an unused pending signup. If reload does not return to the eligible pending
   stage, pause rather than creating an account, deleting registrations, or resetting permission flags.
3. Keep the initial retest **preview-only** in `/sign-up`, pointed at a non-sensitive blank surface:
   user-operated permission denial/recovery, first-open preview/progress, and idle/open/close controls.
   No ID in view, shutter, upload, or registration. Restoring permission/focus must leave the camera
   closed until explicit Open. If Android no longer allows another prompt, do not reset its flags to
   force one; record that branch as not exercised and separately check manual Settings recovery.
4. Record only scenario/date, safe control/status outcome, whether live preview pixels appeared on
   first open, and whether an explicit reopen was needed. No screenshots, sensitive UI dumps, raw
   traffic/logs, inspector, or capture/receipt inspection. Do not edit/reload during the retest interval.
5. Actual native/verification/registration cancellation and other shutter/fault/privacy rows remain
   separate tests. Cases that may register need an approved pending account and unused student number/
   authorized card or separately agreed fixture, with writes/costs and any cleanup separately approved.
    Preview-only **Close camera** evidence must not pass cancellation during encoding or transport.

### User confirmation and decision to move on (2026-11-22)

After the preview-only handoff, the user reported **"It's okay now. I want to move on. All is working
now"**. This is accepted as a **user-confirmed resolution of the reported camera UI issues**. No
structured per-branch result, reload completion, first-preview/control outcome, or closed-after-test
state was separately supplied; none is inferred or independently claimed.

Further device testing is stopped at the user's request. No additional capture, fault/observer setup,
account creation, registration write, cleanup, commit, or deployment is authorized by this confirmation.
No new device/UI inspection or aggregate query was performed. The last guarded counts remain the
historical **20 migrations / 1 student / 1 receipt consumption**, not a new post-follow-up count.
The agent leaves apps/sessions, services, mappings, keys, and code unchanged at this handoff; only
these documentation notes are updated. Separately unevidenced fault/privacy/lifecycle/retry/account/MFA
rows retain their evidence limits, without blocking the user's decision to move to other work.

## User-operated live matrix

For every row, record only scenario/date, safe UI outcome, HTTP status/cooldown or request counts when
available without bodies/headers, and approved aggregate registration/write-observer counts. No
screenshots, screen recordings, hierarchy dumps containing personal details, OCR, image/base64,
Firebase/MFA tokens, receipts, or raw network/crash diagnostics. Do not ask the agent to capture a card.

Controlled failures/delays/401/quota/kill-switch rows require separately approved development-only
fault setup. Do not exhaust real quotas, alter production policy, or intercept sensitive traffic to
force them. If a row cannot be exercised safely, leave it pending instead of counting synthetic
coverage or a similar Phase-2 row as a live pass.

The happy path retains its accepted UI/count evidence. The reported camera UI issues now also have a
combined user-confirmed resolution, recorded above without inventing per-branch results. Remaining rows
lack separately sufficient evidence. Prerequisites or incidental behavior do not pass their full scenarios.

| Scenario | Expected live behavior | Status/evidence |
| --- | --- | --- |
| Genuine privacy and terms acceptance | Each requires its own action; reading/dismissal/Back and missing legacy consent do not accept | **Pending — not separately evidenced** |
| Personal email and structured identity | Personal student email allowed; leading zeros and ordered given names retained; faculty policy unchanged | **Pending — not separately evidenced** |
| Unverified Firebase account | Verification email/resend works; no camera, profile registration, or normal-session promotion | **Pending — not separately evidenced** |
| Verified/restored pending signup | Reload/force-refresh owned Firebase account; still gated pending until receipt-bearing registration | **Pending — not separately evidenced** |
| Printed-detail confirmation and permission | User explicitly confirms details, grants permission, and opens camera after screen protection | **UI reported working — 2026-11-22 combined follow-up confirmation; full scenario not separately recorded** |
| Permission denied/restored | Requestable denial permits explicit retry; permanent denial offers manual Settings/check; no capture/file fallback or automatic reopen | **Issue reported resolved — 2026-11-22 combined follow-up confirmation; prompt/Settings branches not separately recorded** |
| Successful front capture → verification → registration | Bounded RAM JPEG, preview closes, live OCR matches, immediate receipt submission, cleanup before navigation | **Passed happy path — 2026-11-22, user-reported completion and local counts 0→1 student / 0→1 receipt consumption; UI/count evidence only** |
| Capture/encoding privacy interval | Approved scoped observation and source/boundary checks show no capture/OCR/receipt persistence; no payload inspection or universal-zero-write claim | **Pending — not separately evidenced** |
| `retake` / `unmatched` | Safe message only, no OCR/scores; image discarded; explicit new capture/edit, no mock fallback | **Pending — not separately evidenced** |
| Verification HTTP 401 | At most one fresh Firebase-token retry; never MFA-token substitution or mock fallback | **Pending — not separately evidenced** |
| Verification offline/503 and 429 cooldown | Safe failure/cooldown; no automatic scan/retry, no retained capture | **Pending — not separately evidenced** |
| Uncertain registration and explicit retry | Same valid receipt/exact draft, registration only, no second OCR; approved aggregate checks show no duplicate creation | **Pending — not separately evidenced** |
| Receipt expiry while awaiting retry | After TTL, held verification is discarded and a fresh capture is required | **Pending — not separately evidenced** |
| Identity/profile/consent edit after verification | Any change invalidates the receipt; reconfirmation and fresh verification required | **Pending — not separately evidenced** |
| Cancel during native capture/encoding | Clear stage-specific control; preview closes; late native work is disposed; reopening visibly blocked until cleanup settles | **Physical cleanup evidence pending — UI controls reported working; offline regressions passed** |
| Cancel during verification/registration | Clear stage-specific control; references cleared; no late client session/navigation; reconcile any server commit on approved test target | **Live transport evidence pending — UI controls reported working; offline regressions passed** |
| Home/background and notification drawer | App-state/window blur invalidate; returning focus does not reopen or finish stale work | **Pending — not separately evidenced** |
| Leave route/unmount then reopen | Cleanup ownership survives late work; new flow has no old receipt/capture or automatic camera opening | **Pending — not separately evidenced** |
| Double tap/reopen while native work is late | Single-flight capture/verification/registration; no overlapping still allocation | **Pending — not separately evidenced** |
| Sign-out/account switch/preparation cancellation | Only owned UID cleanup; no stale signup promotion, newer-account token/profile erasure, or unrelated-account deletion | **Pending — not separately evidenced** |
| Normal-account MFA regression | Login verification/setup remain usable; stale reads/writes/refreshes cannot replace or erase newer credentials | **Pending — not separately evidenced** |

The approval and local service-setup gate is satisfied for the isolated run above. Live sign-off remains
**pending** for the remaining required rows despite the first successful user-operated happy path.
The camera UI issues are user-confirmed resolved, and further testing is stopped at the user's request.
No Azure deployment, production migration, normal-app reset, automated permission grant, or account/data
cleanup occurred. Only the separately approved development ID-verification material was rotated.
