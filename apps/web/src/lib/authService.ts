// apps/web/src/lib/authService.ts
import { createAuthService } from "@monteai/api";
import { apiClient } from "./firebaseServices";

export const authService = createAuthService(apiClient);