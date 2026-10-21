import { app, ipcMain } from 'electron';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { createWriteStream, type WriteStream } from 'node:fs';
import { once } from 'node:events';
import https from 'https';
import { createApiClient } from '@monteai/api';
import type {
    BackupHistoryEntry,
    BackupManifest,
    BackupPdfPlan,
    BackupProgress,
    BackupRunResult,
    BackupStartRequest,
} from '@monteai/types';

// Local backup artifacts land in Documents/MonteAI_Backups — the real
// counterpart of the old hardcoded C:\Users\DELL\... path in the UI.
//
// 'backup:start' (Route B) streams the full data copy to disk in the main
// process: the server builds the zip (database.json / firestore.json /
// database.bacpac), and PDFs are pulled straight from Azure Blob via a
// container SAS — nothing big transits the renderer. Progress events
// ('backup:progress') drive the panel's progress bar; PDF pulls are skipped
// per-file when an identical size already exists (interrupted runs resume).
const BACKUP_DIR_NAME = 'MonteAI_Backups';
const FILE_PREFIX = 'monte-skolar-backup-';
const FILE_SUFFIX = '.json';
const PROGRESS_INTERVAL_MS = 200;
const PDF_CONCURRENCY = 6;

function backupsDir(): string {
    return path.join(app.getPath('documents'), BACKUP_DIR_NAME);
}

async function ensureBackupDir(): Promise<string> {
    const dir = backupsDir();
    await fs.mkdir(dir, { recursive: true });
    return dir;
}

function fileNameFor(manifest: BackupManifest, existingNames: Set<string>): string {
    const raw = manifest.createdAt || new Date().toISOString();
    const stamp = raw.replace(/[:.]/g, '-');
    let name = `${FILE_PREFIX}${stamp}${FILE_SUFFIX}`;
    let attempt = 2;
    while (existingNames.has(name)) {
        name = `${FILE_PREFIX}${stamp}_${attempt}${FILE_SUFFIX}`;
        attempt += 1;
    }
    return name;
}

async function listExistingNames(dir: string): Promise<Set<string>> {
    const entries = await fs.readdir(dir);
    return new Set(
        entries.filter(
            (name) => name.startsWith(FILE_PREFIX) && name.endsWith(FILE_SUFFIX),
        ),
    );
}

async function readHistory(dir: string): Promise<BackupHistoryEntry[]> {
    let names: string[];
    try {
        names = await fs.readdir(dir);
    } catch {
        return [];
    }

    const entries: BackupHistoryEntry[] = [];
    for (const fileName of names) {
        if (!fileName.startsWith(FILE_PREFIX) || !fileName.endsWith(FILE_SUFFIX)) {
            continue;
        }
        const filePath = path.join(dir, fileName);
        try {
            const stat = await fs.stat(filePath);
            if (!stat.isFile()) continue;
            // Prefer the createdAt baked into the manifest; fall back to mtime.
            let createdAt = stat.mtime.toISOString();
            try {
                const parsed = JSON.parse(
                    await fs.readFile(filePath, 'utf8'),
                ) as Partial<BackupManifest>;
                if (typeof parsed.createdAt === 'string') {
                    createdAt = parsed.createdAt;
                }
            } catch {
                // Unreadable/corrupt manifest — still list it from mtime.
            }
            entries.push({ fileName, filePath, sizeBytes: stat.size, createdAt });
        } catch {
            // Skip files that vanished mid-scan.
        }
    }

    return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function sanitizeSegments(blobName: string): string[] | null {
    const parts = blobName.split('/').filter((part) => part !== '' && part !== '.' && part !== '..');
    return parts.length > 0 ? parts : null;
}

/**
 * Joins a blob path onto a container SAS URL. The SAS is a full URL with a
 * query string (?sv=...&sig=...) — appending "/file.pdf" after it would land
 * inside the query and break both the path and the signature, so the path
 * must be inserted BEFORE the query.
 */
function blobUrl(containerSasUrl: string, encodedPath: string): string {
    const queryIndex = containerSasUrl.indexOf('?');
    if (queryIndex === -1) return `${containerSasUrl}/${encodedPath}`;
    return `${containerSasUrl.slice(0, queryIndex)}/${encodedPath}?${containerSasUrl.slice(queryIndex + 1)}`;
}

function endStream(stream: WriteStream): Promise<void> {
    return new Promise((resolve, reject) => {
        stream.end((err?: Error | null) => (err ? reject(err) : resolve()));
    });
}

async function drainResponse(
    source: AsyncIterable<Buffer>,
    destination: WriteStream,
    onChunk: (bytes: number) => void,
): Promise<void> {
    for await (const chunk of source) {
        onChunk(chunk.length);
        if (!destination.write(chunk)) {
            await once(destination, 'drain');
        }
    }
    await endStream(destination);
}

/**
 * Best-effort error message from an axios-style error (duck-typed: no axios
 * import here). API failures carry JSON (`message`/`Message`), but Azure Blob
 * errors arrive as XML in a response *stream* (responseType: 'stream') — drain
 * it so toasts show the real code (e.g. `InvalidAuthenticationInfo`) instead
 * of a bare status line.
 */
async function toError(err: unknown): Promise<Error> {
    const e = err as {
        response?: { data?: unknown };
        message?: string;
    };
    const data = e?.response?.data;
    let body: string | undefined;

    if (typeof data === 'string' && data.trim()) {
        body = data.trim();
    } else if (data && typeof (data as { pipe?: unknown }).pipe === 'function') {
        try {
            const chunks: Buffer[] = [];
            let size = 0;
            for await (const chunk of data as AsyncIterable<Buffer | string>) {
                const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
                chunks.push(buf);
                size += buf.length;
                if (size >= 64 * 1024) break;
            }
            const text = Buffer.concat(chunks).toString('utf8').trim();
            body = text || undefined;
        } catch {
            // Best effort — status text is still reported below.
        }
    } else if (data && typeof data === 'object') {
        const obj = data as { message?: unknown; Message?: unknown };
        const msg = obj.Message ?? obj.message;
        if (typeof msg === 'string' && msg.trim()) body = msg.trim();
    }

    const head = e?.message || 'Backup failed.';
    if (!body) return new Error(head);
    const flat = body.replace(/\s+/g, ' ');
    const short = flat.length > 300 ? `${flat.slice(0, 300)}…` : flat;
    return new Error(`${head} — ${short}`);
}

export function registerBackupHandlers(): void {
    ipcMain.handle(
        'backup:saveManifest',
        async (_event, manifest: BackupManifest): Promise<BackupHistoryEntry> => {
            if (!manifest || typeof manifest !== 'object' || !manifest.createdAt) {
                throw new Error('Invalid backup manifest.');
            }

            const dir = await ensureBackupDir();
            const existing = await listExistingNames(dir);
            const fileName = fileNameFor(manifest, existing);
            const filePath = path.join(dir, fileName);

            await fs.writeFile(filePath, JSON.stringify(manifest, null, 2), 'utf8');
            const stat = await fs.stat(filePath);

            return { fileName, filePath, sizeBytes: stat.size, createdAt: manifest.createdAt };
        },
    );

    ipcMain.handle('backup:list', async (): Promise<BackupHistoryEntry[]> => {
        const dir = await ensureBackupDir();
        return readHistory(dir);
    });

    ipcMain.handle('backup:defaultDir', async (): Promise<string> => {
        await ensureBackupDir();
        return backupsDir();
    });

    ipcMain.handle(
        'backup:start',
        async (event, request: BackupStartRequest): Promise<BackupRunResult> => {
            const { baseURL, authToken, categories } = request ?? ({} as BackupStartRequest);
            if (!baseURL) throw new Error('Missing API base URL.');
            if (!Array.isArray(categories) || categories.length === 0) {
                throw new Error('No backup categories selected.');
            }

            const sender = event.sender;
            let lastProgressAt = 0;
            const sendProgress = (progress: BackupProgress, force = false): void => {
                const now = Date.now();
                if (!force && now - lastProgressAt < PROGRESS_INTERVAL_MS) return;
                lastProgressAt = now;
                if (!sender.isDestroyed()) sender.send('backup:progress', progress);
            };

            const client = createApiClient({
                baseURL,
                getAuthToken: () => authToken,
                timeout: 0,
                ...(process.env.NODE_ENV === 'development' && {
                    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
                }),
            });

            // Dedicated client for Azure Blob SAS downloads. The API client
            // above attaches the Firebase Bearer token to every request, and
            // Azure rejects any Authorization scheme it cannot parse with
            // HTTP 400 (InvalidAuthenticationInfo) before it even looks at the
            // SAS — the signed URL is the only auth these requests need.
            const blobClient = createApiClient({
                baseURL: '',
                getAuthToken: () => undefined,
                timeout: 0,
                ...(process.env.NODE_ENV === 'development' && {
                    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
                }),
            });

            const dir = await ensureBackupDir();
            const stamp = new Date().toISOString().replace(/[:.]/g, '-');
            const wantsData = categories.some(
                (key) => key === 'database' || key === 'bacpac' || key === 'firestore',
            );
            const wantsPdf = categories.includes('thesis-files');

            let dataZipPath: string | null = null;
            let pdfDir: string | null = null;
            let pdfFiles = 0;
            let pdfBytes = 0;
            let skippedFiles = 0;

            if (wantsData) {
                dataZipPath = path.join(dir, `backup_${stamp}-data.zip`);
                let transferred = 0;
                try {
                    const response = await client.post('/backup/export', { categories }, {
                        responseType: 'stream',
                    });
                    const totalBytes = Number(response.headers['content-length']) || null;
                    await drainResponse(
                        response.data as AsyncIterable<Buffer>,
                        createWriteStream(dataZipPath),
                        (bytes) => {
                            transferred += bytes;
                            sendProgress({
                                phase: 'data',
                                transferredBytes: transferred,
                                totalBytes,
                                completedFiles: 0,
                                totalFiles: 0,
                            });
                        },
                    );
                } catch (err) {
                    await fs.unlink(dataZipPath).catch(() => undefined);
                    dataZipPath = null;
                    throw await toError(err);
                }
                sendProgress({
                    phase: 'data',
                    transferredBytes: transferred,
                    totalBytes: transferred,
                    completedFiles: 0,
                    totalFiles: 0,
                }, true);
            }

            if (wantsPdf) {
                const planResponse = await client.post<BackupPdfPlan>('/backup/pdf-plan', {});
                const plan = planResponse.data;
                pdfDir = path.join(dir, `backup_${stamp}-files`);
                await fs.mkdir(pdfDir, { recursive: true });

                let transferredPdfs = 0;
                let completedFiles = 0;
                const queue = [...plan.files];
                const emitPdfProgress = (force = false): void => {
                    sendProgress({
                        phase: 'pdfs',
                        transferredBytes: transferredPdfs,
                        totalBytes: plan.totalBytes,
                        completedFiles,
                        totalFiles: plan.files.length,
                    }, force);
                };
                emitPdfProgress(true);

                const worker = async (): Promise<void> => {
                    for (;;) {
                        const file = queue.shift();
                        if (!file) return;

                        const segments = sanitizeSegments(file.blobName);
                        if (!segments) {
                            skippedFiles += 1;
                            completedFiles += 1;
                            emitPdfProgress(true);
                            continue;
                        }

                        const destination = path.join(pdfDir, ...segments);
                        try {
                            const existing = await fs.stat(destination);
                            if (existing.size === file.sizeBytes) {
                                // Interrupted run resume — identical file already on disk.
                                skippedFiles += 1;
                                completedFiles += 1;
                                emitPdfProgress(true);
                                continue;
                            }
                        } catch {
                            // Not downloaded yet.
                        }

                        try {
                            await fs.mkdir(path.dirname(destination), { recursive: true });
                            const url = blobUrl(plan.containerSasUrl, segments.map(encodeURIComponent).join('/'));
                            await drainResponse(
                                (await blobClient.get(url, { responseType: 'stream' })).data as AsyncIterable<Buffer>,
                                createWriteStream(destination),
                                (bytes) => {
                                    transferredPdfs += bytes;
                                    emitPdfProgress();
                                },
                            );
                        } catch (err) {
                            await fs.unlink(destination).catch(() => undefined);
                            throw new Error(
                                `PDF download failed (${file.blobName}): ${(await toError(err)).message}`,
                            );
                        }

                        pdfFiles += 1;
                        pdfBytes += file.sizeBytes;
                        completedFiles += 1;
                        emitPdfProgress(true);
                    }
                };

                // allSettled: a failed worker must not leave its siblings'
                // rejections unhandled once the first failure propagates.
                const outcomes = await Promise.allSettled(
                    Array.from({ length: Math.min(PDF_CONCURRENCY, plan.files.length) }, () => worker()),
                );
                const failed = outcomes.find((outcome) => outcome.status === 'rejected');
                if (failed && failed.status === 'rejected') {
                    throw failed.reason;
                }
            }

            sendProgress({
                phase: 'done',
                transferredBytes: 0,
                totalBytes: 0,
                completedFiles: 0,
                totalFiles: 0,
            }, true);

            return { dataZipPath, pdfDir, pdfFiles, pdfBytes, skippedFiles };
        },
    );
}
