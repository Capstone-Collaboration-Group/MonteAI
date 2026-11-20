// Keep verification and registration on the SAME live/mock toggle. No runtime
// fallback to mock when a real verification service fails or is unconfigured.
export const registrationUsesMock =
  (process.env.EXPO_PUBLIC_USE_MOCK ?? (__DEV__ ? 'true' : 'false')) === 'true';

// Full endpoint. Missing configuration fails closed before any capture upload.
export const idVerificationEndpoint = process.env.EXPO_PUBLIC_ID_VERIFICATION_ENDPOINT?.trim();
