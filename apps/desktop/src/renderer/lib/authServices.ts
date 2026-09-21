// desktop/src/renderer/lib/services.ts
import {
  createAuthService,
  createFirebaseTokenAccessors,
  createOtpService,
  createProfileService,
} from "@monteai/api";
import { auth } from "./firebaseServices";
import { apiClient } from "../lib/apiClient";

const useMock = import.meta.env.VITE_USE_MOCK === "true";

export const authService = createAuthService(apiClient, auth);
export const otpService = createOtpService(
  apiClient,
  import.meta.env.VITE_USE_MOCK === "true",
);
export const { getAuthToken, refreshAuthToken } =
  createFirebaseTokenAccessors(auth);
export const profileService = createProfileService(apiClient, useMock);
