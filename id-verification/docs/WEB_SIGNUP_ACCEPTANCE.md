# Original Phase 3: shared UI + web signup

Date: **2026-11-22**. Scope: browser RAM capture, shared signup UI, and web registration integration.
Implementation and synthetic offline verification are complete. After separately approved local
phone/web setup, the user confirmed successful registration and reported testing it on **2026-11-22**.
That is scoped happy-path evidence, **not full live-browser acceptance**. Changes remain uncommitted
on `feat/ocr-registration-verification`; [original Phase 6 release checks](RELEASE_CHECKS.md) are recorded
separately, with Azure deployment deferred.

This follows the original six-phase plan. The Android documents' internal “Phase 3” describes
**original Phase 5: Mobile integration**. Android is user-confirmed working; further device tests are
stopped. That confirmation does not establish unevidenced Android release scenarios or any browser
acceptance by itself. Desktop integration and native iOS capture remain deferred/unsupported.

## Original closed execution boundary

The user originally approved **“Closed—proceed”**: source edits and synthetic offline checks only. That work
does not authorize app reloads, cameras, Firebase accounts, ID uploads, live registration writes, live
faults, privacy observers, MFA mutations, or account/database cleanup. No development API or browser
is started, and no dependencies are installed. No deployment, production/nonlocal write, service/key/
configuration change, certificate-policy change, sensitive screenshot/UI dump, raw traffic/log
inspection, or JavaScript inspector is part of this phase.

The ordinary default API configuration targets a preserved **nonlocal database**. Do not start that
host for browser acceptance. Historical Android-oriented local endpoints, signer trust, and Function
origin settings are not evidence of browser-ready configuration and cannot be reused without an
explicit web-specific setup/target approval.

## Subsequent approved local phone/web setup and confirmation — 2026-11-22

This occurred **after** the closed implementation/checks above; it does not retroactively authorize
additional live work or turn the original offline evidence into browser proof.

- The phone used **`http://localhost:5173/register` through ADB reverse**, with mappings for web **5173**,
  verification **7073**, and the isolated API **5086**. Loopback provided the browser camera secure
  context without Chrome flags, phone certificates, or certificate-policy changes. It does not make
  HTTP a production TLS configuration.
- The approved registration target was the isolated local API/database on **5086 /
  `MonteAI_RegistrationDev`**. The ordinary API on **5084** targets preserved nonlocal SQL and was not
  an approved registration-write target.
- Gitignored web configuration used `VITE_USE_MOCK=false`,
  `VITE_API_BASE_URL="http://localhost:5086/api/v1"`, and
  `VITE_ID_VERIFICATION_ENDPOINT="http://localhost:7073/api/v1/id-verification"`. Existing Firebase
  settings were preserved; these development endpoints are not an Azure frontend configuration.
- The user approved adding only **`http://localhost:5173`** to the isolated Function's allowed origins
  and restarting it. Existing origins/signing material were preserved. Its harness configuration is
  separate from root `id-verification/local.settings.json`.
- Connectivity preflight returned web HTTP **200**, Function/API OPTIONS **204** for the approved
  origin, and the expected unauthenticated `/auth/me` **401**. This proves connectivity, not capture,
  token acceptance, cleanup, or privacy behavior.
- A separately approved, guarded deletion removed only the specifically identified local student
  record. Firebase and consumed-receipt history were preserved. The subsequent scoped quota operation
  changed only that account's local **`DailyAttempts` from 8 to 0**, with conditional update and
  preservation checks; monthly/global counters and all settings/limits remained unchanged.
  This exception is not permission for further cleanup or resets.
- Following a fresh user-operated capture, the user reported **successful web registration** and said
  they had also tested it. No independent post-registration SQL counts or dedicated privacy/fault/
  lifecycle observations were taken. No account name, email, UID, student number, capture, or receipt
  is recorded here.

Phase 6 performs no new camera/signup tests, cleanup, resets, key/configuration changes, deployments,
or service/ADB teardown. Existing services and mappings are preserved. Further Android device testing
remains stopped; remaining live scenarios require separately scoped approval.

## Implemented contract

### Structured details, email, and consent

- Students may use personal email; their number remains exactly `NN-NNNNN`, including leading zeros.
  Given-name order and optional middle initial/suffix remain structured, not inferred from OCR.
- Privacy and terms each require an explicit acceptance action. Reading, dismissal, overlay click,
  Escape, and “Not now” are not acceptance. Current versions are **2026-10-23** for both notices;
  missing/stale legacy consent returns to review, and role changes require the relevant terms again.
- Firebase creates/resumes the account first. Existing-account password resume requires an
  authoritative own-profile lookup: only explicit `null` or still-bound HTTP 404 means no profile.
  Authentication/network failures cannot silently proceed as absence.
- Email verification, polling, and restore can enter only a **closed** student ID stage. They cannot
  register a student or open the camera. The user must confirm printed details, then explicitly open
  the camera and capture the authorized ID front.
- Faculty retain the `@pnm.edu.ph` rule and register without capture or an ID receipt.

### RAM-only browser capture

- Audio-free `getUserMedia`; requested maximum **2560 × 2160**, under **6 MP**. Preview uses only
  `video.srcObject`, centered/unmirrored `object-fit: cover`, and the portrait **720/1120** guide.
- Before allocating pixels, reject actual input over **12 MP / 6000 pixels per edge**, invalid guide
  geometry, or a crop too small for verification. Draw the guide crop directly into one unattached
  bounded canvas, never a full-frame intermediate canvas.
- Encode with `toBlob("image/jpeg", 0.86)`. JPEG must be at most **2 MiB / 1600 pixels per edge** and at
  least **450 pixels on its shorter edge**. Type/size/signature are checked before the consumer.
- No `takePhoto`, gallery/file fallback, `FileReader`, image URL/cache, capture-then-delete, persisted
  capture/OCR, face/liveness, or back-side capture path exists.
- Stop/detach the preview before verification. Overwrite mutable JPEG bytes, reset the canvas after
  encoding really settles, and release immutable Blob/base64 references. This does not certify
  physical erasure of browser/OS/string copies.
- Browsers cannot prevent screenshots/screen recording; the UI explicitly disclaims that guarantee.
  Only structured signup details are rendered, never the capture, OCR text/scores, or receipt.

### Fresh Firebase and private retry

- Verification, registration, and signup's own-profile check use fresh bound Firebase tokens, never
  the generic MFA-preferred provider. Only verification HTTP 401 receives **one** fresh-token retry.
  Registration and profile checks do not automatically retry 401, and live failures never become mock
  success.
- Receipts are sensitive, signed but **unencrypted RS256 JWTs with a 600-second TTL**. Treat them as
  opaque: never decode, inspect, persist, log, expose to diagnostics/analytics/UI state, or put into a
  URL. Receipt ownership remains inside `createStudentSignupFlow`'s per-signup closure.
- Success immediately submits the receipt-bearing registration. The image and verification-response
  receipt references are cleared before registration awaits further Firebase work.
- An uncertain registration failure may offer only explicit **registration-only retry** with the same
  unexpired receipt and exact unchanged draft. No second photo/OCR request occurs. Edits, including
  editing then restoring identical text, expiry, cancellation, account changes, and leaving discard
  retry admission. Retake/unmatched and quota recovery require explicit action, never automatic scans.
- Error boundaries expose allowlisted static codes/messages/status/cooldown only, not SDK/Axios
  objects, raw exception messages, request bodies, tokens, OCR, or receipts.

### Lifecycle and actual cleanup admission

- Visibility/focus loss, pagehide/freeze, orientation/layout changes, camera interruption/permission
  revocation, details/consent edits, account changes, cancellation, and unmount invalidate owned work.
  Restored focus or permission never automatically opens a camera.
- Modal close cancels synchronously, before its 300ms animation. Navigation happens only after the
  still-owned controller and camera cleanup finish; late results cannot navigate or promote signup.
- Global browser admission contains only an opaque lease and cleanup notifications. Streams, pixels,
  encoded data, requests, drafts, and receipts stay with their per-session/per-signup owners.
- Cancellation/watchdogs return promptly but retain admission until actual non-abortable
  `getUserMedia`, playback, `toBlob`, byte conversion, Firebase, and transport work settles. A remount
  shows a blocked form first; after real cleanup it restores an **unconfirmed, closed** ID stage.
  It does not overlap Firebase restore or reopen media.
- Browser cancellation retains Firebase accounts. Start-over clears the safe pending draft and signs
  out only a still-owned account after earlier cleanup. Unmount/account changes cancel a queued
  sign-out that has not started. A started SDK operation cannot be undone; its real cleanup remains
  single-flight. No account is deleted.
- Cancellation cannot undo a registration already committed by the server. Do not infer that a client
  timeout/cancel means no write; registration-only retry relies on the server's idempotency contract.

| Stage | Watchdog/budget |
| --- | --- |
| Camera account preparation/open/playback | 15 seconds |
| Capture/crop/encoding/byte conversion | 15 seconds |
| No-pixel restore, email recheck, email resend | 15 seconds |
| Firebase account preparation, faculty registration, started owned sign-out | 45 seconds |
| Shared verification + registration controller, including explicit registration-only retry | 45 seconds |
| Post-encoding signup consumer / registration-only browser consumer | 50 seconds around the controller |

No watchdog is permission to force-release actual late cleanup. The isolated Android proof's existing
15-second deadline and all accepted Android camera flags remain unchanged.

## Source map and configuration boundary

Repository-root paths:

- `packages/ui/src/components/auth/RegistrationForm.tsx` — shared form and explicit browser opt-in.
- `packages/ui/src/components/auth/useRegistrationFlow.ts` — consent/draft/Firebase ownership,
  preparation/restore/recheck/resend/sign-out budgets, and faculty flow.
- `packages/ui/src/components/auth/StudentIdVerification.tsx` — confirmation, permission recovery,
  stage-specific cancellation, lifecycle/layout guards, capture, and private retry controls.
- `packages/ui/src/components/auth/idCapture/browserMemoryCamera.ts` and `signupCleanup.ts` — RAM
  capture, bounded encoding, cleanup admission, and controller retirement.
- `packages/api/src/auth/studentSignupFlow.ts` — existing shared receipt-owning controller; the small
  web-phase fix preserves initiating timeout/details errors during external cleanup cancellation.
- `packages/ui/src/components/auth/pendingRegistration.ts` and `PendingRegistrationGate.tsx` — safe
  profile/consent-only pending state, memory fallback/notifications, and web protected-route gate.
- `apps/web/src/lib/registrationService.ts`, `pages/Register.tsx`, and `App.tsx` — bound Firebase
  transports, synchronous modal lifetime, and gate-before-profile route wiring.

Web uses `VITE_ID_VERIFICATION_ENDPOINT` (full verification URL), `VITE_API_BASE_URL` (main API base),
and exactly `VITE_USE_MOCK=true` for explicit mock mode. Endpoint configuration must be absolute HTTP(S)
without credentials/query/fragment; missing/malformed live configuration disables capture, not security
checks. Mock mode shares the verification/registration toggle, still checks Firebase, and performs no
ID upload/live profile registration. Opening a mock camera is still a real capture and needs approval.

A configured URL does not prove secure-context camera support, certificate trust, mixed-content
compatibility, or exact-origin/CORS readiness. No such policy is bypassed or changed by this work.
Unchanged desktop callers omit browser opt-in and cannot capture/register students via this stage.
Ordinary completed/cached web sessions keep their existing MFA/profile behavior; pending signup gates
profile/protected routes before they mount.

## Original closed-phase offline evidence

Closed Phase-3 offline results on **2026-11-22** (fresh Phase-6 reruns are in [RELEASE_CHECKS.md](RELEASE_CHECKS.md)):

| Check | Result |
| --- | --- |
| Combined web suites | **252/252 passed**: browser memory **38**, actual React/web runtime **98**, web transport **116** |
| `pnpm test:registration` | **62/62 passed** |
| `pnpm test:capture` | **50/50 passed**; synthetic/source-audit checks, not new device testing |
| `pnpm test:signup` | **193/193 passed**; includes the shared controller/transport and Android synthetic regressions |
| `pnpm typecheck:all` | **Passed** for all five shared packages and web/mobile/desktop |
| `pnpm lint` | **Passed**, zero errors; existing desktop/mobile warnings only |
| `pnpm build:web` | **Passed** (`tsc -b` + Vite); large-chunk advisory only |
| `git diff --check` and added-text whitespace check | **Passed** |
| Tracked/untracked source-scope audit | **Passed**: 11 modified tracked files, 16 untracked files, zero staged changes |

Every listed test run had **zero failures, cancellations, or skips**. These suite counts are separate
run results, not a claim that all test cases are unique across commands. Lint retains the existing
unused desktop `IngestFullThesisResponseDto` warning, mobile `AnimatedSplashScreen.tsx` hook-dependency
warning, and npm environment-config advisories. Vite reports chunks over 500 kB after minification;
the build succeeds, and no unrelated bundle/configuration changes were made to suppress the advisory.

Tests run actual TypeScript/TSX with existing React / `react-test-renderer` **19.1.0**, in-memory
transpilation, and synthetic Firebase,
media/DOM/history/storage/HTTP boundaries. They do not launch an app/browser, use an ID fixture/account,
or make an external request. The web build separately checks its React / React DOM **19.2.7** graph.
No dependencies are installed; this is not real-browser capture or privacy acceptance.

The runtime guards reject every unhandled HTTP/fetch boundary and unexpected React/payload diagnostic.
Synthetic afterEach checks require detached listeners/observers, stopped tracks, and released actual
cleanup admission. The routing fixture permits ordinary MFA-preferred `Auth/me` only **after** successful
registration; verification/registration still cannot consult the generic MFA provider.

```powershell
node --import ./tools/tests/typescript-loader.mjs --test --test-reporter=spec ./tools/tests/web-signup-runtime.test.mjs ./tools/tests/browser-memory-camera.test.mjs ./tools/tests/web-registration-transport.test.mjs
pnpm test:registration
pnpm test:capture
pnpm test:signup
pnpm build:web
pnpm typecheck:all
pnpm lint
git diff --check
```

The JavaScript suites do not run live server/Function acceptance. Earlier Android camera/live signup
and .NET/Python receipt-contract evidence remain historical and are not reclassified as browser proof.

### Original closed-phase scope audit

The Git-visible tracked and untracked changes are confined to web/shared signup sources, the small
shared-controller cancellation fix and regressions, synthetic test support, and these integration/
privacy/acceptance documents. There are no Git-visible changes to mobile/Android, desktop, native iOS,
server/Function implementation, signing material, package manifests/lockfiles, or configuration, and
no capture artifacts among the changed/new files. Added text was checked without printing its contents.
Ignored local credential/configuration contents were not inspected for this audit or edited by this
work; a Git path audit does not independently prove the state of ignored files.

No app/browser/API/camera was launched or reloaded, no live account/registration/database operation was
performed, and no new local database counts were taken. Build outputs remain local; nothing was served,
deployed, staged, or committed. Android's accepted camera dependency, flags, framing, encoder, native
sources, and signing sources remain untouched by this web work.

## Live browser acceptance status — further work requires separate approval

The original closed web phase ran none of these live scenarios. The later approved setup and general
user confirmation establish only the scoped evidence above. No dedicated observation matrix or new
post-registration count baseline was collected. Any further work must specify accounts, authorized
captures/fixtures, exact local targets, permitted observations/writes, and any configuration approvals.

| Scenario | Current evidence / remaining requirement |
| --- | --- |
| Supported real browser / secure context / exact origin | Approved loopback setup and connectivity passed; camera use is user-confirmed. Dedicated permission/origin/browser compatibility matrix remains unobserved. |
| Authorized ID-front happy path | User-confirmed registration after fresh capture. Independent consent/capture/privacy observations and new guarded student/consumption counts were not collected. |
| Denied/revoked permission, return to focus | Not independently established; safe explicit recovery without automatic camera opening/stale callbacks/duplicate work remains a live gate. |
| Crop/readability, optional names and leading zeros | Not independently established; separately authorized card coverage and guide-to-frame/backend behavior remain pending. |
| Cancel/blur/hide/close/unmount and late cleanup | Not independently established; track closure, no late navigation, and blocked remount until actual cleanup remain pending. Cancellation is not rollback proof. |
| Controlled verification/registration faults and quota | Dedicated live faults were not run; verification-only 401 retry, safe errors/cooldown, no mock fallback, and exact-draft registration-only retry remain live gates. The approved daily reset is not fault-matrix evidence. |
| Receipt expiry, draft/account changes | Not independently established; no transfer/reuse and explicit fresh-capture recovery remain pending. Never inspect a live receipt. |
| Dedicated privacy observations | Not run; no intentional capture/OCR/receipt persistence or diagnostic exposure needs separately approved evidence. No physical-zeroization/screenshot-blocking claim. |
| Existing sessions and faculty | Offline regressions pass; dedicated live MFA/profile/faculty checks remain pending. |
| Account/database cleanup | One guarded local student deletion was approved and verified; Firebase/receipt history retained. No additional cleanup is authorized. |

No deployment, production/nonlocal write, or further live operation is authorized by this document or
by completing the release checks. Keep changes uncommitted until the user requests otherwise.
