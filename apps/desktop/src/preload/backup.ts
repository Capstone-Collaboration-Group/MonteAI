import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type {
    BackupHistoryEntry,
    BackupManifest,
    BackupProgress,
    BackupRunResult,
    BackupStartRequest,
} from '@monteai/types';

// The renderer owns the API call context (auth token + live/mock toggle); the
// main process persists manifests and streams full data-copy artifacts to
// Documents/MonteAI_Backups, emitting 'backup:progress' while it works.
contextBridge.exposeInMainWorld('backupApi', {
    saveManifest: (manifest: BackupManifest): Promise<BackupHistoryEntry> =>
        ipcRenderer.invoke('backup:saveManifest', manifest),
    list: (): Promise<BackupHistoryEntry[]> => ipcRenderer.invoke('backup:list'),
    defaultDir: (): Promise<string> => ipcRenderer.invoke('backup:defaultDir'),
    start: (request: BackupStartRequest): Promise<BackupRunResult> =>
        ipcRenderer.invoke('backup:start', request),
    onProgress: (callback: (progress: BackupProgress) => void): (() => void) => {
        const listener = (_event: IpcRendererEvent, progress: BackupProgress): void =>
            callback(progress);
        ipcRenderer.on('backup:progress', listener);
        return () => ipcRenderer.off('backup:progress', listener);
    },
});
