import type {
  BackupManifest,
  BackupStatsResponse,
  BackupCategoryKey,
} from "@monteai/types";

export interface BackupService {
  getStats(): Promise<BackupStatsResponse>;
  createManifest(categories: BackupCategoryKey[]): Promise<BackupManifest>;
}
