import { createAuthService } from "@monteai/api";
import { apiClient, auth } from "./firebaseServices"; // import auth

export const authService = createAuthService(apiClient, auth);