# MonteSkolar mobile

Expo SDK 54 / React Native app in the pnpm workspace. File-based routes live under `app/`.

## Development

Run from the repository root:

```powershell
pnpm install
pnpm dev:mobile
# Metro for an existing native development client:
pnpm dev:android
```

Android student ID capture requires a **rebuilt native client** containing the local
`modules/verification-camera` module, not Expo Go or an older installed client. For acceptance, use the
isolated debug package/build instructions below rather than installing over the normal student app.
Do not reset/uninstall the normal app, clear its session, replace signing keys, or run a broad prebuild
to troubleshoot this flow.

## Android student signup (Phase 3)

Implemented sequence: structured details and separate privacy/terms acceptance → owned Firebase
account and verified email → explicit front-ID camera capture in RAM → verification → immediately
receipt-bearing registration. Students may use personal emails; the faculty `@pnm.edu.ph` policy is
unchanged. A pending signup is gated from the normal session even when Firebase email is verified.

- Camera only, **front only**, Android only; no gallery/file fallback or liveness. Web/iOS capture
  fails closed. Shared orchestration does not imply web/desktop capture integration is complete.
- `expo-camera` stays pinned to **17.0.10** with `pictureRef: true`, `skipProcessing: false`,
  `exif: false`, and `base64: false`. The native encoder consumes `SharedRef<Bitmap>` directly;
  no capture, OCR, or receipt is persisted, including capture-then-delete temporary files.
- A receipt is a sensitive, unencrypted RS256 JWT with a 600-second TTL. It lives only in a per-signup
  closure: never decode it, log it, save it, expose it to analytics/crash reports, or put it in a URL.
  Only profile/consent primitives and the owned Firebase UID may enter the pending-draft cache;
  Firebase's normal auth persistence and existing MFA session storage are separate from that cache.
- Verification and registration use fresh **Firebase** tokens, not MFA JWTs. Verification HTTP 401
  receives one fresh-token retry; no real failure switches to mock. An uncertain registration may be
  retried explicitly with the same valid receipt and exact unchanged draft, without another photo/OCR.
- Background, Android window blur, route blur/unmount, cancellation, edits, and account changes discard
  verification and close the preview. Focus/permission restoration never automatically opens it.
  Cancelled native work retains its cleanup owner and blocks new stills until cleanup settles.
- Permission is explicitly rechecked instead of trusting Expo's cached hook. A requestable denial offers
  **Allow camera** again; permanent denial offers user-operated **Open Android settings** and
  **Check camera permission**. Bounded photo-size updates keep one camera view; startup has visible
  progress and a separate 15-second preview deadline, with capture gated on readiness and guide layout.
  Cancellation controls name the current stage and show cleanup progress before reopening is allowed.

The first user-operated live happy path passed on **2026-11-22** with reported registration success
and guarded local counts of **1 student / 1 receipt consumption** from a zero baseline. **Full live
Firebase/OCR/registration acceptance is still pending**. A later bulk **ALL PASSED** report also identified
permission-denial recovery, confusing controls, and a black first preview. The uncommitted follow-up
passes **191 signup / 62 registration / 50 capture** offline tests. After approved preview-only preflight
and handoff, the user reported **All is working now** and asked to move on. The UI issues are recorded as
user-confirmed resolved; further retests are stopped. This combined report does not establish separately
unevidenced fault/privacy/cleanup scenarios. New accounts, shutter tests, faults, observers, and cleanup
still require their own approval.
See the [integration contract](../../id-verification/docs/INTEGRATION.md) and
[Phase-3 acceptance matrix](../../id-verification/docs/ANDROID_SIGNUP_ACCEPTANCE.md).

### Local configuration

Use the app's gitignored `.env.local`. These are placeholders, not approved test targets:

```dotenv
EXPO_PUBLIC_USE_MOCK=false
EXPO_PUBLIC_API_BASE_URL=https://<approved-api-host>/api/v1
EXPO_PUBLIC_ID_VERIFICATION_ENDPOINT=https://<approved-verifier-host>/api/v1/id-verification
```

The verification value is the **full endpoint**, not just a host. Configure the existing Firebase client
fields for the approved matching project: `EXPO_PUBLIC_FIREBASE_API_KEY`, `AUTH_DOMAIN`, `PROJECT_ID`,
`STORAGE_BUCKET`, `MESSAGING_SENDER_ID`, and `APP_ID` (each with the `EXPO_PUBLIC_FIREBASE_` prefix).
Restart the owned Metro process after environment changes. Never put signer/HMAC/Admin credentials
or receipts in `EXPO_PUBLIC_*` variables; they are bundled client configuration, not secret storage.

`EXPO_PUBLIC_USE_MOCK` selects both verification and registration. Development defaults to mock if the
toggle is absent; live acceptance must explicitly use `false`. Mock mode still uses the native camera,
but does not upload its capture or perform live registration and is not live-identity evidence. Missing
`EXPO_PUBLIC_ID_VERIFICATION_ENDPOINT` in live mode disables capture and fails closed.

The earlier read-only audit found explicit live mode, no verification endpoint, and a main API targeting
a nonlocal database. The approved 2026-11-21 local acceptance setup uses process-only endpoint overrides
and a dedicated local database, plus separately approved development-key rotation; see the
[current Phase-3 setup](../../id-verification/docs/ANDROID_SIGNUP_ACCEPTANCE.md#approved-local-live-setup-2026-11-21).
Other targets still require approval; do not use an existing production database by assumption.
Production requires separate signing/HMAC material and its deployed issuer. No Azure deployment or
production migration is authorized by the local acceptance setup.

## Isolated Android capture proof (Phase 2)

The opt-in debug build uses `-PmonteaiCaptureProof=true` and package
`com.monteskolar.mobile.captureproof`, preserving `com.monteskolar.mobile` and its session/signing
configuration. `EXPO_PUBLIC_ENABLE_ID_CAPTURE_PROOF=true` enables only the diagnostic proof route;
the `/sign-up` integration is separate and does not require that diagnostic flag.

The proof does not call verification or registration. Its source audit, isolated build/instrumentation
commands, and accepted user-operated physical-camera evidence are in
[Android capture proof](../../id-verification/docs/ANDROID_CAPTURE_PROOF.md). That Phase-2 pass does
not count as live signup acceptance. Permission restoration and physical capture remain user-operated;
do not collect screenshots, image payloads, OCR text, or token/receipt diagnostics.

## Regression checks

From the repository root (Node >=22.15):

```powershell
pnpm test:signup
pnpm test:registration
pnpm test:capture
pnpm typecheck:all
pnpm lint
git diff --check
```

Signup runtime tests render actual TS/TSX with development-only `react-test-renderer@19.1.0`.
Native/Firebase/service boundaries are synthetic, storage is in memory, and non-fixture network
requests are blocked. Cached permission and stable camera-instance mocks guard the recovery/startup
changes; synthetic readiness cannot prove preview pixels on a device. See the Phase-3 document for
counts, coverage limits, and the pending live matrix.
