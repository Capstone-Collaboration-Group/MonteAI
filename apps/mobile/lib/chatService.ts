// apps/mobile/lib/chatService.ts
import { createApiClient, createChatService } from "@monteai/api";
import { getAuthToken, refreshAuthToken } from "./authService";

const baseURL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://192.168.100.9:5084/api/v1";

const useMock =
  (process.env.EXPO_PUBLIC_USE_MOCK ?? (__DEV__ ? "true" : "false")) === "true";

const client = createApiClient({ baseURL, getAuthToken, refreshAuthToken });

export const chatService = createChatService(client, useMock);
