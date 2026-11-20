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

## Client status and sequence

The Android student signup integration is implemented in Phase 3, using shared orchestration in
`packages/api/src/auth/studentSignupFlow.ts` and platform-specific capture in
`apps/mobile/components/StudentIdCapture.tsx`. **Live signup acceptance is still pending.** Web and
desktop capture/receipt integration remain separate work; their existing signup screens do not yet
complete this sequence. iOS capture is unsupported under the agreed Android-only scope.

1. Collect structured registration details and separately accept the privacy notice and terms. Reading,
   dismissing, or pressing Back in a notice is not acceptance. Create/resume the owned Firebase account.
2. Send the Firebase verification email and wait for verification. A pending signup, including a restored
   verified Firebase account, is not a normal application session or a completed API registration.
3. Reload the owned account and force-refresh its Firebase ID token. Confirm the structured name and
   exact `NN-NNNNN` student number against the printed front of the ID before explicitly opening the camera.
4. After screen protection and user-granted camera permission, capture **front only** into RAM using the
   audited native path. Close the preview after encoding without cancelling the JPEG's cleanup owner.
5. Verify using a fresh Firebase token, never an MFA session JWT. Only verification HTTP 401 gets one
   fresh-token retry. `retake`/`unmatched` discard the image and require an explicit new capture; quota
   cooldowns never start automatic verification. There is no gallery/file fallback or liveness step.
6. On success, immediately submit the closure-held receipt to `/auth/register` with a fresh Firebase
   header. Wipe owned image/request/response references; never decode the receipt or put it in UI state,
   context, storage, navigation, diagnostics, or analytics.
7. An uncertain registration failure may offer an explicit **registration-only** retry with the same
   unexpired receipt and exact unchanged draft. No new OCR request is made. Expiry, any draft edit,
   cancellation, background/window/route blur, sign-out/account switch, or unmount discards verification.
   Restored focus or permission never automatically reopens the camera.
8. Promote the completed session only for the still-owned signup. Keep the route alive until capture
   cleanup finishes before navigating; cancelled late native/service results cannot promote a session.

The capture/encoding watchdog remains 15 seconds. Android signup gives only the post-encoding consumer
50 seconds around the controller's 45-second verification/registration budget; the isolated Phase-2
proof retains its total 15-second deadline. Further still allocations remain blocked until cancelled
native cleanup settles, including across route remounts.

Ordinary Expo `takePictureAsync` can create a cache file even without gallery access.
**Capture followed by file deletion does not meet this project's no-persistence requirement.** Keep
`expo-camera` pinned to **17.0.10**, with `pictureRef: true`, `skipProcessing: false`, `exif: false`, and
`base64: false`; `skipProcessing: true` writes a cache file even with `pictureRef`. The local encoder
accepts `SharedRef<Bitmap>` directly and has no save/URI/file path. Preserve the portrait **720/1120**
guide, default `FILL_CENTER`, no camera `ratio` prop, bounded requested/actual frames, and bounded JPEG.
See [the Phase-2 source audit and accepted physical-camera evidence](ANDROID_CAPTURE_PROOF.md).

The Phase-2 proof passed on **2026-11-19** on the tested TECNO LJ8k (Android API 35), but made no
verification/registration request. Phase-3 synthetic coverage, configuration prerequisites, privacy
limits, and the entirely pending live matrix are recorded in
[Android signup acceptance](ANDROID_SIGNUP_ACCEPTANCE.md). No Azure deployment or production database
change is authorized by either phase.

The server remains authoritative: client-side email verification, pattern checks, and capture guides
are usability checks, not security controls.

## Phase 1 shared foundation

- `RegistrationDraft` and `StudentRegistrationDraft` explicitly list persistable details, independently
  of the receipt-bearing `RegisterUserRequest`. `toRegistrationDraft`/`toStudentRegistrationDraft` also
  whitelist primitives at runtime; never serialize a request DTO directly.
- Web/desktop pending storage rewrites valid legacy drafts without unknown/receipt/password fields and
  removes invalid drafts. Mobile uses the same projection and sanitizes saved details on restore/read.
  Missing legacy consent is never silently accepted. Phase 3 adds separate mobile consent actions using
  the current privacy/terms versions (`2026-10-23` for both).
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

Android additionally requires `EXPO_PUBLIC_ID_VERIFICATION_ENDPOINT` as the **full** verification URL
and `EXPO_PUBLIC_API_BASE_URL` as the main API's `/api/v1` base URL. Verification and registration share
`EXPO_PUBLIC_USE_MOCK`; real service failures or missing live configuration never fall back to mock.
See [the mobile setup instructions](../../apps/mobile/README.md). The recorded development audit found
the verification endpoint missing and the API database nonlocal; an approved endpoint/API/database
target and a separate decision on exposed development-key rotation are required before live acceptance.

### Local regression checks

From the repository root (Node >=22.15 and the existing Python/.NET dependencies):

```powershell
pnpm test:registration
pnpm test:capture
pnpm test:signup
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

`pnpm test:signup` runs shared orchestration/transport, mobile helper, and actual React TS/TSX runtime
regressions. The runtime uses pinned development-only `react-test-renderer@19.1.0`, synthetic
native/Firebase/service boundaries, in-memory storage, and network-blocking adapters. It also exercises
the real MFA storage/refresh module and account-bound security settings. It is not live Android signup
acceptance; see the Phase-3 document for the recorded counts and pending device checks.

From `id-verification/`, run `python -m pytest` and `python -m ruff check .` using its virtual environment.
The four Table integration tests require an explicitly local `IDV_TEST_TABLE_CONNECTION_STRING`; they
create and remove only randomly named `IdvTest...` Azurite tables, not the application's quota table.
