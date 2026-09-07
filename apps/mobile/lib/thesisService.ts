// apps/mobile/lib/thesisService.ts
import { createApiClient, createThesisService } from "@monteai/api";
import { getAuthToken } from "./authService";

const baseURL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://192.168.100.9:5084/api/v1";

const useMock =
  (process.env.EXPO_PUBLIC_USE_MOCK ?? (__DEV__ ? "true" : "false")) === "true";

const client = createApiClient({ baseURL, getAuthToken });

export const thesisService = createThesisService(client, useMock);
