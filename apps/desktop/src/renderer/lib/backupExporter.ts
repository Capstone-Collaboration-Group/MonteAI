// apps/desktop/src/renderer/lib/backupExporter.ts
//
// Live-only Route B export: streams the data zip and PDFs to disk in the
// Electron main process. Undefined under VITE_USE_MOCK (no server to export)
// and outside Electron — the BackupPanel then saves the manifest only.
import type { BackupCategoryKey, BackupProgress, BackupRunResult } from "@monteai/types";
import { apiClient, getAuthToken } from "./apiClient";

export interface BackupExporter {
  start(
    categories: BackupCategoryKey[],
    onProgress: (progress: BackupProgress) => void,
  ): Promise<BackupRunResult>;
}

export const backupExporter: BackupExporter | undefined =
  typeof window !== "undefined" && window.backupApi && import.meta.env.VITE_USE_MOCK !== "true"
    ? {
        start: async (categories, onProgress) => {
          const unsubscribe = window.backupApi.onProgress(onProgress);
          try {
            return await window.backupApi.start({
              baseURL: apiClient.defaults.baseURL ?? "",
              authToken: await getAuthToken(),
              categories,
            });
          } finally {
            unsubscribe();
          }
        },
      }
    : undefined;
