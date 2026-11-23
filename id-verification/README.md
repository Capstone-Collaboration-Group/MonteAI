# MonteAI student-ID verification

Standalone, camera-only student-ID verification for Colegio de Montalban. It runs as a Python 3.12
Azure Function and is intentionally independent from the ASP.NET Core API in `../server/`.

> **Pilot status (2026-11-22):** the Function, main-API enforcement, and web/Android signup are
> implemented, with user-confirmed local registration success. [Phase 6 release checks](docs/RELEASE_CHECKS.md)
> pass offline; Azure deployment is deferred. Only `cdm-front-v1` is supported. Desktop student capture
> and native iOS remain deferred, and production accuracy/privacy/performance/cost gates remain open.

## What it verifies

- Firebase ID token, including exact project/issuer/audience and `email_verified: true`
- full front-card geometry, green/yellow layout, school logo, municipal seal, and template colors
- exact school heading at a confidence threshold
- printed `NN-NNNNN` student number against registration input
- printed first/middle/last/suffix against strictly normalized registration input

It does **not** accept uploads, process the back side, perform liveness, identify a face, or prove that
the person holding a genuine card is its owner. A positive result is an eligibility signal, not an
identity guarantee.

## Request flow

1. Firebase account and email verification happen first.
2. A client captures the front of the card from a live camera.
3. `POST /api/v1/id-verification` authenticates the user, reserves shared quota, and processes the
   capture in memory.
4. A successful check returns a 10-minute RS256 receipt bound to UID, verified email, normalized
   student number/name, template version, and a unique receipt ID.
5. `POST /auth/register` verifies and atomically consumes that receipt with student creation. An
   identical UID/receipt/draft retry is idempotent; production trust and migrations need separate approval.

Clients treat receipts as opaque, sensitive **600-second** JWTs held only in signup closures. Never
decode, inspect, display, log, persist, or put them into URLs.

No capture or OCR text is intentionally written to files, Azure Blob/Table Storage, logs, or receipts.
See [Security and privacy](docs/SECURITY_AND_PRIVACY.md) for exact lifecycle and limitations.

## Local setup — new, separately approved environments only

Prerequisites: Python 3.12, Azurite (for quota storage), and optionally Azure Functions Core Tools 4.
The commands below create dependencies, settings, and signing material. They were **not** part of
Phase 6; do not run them over the preserved acceptance environment or regenerate existing keys.

```powershell
cd id-verification
uv venv .venv --python 3.12
uv pip install --python .venv/Scripts/python.exe -r requirements-dev.txt
.venv/Scripts/python.exe -m tools.prepare_models
.venv/Scripts/python.exe -m tools.generate_keys
Copy-Item local.settings.example.json local.settings.json
```

Merge the three generated values from `.secrets/signing-settings.json` into the gitignored
`local.settings.json`, then set the Firebase project ID, exact browser origins, issuer, and an Azurite
connection string. Start Azurite before running `func start`. Model download is a one-time build step;
request-time OCR is offline.

Use the integrated web `/register` route or the approved Android development client, following
[web acceptance](docs/WEB_SIGNUP_ACCEPTANCE.md) or [Android acceptance](docs/ANDROID_SIGNUP_ACCEPTANCE.md).
Confirm the exact local API/database, origins, Firebase project, and signer/public trust before any
separately authorized live capture. The ordinary API configuration targets nonlocal SQL.

**Do not use `demo/` with real accounts or captures.** This legacy demo displays a sensitive receipt,
violates the supported client receipt boundary, and is excluded from the audited release ZIP. It is
not a live-testing or deployment path.

## Verification

Use existing dependencies and an existing Bicep CLI; substitute a new private output path below.
This does not authorize installing tools or starting services. Opt-in integration counts matter.

```powershell
.venv/Scripts/python.exe -B -m pytest --strict-markers -p no:cacheprovider
.venv/Scripts/python.exe -B -m ruff check . --no-cache
.venv/Scripts/python.exe -B -m tools.prepare_models --check
bicep build infra/main.bicep --outfile <private-output>/main.json --no-restore
```

Real Azure Table transaction semantics are tested against local Azurite when explicitly enabled:

```powershell
$env:IDV_TEST_TABLE_CONNECTION_STRING = "UseDevelopmentStorage=true"
.venv/Scripts/python.exe -m pytest -m integration
```

Phase 6 on **2026-11-22**: **82/82 Function tests** pass, including four isolated local-Azurite tests
and packaged offline OCR; Ruff and both model hashes pass. Existing Bicep CLI **0.49.2** compiles the
template offline without diagnostics. Frontend, .NET contract, packaging, and scope results are in
[the release checklist](docs/RELEASE_CHECKS.md). These are not Azure or full live-acceptance results.

### Supplied-photo pilot evaluation

Five repeated runs per photo on the local Windows CPU produced:

| Capture | Result | Observed local latency |
| --- | --- | --- |
| Clear original reference | verified 5/5 | 4.400 s first initialization; 1.416–1.589 s warm |
| Heavily compressed copy | retake 5/5 (`card_not_found`) | 0.129–0.139 s |
| Worn/tightly cropped card | retake 5/5 (`school_unreadable`) | 0.697–0.795 s |

Peak process working set was 323.6 MiB (286.6 MiB growth from initial process peak). These are local
process measurements—not Azure cold-start, execution, or billing measurements. The clear reference
also supplied the sanitized template artwork, and the three photos represent only two distinct cards,
so these results are not independent accuracy evidence.

## Project map

- `verification/` — authentication, normalization, image/OCR pipeline, receipts, and shared quotas
- `templates/` — versioned template definition and sanitized non-personal artwork
- `models/manifest.json` — public model URLs and SHA-256 pins; `.onnx` files are build artifacts
- `function_app.py` — Azure Functions HTTP entry point
- `infra/` — Southeast Asia Flex Consumption, storage/RBAC, and a $5 monthly alert budget
- `demo/` — unsupported legacy demonstration; displays receipts and is excluded from release packaging
- `tests/` — unit, cleanup, offline-model, concurrency, and Azurite integration checks
- `tools/` — model preparation, key generation, packaging, sanitized artwork extraction, benchmarking

## Documentation

- [Phase 6 release evidence and remaining gates](docs/RELEASE_CHECKS.md)
- [Web signup acceptance](docs/WEB_SIGNUP_ACCEPTANCE.md)
- [Android signup acceptance](docs/ANDROID_SIGNUP_ACCEPTANCE.md)
- [HTTP and registration integration contract](docs/INTEGRATION.md)
- [Azure deployment and operations](docs/DEPLOYMENT.md)
- [Cost model and limits](docs/COSTS.md)
- [Security, privacy, and disposal](docs/SECURITY_AND_PRIVACY.md)
