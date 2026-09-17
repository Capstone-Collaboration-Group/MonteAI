import {
  createAuthService,
  createOtpService,
  createProfileService,
} from "@monteai/api";
import { apiClient, auth } from "./firebaseServices"; // import auth

export const authService = createAuthService(apiClient, auth);
export const profileService = createProfileService(apiClient);
export const otpService = createOtpService(
  apiClient,
  import.meta.env.VITE_USE_MOCK === "true",
);
