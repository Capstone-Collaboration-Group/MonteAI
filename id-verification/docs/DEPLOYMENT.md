# Azure deployment and operations

**Deferred as of 2026-11-22.** [Phase 6](RELEASE_CHECKS.md) completed offline/local release checks and
prepared a candidate ZIP; no ID-verification Azure resources, deployment, production keys, database
migrations, or frontend endpoint changes were performed. The user wants Azure configuration/deployment
**later**. This runbook is a handoff, not authorization to execute its commands or production sign-off.

## Deferred configuration checklist

- [ ] Approve the subscription, dedicated resource group, unique Function name, monitored alert email,
  exact HTTPS client origins, and Firebase project.
- [ ] Close package license/attribution review and repeat the whitelist ZIP audit. The current candidate
  has no LICENSE/NOTICE files. Do not use unaudited direct Core Tools publishing.
- [ ] Provision separate production RSA signing/HMAC material in a protected workflow; never reuse or
  overwrite existing development keys. Do not print, commit, or upload secret settings/test outputs.
- [ ] Configure main-API public trust and approve its exact database/migration target separately.
- [ ] Plan initial `verificationEnabled=false`, controlled pilot enablement, and rollback. The template
  currently defaults to `true`; set the later deployment parameter explicitly, not by editing it now.
- [ ] Recheck regional Flex availability/quota, USD billing/prices, RBAC, latency/memory/cost, and platform
  diagnostics at deployment time. Compilation does not establish these Azure conditions.
- [ ] Complete held-out accuracy/manual recovery and the separately approved live fault/privacy matrix
  before production rollout. Web + Android are the pilot scope; desktop student capture/iOS are deferred.

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
| `IDV_ENABLED` | From `verificationEnabled`; plan `false` initially, with separately approved controlled enablement. |

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

## Later runbook — separate approval required

### 1. Prepare and validate offline

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

**Only later, in a separately approved fresh protected workspace**, provision production signing/HMAC
material without overwriting the current `.secrets/`. Copy `infra/parameters.example.json` to a new
gitignored `.local.json` parameter file and fill it privately. Add `verificationEnabled=false` and a
stable first-of-month `budgetStartDate`. Gitignore is not access control; restrict access and backups.
Never paste secret parameters, signing settings, app-settings listings, or raw deployment diagnostics.

Do not reuse test/development keys. Keep a protected backup of the private key, public PEM, and HMAC
material. Public trust must be configured before signing is enabled. HMAC rotation needs its own quota
impact review; the approved one-account local daily reset is not a production operation.

### 2. Preview and create infrastructure

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
must use managed identity.

### 3. Package and deploy code

After closing license/attribution requirements, build a **new, uniquely named** whitelist source ZIP
and audit it again. `tools/package.ps1` currently replaces an existing output, so confirm the output
does not exist; never overwrite another release/user artifact. The recorded 20-file candidate and its
SHA-256 are in [RELEASE_CHECKS.md](RELEASE_CHECKS.md); adding reviewed license files requires a new audit.

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
handles this. `host.json` must remain at the ZIP root. Verify the installed CLI's current Flex deployment
support before executing; the local ZIP audit does not prove Azure remote-build success.
The public [source-ZIP CLI reference](https://learn.microsoft.com/en-us/cli/azure/functionapp/deployment/source#az-functionapp-deployment-source-config-zip)
documents `--build-remote`; this reference check is not deployment evidence.

Before upload, list the archive and confirm it contains no `.secrets`, local settings, tests, docs,
demo config, Azurite artifacts, captures, benchmark input, or personal identity text. Verify all source
bytes and both model SHA-256 pins; the two `.onnx` files total approximately **12.10 MiB**. Include the
reviewed license/attribution delivery and restrict access to deployment/build output.

**Direct Core Tools publish is not an audited alternative yet.** `.funcignore` lacks explicit exclusions
for observed local `__azurite_db_*.json`, `__blobstorage__/`, `__queuestorage__/`, and Azurite configuration
artifacts. The whitelist ZIP excludes them, but direct publishing must be separately hardened and
content-audited before it is recommended. No exclusion/packaging implementation change was made in Phase 6.

### 4. Post-deployment gates

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

- Pause new checks: deploy with `verificationEnabled=false` or set `IDV_ENABLED=false` in app settings.
- Quota resets by UTC month; user daily limit resets at UTC midnight.
- Do not edit/delete current-month Table counter rows. Doing so can reopen allowance.
- Treat settlement reservation rows as conservative charges; cleanup is not required for correctness.
- Rotate keys in the order documented in `INTEGRATION.md`.
- Re-run model hashes, package/license audit, and [the release checklist](RELEASE_CHECKS.md) for every package.
- Budget alerts are advisory; follow the response plan in `COSTS.md`.
- Do not repeat local account deletion/quota-reset exceptions or tear down preserved services/mappings
  without separate scoped approval.
