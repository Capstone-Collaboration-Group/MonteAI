import { createApiClient, createFirebaseTokenAccessors, createProfileService } from "@monteai/api";
import { auth } from "./firebase";

const { getAuthToken, refreshAuthToken } = createFirebaseTokenAccessors(auth);

export const apiClient = createApiClient({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  getAuthToken,
  refreshAuthToken,
  onAuthExpired: () => auth.signOut(),
});

export const profileService = createProfileService(apiClient);