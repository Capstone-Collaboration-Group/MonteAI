import type { AxiosInstance } from "axios";
import { mockBackupService } from "./mockBackupService";
import { LiveBackupService } from "./backupService";
import type { BackupService } from "./types";

export function createBackupService(
  client: AxiosInstance,
  useMock: boolean
): BackupService {
  return useMock ? mockBackupService : new LiveBackupService(client);
}

export type { BackupService } from "./types";
export { mockBackupService } from "./mockBackupService";
export { LiveBackupService } from "./backupService";
