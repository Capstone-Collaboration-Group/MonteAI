// apps/desktop/src/types/electron.d.ts
import type {
    BackupHistoryEntry,
    BackupManifest,
    BackupProgress,
    BackupRunResult,
    BackupStartRequest,
    IngestFullThesisResponseDto,
} from '@monteai/types';

declare global {
    interface Window {
        backupApi: {
            /** Writes the manifest JSON to Documents/MonteAI_Backups and reports the saved file. */
            saveManifest(manifest: BackupManifest): Promise<BackupHistoryEntry>;
            /** Scans Documents/MonteAI_Backups for saved manifests, newest first. */
            list(): Promise<BackupHistoryEntry[]>;
            /** Absolute path of the local backup folder (created if missing). */
            defaultDir(): Promise<string>;
            /** Streams the full data copy (zip + PDFs) to disk; progress via onProgress. */
            start(request: BackupStartRequest): Promise<BackupRunResult>;
            /** Subscribes to progress events; returns an unsubscribe function. */
            onProgress(callback: (progress: BackupProgress) => void): () => void;
        };
    }
}

export {};
