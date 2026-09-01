import { createAuthService, createProfileService } from "@monteai/api";
import { apiClient, auth } from "./firebaseServices"; // import auth

export const authService = createAuthService(apiClient, auth);
export const profileService = createProfileService(apiClient)