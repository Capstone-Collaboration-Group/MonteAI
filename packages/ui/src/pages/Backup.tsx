import type { BackupService } from "@monteai/api";
import { BackupPanel, type BackupExporter, type BackupStorage } from "../components/Backup";

export interface BackupPageProps {
  backupService: BackupService;
  storage?: BackupStorage;
  exporter?: BackupExporter;
}

export default function BackupPage({ backupService, storage, exporter }: BackupPageProps) {
  return <BackupPanel backupService={backupService} storage={storage} exporter={exporter} />;
}
