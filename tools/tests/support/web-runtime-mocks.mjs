import { FirebaseError } from "real:firebase/app";
export { FirebaseError };

export const PENDING_KEY = "monteai.pendingRegistration";
export const MFA_KEY = "monteai.mfa.tokens.v1";
export const SYNTHETIC_PRIVATE = "synthetic-web-private-marker";
export const SYNTHETIC_RECEIPT = "synthetic-web-receipt-marker";
export const SYNTHETIC_FIREBASE_TOKEN = "synthetic-web-firebase-token";
export const SYNTHETIC_MFA_TOKEN = "synthetic-web-mfa-token";
const authListeners = new Set();
const tokenListeners = new Set();
const syntheticJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xff, 0xd9]);

class Target extends EventTarget {
  listeners = new Map();
  addEventListener(type, listener, options) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
    super.addEventListener(type, listener, options);
  }
  removeEventListener(type, listener, options) {
    this.listeners.get(type)?.delete(listener);
    super.removeEventListener(type, listener, options);
  }
  get listenerCount() { return [...this.listeners.values()].reduce((sum, listeners) => sum + listeners.size, 0); }
}
export class SyntheticTrack extends Target {
  kind = "video";
  readyState = "live";
  stops = 0;
  getSettings() { return { ...runtime.frame }; }
  stop() { this.stops++; this.readyState = "ended"; runtime.trace.push("stop"); }
}
export class SyntheticStream extends Target {
  tracks = [new SyntheticTrack()];
  getTracks() { return this.tracks; }
}
export class SyntheticVideo extends Target {
  srcObject = null;
  paused = true;
  ended = false;
  readyState = 0;
  videoWidth = 0;
  videoHeight = 0;
  async play() {
    runtime.trace.push("play");
    await runtime.play(this);
  }
  pause() { this.paused = true; this.dispatchEvent(new Event("pause")); }
}
class SyntheticWindow extends Target {
  get isSecureContext() { return runtime.secure; }
  get localStorage() { if (runtime.storageBlocked) throw new Error(SYNTHETIC_PRIVATE); return memoryStorage; }
  setTimeout(callback, ms) { return globalThis.setTimeout(callback, ms); }
  clearTimeout(id) { globalThis.clearTimeout(id); }
  setInterval(callback, ms) { return globalThis.setInterval(callback, ms); }
  clearInterval(id) { globalThis.clearInterval(id); }
}
class SyntheticDocument extends Target {
  body = { style: { overflow: "" } };
  get visibilityState() { return runtime.visible ? "visible" : "hidden"; }
  hasFocus() { return runtime.focused; }
  createElement(type) {
    if (type !== "canvas") throw new Error("Only an unattached synthetic canvas can be allocated in this fixture.");
    runtime.canvasAllocations++;
    const canvas = { width: 0, height: 0,
      getContext(kind, options) {
        if (kind !== "2d" || options?.alpha !== false) throw new Error("Unexpected synthetic context.");
        return { drawImage() { runtime.trace.push("draw"); } };
      },
      toBlob(callback, type, quality) {
        runtime.encodings++;
        runtime.trace.push("encode");
        void runtime.encode(type, quality).then(callback, () => callback(null));
      },
    };
    runtime.canvases.push(canvas);
    return canvas;
  }
}
class SyntheticResizeObserver {
  constructor(callback) { this.callback = callback; runtime.observers.add(this); }
  observe() {}
  disconnect() { runtime.observers.delete(this); }
}

const memoryStorage = {
  getItem(key) { runtime.storageEvents.push(["read", key]); return runtime.store.get(key) ?? null; },
  setItem(key, value) {
    runtime.storageEvents.push(["write", key]);
    if (runtime.writeBlocked) throw new Error(SYNTHETIC_PRIVATE);
    runtime.store.set(key, value);
  },
  removeItem(key) { runtime.storageEvents.push(["remove", key]); runtime.store.delete(key); },
};
export const firebaseAuth = { currentUser: null, app: { name: "synthetic-web-app" }, async authStateReady() { await runtime.ready(); } };
export const runtime = {
  reset() {
    authListeners.clear(); tokenListeners.clear(); firebaseAuth.currentUser = null;
    this.store = new Map(); this.storageEvents = [];
    this.window = new SyntheticWindow(); this.document = new SyntheticDocument();
    this.focused = true; this.visible = true; this.secure = true; this.storageBlocked = false; this.writeBlocked = false;
    this.permission = { state: "granted", onchange: null };
    this.permissionReads = 0; this.mediaRequests = 0; this.canvasAllocations = 0; this.encodings = 0;
    this.createCalls = 0; this.passwordSignIns = 0; this.signOuts = 0; this.deletes = 0; this.resends = 0; this.profileUpdates = 0;
    this.reloads = 0; this.tokenCalls = []; this.verificationCalls = 0; this.registrationCalls = 0; this.profileChecks = 0;
    this.successes = 0; this.loginRequests = 0; this.trace = []; this.navigation = []; this.currentPath = null;
    this.route = "/register"; this.unrelatedMounts = 0; this.unexpectedRequests = 0;
    this.http = null; this.unexpectedDiagnostics = 0;
    this.frame = { width: 1920, height: 1080 }; this.preview = { width: 400, height: 390 };
    this.observers = new Set(); this.streams = []; this.videos = []; this.canvases = [];
    this.ready = async () => {};
    this.create = async email => { const user = this.user({ email, emailVerified: false }); setUser(user); return user; };
    this.passwordSignIn = async email => { const user = this.user({ email }); setUser(user); return user; };
    this.logout = async () => setUser(null);
    this.resend = async () => {};
    this.updateProfile = async () => {};
    this.getPermission = async () => this.permission;
    this.getMedia = async () => { const stream = new SyntheticStream(); this.streams.push(stream); return stream; };
    this.play = async video => {
      video.videoWidth = this.frame.width; video.videoHeight = this.frame.height;
      video.readyState = 2; video.paused = false; video.dispatchEvent(new Event("playing"));
    };
    this.encode = async () => new Blob([syntheticJpeg], { type: "image/jpeg" });
    this.verify = async () => this.response();
    this.register = async () => {};
    this.checkProfile = async () => null;
    Object.defineProperties(globalThis, {
      window: { configurable: true, value: this.window },
      document: { configurable: true, value: this.document },
      navigator: { configurable: true, value: {
        permissions: { query: async () => { this.permissionReads++; return this.getPermission(); } },
        mediaDevices: { getUserMedia: async constraints => { this.mediaRequests++; this.trace.push("media"); return this.getMedia(constraints); } },
      } },
      ResizeObserver: { configurable: true, value: SyntheticResizeObserver },
    });
  },
  user(overrides = {}) {
    return { uid: "synthetic-web-uid", email: "personal@example.com", emailVerified: true,
      async reload() { runtime.reloads++; },
      async getIdToken(force) { runtime.tokenCalls.push(force); return SYNTHETIC_FIREBASE_TOKEN; },
      ...overrides };
  },
  response(overrides = {}) {
    return { outcome: "verified", receipt: SYNTHETIC_RECEIPT, expiresAt: new Date(Date.now() + 590_000).toISOString(),
      templateId: "cdm-front-v1", requestId: "synthetic-web-request", ...overrides };
  },
  nodeMock(element) {
    if (element.type === "video") { const video = new SyntheticVideo(); runtime.videos.push(video); return video; }
    return { getBoundingClientRect: () => ({ ...runtime.preview }) };
  },
  emit(type, properties = {}, target = this.window) {
    const event = Object.assign(new Event(type), properties);
    target.dispatchEvent(event);
  },
  setPermission(state) { this.permission.state = state; this.permission.onchange?.(); },
  resize(size) { this.preview = size; this.observers.forEach(observer => observer.callback()); },
  get authListenerCount() { return authListeners.size + tokenListeners.size; },
};

export function setUser(user) {
  firebaseAuth.currentUser = user;
  authListeners.forEach(listener => listener(user));
  tokenListeners.forEach(listener => listener(user));
}
export function notifyToken() { tokenListeners.forEach(listener => listener(firebaseAuth.currentUser)); }
function subscribe(listeners, listener) {
  listeners.add(listener);
  void Promise.resolve().then(() => { if (listeners.has(listener)) listener(firebaseAuth.currentUser); });
  return () => { listeners.delete(listener); };
}
export function onAuthStateChanged(_auth, listener) { return subscribe(authListeners, listener); }
export function onIdTokenChanged(_auth, listener) { return subscribe(tokenListeners, listener); }
export function getAuth() { return firebaseAuth; }
export function initializeApp() { return firebaseAuth.app; }
export async function createUserWithEmailAndPassword(_auth, email, password) {
  runtime.createCalls++;
  return { user: await runtime.create(email, password) };
}
export async function signInWithEmailAndPassword(_auth, email, password) {
  runtime.passwordSignIns++;
  return { user: await runtime.passwordSignIn(email, password) };
}
export async function signOut() { runtime.signOuts++; await runtime.logout(); }
export async function updateProfile(user, input) { runtime.profileUpdates++; await runtime.updateProfile(user, input); }
export async function sendEmailVerification(user) { runtime.resends++; await runtime.resend(user); }
export async function sendPasswordResetEmail() { throw new Error("Password-reset writes are outside these synthetic tests."); }
export function authError(code) { return new FirebaseError(code, SYNTHETIC_PRIVATE); }

runtime.reset();
