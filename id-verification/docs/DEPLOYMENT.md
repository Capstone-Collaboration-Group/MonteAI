# Azure deployment and operations

No Azure resource has been created by this project. These steps are a runbook, not evidence of a
successful deployment.

## Prerequisites and choices

- Azure CLI signed into the intended subscription
- role-assignment permission at the target resource group
- Azure Functions Core Tools 4 or Azure CLI package deployment
- unique Function app name, exact allowed origins, Firebase project ID, and monitored alert email
- production signing/HMAC values generated locally and never committed

The template is fixed to Southeast Asia, Python 3.12, 2 GiB Flex Consumption, scale-to-zero, no
always-ready instances, managed-identity storage, and USD budget assumptions. Cost Management in the
current Student subscription reported USD; verify this for any other subscription.

## 1. Prepare and validate

```powershell
cd id-verification
.venv/Scripts/python.exe -m tools.prepare_models
.venv/Scripts/python.exe -m tools.prepare_models --check
.venv/Scripts/python.exe -m pytest
.venv/Scripts/python.exe -m ruff check .
az bicep build --file infra/main.bicep
.venv/Scripts/python.exe -m tools.generate_keys --key-id idv-2026-01
```

Copy `infra/parameters.example.json` to a name ending in `.local.json`. Fill it from
`.secrets/signing-settings.json`; both locations are gitignored. Set a stable `budgetStartDate` on the
first deployment if reproducibility across future deployments is important.

Do not reuse local/test keys in production. Store a separately protected backup of the private key and
public PEM; losing the private key requires rotation, and losing public-key configuration prevents the
main API from validating outstanding receipts.

## 2. Preview and create infrastructure

```powershell
az group create --name monteai-idv --location southeastasia
az deployment group what-if `
  --resource-group monteai-idv `
  --template-file infra/main.bicep `
  --parameters '@infra/parameters.local.json'
az deployment group create `
  --resource-group monteai-idv `
  --template-file infra/main.bicep `
  --parameters '@infra/parameters.local.json'
```

Inspect the what-if output. The deployment creates one Function plan/app, one LRS storage account with
private package container/quota table, three managed-identity storage role assignments, and one `$5`
resource-group budget. It does not create Foundry, Document Intelligence, Key Vault, or Application
Insights resources.

Role propagation can take several minutes. Keep shared-key storage disabled; production quota access
must use managed identity.

## 3. Package and deploy code

Build a source package with only runtime files and verified public model weights:

```powershell
./tools/package.ps1
az functionapp deployment source config-zip `
  --resource-group monteai-idv `
  --name <function-app-name> `
  --src dist/id-verification-source.zip `
  --build-remote true
```

Remote build is required when deploying from Windows to Linux. For Flex, do not set
`WEBSITE_RUN_FROM_PACKAGE`, `SCM_DO_BUILD_DURING_DEPLOYMENT`, or `ENABLE_ORYX_BUILD`; package deployment
handles this. `host.json` must remain at the ZIP root. Alternatively, current Core Tools can publish the
project and request Python remote build automatically.

Before upload, list the archive and confirm it contains no `.secrets`, local settings, tests, docs,
demo config, captures, benchmark input, or identity text. The two `.onnx` files should be present and
total approximately 12.1 MiB.

## 4. Post-deployment gates

Do not enable student registration yet. First:

1. confirm `/api/v1/id-verification` rejects missing/invalid tokens and unverified email before OCR;
2. use controlled test accounts/cards to exercise verified, retake, mismatch, quota, and timeout paths;
3. verify Table rows contain only counters/HMAC keys and no captures/OCR text;
4. measure cold/warm latency, peak memory, concurrent requests, Function metrics, storage, and actual
   Cost Management charges in Southeast Asia;
5. inspect platform logs/diagnostics to ensure request bodies and Authorization are not captured;
6. complete the main-API receipt transaction and all three clients per `INTEGRATION.md`;
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
- Re-run model hash checks and the full release checklist for every package.
- Budget alerts are advisory; follow the response plan in `COSTS.md`.
