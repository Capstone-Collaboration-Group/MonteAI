import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

// Every token/receipt/image below is synthetic. Nothing contacts an SDK/service
// or writes a file; AsyncStorage is a Map owned by each runtime test fixture.
export const firebaseAuth = { currentUser: null };
export const MFA_STORAGE_KEY = 'monteai.mfa.tokens.v1';
const authListeners = new Set();
const activityListeners = new Map();
const backListeners = new Set();
export const runtime = {
  reset() {
    authListeners.clear(); activityListeners.clear(); backListeners.clear();
    firebaseAuth.currentUser = null;
    this.platform = 'android'; this.focused = true; this.store = new Map();
    this.permission = { granted: true, canAskAgain: true };
    this.permissionRequests = 0; this.permissionReads = 0; this.settingsOpens = 0;
    this.getPermission = async () => ({ ...this.permission });
    this.requestPermission = async () => ({ ...this.permission });
    this.openSettings = async () => {};
    this.cameraInstanceSerial = 0; this.cameraMounts = []; this.cameraUnmounts = [];
    this.captureCalls = 0; this.verificationCalls = 0;
    this.createCalls = 0; this.passwordSignIns = 0; this.registrationCalls = 0; this.freshCalls = 0; this.checks = 0;
    this.resends = 0; this.deletes = 0; this.signOuts = 0; this.mfaChallenges = 0; this.mfaClears = 0;
    this.nativeEvents = []; this.navigation = []; this.protectionEvents = []; this.storageEvents = [];
    this.alert = null; this.fresh = null; this.mfaToken = undefined;
    this.prevent = async () => {}; this.allow = async () => {};
    this.sizes = async () => ['8000x6000', '2000x1500'];
    this.capture = async () => this.picture();
    this.encode = async () => this.jpeg();
    this.create = async input => { const user = this.user({ email: input.email, emailVerified: false }); setUser(user); return user; };
    this.passwordSignIn = async email => { const user = this.user({ email }); setUser(user); return user; };
    this.login = async () => { throw authError('auth/invalid-credential'); };
    this.register = async () => {};
    this.check = async () => !!firebaseAuth.currentUser?.emailVerified;
    this.resend = async () => {};
    this.mfaVerify = async () => ({ accessToken: 'synthetic-mfa-token', refreshToken: 'synthetic-mfa-refresh',
      expiresAt: new Date(Date.now() + 600_000).toISOString() });
    this.mfaConfirmations = 0; this.mfaEnrollments = 0; this.mfaStatusCalls = 0;
    this.mfaStatus = async () => ({ totpEnabled: false, recoveryCodesRemaining: 0 });
    this.mfaEnroll = async () => ({ secret: 'synthetic-setup-key', otpauthUri: 'synthetic-setup-uri' });
    this.mfaConfirm = async () => ({ ...(await this.mfaVerify()), recoveryCodes: ['synthetic-recovery-code'] });
    this.logout = async () => { setUser(null); };
    this.refresh = null;
    this.onNavigate = () => {};
    this.read = async key => this.store.get(key) ?? null;
    this.save = async (key, value) => { this.store.set(key, value); };
    this.remove = async key => { this.store.delete(key); };
    this.verify = async () => ({ outcome: 'verified', receipt: 'synthetic-runtime-receipt',
      expiresAt: new Date(Date.now() + 590_000).toISOString(), templateId: 'cdm-front-v1', requestId: 'synthetic-request' });
    this.challenge = async () => ({ mfaRequired: false });
    AppState.currentState = 'active';
  },
  user(overrides = {}) {
    return { uid: 'synthetic-firebase-uid', email: 'personal@example.com', emailVerified: true,
      async reload() {}, async getIdToken() { return 'synthetic-firebase-token'; }, ...overrides };
  },
  get mfaToken() { return JSON.parse(this.store.get(MFA_STORAGE_KEY) ?? 'null')?.accessToken; },
  set mfaToken(token) {
    if (token === undefined) { this.store.delete(MFA_STORAGE_KEY); return; }
    this.store.set(MFA_STORAGE_KEY, JSON.stringify({ accessToken: token, refreshToken: 'synthetic-mfa-refresh',
      expiresAt: new Date(Date.now() + 600_000).toISOString() }));
  },
  picture() {
    return { nativeRefType: 'image', width: 3000, height: 4000,
      release() { runtime.nativeEvents.push('release'); } };
  },
  jpeg() { return { imageBase64: '/9j/2Q==', byteLength: 4, mimeType: 'image/jpeg', width: 720, height: 1120 }; },
  emit(type, value) {
    if (type === 'change') AppState.currentState = value;
    activityListeners.get(type)?.forEach(listener => listener(value));
  },
  listenerCount(type) { return activityListeners.get(type)?.size ?? 0; },
  back() { backListeners.forEach(listener => listener()); },
};

export const Platform = {
  get OS() { return runtime.platform; },
  select(values) { return values[runtime.platform] ?? values.default; },
};
export const StyleSheet = { create: value => value, absoluteFill: { position: 'absolute' },
  flatten: value => Array.isArray(value) ? Object.assign({}, ...value.filter(Boolean)) : value };
export const View = 'View';
export const Text = 'Text';
export const TextInput = 'TextInput';
export const Pressable = 'Pressable';
export const ScrollView = 'ScrollView';
export const Image = 'Image';
export const KeyboardAvoidingView = 'KeyboardAvoidingView';
export const ActivityIndicator = 'ActivityIndicator';
export const SafeAreaView = 'SafeAreaView';
export const MaterialIcons = 'MaterialIcons';
export function Modal({ visible, children, ...props }) { return visible ? React.createElement('Modal', props, children) : null; }
export const Alert = { alert: (...args) => { runtime.alert = args; } };
export const Linking = { async openSettings() { runtime.settingsOpens++; await runtime.openSettings(); } };
export const AppState = {
  currentState: 'active',
  addEventListener(type, listener) {
    if (!activityListeners.has(type)) activityListeners.set(type, new Set());
    activityListeners.get(type).add(listener);
    return { remove() { activityListeners.get(type)?.delete(listener); } };
  },
};
export const BackHandler = { addEventListener(_type, listener) {
  backListeners.add(listener); return { remove() { backListeners.delete(listener); } };
} };
export function useIsFocused() { return runtime.focused; }
export function useThemeColor() { return '#123456'; }

export const CameraView = forwardRef(function CameraView(props, ref) {
  const [instance] = useState(() => ({
    id: ++runtime.cameraInstanceSerial,
    takePictureAsync: async options => { runtime.captureCalls++; return runtime.capture(options); },
    getAvailablePictureSizesAsync: () => runtime.sizes(),
  }));
  useImperativeHandle(ref, () => instance, [instance]);
  useEffect(() => {
    runtime.cameraMounts.push(instance.id);
    return () => { runtime.cameraUnmounts.push(instance.id); };
  }, [instance]);
  return React.createElement('CameraView', { ...props, testInstanceId: instance.id });
});
export function useCameraPermissions({ get = true, request = false } = {}) {
  // Match Expo's cached hook: mutating the OS fixture does NOT refresh React
  // state. Only the getter/requester updates it, including after a prompt denial.
  const mounted = useRef(true);
  const [permission, setPermission] = useState(null);
  const getPermission = useCallback(async () => {
    runtime.permissionReads++;
    const response = await runtime.getPermission();
    if (mounted.current) setPermission(response);
    return response;
  }, []);
  const requestPermission = useCallback(async () => {
    runtime.permissionRequests++;
    const response = await runtime.requestPermission();
    if (mounted.current) setPermission(response);
    return response;
  }, []);
  useEffect(() => {
    if (request) void requestPermission();
    if (!request && get) void getPermission();
  }, [get, request, getPermission, requestPermission]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  return [permission, requestPermission, getPermission];
}
export async function preventScreenCaptureAsync(key) { runtime.protectionEvents.push(['prevent', key]); await runtime.prevent(key); }
export async function allowScreenCaptureAsync(key) { runtime.protectionEvents.push(['allow', key]); await runtime.allow(key); }
export function getVerificationCamera() {
  return { encodeJpeg: async (picture, crop) => { runtime.nativeEvents.push('encode'); return runtime.encode(picture, crop); },
    disposePicture() { runtime.nativeEvents.push('dispose'); } };
}

const storage = {
  async getItem(key) { runtime.storageEvents.push(['read', key]); return runtime.read(key); },
  async setItem(key, value) { runtime.storageEvents.push(['save', key]); await runtime.save(key, value); },
  async removeItem(key) {
    runtime.storageEvents.push(['remove', key]);
    if (key === MFA_STORAGE_KEY) runtime.mfaClears++;
    await runtime.remove(key);
  },
};
export default storage;
export function setUser(user) { firebaseAuth.currentUser = user; authListeners.forEach(listener => listener(user)); }
export function onAuthStateChanged(_auth, listener) {
  authListeners.add(listener);
  void Promise.resolve().then(() => { if (authListeners.has(listener)) listener(firebaseAuth.currentUser); });
  return () => { authListeners.delete(listener); };
}
export function getAuth() { return firebaseAuth; }
export const EMAIL_NOT_VERIFIED_CODE = 'auth/email-not-verified';
export function authError(code) { return Object.assign(new Error('Synthetic account error'), { code }); }
export async function createStudentAccount(input) { runtime.createCalls++; return runtime.create(input); }
export async function signInWithPassword(email, password) { runtime.passwordSignIns++; return runtime.passwordSignIn(email, password); }
export async function signInWithStudentNumber(number, password) { return runtime.login(number, password); }
export async function sendVerificationEmail() { runtime.resends++; await runtime.resend(); }
export async function deleteUnverifiedAccount() { if (!firebaseAuth.currentUser?.emailVerified) { runtime.deletes++; setUser(null); } }
export async function signOut() { runtime.signOuts++; await runtime.logout(); }
export async function getAuthToken() { return runtime.mfaToken ?? firebaseAuth.currentUser?.getIdToken(); }
export async function checkEmailVerified() { runtime.checks++; return runtime.check(); }
export async function getFreshFirebaseIdToken() {
  runtime.freshCalls++;
  if (runtime.fresh) return runtime.fresh();
  const user = firebaseAuth.currentUser;
  if (!user) return undefined;
  await user.reload();
  if (firebaseAuth.currentUser?.uid !== user.uid) return undefined;
  const token = await user.getIdToken(true);
  return firebaseAuth.currentUser?.uid === user.uid ? token : undefined;
}
export async function completeProfileRegistration({ profile, signal }) {
  runtime.registrationCalls++;
  await runtime.register(profile, signal);
  return firebaseAuth.currentUser;
}
export async function verifyRegistrationId(request, draft, signal) {
  runtime.verificationCalls++;
  return runtime.verify(request, draft, signal);
}
export const anonymousMfaService = {
  async challenge(token) { runtime.mfaChallenges++; return runtime.challenge(token); },
  async verify(input) { return runtime.mfaVerify(input); },
};
export const mfaService = {
  async status(token) { runtime.mfaStatusCalls++; return runtime.mfaStatus(token); },
  async enroll(token) { runtime.mfaEnrollments++; return runtime.mfaEnroll(token); },
  async confirmEnroll(input, token) { runtime.mfaConfirmations++; return runtime.mfaConfirm(input, token); },
  async disable() {},
  async regenerateRecoveryCodes() { return { recoveryCodes: ['synthetic-recovery-code'] }; },
};

export const router = {
  replace(path) { runtime.onNavigate(path); runtime.navigation.push(['replace', path]); },
  push(path) { runtime.onNavigate(path); runtime.navigation.push(['push', path]); },
  back() { runtime.navigation.push(['back']); },
  canGoBack() { return false; },
};
export function useRouter() { return router; }
export function Redirect(props) { return React.createElement('Redirect', props); }
export const Stack = Object.assign(props => React.createElement('Stack', props), { Screen: () => null });
export const Tabs = Object.assign(props => React.createElement('Tabs', props), { Screen: () => null });

runtime.reset();
