// apps/mobile/lib/chatService.ts
import { createApiClient, createChatService } from "@monteai/api";

const baseURL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://localhost:7085/api/v1";

const useMock =
  (process.env.EXPO_PUBLIC_USE_MOCK ?? (__DEV__ ? "true" : "false")) === "true";

const client = createApiClient({ baseURL });

export const chatService = createChatService(client, useMock);
