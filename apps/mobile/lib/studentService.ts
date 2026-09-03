// apps/mobile/lib/studentService.ts
import { createApiClient, createStudentService } from "@monteai/api";

const baseURL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://localhost:7085/api/v1";

const useMock =
  (process.env.EXPO_PUBLIC_USE_MOCK ?? (__DEV__ ? "true" : "false")) === "true";

const client = createApiClient({ baseURL });

export const studentService = createStudentService(client, useMock);
