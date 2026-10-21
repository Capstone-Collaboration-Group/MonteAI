// apps/desktop/src/renderer/lib/backupStorage.ts
//
// Bridges the shared BackupPanel to the desktop main process (real files
// under Documents/MonteAI_Backups). Undefined outside Electron — the panel
// then falls back to a browser JSON download.
import type { BackupHistoryEntry, BackupManifest } from "@monteai/types";

export interface BackupStorage {
  save(manifest: BackupManifest): Promise<BackupHistoryEntry>;
  list(): Promise<BackupHistoryEntry[]>;
  defaultDir(): Promise<string>;
}

export const backupStorage: BackupStorage | undefined =
  typeof window !== "undefined" && window.backupApi
    ? {
        save: (manifest) => window.backupApi.saveManifest(manifest),
        list: () => window.backupApi.list(),
        defaultDir: () => window.backupApi.defaultDir(),
      }
    : undefined;
