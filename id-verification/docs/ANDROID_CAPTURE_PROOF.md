# Phase 2: Android in-memory capture proof

Scope: **Android only**, camera only, front only, no liveness. This is not signup integration,
an OCR/receipt demo, a deployment, or a production-database change. iOS is explicitly unsupported.

## Capture path and source audit

`expo-camera` is pinned to **17.0.10**, the Expo SDK 54 compatible release. The host regression suite
pins SHA-256 hashes of its installed JS/native capture sources. A dependency change requires another
source audit and device run; updating a hash alone is not an audit.

The exercised Android branch is:

1. `CameraView.takePictureAsync` calls the native `takePicture` view method with fixed options:
   `pictureRef: true`, `skipProcessing: false`, `exif: false`, `base64: false`, `quality: 1`.
   No `onPictureSaved` callback or fast mode is used. Callers cannot supply alternate camera options.
2. `CameraViewModule` calls `ExpoCameraView.takePicture`. It uses CameraX's
   `ImageCapture.takePicture(executor, OnImageCapturedCallback)` **in-memory overload**, not
   `OutputFileOptions`/`OnImageSavedCallback`. `ImageProxy` planes are copied into a byte array and
   the proxy is closed. This is not video capture or a media-library call.
3. `ResolveTakenPicture` reads EXIF from `ByteArrayInputStream`, decodes/rotates the pixels, and
   resolves `PictureRef(Bitmap)` **before** its file-writing branch. Crucially, `skipProcessing`
   is checked first: setting it to true **writes a cache file even with `pictureRef: true`**.
   Exporting EXIF would also change pixel-orientation handling, so it stays false.
4. The local `VerificationCamera` Expo module accepts `SharedRef<Bitmap>`, crops/downscales directly
   into a bounded bitmap, calls `Bitmap.compress(JPEG, ..., BoundedJpegBuffer)`, and base64-encodes
   only that RAM buffer. It has no URI loader, save API, media-library call, or file output stream.

Do not use ordinary `takePictureAsync`, `PictureRef.savePictureAsync`, image-manipulator `saveAsync`,
or capture-then-delete. The module fails closed on web/iOS, Expo Go, a stale native client, a file-camera
result, an invalid guide/image, or failed screen protection. There is no gallery/file fallback.

The audited dependency sources are under `node_modules/expo-camera/`:
`build/CameraView.js`, `android/src/main/java/expo/modules/camera/{CameraViewModule,ExpoCameraView,Options,PictureRef}.kt`,
`tasks/ResolveTakenPicture.kt`, and the plane-copy helper in `analyzers/BarcodeAnalyzer.kt`.
CameraX in this release is `1.5.0-rc01`.

## Bounds, ownership, and privacy

- Guide aspect ratio is **720/1120**, matching `templates/cdm-front-v1.json` (portrait CDM card).
  Crop math accounts for the preview's default `FILL_CENTER` scaling and rounds outward.
  Keep the camera's `ratio` prop unset: SDK 54 changes ratio previews to `FIT_CENTER`.
- The proof selects the largest supported still size at or below 6 MP, with both sides at least
  900 pixels. CameraX can fall back; JS/native recheck the actual frame at 12 MP and 6000 pixels/edge.
  Output is not upscaled, has a maximum edge of 1600 pixels, and a minimum side of 450 pixels.
- The fixed RAM sink cannot exceed **2 MiB**. Qualities 88/80/72 are attempted only if needed;
  there is no disk spill. Base64 stays below about 2.67 MiB, leaving space within the backend's
  4 MiB JSON envelope / 3 MiB decoded-image limits. The server remains authoritative.
- Native encoding is destructive/one-shot: input and rendered bitmaps are recycled on success and
  failure; the mutable render and JPEG buffer are cleared. JS explicitly releases `PictureRef`.
  Cancellation must not recycle a bitmap while the encoder still owns it.
- `createMemoryCaptureSession` permits one native operation at a time, snapshots geometry, checks
  invalidation between stages, and promptly rejects cancellation or a 15-second watchdog timeout.
  Late native results still have a cleanup owner. A disposed session cannot be reused.
- The consumer receives a mutable image envelope and abort signal. Its base64 reference is cleared
  on success/failure/cancellation, including while a consumer is awaiting. **Consumers must not retain
  copies, serialize the image, or ignore cancellation.** No capture is kept in React state.
- Errors contain static messages/codes only, not native causes, paths, request objects, or images.
  New rendered JPEGs do not copy EXIF/GPS/camera-identifying metadata. No OCR or receipt is generated.
- Screen capture protection must finish before mounting a live preview. Camera views are unmounted
  on cancellation, background/inactive transitions, navigation blur, and route unmount. Returning
  to the foreground requires explicitly reopening the camera.
  Android window `blur`/`focus` is also observed: the notification drawer can blur a window without
  changing `AppState.currentState`. Blur invalidates capture; focus cannot override a background
  state and never automatically reopens the camera. All three lifecycle listeners are removed on unmount.
- The **Hold until cancel** proof control reports when a JPEG is actually held in RAM. It waits only
  for cancellation, background/unmount invalidation, or the existing 15-second safety watchdog;
  it can never complete as ordinary JPEG success. The watchdog also closes the preview. Starting a
  fresh file watch clears old summary/status text so results from a previous check cannot be mistaken
  for the current one. Do not edit or reload the JS client during a capture/watch acceptance interval.

No-persistence means **no application-controlled capture/file writes**, not cryptographic RAM erasure.
Immutable JS/JNI strings, SDK-owned capture bytes, camera-driver buffers, and OS internals are outside
the module's zeroization control. Do not promise secure heap erasure, and do not enable payload logging,
analytics, network-body inspection, crash attachments, or screenshots when later wiring verification.

## Local checks and isolated device build

From the repo root:

```powershell
pnpm test:capture
pnpm --filter mobile typecheck
pnpm --filter mobile lint
```

From `apps/mobile/android/` (existing native project; no signing-key replacement or broad prebuild):

```powershell
$env:NODE_ENV = 'development'
.\gradlew.bat :verification-camera:testDebugUnitTest :verification-camera:assembleDebugAndroidTest :app:assembleDebug -PmonteaiCaptureProof=true -PreactNativeArchitectures=arm64-v8a --max-workers=2 --no-parallel --console=plain
```

The checked-in `withCaptureProof.cjs` config plugin makes the Gradle property reproducible on future
prebuilds. It changes **only** the opt-in debug application's ID to
`com.monteskolar.mobile.captureproof`; the installed `com.monteskolar.mobile`, its session/data, normal
debug/release IDs, and signing configuration are untouched. Do not uninstall/reset the student app
to install the proof. `android/` remains the project's existing gitignored generated directory.

Use an explicit ADB serial from `adb devices -l` (wireless aliases can refer to the same phone).
Install/run the standalone instrumentation APK, from the repo root:

```powershell
adb -s <serial> install -r apps/mobile/modules/verification-camera/android/build/outputs/apk/androidTest/debug/verification-camera-debug-androidTest.apk
adb -s <serial> shell am instrument -w -e class expo.modules.verificationcamera.MemoryJpegEncoderTest expo.modules.verificationcamera.test/androidx.test.runner.AndroidJUnitRunner
```

Those tests generate pixels in RAM, validate real Android JPEG round trips/cropping/dimension and
size limits/metadata removal/failure disposal, and exercise the passive file observer. The positive
control intentionally creates/deletes **one empty sentinel** in the isolated test package to prove
transient file creation is detected. It never writes a capture or encoded image.

Start a Metro instance for the gated proof (repo root; environment is process-local, not written to `.env`):

```powershell
$env:EXPO_PUBLIC_ENABLE_ID_CAPTURE_PROOF = 'true'
$env:CI = '1' # disable Fast Refresh during acceptance; restart this owned Metro process after proof edits
pnpm --filter mobile exec expo start --localhost --port 8081
```

Then install the separate debug app and connect that phone to Metro:

```powershell
adb -s <serial> install -r apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
adb -s <serial> reverse tcp:8081 tcp:8081
adb -s <serial> shell am start -n com.monteskolar.mobile.captureproof/com.monteskolar.mobile.MainActivity -a android.intent.action.VIEW -d mobile:///id-capture-proof
```

If port 8081 is already used, do not stop an unfamiliar service. Use another port and matching
`-PreactNativeDevServerPort=<port>` in the native build and reverse command. Never put images/tokens
in a deep link. Expo Go does not contain the local native module.

## Recorded validation (2026-11-19)

- Host capture suite: **50 passed**, including the pinned upstream source guards, cancellation/
  late-result cleanup checks, the abort-only hold regression beyond the old five-second deadline,
  and Android activity/window-focus handling with idempotent listener disposal.
  Shared registration-foundation regression: **62 passed**.
- Mobile TypeScript check: **passed**. Mobile lint: **0 errors**, only the pre-existing
  `AnimatedSplashScreen.tsx` dependency warning; the proof cleanup warning is resolved.
- Isolated Android debug build: **passed** with two workers, no parallel project execution, and
  `arm64-v8a`. The JVM buffer report records **5 tests, 0 failures, 0 errors**.
- The standalone native test APK's package and self-targeting runner were checked before installing.
  On the wireless-connected **TECNO LJ8k, Android API 35 / arm64-v8a**, instrumentation returned
  **OK (8 tests)**. This includes real JPEG decoding, crop/size/metadata checks, source disposal on
  failure, zero observed encoder writes, and the transient empty-file positive control.
- The app APK was separately checked as **`com.monteskolar.mobile.captureproof`**, installed, and
  connected to the gated localhost Metro process through ADB reverse. The existing student package
  was not replaced, reset, or uninstalled. No signing keys, Azure deployment, or database were changed.
- Manual proof: the user confirmed the camera preview and one physical capture with the safe status
  "JPEG/base64 produced in RAM and discarded", **842 × 1310 pixels**, and **135819 JPEG bytes**.
  This confirms a successful physical-capture/native-encoding path within the configured bounds;
  the status message alone does not establish zero filesystem writes.
- The user then reported the stopped file-watch result: **14 directories, 0 write events, coverage
  complete**. The normal-capture interval passes this scoped observation check; it is not a universal
  filesystem guarantee. Explicit repetition is recorded separately below.
- Manual encode-failure proof returned the expected static message, "The card could not be processed
  safely. Please retake it." A metadata-only UI read then confirmed the stopped watch: **14 directories,
  0 write events, coverage complete**. No screenshot or image payload was read.
- For the hold/cancel check, the user completed the instructed sequence and reported a stopped watch
  with **14 directories, 0 write events, coverage complete**. The user clarified that JPEG success was
  already visible **before** tapping Cancel: the old five-second hold had completed, so this was not a
  valid interrupted-capture test or evidence of a post-cancel stale completion. The proof now uses an
  abort-only hold with an explicit held-in-RAM message.
- On the abort-only retest, the user reported the expected **"Capture discarded; camera closed."**
  message, then confirmed the latest watch was **stopped, 0 write events, coverage complete**. This
  cancellation retest passes on the manual report; counters from the old timed test are not reused.
- For the Home/background check, the user reported a stopped watch with **14 directories, 0 write
  events, coverage complete**, then explicitly confirmed Home was pressed after the held-in-RAM
  message. Returning through Recent apps left the camera closed with no later JPEG success. This
  background check passes on the manual report.
- The user reported the notification-drawer check **passed** against the requested closed-camera,
  no-later-JPEG-success, and zero-write/complete-coverage expectations. This is a manual pass report;
  the fresh interval's raw Watch line and directory count were not separately supplied or independently
  read. The Home test's counters are not reused for this interval.
- For leave-proof/unmount, the user reported leaving after the instructed hold sequence. A direct link
  reopened the existing activity without restarting it; a safe metadata-only UI read confirmed the
  camera was closed and the same watch was still running with **14 directories, 0 writes, complete
  coverage**. The user then reported the final stopped watch with the same counters. This unmount
  check passes; the observer was not reset between leaving and returning.
- After returning from unmount, the user explicitly reported two normal captures, both **842 × 1310
  pixels**, with **126324** and **129564 JPEG bytes**, respectively. Both results are within the
  configured output bounds, and the user confirmed both displayed **"payload discarded"**. The user
  also confirmed the latest stopped-watch result was **0 writes, complete coverage**. Repeated capture
  and reopening after interruption pass on that manual report; the directory count was not separately
  restated, and these final counters were not independently read.
- For permission denial, the user reported disabled capture controls. A read-only Android package
  query independently confirmed **`android.permission.CAMERA: granted=false`**, with `USER_SET` and
  `USER_FIXED` flags, specifically for **`com.monteskolar.mobile.captureproof`**. This establishes actual
  OS permission denial rather than merely closed-camera/busy controls. The final proof UI hierarchy
  was unavailable during the attempted metadata-only read, so disabled-control behavior remains a
  manual report; the audited path has no file/gallery fallback. The agent did not change permissions.
- **Phase 2 physical-camera acceptance passed on the tested Android device.** The user elected to
  operate physical checks manually; the matrix distinguishes manual reports from independent safe-state
  reads. No screenshots, captured images, or payload diagnostics were collected. No verification/
  registration call has been exercised.

## Physical-camera acceptance matrix

Use a blank/non-sensitive portrait test card. The proof displays **only** safe status text, dimensions,
JPEG byte counts, and file-write counters; it does not show the captured image or call either API.

1. Allow camera permission, open the camera, and wait for its bounded still size to become ready.
2. Start the debug file watch **after** startup/permission/setup writes have settled.
3. Exercise each row below in a fresh watch interval; wait for late native callbacks to settle before
   stopping the watch. Repeat and reopen the camera as needed.
4. Any observed write is a failed/ambiguous interval: investigate without reading or logging file
   contents, then rerun. Do not dismiss it merely because no file remains afterward.
5. For cancellation/background/unmount rows, choose **Hold until cancel**, wait for **JPEG held in RAM
   for cancellation test**, then interrupt it. After cancellation, wait five seconds and confirm the
   preview stays closed and no JPEG success/summary appears before stopping the watch. If the 15-second
   safety timeout occurs before the manual interruption, reopen and retry; do not count it as that test.

| Scenario | Expected behavior | Device evidence |
| --- | --- | --- |
| Open camera preview | Camera permission opens the isolated proof preview | User confirmed working (2026-11-19); capture and file-watch checks recorded separately below |
| Capture front | Valid bounded JPEG/base64; payload discarded; no observed writes | Manual pass (2026-11-19): 842 × 1310, 135819 JPEG bytes; stopped watch: 14 directories, 0 writes, complete coverage |
| Repeat capture | Fresh bounded JPEG/base64 on each capture; no concurrent operation or observed writes | Manual pass (2026-11-19): two captures, both 842 × 1310, first 126324 JPEG bytes, second 129564 JPEG bytes; both payloads discarded; latest stopped watch confirmed as 0 writes, complete coverage |
| Test encode failure | Actual capture, native rejection, source disposed; safe error; no writes | Manual pass (2026-11-19): expected static processing error; stopped watch independently read as 14 directories, 0 writes, complete coverage |
| Hold then cancel | Immediate invalidation/closed preview; no stale completion/image retention | Manual abort-only retest passed (2026-11-19): expected capture-discarded/camera-closed message; latest stopped watch confirmed as 0 writes, complete coverage. Old five-second hold was not a valid interruption test |
| Hold then background (Home) | Camera closes; explicit reopen required; no stale completion | Manual pass (2026-11-19): Home pressed after held-in-RAM message; camera stayed closed on return with no later JPEG success; stopped watch: 14 directories, 0 writes, complete coverage |
| Hold then window blur (notification drawer) | Active app's blurred window discards capture; returning focus does not reopen the preview | Manual pass reported (2026-11-19) against requested closed-camera/no-later-success and zero-write/complete-coverage criteria; raw Watch line not separately supplied or independently read |
| Hold then leave proof (unmount) | Camera closes; late work discarded; no stale state updates | Manual pass (2026-11-19): existing activity reopened without restart; closed camera and same running watch independently read; final stopped watch reported: 14 directories, 0 writes, complete coverage |
| Permission denied | No capture and no file/gallery fallback | Pass (2026-11-19): disabled capture controls reported; read-only OS check independently confirmed CAMERA granted=false for the proof package; audited path has no file/gallery fallback |
| Reopen/repeat after interruption | Fresh session; no concurrent capture or stale result | Manual pass (2026-11-19): reopen after unmount produced two bounded, discarded normal captures; latest stopped watch confirmed as 0 writes, complete coverage |

The debug observer counts create/modify/close-write/move-in events in all readable app-private
directories and existing app-scoped external directories, including files deleted immediately.
It records neither names nor contents in reports. It intentionally spans navigation unmount, so return
to the proof route and stop it after testing that case; host destruction stops all observer handles.
Coverage must be complete and the event count zero. Its scope excludes unrelated/OS/vendor storage;
combine observation with the source audit rather than treating a zero counter as a universal guarantee.

**Phase 2 Android capture-proof gate passed (2026-11-19)** on the tested device, based on the combined
source audit, host/native checks, and documented physical-camera/lifecycle acceptance reports above.
Native JPEG tests alone do **not** prove physical-camera acquisition, and host fakes alone do **not**
prove native encoding. Zero-write results remain scoped observations, not a universal filesystem
guarantee. No iOS evidence is required under the agreed Android-only scope. Later mobile signup, web,
and desktop integration still require separate phases. No Azure deployment, database change, or
signing-key replacement occurred at the 2026-11-19 checkpoint. Phase-2/Phase-3 implementation was later
committed as `0c7fa1a`; current live-signup setup, uncommitted permission/control/first-preview follow-up,
and pending device evidence are tracked separately in
[the Android signup acceptance document](ANDROID_SIGNUP_ACCEPTANCE.md).
The Phase-2 pass does not verify those later signup UI fixes; preview-only retests cannot establish
native/transport cancellation or whole-signup privacy.
