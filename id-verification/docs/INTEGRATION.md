# Integration contract

## Verification endpoint

`POST {IDV_BASE_URL}/api/v1/id-verification`

Headers:

```http
Authorization: Bearer <fresh Firebase ID token>
Content-Type: application/json
```

Request (strict envelope; JPEG or PNG bytes, not a data URL):

```json
{
  "student": {
    "studentNumber": "00-00123",
    "firstName": "Given Names",
    "middleInitial": "M",
    "lastName": "Family Name",
    "suffix": ""
  },
  "imageBase64": "<base64>"
}
```

`middleInitial` and `suffix` may be empty. Student numbers are exactly `NN-NNNNN`; leading zeros are
significant. Names use Latin-v1 normalization: Unicode diacritics/case/punctuation/space are
normalized, but missing names, reordered given names, edit distance, and OCR `O`/`0` substitution are
never inferred.

Success:

```json
{
  "outcome": "verified",
  "receipt": "<RS256 JWT>",
  "expiresAt": "2026-11-16T12:10:00+00:00",
  "templateId": "cdm-front-v1",
  "requestId": "<UUID>"
}
```

Failures have a stable `outcome`, `code`, safe user-facing `message`, and `requestId`. Relevant status
codes are 400 (shape/base64), 401 (token), 403 (unverified email/origin), 413 (size), 415 (media), 422
(`retake` or `unmatched`), 429 (quota/busy), and 503 (timeout/storage/kill switch). Honor `Retry-After`.
Do not expose raw OCR text, matching scores, or internal exceptions to users.

Limits: 4 MiB JSON body, 3 MiB decoded image, 12 megapixels, JPEG/PNG only, front side only.

## Receipt format

Header:

- `alg`: `RS256`
- `typ`: `monteai-idv+jwt`
- `kid`: configured signing-key ID

Claims:

- standard: `iss`, `aud`, `sub`, `iat`, `nbf`, `exp`, `jti`
- binding: `email`, `email_verified`, `student_number`, `name_key`
- policy: `purpose=student-registration`, `version=1`, `name_normalization=latin-v1`, `template_id`

The JWT is signed, **not encrypted**. Treat it as sensitive personal data even though it expires after
600 seconds. Never store it in local/session storage, URLs, crash reports, analytics, or logs.

## `/auth/register` enforcement (implemented in the main API)

The ASP.NET API accepts personal student emails only with a verified Firebase identity and a valid
`idVerificationReceipt`. Faculty still require `@pnm.edu.ph` and do not submit an ID receipt.
The following controls are implemented; production rollout and migrations require separate approval:

1. Allow personal email syntax for students; keep the faculty policy unchanged.
2. Validate signature using a configured public key selected only from an allowlist by `kid`.
3. Pin `RS256`, `typ`, issuer, audience, purpose, version, normalization version, and an allowed active
   template. Reject missing/extra semantic variants; allow only small clock skew.
4. Require an authenticated Firebase user with verified email. Match receipt `sub` to token UID and
   match normalized receipt email to both token email and registration DTO email.
5. Normalize DTO name/student number independently and compare exact values with `name_key` and
   `student_number`. Require `role == Student`.
6. Consume `jti` exactly once in Azure SQL with a unique constraint, in the **same transaction** as
   student creation. Do not use an in-memory cache or call this Function for introspection.
7. Make retries idempotent: if the same UID/JTI already committed the identical registration, return
   the existing result; reject reuse for any different UID or payload. Rollback must leave neither the
   student nor consumption row committed.
8. Redact the receipt from ASP.NET request logging and model-validation diagnostics.

Key rotation order: configure the new public key in the main API, deploy the new signer/key ID, wait at
least the receipt TTL plus clock skew, then remove the old public key.

## Client sequence

The camera/state-machine integration is a later phase. The existing application signup screens do not
yet collect receipts and therefore cannot finish live student registration with enforcement enabled.
All web, desktop, and mobile student flows must eventually use this sequence:

1. Collect registration details and genuine privacy/terms acceptance; create/sign in the Firebase account.
2. Send Firebase verification email; wait for verification; reload user and force-refresh ID token.
3. Confirm the structured name and `NN-NNNNN` student number before capture.
4. Request a live camera, show a full-card guide, capture **front only**, and call this endpoint.
5. On `retake`, discard the capture and allow another live capture. Never offer gallery/file selection.
6. On success, immediately pass the receipt in `/auth/register`; drop all client references afterward.

For browser/Electron, use `getUserMedia`, stop tracks on completion/cancel/unmount, clear canvases, and
revoke any object URLs. Electron must request camera permission explicitly; do not restore the removed
TLS bypass.

For Expo, ordinary `takePictureAsync` can create a cache file even without gallery access.
**Capture followed by file deletion does not meet this project's no-persistence requirement.**
Prove a memory-only native capture/crop/encoding path before choosing camera dependencies or integrating
the mobile flow. Keep the existing live/mock service toggle; no gallery, uploads, or liveness.

The server remains authoritative: client-side email verification, pattern checks, and capture guides
are usability checks, not security controls.

## Phase 1 shared foundation

- `RegistrationDraft` and `StudentRegistrationDraft` explicitly list persistable details, independently
  of the receipt-bearing `RegisterUserRequest`. `toRegistrationDraft`/`toStudentRegistrationDraft` also
  whitelist primitives at runtime; never serialize a request DTO directly.
- Web/desktop pending storage rewrites valid legacy drafts without unknown/receipt/password fields and
  removes invalid drafts. Mobile uses the same projection and sanitizes saved details on restore/read.
  Missing legacy consent is never silently accepted. Mobile consent UI remains a later phase.
- `createRegistrationReceiptStore` creates a per-signup closure, not a global store. It refuses expired
  or over-600-second receipts and drops receipts on an identity mismatch or expired `get`. Do not decode
  the JWT on clients. Call `clear` on success, any identity edit, cancellation, sign-out, and unmount;
  retry registration with the same valid receipt only when the original payload is unchanged.
- `createFirebaseTokenAccessors(auth).getFreshFirebaseIdToken` waits for Firebase restore, reloads the
  user, then calls `getIdToken(true)`. ID-verification config requires this Firebase-only provider, not
  the generic MFA-preferred `getAuthToken`. The verification transport retries only an HTTP 401 once.
- Shared registration supplies an explicit fresh Firebase `Authorization` header. API interceptors
  preserve it and do not substitute MFA credentials on a 401. Registration returns `RegisterUserResponse`
  (the created/existing profile), not a boolean.
- Registration and verification errors contain only static safe messages/codes/status/cooldown fields,
  never Axios request/config/response objects, causes, captures, OCR, or receipts.

### Local main-API trust

Configure these in the gitignored `server/appsettings.Development.json`, then restart the API:

```text
IdVerification:Issuer                              = exact local signer's normalized issuer
IdVerification:Audience                            = monteai-registration (or the matching local value)
IdVerification:PublicKeys:0:KeyId                    = local signer's key ID
IdVerification:PublicKeys:0:PublicKeyPemBase64        = base64 of the matching public PEM
IdVerification:MaximumReceiptLifetimeSeconds        = 600
IdVerification:ClockSkewSeconds                     = 30
IdVerification:AllowedTemplateIds:0                 = cdm-front-v1
```

Verify the public key matches the active signer before trusting it. Do not copy the private signing key
into the API, replace existing development keys, deploy, or run production migrations as part of this
local foundation work. Production must use separate signing/HMAC material and its deployed issuer.

### Local regression checks

From the repository root (Node >=22.15 and the existing Python/.NET dependencies):

```powershell
pnpm test:registration
pnpm typecheck:all
pnpm lint

# Opt-in real Python signer -> real ASP.NET controller, with synthetic Firebase auth and SQLite :memory:.
$env:MONTEAI_IDV_CONTRACT_PYTHON = (Resolve-Path id-verification/.venv/Scripts/python.exe).Path
# Optional: also check the existing local signer against server/appsettings.Development.json public trust.
$env:MONTEAI_IDV_CONTRACT_LOCAL_SETTINGS = "1"
dotnet test server/server.Tests/server.Tests.csproj
```

Two `IDVerificationContract` tests use an ephemeral Python RSA key and redirected process pipes.
A third, separately opted-in test uses the existing development signer and the API's configured public
trust, still with SQLite `:memory:` and synthetic Firebase authentication. No receipt/private-key/capture
data is written to files or test output, and existing signing/configuration files are never rewritten.
Without the interpreter variable, all three tests are skipped; without the local-settings flag, only the
third is skipped. This proves signature/claim interoperability and registration/idempotency,
**not** a live Firebase account, OCR scan, camera UI, or Azure deployment.

From `id-verification/`, run `python -m pytest` and `python -m ruff check .` using its virtual environment.
The four Table integration tests require an explicitly local `IDV_TEST_TABLE_CONNECTION_STRING`; they
create and remove only randomly named `IdvTest...` Azurite tables, not the application's quota table.
