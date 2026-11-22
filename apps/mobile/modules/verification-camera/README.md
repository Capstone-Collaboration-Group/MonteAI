# VerificationCamera (Android only)

Local Expo SDK 54 module for destructive in-memory `SharedRef<Bitmap>` crop/scale/JPEG/base64 encoding.
It does not acquire files, save images, request gallery access, or verify/register students.
Capture comes from the audited, pinned `expo-camera` `PictureRef` branch with `skipProcessing: false`.

Use `getVerificationCamera()` and `createMemoryCaptureSession`; never call a camera save API or retain
the encoded envelope. Expo Go and iOS are unsupported. Rebuild the native client after module edits.

The debug-only proof is `/id-capture-proof`, gated by `EXPO_PUBLIC_ENABLE_ID_CAPTURE_PROOF=true` and
`__DEV__`. Its separate Android package avoids replacing the installed student app.

See [`ANDROID_CAPTURE_PROOF.md`](../../../../id-verification/docs/ANDROID_CAPTURE_PROOF.md) for the
audit, ownership/bounds, synthetic native tests, safe file-write observation, and device acceptance gate.
