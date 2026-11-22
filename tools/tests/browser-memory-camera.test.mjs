// Synthetic browser boundaries only. No camera, network, payload file, or live account.
import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { setImmediate } from "node:timers/promises";
import { readFileSync } from "node:fs";
import {
  BROWSER_CAMERA_CONSTRAINTS, BROWSER_ID_CARD_ASPECT_RATIO, BROWSER_CAPTURE_TIMEOUT_MS,
  BROWSER_CONSUMER_TIMEOUT_MS, BROWSER_MAX_JPEG_BYTES, BrowserMemoryCameraError,
  createBrowserMemoryCameraSession, getBrowserIdGuide, getBrowserGuideCrop, getBrowserJpegSize,
} from "../../packages/ui/src/components/auth/idCapture/browserMemoryCamera.ts";
import { awaitStudentSignupCleanup, retireStudentSignupFlow } from "../../packages/ui/src/components/auth/idCapture/signupCleanup.ts";
import { createStudentSignupFlow } from "../../packages/api/src/auth/studentSignupFlow.ts";

const SENSITIVE = "synthetic-browser-sensitive-marker";
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xff, 0xd9]);
const sessions = new Set();
const waits = new Set();
const flows = new Set();
const layout = { preview: { width: 400, height: 390 } };
layout.guide = getBrowserIdGuide(layout.preview);

function deferred(value) {
  let resolve;
  const promise = new Promise(finish => { resolve = finish; });
  const wait = { promise, finish(result = value) { waits.delete(wait); resolve(result); } };
  waits.add(wait);
  return wait;
}
function safeError(code) {
  return error => {
    assert.ok(error instanceof BrowserMemoryCameraError);
    assert.equal(error.code, code);
    assert.ok(!String(error).includes(SENSITIVE));
    assert.ok(!JSON.stringify(error).includes(SENSITIVE));
    for (const field of ["cause", "imageBase64", "blob", "bytes", "config", "request"]) assert.equal(error[field], undefined);
    return true;
  };
}
const flush = () => setImmediate();

class Track extends EventTarget {
  kind = "video";
  readyState = "live";
  stops = 0;
  constructor(size = { width: 1920, height: 1080 }) { super(); this.size = size; }
  getSettings() { return { ...this.size }; }
  stop() { this.stops++; this.readyState = "ended"; }
}
class Stream extends EventTarget {
  constructor(tracks = [new Track()]) { super(); this.tracks = tracks; }
  getTracks() { return this.tracks; }
}
class Video extends EventTarget {
  srcObject = null;
  paused = true;
  ended = false;
  readyState = 0;
  videoWidth = 1920;
  videoHeight = 1080;
  async play() { this.paused = false; this.readyState = 2; this.dispatchEvent(new Event("playing")); }
  pause() { this.paused = true; this.dispatchEvent(new Event("pause")); }
}
function fixture(overrides = {}, options = {}) {
  const trace = [];
  const stream = new Stream();
  const video = new Video();
  const canvases = [];
  let requests = 0;
  const dependencies = {
    async getUserMedia(constraints) {
      requests++;
      assert.deepEqual(constraints, BROWSER_CAMERA_CONSTRAINTS);
      trace.push("media");
      return stream;
    },
    createCanvas() {
      trace.push("allocate");
      const canvas = {
        width: 0, height: 0,
        getContext(kind, settings) {
          assert.equal(kind, "2d");
          assert.deepEqual(settings, { alpha: false });
          return { drawImage(...args) { canvas.draw = args; trace.push("draw"); } };
        },
        toBlob(callback, type, quality) {
          assert.equal(type, "image/jpeg");
          assert.equal(quality, 0.86);
          trace.push("encode");
          callback(new Blob([jpeg], { type }));
        },
      };
      canvases.push(canvas);
      return canvas;
    },
    ...overrides,
  };
  const session = createBrowserMemoryCameraSession(dependencies, options);
  sessions.add(session);
  return { session, video, stream, canvases, trace, get requests() { return requests; },
    open: () => session.open(video, async signal => { assert.equal(signal.aborted, false); trace.push("prepare"); }) };
}
function clock(t) {
  let now = 0;
  let id = 0;
  const timers = new Map();
  t.mock.method(globalThis, "setTimeout", (callback, delay) => {
    const key = ++id;
    timers.set(key, { at: now + delay, callback });
    return key;
  });
  t.mock.method(globalThis, "clearTimeout", key => { timers.delete(key); });
  return { tick(ms) {
    now += ms;
    [...timers].filter(([, timer]) => timer.at <= now).sort((a, b) => a[1].at - b[1].at)
      .forEach(([key, timer]) => { if (timers.delete(key)) timer.callback(); });
  }, get count() { return timers.size; } };
}

afterEach(async () => {
  sessions.forEach(session => session.dispose());
  sessions.clear();
  flows.forEach(flow => retireStudentSignupFlow(flow));
  flows.clear();
  waits.forEach(wait => wait.finish());
  await flush();
  await flush();
  const probe = createBrowserMemoryCameraSession();
  assert.equal(probe.getState().blocked, false, "No browser cleanup owner may leak between tests.");
  probe.dispose();
});

describe("browser portrait and bounded memory encoding", () => {
  test("requests no audio and at most 6 MP; preserves the portrait guide and watchdogs", () => {
    assert.equal(BROWSER_CAMERA_CONSTRAINTS.audio, false);
    assert.ok(BROWSER_CAMERA_CONSTRAINTS.video.width.max * BROWSER_CAMERA_CONSTRAINTS.video.height.max <= 6_000_000);
    assert.equal(BROWSER_ID_CARD_ASPECT_RATIO, 720 / 1120);
    assert.equal(BROWSER_CAPTURE_TIMEOUT_MS, 15_000);
    assert.equal(BROWSER_CONSUMER_TIMEOUT_MS, 50_000);
    assert.ok(Math.abs(layout.guide.width / layout.guide.height - 720 / 1120) < 1e-12);
  });
  for (const size of [{ width: 1920, height: 1080 }, { width: 1080, height: 1920 }, { width: 4000, height: 3000 }]) {
    test(`cover/center crop matches the guide for ${size.width}x${size.height}`, () => {
      const crop = getBrowserGuideCrop(layout, size);
      assert.ok(crop.originX >= 0 && crop.originY >= 0);
      assert.ok(crop.originX + crop.width <= size.width && crop.originY + crop.height <= size.height);
      assert.ok(Math.abs(crop.width / crop.height - 720 / 1120) < 0.003);
      const output = getBrowserJpegSize(crop);
      assert.ok(Math.max(output.width, output.height) <= 1600);
      assert.ok(Math.min(output.width, output.height) >= 450);
    });
  }
  for (const size of [{ width: 6001, height: 1000 }, { width: 4001, height: 3000 }, { width: 1280, height: 720 },
    { width: 1920.5, height: 1080 }, { width: 0, height: 1080 }]) {
    test(`rejects invalid or undersized ${size.width}x${size.height} before encoding`, () => {
      assert.throws(() => getBrowserGuideCrop(layout, size), safeError("invalid_image"));
    });
  }
  test("rejects invalid layout, overflow, and landscape guides", () => {
    for (const bad of [{ preview: { width: 0, height: 1 }, guide: layout.guide },
      { ...layout, guide: { ...layout.guide, originX: -1 } },
      { ...layout, guide: { ...layout.guide, originY: 390 } },
      { ...layout, guide: { originX: 0, originY: 0, width: 300, height: 180 } }]) {
      assert.throws(() => getBrowserGuideCrop(bad, { width: 1920, height: 1080 }), safeError("invalid_layout"));
    }
  });
  test("mounting a session never opens or allocates; account preparation precedes getUserMedia", async () => {
    const f = fixture();
    assert.equal(f.requests, 0);
    assert.equal(f.canvases.length, 0);
    await f.open();
    assert.deepEqual(f.trace, ["prepare", "media"]);
    assert.equal(f.session.getState().phase, "preview");
    assert.equal(f.video.srcObject, f.stream);
    assert.equal(f.video.muted, true);
    assert.equal(f.video.playsInline, true);
  });
  test("crops directly into bounded pixels and stops preview before the consumer; exports metadata only", async () => {
    const f = fixture();
    await f.open();
    let held;
    const result = await f.session.capture(layout, async (image, signal) => {
      held = image;
      assert.equal(signal.aborted, false);
      assert.equal(image.imageBase64, Buffer.from(jpeg).toString("base64"));
      assert.equal(f.video.srcObject, null);
      assert.equal(f.stream.tracks[0].stops, 1);
      assert.equal(f.canvases[0].width, 0);
      assert.equal(f.canvases[0].height, 0);
    });
    assert.deepEqual(Object.keys(result).sort(), ["byteLength", "height", "mimeType", "width"]);
    assert.equal(result.byteLength, jpeg.length);
    assert.equal(held.imageBase64, "");
    const crop = getBrowserGuideCrop(layout, { width: 1920, height: 1080 });
    assert.deepEqual(f.canvases[0].draw.slice(1, 5), [crop.originX, crop.originY, crop.width, crop.height]);
    assert.equal(f.session.getState().busy, false);
  });
  test("large, chunked synthetic JPEG stays below 2 MiB and base64 matches byte-for-byte", async () => {
    const bytes = new Uint8Array(100_003).fill(0x45);
    bytes.set([0xff, 0xd8, 0xff]); bytes.set([0xff, 0xd9], bytes.length - 2);
    const f = fixture();
    await f.open();
    const create = f.session;
    // Replace only the fake canvas encoder, never a browser/file API.
    const original = fixture({ createCanvas() {
      return { width: 0, height: 0, getContext: () => ({ drawImage() {} }),
        toBlob(callback) { callback(new Blob([bytes], { type: "image/jpeg" })); } };
    } });
    create.cancel();
    await original.open();
    await original.session.capture(layout, async image => {
      assert.equal(image.byteLength, bytes.length);
      assert.ok(image.byteLength < BROWSER_MAX_JPEG_BYTES);
      assert.equal(image.imageBase64 === Buffer.from(bytes).toString("base64"), true, "Compare synthetic image only, without printing it.");
    });
  });
  for (const [label, blob] of [["wrong MIME", new Blob([jpeg], { type: "image/png" })],
    ["oversized", new Blob([new Uint8Array(BROWSER_MAX_JPEG_BYTES + 1)], { type: "image/jpeg" })],
    ["bad signature", new Blob([new Uint8Array(5)], { type: "image/jpeg" })], ["null", null]]) {
    test(`rejects ${label} encoding without invoking the consumer`, async () => {
      const f = fixture({ createCanvas: () => ({ width: 0, height: 0, getContext: () => ({ drawImage() {} }),
        toBlob(callback) { callback(blob); } }) });
      await f.open();
      let consumes = 0;
      await assert.rejects(f.session.capture(layout, async () => { consumes++; }), safeError("encode_failed"));
      assert.equal(consumes, 0);
      assert.equal(f.stream.tracks[0].stops, 1);
    });
  }
  for (const dimensions of [{ width: 8000, height: 1000 }, { width: 4001, height: 3000 }]) {
    test(`rejects oversized actual preview ${dimensions.width}x${dimensions.height} without a canvas`, async () => {
      const f = fixture();
      f.video.videoWidth = dimensions.width; f.video.videoHeight = dimensions.height;
      await assert.rejects(f.open(), safeError("invalid_image"));
      assert.equal(f.canvases.length, 0);
      assert.equal(f.stream.tracks[0].stops, 1);
    });
  }
  test("rejects oversized track settings and unexpected audio, stopping every track", async () => {
    for (const stream of [new Stream([new Track({ width: 4001, height: 3000 })]),
      new Stream([new Track(), Object.assign(new Track(), { kind: "audio" })])]) {
      const f = fixture({ async getUserMedia() { return stream; } });
      await assert.rejects(f.open(), error => error instanceof BrowserMemoryCameraError);
      assert.ok(stream.tracks.every(track => track.stops === 1));
      assert.equal(f.canvases.length, 0);
    }
  });
  test("permission denial and arbitrary browser/consumer exceptions have static safe errors", async () => {
    const f = fixture({ async getUserMedia() { throw new DOMException(SENSITIVE, "NotAllowedError"); } });
    await assert.rejects(f.open(), safeError("permission_denied"));
    const g = fixture({ async getUserMedia() { throw new Error(SENSITIVE); } });
    await assert.rejects(g.open(), safeError("capture_failed"));
    const h = fixture(); await h.open();
    await assert.rejects(h.session.capture(layout, async () => { throw new Error(SENSITIVE); }), safeError("processing_failed"));
    assert.ok(!JSON.stringify(h.session.getState()).includes(SENSITIVE));
  });
  test("source never invokes persistent/URI capture or receipt inspection APIs", () => {
    const source = readFileSync(new URL("../../packages/ui/src/components/auth/idCapture/browserMemoryCamera.ts", import.meta.url), "utf8");
    for (const forbidden of [/\.takePhoto\s*\(/, /\.toDataURL\s*\(/, /createObjectURL\s*\(/, /new\s+FileReader/, /\bnew\s+File\s*\(/,
      /(?:localStorage|sessionStorage|indexedDB|caches)\s*\./, /console\s*\./]) assert.equal(forbidden.test(source), false);
  });
});

describe("browser cancellation, deadlines, and cross-remount cleanup", () => {
  test("no current frame means no capture; play failure does not retain preview listeners", async () => {
    const f = fixture();
    f.video.play = async () => { throw new Error(SENSITIVE); };
    await assert.rejects(f.open(), safeError("capture_failed"));
    assert.equal(f.video.srcObject, null);
    assert.equal(f.stream.tracks[0].stops, 1);
    await assert.rejects(f.session.capture(layout, async () => {}), safeError("invalid_layout"));
  });
  test("cancelled preparation cannot ask for a camera and holds admission until the late check settles", async () => {
    const f = fixture();
    const wait = deferred();
    const opening = f.session.open(f.video, () => wait.promise);
    const rejected = assert.rejects(opening, safeError("cancelled"));
    await flush(); f.session.cancel(); await rejected;
    const g = fixture();
    assert.equal(g.session.getState().blocked, true);
    await assert.rejects(g.open(), safeError("busy"));
    wait.finish(); await flush();
    assert.equal(f.requests, 0);
    assert.equal(g.session.getState().blocked, false);
  });
  test("late getUserMedia after cancellation/unmount is stopped before another session can open", async () => {
    const stream = new Stream();
    const wait = deferred(stream);
    const f = fixture({ getUserMedia: () => wait.promise });
    const opening = f.open();
    const rejected = assert.rejects(opening, safeError("cancelled"));
    await flush(); f.session.dispose(); await rejected;
    const g = fixture(); assert.equal(g.session.getState().blocked, true);
    wait.finish(); await flush();
    assert.equal(stream.tracks[0].stops, 1);
    assert.equal(f.video.srcObject, null);
    assert.equal(g.session.getState().blocked, false);
    await g.open();
  });
  for (const action of ["cancel", "dispose"]) {
    test(`${action} while video.play is pending holds admission until playback actually settles`, async () => {
      const wait = deferred();
      const f = fixture();
      f.video.play = async () => { await wait.promise; f.video.paused = false; f.video.readyState = 2; f.video.dispatchEvent(new Event("playing")); };
      const opening = f.open();
      const rejected = assert.rejects(opening, safeError("cancelled"));
      await flush(); f.session[action](); await rejected; await flush();
      assert.equal(f.video.srcObject, null); assert.equal(f.stream.tracks[0].stops, 1);
      const g = fixture(); assert.equal(g.session.getState().blocked, true);
      await assert.rejects(g.open(), safeError("busy"));
      wait.finish(); await flush();
      assert.equal(g.session.getState().blocked, false);
      assert.equal(f.video.paused, true);
      assert.equal(f.video.srcObject, null);
      assert.equal(f.canvases.length, 0);
    });
  }
  test("late toBlob retains pixels until the encoder settles, never consumes, and blocks a remount", async () => {
    let encode;
    let canvas;
    const wait = deferred();
    const f = fixture({ createCanvas() {
      canvas = { width: 0, height: 0, getContext: () => ({ drawImage() {} }),
        toBlob(callback) { encode = callback; void wait.promise.then(() => callback(new Blob([jpeg], { type: "image/jpeg" }))); } };
      return canvas;
    } });
    await f.open();
    let consumes = 0;
    const capture = f.session.capture(layout, async () => { consumes++; });
    const rejected = assert.rejects(capture, safeError("cancelled"));
    await flush(); assert.equal(typeof encode, "function");
    f.session.dispose(); await rejected;
    assert.ok(canvas.width >= 450);
    assert.equal(f.video.srcObject, null);
    const g = fixture(); assert.equal(g.session.getState().blocked, true);
    wait.finish(); await flush();
    assert.equal(canvas.width, 0); assert.equal(canvas.height, 0);
    assert.equal(consumes, 0);
    assert.equal(g.session.getState().blocked, false);
  });
  test("cancelled arrayBuffer is wiped and cannot reach the consumer", async () => {
    const buffer = jpeg.slice().buffer;
    const wait = deferred(buffer);
    const f = fixture({ createCanvas: () => ({ width: 0, height: 0, getContext: () => ({ drawImage() {} }),
      toBlob(callback) { callback({ type: "image/jpeg", size: jpeg.length, arrayBuffer: () => wait.promise }); } }) });
    await f.open();
    let consumed = false;
    const capture = f.session.capture(layout, async () => { consumed = true; });
    const rejected = assert.rejects(capture, safeError("cancelled"));
    await flush(); f.session.cancel(); await rejected;
    wait.finish(); await flush();
    assert.equal(consumed, false);
    assert.ok(new Uint8Array(buffer).every(byte => byte === 0));
  });
  for (const event of ["ended", "mute"]) {
    test(`track ${event} invalidates the camera without reopening`, async () => {
      let interrupted = 0;
      const f = fixture({}, { onInterrupted() { interrupted++; } }); await f.open();
      f.stream.tracks[0].dispatchEvent(new Event(event));
      assert.equal(interrupted, 1);
      assert.equal(f.session.getState().phase, "closed");
      assert.equal(f.session.getState().failure.code, "camera_interrupted");
      assert.equal(f.requests, 1);
      assert.equal(f.video.srcObject, null);
    });
  }
  test("video resolution changes invalidate the old guide and never allocate", async () => {
    const f = fixture(); await f.open();
    f.video.videoWidth = 1280; f.video.dispatchEvent(new Event("resize"));
    assert.equal(f.session.getState().phase, "closed");
    assert.equal(f.canvases.length, 0);
    assert.equal(f.video.srcObject, null);
  });
  test("15-second opening watchdog returns promptly while getUserMedia still owns cleanup", async t => {
    const time = clock(t);
    const wait = deferred(new Stream());
    const f = fixture({ getUserMedia: () => wait.promise });
    const opening = f.open(); const rejected = assert.rejects(opening, safeError("timeout"));
    await flush(); time.tick(15_000); await rejected;
    assert.equal(f.session.getState().busy, true);
    const g = fixture(); assert.equal(g.session.getState().blocked, true);
    wait.finish(); await flush();
    assert.equal(g.session.getState().blocked, false);
    assert.equal(time.count, 0);
  });
  test("15-second encoding watchdog keeps late toBlob admission until pixels are reset", async t => {
    const time = clock(t);
    const wait = deferred(new Blob([jpeg], { type: "image/jpeg" }));
    let canvas;
    const f = fixture({ createCanvas() {
      canvas = { width: 0, height: 0, getContext: () => ({ drawImage() {} }),
        toBlob(callback) { void wait.promise.then(callback); } };
      return canvas;
    } });
    await f.open();
    let consumes = 0;
    const capture = f.session.capture(layout, async () => { consumes++; });
    const rejected = assert.rejects(capture, safeError("timeout"));
    await flush(); time.tick(14_999); await flush();
    assert.equal(f.session.getState().phase, "capturing");
    time.tick(1); await rejected;
    assert.equal(f.video.srcObject, null); assert.equal(f.stream.tracks[0].stops, 1);
    assert.ok(canvas.width >= 450);
    const g = fixture(); assert.equal(g.session.getState().blocked, true);
    wait.finish(); await flush();
    assert.equal(canvas.width + canvas.height, 0); assert.equal(consumes, 0);
    assert.equal(g.session.getState().blocked, false); assert.equal(time.count, 0);
  });
  test("no-pixel proof overrides the 45-second work budget with a 15-second watchdog", async t => {
    const time = clock(t);
    const wait = deferred();
    const f = fixture({}, { consumerTimeoutMs: 45_000 });
    let signal;
    const work = f.session.runConsumer(async current => { signal = current; await wait.promise; }, { timeoutMs: 15_000 });
    const rejected = assert.rejects(work, safeError("timeout"));
    await flush(); time.tick(14_999); assert.equal(signal.aborted, false);
    time.tick(1); await rejected; assert.equal(signal.aborted, true);
    const g = fixture(); assert.equal(g.session.getState().blocked, true);
    assert.equal(f.requests + f.canvases.length, 0);
    wait.finish(); await flush();
    assert.equal(g.session.getState().blocked, false); assert.equal(time.count, 0);
  });
  test("capture watchdog remains 15 seconds and the post-encoding consumer gets a separate 50 seconds", async t => {
    const time = clock(t);
    const wait = deferred();
    const f = fixture(); await f.open();
    let signal;
    const capture = f.session.capture(layout, async (_image, current) => { signal = current; await wait.promise; });
    const rejected = assert.rejects(capture, safeError("timeout"));
    await flush(); time.tick(15_000); await flush();
    assert.equal(signal.aborted, false);
    time.tick(34_999); assert.equal(signal.aborted, false);
    time.tick(1); await rejected;
    assert.equal(signal.aborted, true);
    assert.equal(f.session.getState().busy, true);
    wait.finish(); await flush(); assert.equal(time.count, 0);
  });
  test("registration-only consumer cancellation holds admission until the actual transport settles", async () => {
    const f = fixture(); const wait = deferred();
    const work = f.session.runConsumer(() => wait.promise);
    const rejected = assert.rejects(work, safeError("cancelled"));
    await flush(); f.session.dispose(); await rejected;
    const g = fixture(); assert.equal(g.session.getState().blocked, true);
    wait.finish(); await flush();
    assert.equal(g.session.getState().blocked, false);
    assert.equal(f.requests, 0);
    assert.equal(f.canvases.length, 0);
  });
  test("the prompt-cancelling shared controller cannot release browser admission ahead of its cleanup", async () => {
    const draft = { id: "synthetic-browser-uid", email: "personal@example.com", firstName: "Maria Ana", lastName: "Dela Cruz",
      role: "Student", studentNumber: "00-00123", position: "Member", institute: "Institute of Computing Studies",
      program: "BS Computer Science", yearLevel: 1, section: "A", privacyNoticeAccepted: true,
      privacyNoticeVersion: "2026-10-23", termsAccepted: true, termsVersion: "2026-10-23" };
    const wait = deferred({ outcome: "verified", receipt: SENSITIVE, templateId: "cdm-front-v1",
      expiresAt: new Date(Date.now() + 590_000).toISOString(), requestId: "synthetic-browser-request" });
    let registrations = 0;
    const flow = createStudentSignupFlow({ async getVerifiedDraft() { return draft; },
      verify: () => wait.promise, async register() { registrations++; } });
    flows.add(flow);
    const f = fixture(); await f.open();
    const capture = f.session.capture(layout, (image, signal) => awaitStudentSignupCleanup(flow, () => flow.verifyAndRegister(image, signal)));
    const rejected = assert.rejects(capture, safeError("cancelled"));
    await flush(); f.session.dispose(); retireStudentSignupFlow(flow); await rejected;
    const g = fixture(); assert.equal(g.session.getState().blocked, true);
    assert.equal(flow.getState().busy, true);
    wait.finish(); await flush(); await flush();
    assert.equal(registrations, 0);
    assert.equal(g.session.getState().blocked, false);
    assert.equal(flow.getState().busy, false);
  });
});
