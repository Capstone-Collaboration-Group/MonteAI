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
        thesisApi: {
            /**
             * Runs the approve/reindex pipeline. Resolves with the ingestion
             * response, or `{ kind: 'SectionsNotDetected' }` when the PDF has
             * no chapter headings — the renderer must then confirm
             * metadata-only indexing and re-invoke with `metadataOnly: true`
             * (the short-circuit itself never touched the server).
             */
            approveThesis(request: {
                thesisId: string;
                baseURL?: string;
                authToken?: string;
                metadataOnly?: boolean;
            }): Promise<
                | IngestFullThesisResponseDto
                | { kind: 'SectionsNotDetected' }
            >;
        };
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
