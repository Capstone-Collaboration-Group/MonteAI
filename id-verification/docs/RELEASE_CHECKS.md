# Original Phase 6: release checks

Date: **2026-11-22**. Branch: `feat/ocr-registration-verification`. Changes remain **uncommitted**.

**Outcome: offline/local release checks pass; Azure deployment and production sign-off are deferred.**
This handoff assesses the implemented **web + Android pilot**, not every original platform phase.
Desktop student capture and native iOS remain deferred/unsupported. Passing these checks does not
close held-out accuracy, dedicated live fault/privacy, Azure performance/cost, licensing, or production
trust/database gates.

## Scope and evidence boundary

- The user confirmed successful phone/web registration after the separately approved local setup and
  fresh capture, and said they had also tested it. This is user-confirmed happy-path evidence, not an
  independently observed acceptance matrix. No new post-registration SQL counts or dedicated privacy
  observations were collected. See [WEB_SIGNUP_ACCEPTANCE.md](WEB_SIGNUP_ACCEPTANCE.md) for the approvals.
- Historical Android happy-path/device evidence remains scoped as recorded in
  [ANDROID_SIGNUP_ACCEPTANCE.md](ANDROID_SIGNUP_ACCEPTANCE.md). Further Android device testing is stopped.
- Phase 6 runs synthetic/offline frontend and API checks, packaged offline OCR, isolated **local**
  Azurite integration tests, static source/package audits, and local Bicep compilation. External lookups
  were limited to public upstream licensing/CLI documentation; no Azure resource query/deployment was needed.
- No new live capture/signup, account cleanup, quota reset, production/nonlocal database write,
  migration, signing/configuration change, certificate-policy change, dependency installation,
  sensitive screenshot, raw traffic/log inspection, or JavaScript inspector was performed.
  Preserved web/Function/API services and ADB mappings were not torn down.

The earlier approved local exception changed only one account's `DailyAttempts` **8 → 0**, preserving
monthly/global counters, settings, and limits. It is not a rate-limit implementation change or standing
permission to reset quota. Limits remain **8 daily / 20 monthly per user / 6000 global monthly attempts /
40000 global charged seconds**.

## Fresh check results

| Check | Phase-6 result |
| --- | --- |
| Combined browser memory / actual web runtime / web transport suites | **252/252 passed**. |
| `pnpm test:registration` | **62/62 passed**. |
| `pnpm test:capture` | **50/50 passed**; synthetic/source checks, no new device test. |
| `pnpm test:signup` | **193/193 passed**, including Android synthetic regressions. |
| `pnpm typecheck:all` | **Passed**, all five shared packages and web/mobile/desktop. |
| `pnpm lint` | **Passed**, zero errors; two existing warnings only. |
| `pnpm build:web` | **Passed** (`tsc -b` + Vite); not deployed. |
| Function pytest | **82/82 passed**, including all four opted-in local-Azurite tests and real packaged offline OCR. |
| Function Ruff | **Passed**. |
| Public model SHA-256 checks | **Both passed**, against the pinned manifest. |
| Fresh isolated .NET tests | **73/73 passed**, **zero skipped**, including all three Python receipt-contract tests. |
| Existing development signer / main-API public trust compatibility | **Passed** inside the opted-in synthetic .NET contract test; no keys/settings rewritten. |
| Bicep compilation | **Passed**, existing CLI **0.49.2**, offline `--no-restore`, no diagnostics. |
| Whitelist source-ZIP audit | **Passed technically**: 20 exact runtime files, source/model bytes match, Linux-compatible archive names. Licensing gate remains open. |
| Scoped source/secret and changed-file artifact audit | **Passed within scope**; no secret candidates or changed/new capture/credential artifacts. |
| Tracked added-line / untracked new-text whitespace, documentation links, scope, and staging audit | **Passed**; documentation-only Phase-6 repository edits, zero staged changes. |

Test runs had zero failures/cancellations/skips. Counts are separate suite results, **not a sum of unique
cases**. Lint retains desktop's unused `IngestFullThesisResponseDto` and mobile's
`AnimatedSplashScreen.tsx` hook-dependency warnings, plus npm environment-config advisories. The .NET
build reports existing nullable warnings **CS8602 / CS8604**; they are nonblocking and were not changed.
Early reporting-wrapper/CLI syntax errors were corrected; they were not application/template failures.

### Isolation and repeat conditions

Frontend suites use synthetic Firebase/media/DOM/history/storage/HTTP boundaries and reject unexpected
network/diagnostic output. They do not launch a real browser or validate device privacy. The web build
still embeds the current **local HTTP development endpoints**, so it is not an Azure-ready frontend
deployment artifact.

.NET ran with existing restored dependencies (`--no-restore`), a clean **Testing** environment, synthetic
Firebase authentication, and SQLite **`:memory:`**. Both `MONTEAI_IDV_CONTRACT_PYTHON` and
`MONTEAI_IDV_CONTRACT_LOCAL_SETTINGS=1` opt-ins were enabled. Private output stayed under
`server/server.Tests/bin/phase6-release-800725f858bd/` to satisfy repository-root discovery without
overwriting the running server's locked normal binaries. Test logging/file sinks and background side
effects were isolated/suppressed. This proves receipt/registration interoperability, not live OCR,
Firebase, camera, Azure SQL, or deployed Azure behavior.

The Table tests create/remove only randomly named `IdvTest...` tables at an explicitly local Azurite
endpoint, not application quota rows. Packaged OCR inference denies sockets/downloads. Models were
checked, not downloaded; no dependencies/services were installed and no existing keys were regenerated.

Repeat frontend commands are in [INTEGRATION.md](INTEGRATION.md#local-regression-checks); Function/local
Bicep commands are in [DEPLOYMENT.md](DEPLOYMENT.md). Preserve the isolation/opt-in conditions and
inspect safe result counts: default pytest/.NET runs may skip opt-in checks. Repeating a check does not
authorize a live capture, configuration change, or deployment.

## Source/security review

The manual review covered Function authentication/quota/image/OCR/receipt boundaries, main-API Firebase
policy/public validation/transactional consumption, and web/shared signup capture, transports,
pending storage, receipt ownership, and cleanup. No runtime implementation was changed in Phase 6.

- Function authentication is required before quota/image processing; exact origins, bounded inputs,
  fail-closed storage, and conditional shared reservations remain intact. Table rows store counters,
  monthly HMAC user keys, and reservations, not raw UID/email/capture/OCR.
- The signer still issues **RS256 / 600-second** receipts. Main-API validation pins the allowlisted public
  key/header/claim contract and identity; student creation and unique receipt consumption commit in one
  transaction, with exact-registration idempotency. No raw receipt/capture/OCR is stored in SQL.
- Clients keep receipts opaque in per-signup closures, never in UI/navigation/storage/logs/diagnostics.
  Genuine current consent and fresh verified Firebase authentication remain mandatory. Students may
  use personal email; faculty retain `@pnm.edu.ph` and require no ID capture/receipt.
- Only verification HTTP 401 gets one fresh-token retry. Uncertain registration offers only an explicit
  same-unexpired-receipt/exact-unchanged-draft registration-only retry; never another automatic scan.
- RAM-only front capture, bounds, watchdogs, cancellation/account/draft/lifecycle invalidation, and
  admission until **actual late cleanup** remain unchanged. Android `expo-camera` **17.0.10**, accepted
  picture-ref/processing/EXIF/base64 flags, and native memory encoder remain untouched.
- Safe pending storage is an allowlist of profile/consent primitives. Owned mutable buffers are wiped
  and immutable references released; this is not certified physical zeroization or browser screenshot
  blocking. The server remains authoritative.

Pattern-based secret checks covered current Git-visible ID-verification/relevant signup sources,
documents/tests, and **16 textual entries** inside the vetted ZIP. They found no private PEM blocks,
literal JWTs, known token/account-key patterns, Firebase service-account JSON, or literal IDV secrets.
This is **not** a complete repository-history scan, CVE assessment, or proof about ignored local files.
The static audit did not read ignored credentials/settings, copied test outputs, service logs/traffic,
or live captures/receipts. The separately opted-in test used existing signer/public trust privately.

## Audited package and artifact handling

The existing `tools/package.ps1` produced a new private candidate, not an upload:

- **20 runtime files / 11.37 MiB ZIP**: Function/host/locked requirements, runtime Python modules, model
  manifest + two ONNX weights, template + two previously sanitized artwork PNGs.
- Both models match their manifest SHA-256 pins and total **12.10 MiB**.
- Exact approved allowlist, no duplicate/traversal/Windows-separator names, and all packaged bytes match
  the source. No local settings, keys, demo, tests, docs, diagnostics, Azurite state, or captures.
- ZIP SHA-256: `976f9dea326c110d416c97e0b5d4803268e5bfd87d794c6853ac693283df2441`.

Sanitized JSON reports, compiled `main.json`, and `id-verification-source.zip` remain in the private
approved temporary directory named `monteai-phase6-release-20261122-800725f858bd`. Nothing was uploaded.
Do **not** upload .NET `bin/`, copied settings/test keys, raw diagnostics, harness configuration,
`.secrets/`, or entire working directories. Even ignored build outputs may contain sensitive material.
After any approved packaging/license/source change, produce a new uniquely named package and repeat
the content/hash audit; the recorded hash then applies only to this candidate.

## Findings and outstanding release gates

| Gate / finding | Current status and next requirement |
| --- | --- |
| Model/dependency license and attribution delivery | **Open before distribution.** Manifest declares Apache-2.0; ZIP has no LICENSE/NOTICE files. Offline metadata inventory found 43 runtime dependencies matching the lock, not legal sign-off. Review weight provenance, required license/attribution copies, dependency notices, and school artwork usage rights; approve any packaging change and re-audit it. |
| Direct Core Tools publishing | **Not approved/audited.** `.funcignore` lacks explicit exclusions for observed local Azurite data/config artifacts. The whitelist ZIP excludes them. Harden and list-audit a direct-publish path separately before recommending it. No `.funcignore`/packager change was made. |
| Legacy demo | **Unsupported for live use.** `demo/app.js` renders the sensitive receipt; it is excluded from the ZIP and README live-demo instructions were removed. Do not use it for real accounts/captures or receipt inspection. |
| Dedicated live browser/Android acceptance | **Incomplete.** User-confirmed happy paths do not pass permission, lifecycle/late cleanup, quota/fault/retry/expiry, account-change, existing-session/faculty, and dedicated privacy observations. Further Android testing is stopped; any new live work requires separate scoped approval. |
| Held-out accuracy and manual/accessibility recovery | **Pending.** Historical reference-photo timings/acceptances are not independent false-accept/false-reject evidence; define recovery for legitimate worn/constrained cards. |
| Azure runtime/RBAC/remote build/diagnostics | **Pending; not deployed.** Validate controlled authentication/quota/timeout behavior, managed storage roles, platform buffering/logging, and deployment/rollback behavior later. No raw receipt/body/Authorization inspection is allowed. |
| Cold/warm latency, peak memory, capacity, actual cost | **Pending in Azure.** Local results and budgets do not establish cloud performance or a `$5` hard cap; recheck pricing/quota and actual billing under an approved pilot. |
| Production trust/database/frontend configuration | **Pending separate approval.** Provision distinct protected production signing/HMAC material, configure public trust first, approve the exact migration target, and rebuild clients for approved HTTPS endpoints. No current local settings/keys were changed. |
| Broader logging/dependency security review | **Not certified.** Function logs are static/result metadata only; the main API retains existing UID logs and a legacy `resolve-login` email log. Review separately before production. Version/hash locks and metadata do not replace vulnerability/advisory review. |

Public licensing references reviewed on 2026-11-22:
[RapidOCR v3.10.0 LICENSE](https://github.com/RapidAI/RapidOCR/blob/v3.10.0/LICENSE) and
[PaddleOCR LICENSE](https://github.com/PaddlePaddle/PaddleOCR/blob/main/LICENSE). Both declare Apache-2.0;
the latter is a current upstream reference, not independently pinned proof for each converted weight.
No license text/package contents were added or legal distribution approval inferred.

## Final handoff

Phase 6 adds only this checklist and updates the README/integration/privacy/web-acceptance/deployment
documents. Existing source changes remain preserved: final scope is **13 modified tracked / 17
untracked / 0 staged** files. Tracked diff checks, all new-text whitespace checks, relative documentation
links, source fingerprints, and changed-path comparisons pass. Two unchanged baseline whitespace lines
in `apps/web/src/App.tsx` were confirmed against HEAD and preserved, not treated as new-text failures.
No server/Function/Android/desktop
implementation, dependency manifests/lockfiles, signing material, or configuration was changed by
Phase 6; ignored local-file state is not independently certified by Git.

Use [DEPLOYMENT.md](DEPLOYMENT.md) as the **later-only** Azure configuration handoff. Resolve the open
release gates with explicit approvals before publishing/enabling production signup. Leave changes
uncommitted and preserved services/ADB mappings intact until the user requests otherwise.
