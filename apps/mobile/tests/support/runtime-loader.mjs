// Test-only native/Firebase boundaries. All production TS/TSX still runs through
// the repository's in-memory loader; no Metro/device, payload files, or network.
import { existsSync } from 'node:fs';
import { createRequire, registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const mobile = new URL('../../', import.meta.url);
const nativeMocks = new URL('./runtime-mocks.mjs', import.meta.url).href;
const routeMocks = new URL('./route-ui-mocks.mjs', import.meta.url).href;
const requireMobile = createRequire(new URL('package.json', mobile));
const external = new Set([
  'react-native', 'react-native-safe-area-context', '@expo/vector-icons', '@react-navigation/native',
  'expo-camera', 'expo-screen-capture', 'expo-router', '@react-native-async-storage/async-storage', 'firebase/auth',
]);
const nativePaths = new Set([
  'lib/authService', 'lib/firebase', 'lib/mfaService', 'hooks/use-theme-color',
  'components/ui/ScaledText', 'modules/verification-camera', 'lib/registration/idVerificationService',
]);

globalThis.__DEV__ = true;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
process.env.EXPO_PUBLIC_USE_MOCK = 'false';
process.env.EXPO_PUBLIC_ID_VERIFICATION_ENDPOINT = 'https://idv.example.test/api/v1/id-verification';
globalThis.require = specifier => {
  if (specifier.startsWith('@/assets/images/')) return 0;
  throw new Error('Only static native image assets are mocked in this test.');
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'react' || specifier.startsWith('react/')) {
      return { url: pathToFileURL(requireMobile.resolve(specifier)).href, shortCircuit: true };
    }
    if (external.has(specifier)) return { url: nativeMocks, shortCircuit: true };
    if (specifier.startsWith('@/')) {
      const path = specifier.slice(2);
      if (nativePaths.has(path)) return { url: nativeMocks, shortCircuit: true };
      if (path === 'components/AnimatedSplashScreen' || path === 'components/ui/CustomTabBar') {
        return { url: routeMocks, shortCircuit: true };
      }
      for (const suffix of ['.ts', '.tsx', '/index.ts']) {
        const candidate = new URL(path + suffix, mobile);
        if (existsSync(fileURLToPath(candidate))) return { url: candidate.href, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
});
