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

## Required `/auth/register` enforcement (pending)

The main API and clients have not been modified yet. Before removing the institutional-email rule for
students, add `idVerificationReceipt` to student registration and enforce all of the following locally
in the ASP.NET API:

1. Allow personal email syntax for students; keep the deferred faculty policy unchanged.
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

All web, desktop, and mobile student flows should use the same state machine:

1. Create/sign in the Firebase account using the personal email.
2. Send Firebase verification email; wait for verification; reload user and force-refresh ID token.
3. Collect the structured name and `NN-NNNNN` student number.
4. Request a live camera, show a full-card guide, capture **front only**, and call this endpoint.
5. On `retake`, discard the capture and allow another live capture. Never offer gallery/file selection.
6. On success, immediately pass the receipt in `/auth/register`; drop all client references afterward.

For browser/Electron, use `getUserMedia`, stop tracks on completion/cancel/unmount, clear canvases, and
revoke any object URLs. Electron must request camera permission explicitly; do not restore the removed
TLS bypass.

For Expo, `takePictureAsync` may create a cache file even without gallery access. Read it only for the
request and delete that exact URI in `finally` on success, failure, cancellation, and unmount. Do not
copy it to MediaLibrary/Documents or enable base64 fields that outlive the request. Keep the existing
`VITE_USE_MOCK` live/mock service pattern when adding the shared API client.

The server remains authoritative: client-side email verification, pattern checks, and capture guides
are usability checks, not security controls.
