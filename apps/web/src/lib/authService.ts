import { createAuthService, createFirebaseTokenAccessors, createProfileService } from "@monteai/api";
import { apiClient, auth } from "./firebaseServices"; // import auth

export const authService = createAuthService(apiClient, auth);
export const { getFreshFirebaseIdToken } = createFirebaseTokenAccessors(auth);
export const profileService = createProfileService(apiClient)

const token = await getFreshFirebaseIdToken();