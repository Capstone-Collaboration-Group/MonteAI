import { createBackupService } from "@monteai/api";
import { apiClient } from "./apiClient";

const client = apiClient;

export const backupService = createBackupService(
  client,
  import.meta.env.VITE_USE_MOCK === "true"
);
