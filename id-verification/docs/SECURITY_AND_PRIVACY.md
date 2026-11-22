# Security, privacy, and capture disposal

## Data lifecycle

1. The client obtains one front-side frame from a live camera. No gallery/file input is permitted.
2. Production TLS transports a short-lived Firebase token, structured registration identity, and base64
   image. The separately approved local HTTP-loopback acceptance setup is not production TLS evidence.
3. The Function authenticates first, atomically reserves quota, decodes in memory, locates/warps the
   card, compares fixed artwork/colors, and runs packaged OCR.
4. Mutable image byte arrays and NumPy arrays are overwritten in `finally` paths. OCR result references
   are dropped, and no result is retained in the service singleton.
5. Success returns a signed, 10-minute receipt; failure returns only a stable code/message/request ID.

The application never intentionally writes captures, crops, OCR text, or biometric templates to disk,
Blob Storage, Table Storage, SQL, logs, receipts, or third-party vision services. The two checked-in PNG
assets contain only cropped school artwork and were manually inspected for personal content.

Python, browser, HTTP-runtime, and OS allocators can copy immutable request/base64 strings and cannot
guarantee immediate physical zeroization. “Discard” here means no intentional persistence, overwrite
of owned mutable buffers, prompt reference release, and process-memory reclamation on termination. If
legal policy requires certified memory erasure or proof about Azure front-end buffering, obtain a
platform/legal review before deployment.

## Persisted service data

Azure Table Storage contains only:

- UTC monthly aggregate attempt/charged-second counters
- daily/monthly per-user counters keyed by HMAC of `month:Firebase UID`
- short-lived reservation rows containing only reserved seconds

The HMAC changes by month and raw UIDs/emails are not stored. A crash conservatively leaves the full
30-second reservation charged; settlement is conditional and single-use. The deployment Blob container
holds code, public OCR weights, and sanitized template artwork—not requests.

Receipts contain email, normalized name components, and student number. They are signed but readable;
consumers must treat them as sensitive and redact them everywhere. Client receipts are opaque,
unencrypted **RS256 JWTs with a 600-second TTL**: never decode, inspect, log, persist, put them into URLs,
or expose them to UI state, diagnostics, crash reporting, or analytics. Keep them only in the per-signup
controller closure. Only explicit registration-only retry may reuse a still-unexpired receipt with the
exact unchanged draft; expiry, edits, cancellation, account changes, and leaving discard it.

## Browser capture boundary

Web capture uses audio-free `getUserMedia` and `video.srcObject`, then draws only the portrait front-ID
guide into an unattached bounded canvas. `toBlob("image/jpeg", 0.86)` and `arrayBuffer` stay in memory;
there is no file/gallery picker, `takePhoto`, `FileReader`, data/object URL, image cache, or temporary
capture file. Requested frames are under 6 MP; actual input is rejected above 12 MP or 6000 pixels per
edge, and JPEG output is limited to 2 MiB / 1600 pixels per edge with a 450-pixel minimum shorter edge.

Cancellation immediately stops/detaches preview media and clears owned encoded/request references.
Non-abortable media, playback, encoder, Firebase, and transport work retains an opaque cleanup lease
until it actually settles, including after unmount. Late byte buffers are overwritten and the canvas is
reset after encoder completion, never recycled while encoding is pending. This is ownership/reference
disposal, **not certified physical memory zeroization** of browser, OS, immutable Blob, or string copies.

Browser screenshots and screen recordings cannot be prevented by this implementation. The signup UI
states that limitation and asks users not to record/share the screen; it makes no screenshot-blocking
or liveness claim. Only the structured registration details are rendered, never a captured image, OCR
output, or receipt. Safe pending storage contains allowlisted profile/consent fields only.

No live browser privacy observer, capture/signup, raw traffic/log inspection, or account/database
cleanup was authorized in the **original closed offline web phase**. The subsequent separately approved
local phone/web setup, guarded student deletion, daily-only quota reset, and user-confirmed registration
are recorded in [web signup acceptance](WEB_SIGNUP_ACCEPTANCE.md). No dedicated live privacy observer or
new post-registration counts were collected. [Phase 6](RELEASE_CHECKS.md) adds offline/static release
evidence only; it authorizes no further live work, cleanup, resets, or deployment.

## Authentication and abuse controls

- Firebase tokens use Google's public X.509 endpoint, pinned project audience/issuer, `RS256`, strict
  single audience, time claims, verified non-anonymous email, and no Firebase tenant.
- Unknown certificate IDs are refresh-rate-limited; certificate/storage failure is fail-closed.
- Allowed browser origins are exact values. CORS is not authorization and non-browser callers remain
  possible.
- Quota admission is a conditional Azure Table transaction shared by all cold workers.
- One request runs per Function instance and one inference runs per Python worker.
- Request size/pixels/type, decode bombs, OCR confidence, geometry, and an 18-second cooperative
  pipeline deadline are bounded. The Functions host has a 30-second invocation timeout.
- `IDV_ENABLED=false` is an operational kill switch for new attempts.

No liveness, face comparison, revocation lookup, hologram/UV/NFC check, or back-side check exists. A
high-quality copy or presentation attack may pass. Manual review/recovery must exist for students whose
valid worn/accessibility-constrained cards repeatedly fail.

## Logging rules

Function application logs contain only generated request ID, result code, elapsed milliseconds, and
quota settlement warnings (plus a static initialization-failure code). Never enable body/header
capture, print exceptions containing decoder input, or log Authorization/receipt values. Application
Insights is intentionally absent from the Bicep template; review any platform diagnostic settings
separately before production. This is not a claim that all existing main-API logs are PII-free: existing
UID logs and the legacy `resolve-login` email log require a separately scoped production logging review.

The legacy `demo/app.js` renders receipts. It is **unsupported for live accounts/captures**, excluded
from the audited ZIP, and must not be used to inspect receipts or as a production integration example.

## Model and dependency controls

OCR uses public PP-OCRv5 ONNX weights pinned by SHA-256 in `models/manifest.json`. Downloads occur only
through `tools.prepare_models`; startup verifies packaged hashes, and inference uses explicit local model
paths. Tests deny sockets/download methods during real packaged inference. Python dependencies are
version/hash locked in `requirements.txt`.

Phase 6 found that the model manifest declares Apache-2.0 but the source ZIP contains no LICENSE/NOTICE
files. Review weight provenance, required license/attribution delivery, dependency notices, and school
artwork usage rights before distribution. Installed dependency metadata is not licensing or CVE
sign-off. Direct Core Tools publishing is also unaudited for local Azurite artifacts; use only a
reviewed whitelist ZIP after closing its release gates. Neither packaging nor `.funcignore` was changed.

Before each release:

1. run all frontend/server/Function, isolated local-Azurite, offline-model, lint, typecheck, build, and
   offline Bicep checks per [RELEASE_CHECKS.md](RELEASE_CHECKS.md);
2. inspect `git diff` and package contents for captures, local settings, manifests with real identity,
   keys, and generated logs;
3. validate representative held-out cards and false-accept/false-reject rates;
4. test client cleanup on success, retake, cancellation, timeout, app backgrounding, and process death;
5. complete licensing/dependency and platform-diagnostics review, and separately approve any required
   production rotation if secrets were ever printed or added to source control.
