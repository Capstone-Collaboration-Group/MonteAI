# Azure deployment and operations

**Deployed 2026-11-22; verification remains paused.** [Phase 6](RELEASE_CHECKS.md) completed the
offline/local release checks. The user then provisioned the infrastructure and deployed the Function
manually with Azure CLI + Bicep — the assistant supplied instructions only and ran no cloud commands.
Function registration and the paused (`IDV_ENABLED=False`) response are validated end to end.
**Verification is not enabled.** Production key confirmation, main-API public trust, database
migrations, frontend endpoint changes, and the release gates below remain separate approved steps.
This document records what was executed, the packaging defect found and corrected, and what is still
required before enablement. It is not production sign-off.

## Current state (as of 2026-11-22)

| Item | State |
| --- | --- |
| Resource group | `monteai-group` |
| Function app | `monteai-id-verifier` (Flex Consumption, Linux, Python per `functionAppConfig.runtime`) |
| Storage account | `idveqhdw7yfug3l4` (managed identity; shared-key access disabled by template) |
| `endpoint` output | `https://monteai-id-verifier.azurewebsites.net/api/v1/id-verification` |
| `receiptIssuer` output | `https://monteai-id-verifier.azurewebsites.net` |
| Function registration | `verify_student_id` registered; `POST`/`OPTIONS` at `/api/v1/id-verification` |
| `IDV_ENABLED` | `False` (observed in app settings; the initial `verificationEnabled=false` plan was honored) |
| Paused smoke test | **Passed**, 2026-11-22 17:43 UTC — `503`, `Retry-After: 3600`, `code=verification_disabled` |
| `FUNCTIONS_WORKER_RUNTIME` | Not present — **expected**. Flex configures the runtime through `functionAppConfig.runtime`; do not add this setting manually. The loaded Python Function confirms the worker runs. |

Exact app-setting values supplied during parameterization (allowed origins, Firebase project, alert
email, signing/HMAC material) were handled privately and are **not recorded here or anywhere in this
repository**. Re-verify them by policy, not by printing them, before enablement.

### Paused smoke-test evidence

```http
HTTP/1.1 503 Service Unavailable
Content-Type: application/json
Access-Control-Expose-Headers: Retry-After
Cache-Control: no-store, max-age=0
Retry-After: 3600

{"outcome": "error", "code": "verification_disabled",
 "message": "ID verification is temporarily paused.", "requestId": "<uuid>"}
```

This is the expected paused contract: the kill switch fires before auth, quota, or image handling, so
an empty `{}` body is sufficient and no token or capture was involved.

## Deployment record

### What was executed (by the user)

- Bicep deployment of `infra/main.bicep` into `monteai-group`, creating the Function plan/app, one
  LRS storage account with private package container and quota table, three managed-identity storage
  role assignments, and the `$5` resource-group budget, with `verificationEnabled=false`.
- `az functionapp deployment source config-zip ... --build-remote true` for the source package.
- Kudu deployment id `0fbd4425-9ca5-4ead-9aaa-6a3b0a1989f2` finished with `status: 4` (Success) and
  `remoteBuild: true`.

### Packaging defect found during deployment

- The first package, `id-verification-source-20261122-212259.zip` (22 files, 11,934,067 bytes,
  SHA-256 `89DFAAFCCB5D1B61B7E217E00D1DD795727980A70C0D260356380515ED9A205E`), was built by
  `tools/package.ps1`, whose then-current `Compress-Archive` step wrote Windows backslash entry paths
  (`verification\service.py`). Extracted on Linux, the `verification` package never materialized, so
  the host logged `0 functions found (Custom)` / `0 functions loaded` and the route answered an empty
  Kestrel `404` — before any kill-switch or auth logic could run.
- Kudu reported success (`status: 4`, `remoteBuild: true`) the whole time. **Kudu success proves only
  that the upload/build pipeline finished; it does not prove function registration.**
- Correction: a new archive `id-verification-linux-44d9c038ad4b424899e922103ab854a5.zip`
  (SHA-256 `7B00F93D9F150627DC3735F15D15A18125193785778F7EA5A264643E2BC8B8D9`) was created by
  rewriting **only** entry names to forward slashes: same 11,934,067 bytes, same 22 entries, every
  file byte-identical, both ONNX model hashes re-verified against the manifest, zero backslash
  entries. It was redeployed with the same remote-build command. No settings, keys, quotas, or source
  files changed.

### Packager fix — locally validated 2026-11-23

`tools/package.ps1` now calls `tools/package_archive.py`, using Python's standard-library `zipfile`
with root-relative `Path.as_posix()` entry names instead of `Compress-Archive`. The existing staging
whitelist, license delivery, and model checks are unchanged. Existing output paths are refused rather
than deleted; exclusive archive creation also protects against concurrent overwrites. No additional
dependencies are required.

A validation-only ZIP was built in the approved local temporary workspace: **22 files**, zero
backslash entries, every file byte-identical to the corrected deployed package and current source,
and both model hashes matching the manifest. The three archive regression tests, Ruff checks, and a
real PowerShell overwrite-guard check passed. **No package was deployed and no cloud settings changed.**
For future releases, use a new unique output name and repeat the full whitelist audit with a new
SHA-256. The deployed corrected ZIP and its recorded hash above remain unchanged.

### Diagnostic authority

- `az functionapp function list` and the host log line `N functions loaded` are authoritative for
  registration.
- An empty-body `404` on `/api/v1/...` means the Function is not registered. A `503
  verification_disabled` means routing works and the kill switch is holding.
- Kudu `status: 4` alone proves neither.

## Configuration checklist — enablement still requires these

- [x] Provision resource group, Function app, storage, RBAC, and budget from the reviewed Bicep
  template with `verificationEnabled=false`.
- [x] Deploy the code package with remote build and confirm `verify_student_id` registration.
- [x] Confirm `IDV_ENABLED=False` and the paused `503` contract at the live endpoint.
- [x] Fix future ZIP generation locally and validate Linux-compatible paths, unchanged contents, and
  refusal to overwrite prior artifacts (2026-11-23; not an Azure deployment).
- [ ] Close package license/attribution review. The deployed 22-file package includes the `licenses/`
  delivery (PaddleOCR and RapidOCR), but the legal/attribution sign-off in
  [RELEASE_CHECKS.md](RELEASE_CHECKS.md) remains open; any packaging change requires a new whitelist
  audit. Note that `RELEASE_CHECKS.md` records the earlier **20-file** Phase-6 candidate — that record
  is superseded for deployment purposes by the two hashes above.
- [ ] Confirm production RSA signing/HMAC material was generated in a protected workflow and is not
  reused development material — without printing or inspecting the values. Keep a protected backup of
  the private key, public PEM, and HMAC material.
- [ ] Configure main-API public trust and approve its exact database/migration target separately.
- [ ] Plan controlled pilot enablement (`verificationEnabled=true`) and rollback; the pause must stay
  in force until this and every item below is approved.
- [ ] Revalidate regional Flex availability/quota, USD billing/prices, RBAC propagation, latency/
  memory/cost, and platform diagnostics at enablement time. Successful deployment does not establish
  these conditions.
- [ ] Complete held-out accuracy/manual recovery and the separately approved live fault/privacy matrix
  before production rollout. Web + Android are the pilot scope; desktop student capture/iOS are
  deferred.

## Prerequisites and choices

- Azure CLI signed into the intended subscription
- role-assignment permission at the target resource group
- a reviewed Azure CLI Flex source-ZIP/remote-build workflow (verify the installed CLI supports it)
- unique Function app name, exact allowed origins, Firebase project ID, and monitored alert email
- production signing/HMAC values generated locally and never committed

The template is fixed to Southeast Asia, Python 3.12, 2 GiB Flex Consumption, scale-to-zero, no
always-ready instances, managed-identity storage, and USD budget assumptions. Cost Management in the
previously checked Student subscription reported USD; verify it again for the intended deployment.
The maximum instance setting is **40**, not 40 running instances; HTTP concurrency is **1** per instance.
The `$5` budget alerts at 60/80/100% are advisory, **not a spending cap**. See [COSTS.md](COSTS.md).

## Function configuration map — names only, no secret values

`infra/main.bicep` supplies these settings. Preserve the existing runtime limits; this checklist does
not change current local or Azure configuration.

| Setting | Later configuration / existing policy |
| --- | --- |
| `IDV_FIREBASE_PROJECT_ID` | Approved Firebase project; must match client tokens and main-API authentication. No Firebase service-account secret is needed by this Function. |
| `IDV_ALLOWED_ORIGINS` | Comma-separated exact HTTPS browser origins from `allowedOrigins`; no wildcard, credentials, path, query, or fragment. Localhost HTTP is development-only. |
| `IDV_RECEIPT_ISSUER` | Exact `receiptIssuer` deployment output, using the Function's HTTPS host, not its route path. |
| `IDV_RECEIPT_AUDIENCE` | `monteai-registration`; must match main-API public trust. |
| `IDV_RECEIPT_KEY_ID` | Production signer ID from `receiptKeyId`, allowlisted by the main API before use. |
| `IDV_RECEIPT_PRIVATE_KEY_B64` | Protected base64 RSA private PEM, at least 2048 bits, from secure `receiptPrivateKeyB64`. Function only. |
| `IDV_QUOTA_HMAC_KEY_B64` | Protected base64 of at least 32 random bytes from secure `quotaHmacKeyB64`. Preserve across redeployments; changing it mid-month changes per-user quota keys. |
| `IDV_TABLE_ENDPOINT`, `IDV_QUOTA_TABLE` | Template storage Table endpoint and `IdVerificationQuota`; managed identity, not a production connection string. |
| `AzureWebJobsStorage__credential` | `managedidentity`, with template-provided blob/queue/table service URIs and all three storage RBAC assignments. |
| `IDV_DAILY_USER_ATTEMPTS`, `IDV_MONTHLY_USER_ATTEMPTS` | **8 daily / 20 monthly** per user; unchanged. |
| `IDV_MONTHLY_ATTEMPTS`, `IDV_MONTHLY_COMPUTE_SECONDS` | **6000 attempts / 40000 charged seconds** globally per UTC month; unchanged. |
| `FUNCTIONS_REQUEST_BODY_SIZE_LIMIT` | `4194304` bytes; decoded image remains at most 3 MiB / 12 MP / 6000 pixels per edge. |
| `PYTHON_THREADPOOL_THREAD_COUNT` | `1`; preserve per-instance HTTP concurrency 1 and the 30-second host timeout. |
| `IDV_ENABLED` | From `verificationEnabled`; currently `false` in Azure, with separately approved controlled enablement. |

Receipt TTL remains **600 seconds** in code; there is no new TTL setting or override. Host
`ANONYMOUS` means Azure host authentication only: the application requires a signed, email-verified
Firebase token before quota/image processing. Do not place signing/HMAC secrets or Function keys in
frontend configuration, and do not treat CORS as authentication. Review any added Azure host CORS or
diagnostic policy explicitly; avoid wildcard origins and all body/Authorization/receipt capture.

## Main API and client handoff

Production trust uses **public material only**, in protected deployment configuration:

| Main-API setting | Required value |
| --- | --- |
| `IdVerification:Issuer` | Exact deployed `receiptIssuer`, without a trailing slash. |
| `IdVerification:Audience` | `monteai-registration`. |
| `IdVerification:PublicKeys:0:KeyId` | Approved production signer's key ID. |
| `IdVerification:PublicKeys:0:PublicKeyPemBase64` | Base64 of the matching **public** PEM; never private PEM. |
| `IdVerification:MaximumReceiptLifetimeSeconds` | **600**. |
| `IdVerification:ClockSkewSeconds` | **30**. |
| `IdVerification:AllowedTemplateIds:0` | `cdm-front-v1`. |

For ASP.NET environment variables, use `__` in place of `:`. Independently approve the main API's
database and the existing `EnforceStudentIdVerification` migration; do not run migrations or point
local signup at nonlocal SQL as part of Function deployment. Preserve current development trust.

- Web: `VITE_ID_VERIFICATION_ENDPOINT` = full deployment `endpoint` output;
  `VITE_API_BASE_URL` = approved main API `/api/v1`; `VITE_USE_MOCK=false` for approved real mode.
- Android: corresponding `EXPO_PUBLIC_ID_VERIFICATION_ENDPOINT`, `EXPO_PUBLIC_API_BASE_URL`, and
  `EXPO_PUBLIC_USE_MOCK=false`. Preserve the accepted camera dependency/native flags; further device
  testing remains stopped unless the user separately reopens it.
- Match existing Firebase client configuration to the approved project, and review the main API's
  hardcoded CORS list separately. Do not replace unrelated Firebase settings or enable desktop/iOS
  capture by copying these variables.

The current web build embeds **local HTTP development endpoints**, not these production values. A
later frontend build/configuration change is a separate approved step. Follow [INTEGRATION.md](INTEGRATION.md)
for receipt ownership, transactional consumption/idempotency, and public-key-first signing rotation.

## Runbook status

Steps 1–3 were executed on 2026-11-22 as recorded above; they are retained for reproduction and for
the next release. Step 4 remains pending and requires separate approval.

### 1. Prepare and validate offline — executed (Phase 6)

Use already installed dependencies and the existing Bicep CLI; do not install tools, download models,
start new services, regenerate keys, or overwrite prior packages under the release-check scope.
Run frontend/server checks per [RELEASE_CHECKS.md](RELEASE_CHECKS.md). For Function checks:

```powershell
cd id-verification
.venv/Scripts/python.exe -B -m tools.prepare_models --check
$env:IDV_TEST_TABLE_CONNECTION_STRING = "UseDevelopmentStorage=true"
.venv/Scripts/python.exe -B -m pytest --strict-markers -p no:cacheprovider
.venv/Scripts/python.exe -B -m ruff check . --no-cache
bicep build infra/main.bicep --outfile <private-output>/main.json --no-restore
```

Substitute the private output path and use only an already approved **local Azurite** endpoint. The
four opt-in Table tests create/remove randomly named `IdvTest...` tables, not application quota rows.
Without that opt-in, pytest can succeed while skipping the integration tests; check the counts.

**Signing/HMAC material** was parameterized privately during deployment; this repository neither
records nor verifies it. Before enablement, confirm in a protected workflow that it is production
material distinct from development keys, without printing or inspecting values. Copy
`infra/parameters.example.json` to a new gitignored `.local.json` parameter file for any future
deployment, add an explicit `verificationEnabled=false` unless enablement is separately approved, and
keep a stable first-of-month `budgetStartDate`. Gitignore is not access control; restrict access and
backups. Never paste secret parameters, signing settings, app-settings listings, or raw deployment
diagnostics.

Do not reuse test/development keys. Keep a protected backup of the private key, public PEM, and HMAC
material. Public trust must be configured before signing is enabled. HMAC rotation needs its own quota
impact review; the approved one-account local daily reset is not a production operation.

### 2. Preview and create infrastructure — executed

Examples below require approved targets and substituted placeholders. Use resource-ID-only what-if
output to avoid displaying secret app-setting payloads; arrange a separately protected/redacted review
if property-level inspection is needed. Keep raw errors/output private; deployment output is suppressed.
The public [what-if CLI reference](https://learn.microsoft.com/en-us/cli/azure/deployment/group#az-deployment-group-what-if)
lists `ResourceIdOnly`; revalidate CLI behavior before use, rather than printing full resource payloads.

```powershell
az group create --name <approved-resource-group> --location southeastasia --output none
az deployment group what-if `
  --resource-group <approved-resource-group> `
  --template-file infra/main.bicep `
  --parameters '@infra/parameters.local.json' `
  --result-format ResourceIdOnly
az deployment group create `
  --resource-group <approved-resource-group> `
  --template-file infra/main.bicep `
  --parameters '@infra/parameters.local.json' `
  --output none
```

Inspect the what-if output. The deployment creates one Function plan/app, one LRS storage account with
private package container/quota table, three managed-identity storage role assignments, and one `$5`
resource-group budget. It does not create Foundry, Document Intelligence, Key Vault, or Application
Insights resources.

Role propagation can take several minutes. Keep shared-key storage disabled; production quota access
must use managed identity. Role propagation, billing, and quota were not independently revalidated
after this deployment — they remain enablement-time checks.

### 3. Package and deploy code — executed, defect found and corrected

Build a **new, uniquely named** whitelist source ZIP and audit it for every release.
`tools/package.ps1` now emits Linux-compatible forward-slash paths and refuses existing outputs
(see *Packager fix* above); never overwrite another release/user artifact. The Phase 6 20-file
candidate and its SHA-256 are in [RELEASE_CHECKS.md](RELEASE_CHECKS.md); the deployed release is the
corrected 22-file package whose hashes are recorded above. Local packager validation did not deploy a
replacement release.

```powershell
./tools/package.ps1 -Output "dist/id-verification-source-<release-id>.zip"
az functionapp deployment source config-zip `
  --resource-group <approved-resource-group> `
  --name <function-app-name> `
  --src "dist/id-verification-source-<release-id>.zip" `
  --build-remote true `
  --output none
```

Remote build is required when deploying from Windows to Linux. For Flex, do not set
`WEBSITE_RUN_FROM_PACKAGE`, `SCM_DO_BUILD_DURING_DEPLOYMENT`, or `ENABLE_ORYX_BUILD`; package deployment
handles this. `host.json` must remain at the ZIP root. The public
[source-ZIP CLI reference](https://learn.microsoft.com/en-us/cli/azure/functionapp/deployment/source#az-functionapp-deployment-source-config-zip)
documents `--build-remote`.

Before upload, list the archive and confirm:

- it contains no `.secrets`, local settings, tests, docs, demo config, Azurite artifacts, captures,
  benchmark input, or personal identity text;
- all entry paths use forward slashes — **zero backslash entries**;
- all source bytes and both model SHA-256 pins verify; the two `.onnx` files total approximately
  **12.10 MiB**;
- the reviewed license/attribution delivery is present.

After upload, registration is proven only by `az functionapp function list` (or the host log's
`N functions loaded`) plus a paused-endpoint `503` — not by Kudu status. **Direct Core Tools publish is
not an audited alternative yet.** `.funcignore` lacks explicit exclusions for observed local
`__azurite_db_*.json`, `__blobstorage__/`, `__queuestorage__/`, and Azurite configuration artifacts.
The whitelist ZIP excludes them, but direct publishing must be separately hardened and content-audited
before it is recommended.

### 4. Post-deployment gates — pending; separate approval required

**Gate 0 (passed 2026-11-22):** routing and the paused contract — `verify_student_id` registered,
`/api/v1/id-verification` answers `503 verification_disabled` with `Retry-After: 3600`. No token,
quota, or image path was exercised.

Keep public student rollout disabled. Only after approved controlled pilot enablement:

1. confirm `/api/v1/id-verification` rejects missing/invalid tokens and unverified email before OCR;
2. use controlled test accounts/cards to exercise verified, retake, mismatch, quota, and timeout paths;
3. verify Table rows contain only counters/HMAC keys and no captures/OCR text;
4. measure cold/warm latency, peak memory, concurrent requests, Function metrics, storage, and actual
   Cost Management charges in Southeast Asia;
5. validate diagnostic configuration and separately approved privacy observations without exposing
   request bodies, Authorization, OCR, captures, or receipts; review existing main-API identity logs;
6. complete production public trust/database prerequisites and the approved web/Android main-API
   receipt transaction per `INTEGRATION.md`; do not advertise deferred desktop student capture/iOS;
7. run a representative held-out accuracy study and document manual recovery.

Because Flex has no deployment slots, plan rollback before updates. Keep the previous known-good package
deployment available and use Azure's Flex deployment history/diagnostic tooling. Deployments can stop
in-flight functions under the default recreate strategy; clients must handle a transient 503 without
reusing a stale capture.

## Operations

- **Currently paused** via `IDV_ENABLED=False` in Azure. Pause again: deploy with
  `verificationEnabled=false` or set `IDV_ENABLED=false` in app settings.
- Quota resets by UTC month; user daily limit resets at UTC midnight.
- Do not edit/delete current-month Table counter rows. Doing so can reopen allowance.
- Treat settlement reservation rows as conservative charges; cleanup is not required for correctness.
- Rotate keys in the order documented in `INTEGRATION.md`.
- Re-run model hashes, package/license audit, backslash-path check, and
  [the release checklist](RELEASE_CHECKS.md) for every package.
- Budget alerts are advisory; follow the response plan in `COSTS.md`.
- Do not repeat local account deletion/quota-reset exceptions or tear down preserved services/mappings
  without separate scoped approval.
