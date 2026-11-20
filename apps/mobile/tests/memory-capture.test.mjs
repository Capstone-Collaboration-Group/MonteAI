import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { setImmediate, setTimeout as delay } from 'node:timers/promises';
import { describe, test } from 'node:test';
import { inspect } from 'node:util';
import { CAPTURE_POLICY, createMemoryCaptureSession, getGuideCrop, getIdCaptureGuide,
  ID_CARD_ASPECT_RATIO, MAX_JPEG_BYTES, MEMORY_PICTURE_OPTIONS, MemoryCaptureError,
  selectPictureSize } from '../lib/idCapture/memoryCapture.ts';
import { holdUntilCaptureAbort, observeCaptureActivity } from '../lib/idCapture/captureProof.ts';

const require = createRequire(import.meta.url);
const root = new URL('../../../', import.meta.url);
const SECRET = 'synthetic-sensitive-error-marker';
const preview = { width: 400, height: 600 };
const layout = { preview, guide: getIdCaptureGuide(preview) };
// Synthetic JPEG marker only; actual Android decode/encode is covered on-device.
const jpeg = () => ({ width: 720, height: 1120, byteLength: 4, mimeType: 'image/jpeg', imageBase64: '/9j/2Q==' });

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function fixture(overrides = {}, timeout = 15_000) {
  const events = [];
  const image = jpeg();
  const picture = { width: 3000, height: 4000, nativeRefType: 'image', release() { events.push('release'); } };
  const dependencies = {
    async capture(options) { events.push(['capture', options]); return picture; },
    async encode(reference, crop) { events.push(['encode', reference === picture, crop]); return image; },
    disposePicture(reference) { events.push(['dispose', reference === picture]); },
    ...overrides,
  };
  return { session: createMemoryCaptureSession(dependencies, timeout), events, picture, image };
}

function safeError(code) {
  return error => {
    assert.ok(error instanceof MemoryCaptureError);
    assert.equal(error.code, code);
    for (const key of ['cause', 'picture', 'imageBase64', 'config', 'request', 'response', 'uri']) {
      assert.equal(error[key], undefined);
    }
    assert.ok(!inspect(error).includes(SECRET));
    assert.ok(!JSON.stringify(error).includes(SECRET));
    return true;
  };
}

describe('audited Android capture dependency and build isolation', () => {
  const cameraRoot = dirname(require.resolve('expo-camera/package.json'));
  const cameraPackage = JSON.parse(readFileSync(resolve(cameraRoot, 'package.json'), 'utf8'));
  const mobilePackage = JSON.parse(readFileSync(new URL('apps/mobile/package.json', root), 'utf8'));
  test('pins the exact audited Expo SDK 54 camera', () => {
    assert.equal(cameraPackage.version, '17.0.10');
    assert.equal(mobilePackage.dependencies['expo-camera'], '17.0.10');
  });

  // Manual audit of these installed sources establishes the branch used below.
  // A changed dependency must be re-audited, not accepted by updating hashes alone.
  for (const [path, expected] of [
    ['build/CameraView.js', '4e3bc7b649579aa4f9d3650b2b3def5ad516f8193f7ed3c914c6104465a63a7b'],
    ['android/src/main/java/expo/modules/camera/ExpoCameraView.kt', '9e5bf6c2b46560e855deea46b36b44ef0e5b7bbafc9efc446352ae9c2d3e2c32'],
    ['android/src/main/java/expo/modules/camera/CameraViewModule.kt', 'e845933868e33b4799c39c1a4fd4c1ed8cba52cab8092b98f84fcd0f04d30151'],
    ['android/src/main/java/expo/modules/camera/tasks/ResolveTakenPicture.kt', '4bf1d61c55c8a19b938e8553a1c50bfcbc2713a9894454fb7053a4aa01e59286'],
    ['android/src/main/java/expo/modules/camera/PictureRef.kt', '7f5f0b375a23d2c59e8be6c53e84d3102280181bc7d7b3d727c6aba8f49817b2'],
    ['android/src/main/java/expo/modules/camera/Options.kt', '6418bf36bf1af49495dd1054851541615487f1792ac05a6b1d2d5c6618ed60ae'],
  ]) {
    test(`audited source unchanged: ${path}`, () => {
      assert.equal(createHash('sha256').update(readFileSync(resolve(cameraRoot, path))).digest('hex'), expected);
    });
  }

  test('uses SharedRef memory input and contains no native file-writing/URI/logging APIs', () => {
    const base = new URL('apps/mobile/modules/verification-camera/android/src/main/java/expo/modules/verificationcamera/', root);
    const encoder = readFileSync(new URL('MemoryJpegEncoder.kt', base), 'utf8');
    const buffer = readFileSync(new URL('BoundedJpegBuffer.kt', base), 'utf8');
    const module = readFileSync(new URL('VerificationCameraModule.kt', base), 'utf8');
    assert.match(module, /picture: SharedRef<Bitmap>/);
    assert.match(encoder, /output\.compress\(Bitmap\.CompressFormat\.JPEG/);
    assert.match(encoder, /dispose\(source\)/);
    assert.match(buffer, /bytes\.fill\(0\)/);
    for (const content of [encoder, buffer, module]) {
      assert.doesNotMatch(content, /FileOutputStream|java\.io\.File\b|createTempFile|contentResolver|savePicture|saveAsync|\.printStackTrace\(|Log\.[deiw]\(/);
    }
  });

  test('Android only; proof plugin is opt-in, debug-only, and idempotent', () => {
    const config = JSON.parse(readFileSync(new URL('apps/mobile/modules/verification-camera/expo-module.config.json', root), 'utf8'));
    assert.deepEqual(config.platforms, ['android']);
    const { addCaptureProofVariant } = require('../plugins/withCaptureProof.cjs');
    const first = addCaptureProofVariant('existing user build config\n');
    assert.equal(addCaptureProofVariant(first), first);
    assert.ok(first.startsWith('existing user build config\n'));
    assert.match(first, /findProperty\('monteaiCaptureProof'\)/);
    assert.match(first, /android\.buildTypes\.debug\.applicationIdSuffix = '\.captureproof'/);
    assert.doesNotMatch(first, /signingConfig|release\.applicationIdSuffix/);
    const app = JSON.parse(readFileSync(new URL('apps/mobile/app.json', root), 'utf8'));
    const camera = app.expo.plugins.find(value => Array.isArray(value) && value[0] === 'expo-camera');
    assert.equal(camera[1].recordAudioAndroid, false);
    assert.equal(camera[1].microphonePermission, false);
  });

  test('proof is explicitly gated and never uses persistence or image previews', () => {
    const proof = readFileSync(new URL('apps/mobile/app/id-capture-proof.tsx', root), 'utf8');
    assert.match(proof, /!__DEV__/);
    assert.match(proof, /EXPO_PUBLIC_ENABLE_ID_CAPTURE_PROOF !== 'true'/);
    assert.match(proof, /Platform\.OS !== 'android'/);
    assert.match(proof, /preventScreenCaptureAsync/);
    assert.doesNotMatch(proof, /AsyncStorage|FileSystem|console\.|<Image\b|data:image|imageBase64|idVerificationService|authService|receipt:/);
    assert.doesNotMatch(proof, /\bratio=/); // SDK 54 switches ratio previews to FIT_CENTER
    assert.equal(CAPTURE_POLICY, 'android-memory-jpeg-v1');
  });

  test('proof hold is abort-only, negative tests cannot show success, and fresh watches clear old summaries', () => {
    const proof = readFileSync(new URL('apps/mobile/app/id-capture-proof.tsx', root), 'utf8');
    const hold = readFileSync(new URL('apps/mobile/lib/idCapture/captureProof.ts', root), 'utf8');
    assert.match(proof, /await holdUntilCaptureAbort\(signal\)/);
    assert.match(proof, /JPEG held in RAM for cancellation test/);
    assert.match(proof, /if \(proofMode !== 'normal'\) throw new MemoryCaptureError/);
    assert.match(proof, /if \(start\) \{\s*setSummary\(null\)/);
    assert.match(proof, /error\.code === 'timeout'\) closeCamera\(\)/);
    assert.doesNotMatch(hold, /setTimeout|\bresolve\(/);
    assert.doesNotMatch(proof, /setTimeout\(finish, 5000\)/);
  });

  test('proof closes the camera on Android activity/window blur; focus never reopens it', () => {
    const proof = readFileSync(new URL('apps/mobile/app/id-capture-proof.tsx', root), 'utf8');
    assert.match(proof, /return observeCaptureActivity\(AppState, active =>/);
    assert.match(proof, /if \(!active\) \{\s*closeCamera\(\)/);
    const callback = proof.slice(proof.indexOf('return observeCaptureActivity('), proof.indexOf('}, [closeCamera, encoder]'));
    assert.doesNotMatch(callback, /setCameraOpen\(true\)|openCamera\(\)/);
  });
});

describe('Android capture activity/window focus observation', () => {
  function activityFixture(initial = 'active') {
    const listeners = new Map();
    const removed = [];
    const events = [];
    const source = {
      currentState: initial,
      addEventListener(type, callback) {
        listeners.set(type, callback);
        return { remove() { removed.push(type); listeners.delete(type); } };
      },
    };
    const dispose = observeCaptureActivity(source, active => events.push(active));
    return { source, events, listeners, removed, dispose,
      change(state) { source.currentState = state; listeners.get('change')?.(state); },
      blur() { listeners.get('blur')?.(); },
      focus() { listeners.get('focus')?.(); },
    };
  }

  test('notification-drawer blur closes an otherwise active window', () => {
    const f = activityFixture();
    assert.deepEqual(f.events, [true]);
    f.blur();
    assert.equal(f.source.currentState, 'active');
    assert.equal(f.events.at(-1), false);
    f.focus();
    assert.equal(f.events.at(-1), true);
    f.dispose();
  });

  test('foreground change cannot override blur until window focus returns', () => {
    const f = activityFixture();
    f.blur();
    f.change('background');
    f.change('active');
    assert.equal(f.events.at(-1), false);
    f.focus();
    assert.equal(f.events.at(-1), true);
    f.dispose();
  });

  test('focus alone cannot activate a background or unknown app state', () => {
    const f = activityFixture('unknown');
    assert.deepEqual(f.events, [false]);
    f.focus();
    assert.equal(f.events.at(-1), false);
    f.change('background');
    f.blur();
    f.focus();
    assert.equal(f.events.at(-1), false);
    f.change('active');
    assert.equal(f.events.at(-1), true);
    f.dispose();
  });

  test('dispose removes every listener and ignores already-queued events', () => {
    const f = activityFixture();
    const queued = [...f.listeners.values()];
    f.dispose();
    f.dispose();
    assert.equal(f.listeners.size, 0);
    assert.deepEqual(f.removed, ['change', 'blur', 'focus']);
    queued.forEach(callback => callback('background'));
    assert.deepEqual(f.events, [true]);
  });
});

describe('abort-only cancellation proof consumer', () => {
  test('a pre-aborted signal exposes only a static cancellation error', async () => {
    const controller = new AbortController();
    controller.abort(Object.assign(new Error(SECRET), { imageBase64: SECRET }));
    await assert.rejects(holdUntilCaptureAbort(controller.signal), safeError('cancelled'));
  });

  test('manual cancellation immediately clears the held envelope and finishes cleanup', async () => {
    const started = deferred();
    const f = fixture();
    const task = f.session.capture(layout, async (_image, signal) => {
      started.resolve();
      await holdUntilCaptureAbort(signal);
    });
    const rejection = assert.rejects(task, safeError('cancelled'));
    await started.promise;
    assert.notEqual(f.image.imageBase64, '');
    assert.equal(f.events.at(-1), 'release');
    f.session.dispose();
    assert.equal(f.image.imageBase64, '');
    await rejection;
    await setImmediate();
    assert.equal(f.session.busy, false);
    assert.equal(f.events.filter(event => event === 'release').length, 1);
  });

  test('safety timeout clears the held envelope without reporting JPEG success', async () => {
    const started = deferred();
    const f = fixture({}, 25);
    const task = f.session.capture(layout, async (_image, signal) => {
      started.resolve();
      await holdUntilCaptureAbort(signal);
    });
    const rejection = assert.rejects(task, safeError('timeout'));
    await started.promise;
    await rejection;
    await setImmediate();
    assert.equal(f.image.imageBase64, '');
    assert.equal(f.session.busy, false);
    assert.equal(f.events.filter(event => event === 'release').length, 1);
  });

  test('hold remains pending beyond the old five-second auto-success deadline', { timeout: 15_000 }, async () => {
    const started = deferred();
    const f = fixture({}, 12_000);
    const task = f.session.capture(layout, async (_image, signal) => {
      started.resolve();
      await holdUntilCaptureAbort(signal);
    });
    const rejection = assert.rejects(task, safeError('cancelled'));
    try {
      await started.promise;
      await delay(5100);
      assert.equal(f.session.busy, true);
      assert.notEqual(f.image.imageBase64, '');
    } finally {
      f.session.dispose();
      await rejection;
    }
    assert.equal(f.image.imageBase64, '');
  });
});

describe('guide geometry and bounded still-size selection', () => {
  test('guide matches the authoritative portrait template and fits the preview', () => {
    const template = JSON.parse(readFileSync(new URL('id-verification/templates/cdm-front-v1.json', root), 'utf8'));
    assert.equal(ID_CARD_ASPECT_RATIO, template.width / template.height);
    for (const size of [preview, { width: 800, height: 300 }, { width: 300, height: 800 }]) {
      const guide = getIdCaptureGuide(size);
      assert.ok(Math.abs(guide.width / guide.height - ID_CARD_ASPECT_RATIO) < 1e-10);
      assert.ok(guide.originX >= 0 && guide.originY >= 0);
      assert.ok(guide.originX + guide.width <= size.width);
      assert.ok(guide.originY + guide.height <= size.height);
    }
  });
  test('maps cover preview offsets into the upright native image, rounding outward', () => {
    assert.deepEqual(getGuideCrop(layout, { width: 3000, height: 4000 }), { originX: 420, originY: 320, width: 2160, height: 3360 });
    const size = { width: 1000, height: 1000 };
    const wide = { width: 600, height: 400 };
    const full = getGuideCrop({ preview: wide, guide: { originX: 0, originY: 0, ...wide } }, size);
    assert.equal(full.originX, 0);
    assert.equal(full.originY, 166);
    assert.equal(full.width, 1000);
    assert.equal(full.height, 668);
  });
  for (const [name, badLayout] of [
    ['missing', null], ['zero preview', { ...layout, preview: { width: 0, height: 1 } }],
    ['NaN guide', { ...layout, guide: { ...layout.guide, originX: NaN } }],
    ['out of preview', { ...layout, guide: { ...layout.guide, originX: 999 } }],
  ]) {
    test(`invalid ${name} layout is rejected before camera use`, async () => {
      const f = fixture();
      await assert.rejects(f.session.capture(badLayout, async () => {}), safeError('invalid_layout'));
      assert.deepEqual(f.events, []);
    });
  }
  test('rejects oversized input and crops too small for the verification backend', () => {
    assert.throws(() => getGuideCrop(layout, { width: 4000, height: 4000 }), safeError('invalid_image'));
    assert.throws(() => getGuideCrop(layout, { width: 400, height: 600 }), safeError('invalid_image'));
  });
  test('chooses the largest bounded size; ignores malformed, tiny, and huge sizes', () => {
    assert.equal(selectPictureSize(['4000x3000', '2560x1920', '1920x1080', '720x480', '999999x999999', SECRET]), '2560x1920');
    assert.equal(selectPictureSize([]), null);
    assert.equal(selectPictureSize(['4000x3000', '0x2000', '800x600']), null);
  });
});

describe('memory-only ownership, single flight, cancellation, and safe errors', () => {
  test('supplies fixed safe capture flags and returns only whitelisted summary metadata', async () => {
    const f = fixture();
    let retained;
    const result = await f.session.capture(layout, async (image, signal) => {
      retained = image;
      assert.equal(signal.aborted, false);
      assert.equal(image.imageBase64, jpeg().imageBase64);
      assert.equal(f.events.at(-1), 'release');
    });
    assert.deepEqual(f.events[0], ['capture', MEMORY_PICTURE_OPTIONS]);
    assert.notEqual(f.events[0][1], MEMORY_PICTURE_OPTIONS);
    assert.equal(f.events[0][1].pictureRef, true);
    assert.equal(f.events[0][1].skipProcessing, false);
    assert.equal(f.events[0][1].exif, false);
    assert.equal(f.events[0][1].base64, false);
    assert.equal(f.events[0][1].onPictureSaved, undefined);
    assert.equal(f.events[0][1].fastMode, undefined);
    assert.deepEqual(result, { width: 720, height: 1120, byteLength: 4, mimeType: 'image/jpeg' });
    assert.equal(retained.imageBase64, '');
    assert.equal(f.image.imageBase64, '');
    assert.equal(f.events.filter(event => event === 'release').length, 1);
    assert.equal(f.session.busy, false);
  });

  test('layout is snapshotted; edits while acquiring cannot change the crop', async () => {
    const capture = deferred();
    const f = fixture({ capture: () => capture.promise });
    const mutable = structuredClone(layout);
    const task = f.session.capture(mutable, async () => {});
    mutable.guide.originX = 999;
    mutable.preview.width = 1;
    capture.resolve(f.picture);
    await task;
    assert.deepEqual(f.events[0][2], { originX: 420, originY: 320, width: 2160, height: 3360 });
  });

  test('concurrent captures are rejected, including while cancelled native work is finishing', async () => {
    const capture = deferred();
    const f = fixture({ capture: () => capture.promise });
    const task = f.session.capture(layout, async () => {});
    const rejection = assert.rejects(task, safeError('cancelled'));
    await assert.rejects(f.session.capture(layout, async () => {}), safeError('busy'));
    f.session.cancel();
    await rejection;
    assert.equal(f.session.busy, true);
    await assert.rejects(f.session.capture(layout, async () => {}), safeError('busy'));
    capture.resolve(f.picture);
    await setImmediate();
    assert.equal(f.session.busy, false);
    assert.deepEqual(f.events, [['dispose', true], 'release']);
  });

  test('cancel during encoding does not recycle a bitmap still owned by native work', async () => {
    const encoding = deferred();
    const started = deferred();
    const f = fixture({ encode: () => { started.resolve(); return encoding.promise; } });
    const task = f.session.capture(layout, async () => { assert.fail('Cancelled data must not reach consumer'); });
    const rejection = assert.rejects(task, safeError('cancelled'));
    await started.promise;
    f.session.cancel();
    await rejection;
    assert.equal(f.events.includes('release'), false);
    encoding.resolve(f.image);
    await setImmediate();
    assert.equal(f.image.imageBase64, '');
    assert.equal(f.events.at(-1), 'release');
  });

  test('cancel/background invalidation immediately clears an image already held by the consumer', async () => {
    const started = deferred();
    const consumer = deferred();
    const f = fixture();
    let retained;
    let signal;
    const task = f.session.capture(layout, async (image, abortSignal) => {
      retained = image; signal = abortSignal; started.resolve(); await consumer.promise;
    });
    const rejection = assert.rejects(task, safeError('cancelled'));
    await started.promise;
    f.session.cancel();
    assert.equal(signal.aborted, true);
    assert.equal(retained.imageBase64, '');
    await rejection;
    consumer.resolve();
    await setImmediate();
    assert.equal(f.session.busy, false);
  });

  test('unmount/dispose is terminal and late captures are released once', async () => {
    const capture = deferred();
    const f = fixture({ capture: () => capture.promise });
    const task = f.session.capture(layout, async () => { assert.fail('Disposed data must not reach consumer'); });
    const rejection = assert.rejects(task, safeError('cancelled'));
    f.session.dispose();
    f.session.dispose();
    await rejection;
    await assert.rejects(f.session.capture(layout, async () => {}), safeError('disposed'));
    capture.resolve(f.picture);
    await setImmediate();
    assert.deepEqual(f.events, [['dispose', true], 'release']);
  });

  test('watchdog rejects promptly and disposes late data without a URI fallback', async () => {
    const capture = deferred();
    const f = fixture({ capture: () => capture.promise }, 10);
    const task = f.session.capture(layout, async () => {});
    await assert.rejects(task, safeError('timeout'));
    capture.resolve(f.picture);
    await setImmediate();
    assert.equal(f.events.at(-1), 'release');
    assert.equal(f.session.busy, false);
  });

  for (const [stage, expected] of [['capture', 'capture_failed'], ['encode', 'encode_failed']]) {
    test(`${stage} errors never expose native/request diagnostics`, async () => {
      const raw = Object.assign(new Error(SECRET), { imageBase64: SECRET, uri: SECRET, cause: new Error(SECRET) });
      const f = fixture({ [stage]: async () => { throw raw; } });
      await assert.rejects(f.session.capture(layout, async () => {}), safeError(expected));
      assert.equal(f.session.busy, false);
      if (stage === 'encode') assert.equal(f.events.at(-1), 'release');
    });
  }
  test('consumer failure wipes its retained envelope and exposes only a safe error', async () => {
    const f = fixture();
    let retained;
    await assert.rejects(f.session.capture(layout, async image => {
      retained = image; throw Object.assign(new Error(SECRET), { imageBase64: SECRET });
    }), safeError('processing_failed'));
    assert.equal(retained.imageBase64, '');
    assert.equal(f.events.at(-1), 'release');
  });
  test('native disposal failure still calls PictureRef.release and does not consume the image', async () => {
    const f = fixture({ disposePicture() { throw new Error(SECRET); } });
    await assert.rejects(f.session.capture(layout, async () => { assert.fail('Cleanup failed'); }), safeError('cleanup_failed'));
    assert.equal(f.events.at(-1), 'release');
    assert.equal(f.image.imageBase64, '');
  });
  test('unexpected ordinary file-camera result is rejected; no encoding fallback', async () => {
    const f = fixture({ capture: async () => ({ uri: SECRET, base64: SECRET, width: 1000, height: 1000 }) });
    await assert.rejects(f.session.capture(layout, async () => {}), safeError('invalid_image'));
    assert.deepEqual(f.events, []);
  });

  for (const [name, patch] of [
    ['URI', { uri: SECRET }], ['metadata', { exif: SECRET }], ['wrong media', { mimeType: 'image/png' }],
    ['huge body', { byteLength: MAX_JPEG_BYTES + 1 }], ['huge dimension', { height: 1601 }],
    ['too small', { width: 449 }], ['non-integer', { width: 720.5 }], ['data URL', { imageBase64: 'data:image/jpeg;base64,/9j/2Q==' }],
    ['base64 length mismatch', { byteLength: 5 }], ['whitespace', { imageBase64: '/9j/2Q=\n' }],
  ]) {
    test(`malformed native JPEG (${name}) is rejected and cleared`, async () => {
      const image = { ...jpeg(), ...patch };
      const f = fixture({ encode: async () => image });
      await assert.rejects(f.session.capture(layout, async () => { assert.fail('Invalid data consumed'); }), safeError('invalid_image'));
      assert.equal(image.imageBase64, '');
      assert.equal(f.events.at(-1), 'release');
    });
  }
});
