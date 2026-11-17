# Security, privacy, and capture disposal

## Data lifecycle

1. The client obtains one front-side frame from a live camera. No gallery/file input is permitted.
2. TLS transports a short-lived Firebase token, structured registration identity, and base64 image.
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
consumers must treat them as sensitive and redact them everywhere.

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

Application logs contain only generated request ID, result code, elapsed milliseconds, and quota
settlement warnings. Never enable body/header capture, print exceptions containing decoder input, or log
Authorization/receipt values. Application Insights is intentionally absent from the Bicep template;
review any platform diagnostic settings separately before production.

## Model and dependency controls

OCR uses public PP-OCRv5 ONNX weights pinned by SHA-256 in `models/manifest.json`. Downloads occur only
through `tools.prepare_models`; startup verifies packaged hashes, and inference uses explicit local model
paths. Tests deny sockets/download methods during real packaged inference. Python dependencies are
version/hash locked in `requirements.txt`.

Before each release:

1. run all unit, Azurite, offline-model, lint, and Bicep checks;
2. inspect `git diff` and package contents for captures, local settings, manifests with real identity,
   keys, and generated logs;
3. validate representative held-out cards and false-accept/false-reject rates;
4. test client cleanup on success, retake, cancellation, timeout, app backgrounding, and process death;
5. rotate production secrets if they were ever printed or added to source control.
