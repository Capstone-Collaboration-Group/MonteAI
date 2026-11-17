# MonteAI student-ID verification

Standalone, camera-only student-ID verification for Colegio de Montalban. It runs as a Python 3.12
Azure Function and is intentionally independent from the ASP.NET Core API in `../server/`.

> **Pilot status:** the service is implemented and locally validated, but it has not been deployed or
> integrated into registration. It supports only the `cdm-front-v1` front-side template. Do not call
> this production-ready until representative held-out cards and Azure performance/cost are validated.

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
5. Eventually, `POST /auth/register` will verify and atomically consume that receipt. This final step
   is specified but **not implemented** in the main API yet.

No capture or OCR text is intentionally written to files, Azure Blob/Table Storage, logs, or receipts.
See [Security and privacy](docs/SECURITY_AND_PRIVACY.md) for exact lifecycle and limitations.

## Local setup

Prerequisites: Python 3.12, Azurite (for quota storage), and optionally Azure Functions Core Tools 4.

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

Run the camera-only demo from a separate terminal:

```powershell
Copy-Item demo/config.example.js demo/config.js
python -m http.server 8080 --directory demo
```

Fill `demo/config.js`, allow `http://localhost:8080` in `IDV_ALLOWED_ORIGINS`, and open
`http://localhost:8080`. The demo has no file chooser and signs in only an existing Firebase test
user. It displays a receipt for inspection; production clients must pass receipts directly to the API.

## Verification

```powershell
.venv/Scripts/python.exe -m pytest
.venv/Scripts/python.exe -m ruff check .
.venv/Scripts/python.exe -m tools.prepare_models --check
az bicep build --file infra/main.bicep
```

Real Azure Table transaction semantics are tested against local Azurite when explicitly enabled:

```powershell
$env:IDV_TEST_TABLE_CONNECTION_STRING = "UseDevelopmentStorage=true"
.venv/Scripts/python.exe -m pytest -m integration
```

Current local result: 82 tests pass, including live Azurite transactions and packaged offline OCR.
Bicep builds with no diagnostics.

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
- `demo/` — local camera-only browser demonstration
- `tests/` — unit, cleanup, offline-model, concurrency, and Azurite integration checks
- `tools/` — model preparation, key generation, packaging, sanitized artwork extraction, benchmarking

## Documentation

- [HTTP and registration integration contract](docs/INTEGRATION.md)
- [Azure deployment and operations](docs/DEPLOYMENT.md)
- [Cost model and limits](docs/COSTS.md)
- [Security, privacy, and disposal](docs/SECURITY_AND_PRIVACY.md)
