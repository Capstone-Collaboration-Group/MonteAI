import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  Check,
  ChevronDown,
  CloudUpload,
  Database,
  Download,
  FileArchive,
  FileText,
  FolderOpen,
  Info,
  Layers,
  LoaderCircle,
  type LucideIcon,
} from "lucide-react";
import type { BackupService } from "@monteai/api";
import type {
  BackupCategoryKey,
  BackupHistoryEntry,
  BackupManifest,
  BackupProgress,
  BackupRunResult,
  BackupStatsResponse,
} from "@monteai/types";
import { getApiErrorMessage } from "@monteai/utils";
import { toast } from "sonner";
import { Button } from "../Button";
import { Card } from "../Card";

// Optional local persistence supplied by the desktop app (Electron main
// process writes real files under Documents/MonteAI_Backups). Without it
// (web shells) the panel falls back to a browser JSON download.
export interface BackupStorage {
  save(manifest: BackupManifest): Promise<BackupHistoryEntry>;
  list(): Promise<BackupHistoryEntry[]>;
  defaultDir(): Promise<string>;
}

// Live-only Route B export (undefined in mock mode): streams the data zip
// and pulls PDFs into the local backup folder with progress callbacks.
export interface BackupExporter {
  start(
    categories: BackupCategoryKey[],
    onProgress: (progress: BackupProgress) => void,
  ): Promise<BackupRunResult>;
}

export interface BackupPanelProps {
  backupService: BackupService;
  storage?: BackupStorage;
  exporter?: BackupExporter;
}

const categoryIcons: Record<BackupCategoryKey, LucideIcon> = {
  database: Database,
  bacpac: FileArchive,
  "thesis-files": FileText,
  firestore: Layers,
};

function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || Number.isNaN(bytes)) return "—";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** exponent;
  return `${value >= 100 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`;
}

function formatCount(count: number | null, unit: string): string {
  if (count == null) return "—";
  switch (unit) {
    case "files":
      return `${count} file${count === 1 ? "" : "s"}`;
    case "rows":
      return `${count} row${count === 1 ? "" : "s"}`;
    case "docs":
      return `${count} doc${count === 1 ? "" : "s"}`;
    case "export":
      return "on demand";
    default:
      return `${count} record${count === 1 ? "" : "s"}`;
  }
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

function phaseLabel(phase: BackupProgress["phase"]): string {
  switch (phase) {
    case "data":
      return "Exporting data zip…";
    case "pdfs":
      return "Downloading PDFs…";
    default:
      return "Finishing…";
  }
}

export function BackupPanel({ backupService, storage, exporter }: BackupPanelProps) {
  const [stats, setStats] = useState<BackupStatsResponse | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<BackupCategoryKey>>(new Set());
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<BackupProgress | null>(null);
  const [lastRun, setLastRun] = useState<BackupRunResult | null>(null);
  const [history, setHistory] = useState<BackupHistoryEntry[]>([]);
  const [targetDir, setTargetDir] = useState<string | null>(null);

  const refreshHistory = useCallback(async () => {
    if (!storage) return;
    try {
      setHistory(await storage.list());
    } catch {
      // History is best-effort — the save itself already toasted on failure.
    }
  }, [storage]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await backupService.getStats();
        if (cancelled) return;
        setStats(result);
        setSelected(new Set(result.categories.map(({ key }) => key)));
        setStatsError(null);
      } catch (err) {
        if (!cancelled) {
          setStatsError(getApiErrorMessage(err, "Couldn't load backup stats."));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [backupService]);

  useEffect(() => {
    if (!storage) return;
    let cancelled = false;
    storage
      .list()
      .then((entries) => {
        if (!cancelled) setHistory(entries);
      })
      .catch(() => {
        // History is best-effort — the save itself already toasted on failure.
      });
    storage
      .defaultDir()
      .then((dir) => {
        if (!cancelled) setTargetDir(dir);
      })
      .catch(() => {
        if (!cancelled) setTargetDir(null);
      });
    return () => {
      cancelled = true;
    };
  }, [storage]);

  const toggleCategory = (key: BackupCategoryKey) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const categories = useMemo(() => stats?.categories ?? [], [stats]);
  const lastBackup = history[0] ?? null;

  const totalSizeLabel = useMemo(() => {
    const chosen = categories.filter(({ key }) => selected.has(key));
    if (chosen.length === 0) return "—";
    const known = chosen.filter(({ sizeBytes }) => sizeBytes != null);
    if (known.length === 0) return "—";
    const sum = known.reduce((acc, { sizeBytes }) => acc + (sizeBytes ?? 0), 0);
    return known.length === chosen.length ? formatBytes(sum) : `~ ${formatBytes(sum)}+`;
  }, [categories, selected]);

  const downloadManifest = (manifest: BackupManifest) => {
    const blob = new Blob([JSON.stringify(manifest, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `monte-skolar-backup-${manifest.createdAt.slice(0, 19).replace(/:/g, "-")}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const startBackup = async () => {
    if (selected.size === 0 || busy) return;
    setBusy(true);
    setLastRun(null);
    try {
      const chosen = Array.from(selected);
      const manifest = await backupService.createManifest(chosen);

      if (storage) {
        const entry = await storage.save(manifest);
        await refreshHistory();
        toast.success(`Manifest saved — ${entry.fileName}`);
      } else {
        downloadManifest(manifest);
        toast.success("Backup manifest downloaded.");
      }

      if (exporter) {
        setProgress({
          phase: "data",
          transferredBytes: 0,
          totalBytes: null,
          completedFiles: 0,
          totalFiles: 0,
        });
        try {
          const result = await exporter.start(chosen, setProgress);
          setLastRun(result);
          const parts: string[] = [];
          if (result.dataZipPath) parts.push("data zip");
          if (result.pdfDir) parts.push(`${result.pdfFiles} PDFs`);
          toast.success(`Backup complete — ${parts.join(" + ") || "manifest only"}.`);
        } finally {
          setProgress(null);
        }
      } else if (storage) {
        toast.info("Mock mode — manifest only. Data export needs the live API.");
      }
    } catch (err) {
      setProgress(null);
      // Non-axios failures (main-process PDF errors, IPC/preload issues,
      // network errors) carry the real reason in err.message — surface it
      // instead of the generic fallback. Server responses still win via
      // getApiErrorMessage.
      console.error("Backup failed:", err);
      toast.error(
        getApiErrorMessage(err, "") ||
          (err instanceof Error && err.message) ||
          "Backup failed.",
      );
    } finally {
      setBusy(false);
    }
  };

  const savedTo = lastBackup?.filePath ?? targetDir;
  const progressPct =
    progress && progress.totalBytes && progress.totalBytes > 0
      ? Math.min(100, Math.round((progress.transferredBytes / progress.totalBytes) * 100))
      : null;

  return (
    <div className="min-h-screen bg-surface-container-low/60 p-5 lg:p-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <header className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <CloudUpload className="h-9 w-9" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-on-surface">Backup</h1>
              <p className="mt-1 max-w-xl text-sm leading-5 text-on-surface-variant">
                {storage
                  ? "Full data copy: database JSON, .bacpac snapshot, thesis PDFs, and Firestore documents — saved locally on this computer."
                  : "Export an inventory manifest of live system data. The manifest will be downloaded as a JSON file."}
              </p>
            </div>
          </div>
          <div className="flex min-w-60 items-center gap-3 rounded-xl bg-primary/5 px-4 py-3">
            <Archive className="h-10 w-10 rounded-xl bg-primary/10 p-3 text-primary" />
            <div className="text-xs">
              <p className="font-semibold text-primary">Last Backup</p>
              <p className="mt-1 text-on-surface-variant">
                {lastBackup
                  ? `Completed ${formatWhen(lastBackup.createdAt)}`
                  : "No previous backup found"}
              </p>
              <p className="mt-0.5 truncate text-on-surface-variant">
                {lastBackup
                  ? `${lastBackup.fileName} (${formatBytes(lastBackup.sizeBytes)})`
                  : history.length > 0
                    ? `${history.length} manifest${history.length === 1 ? "" : "s"} on disk`
                    : "—"}
              </p>
            </div>
          </div>
        </header>

        <Card className="rounded-md border-outline-variant/60 bg-surface p-4 sm:p-5">
          <div className="flex flex-col gap-3 border-b border-outline-variant/50 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-on-surface">Data to Backup</h2>
              <p className="mt-1 text-xs text-on-surface-variant">
                Live counts from the server. Select the data to include in this backup run.
              </p>
            </div>
            <Button
              onClick={startBackup}
              disabled={selected.size === 0 || busy || !stats}
              className="flex items-center justify-center gap-2 rounded-md px-5"
            >
              {busy ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {busy ? "Backing up…" : "Start Backup"}
            </Button>
          </div>

          {statsError && (
            <p className="mt-3 rounded-lg bg-error/10 px-3 py-2 text-xs font-medium text-error">
              {statsError}
            </p>
          )}

          {progress && (
            <div className="mt-3 rounded-lg bg-primary/5 p-3">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="font-medium text-primary">{phaseLabel(progress.phase)}</span>
                <span className="text-on-surface-variant">
                  {progress.phase === "pdfs" && progress.totalFiles > 0
                    ? `${progress.completedFiles}/${progress.totalFiles} files · ${formatBytes(progress.transferredBytes)}${progress.totalBytes ? ` / ${formatBytes(progress.totalBytes)}` : ""}`
                    : `${formatBytes(progress.transferredBytes)}${progress.totalBytes ? ` / ${formatBytes(progress.totalBytes)}` : ""}`}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-container-highest">
                {progressPct != null ? (
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-200"
                    style={{ width: `${progressPct}%` }}
                  />
                ) : (
                  <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
                )}
              </div>
            </div>
          )}

          <div className="divide-y divide-outline-variant/40">
            {!stats &&
              !statsError &&
              [0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 py-3.5">
                  <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-surface-container-highest" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-3 w-40 animate-pulse rounded bg-surface-container-highest" />
                    <div className="h-3 w-64 animate-pulse rounded bg-surface-container-highest" />
                  </div>
                </div>
              ))}

            {categories.map((category) => {
              const isSelected = selected.has(category.key);
              const Icon = categoryIcons[category.key] ?? FileText;
              return (
                <div key={category.key} className="flex items-center gap-3 py-3.5 sm:gap-4">
                  <button
                    type="button"
                    aria-label={`${isSelected ? "Deselect" : "Select"} ${category.name}`}
                    aria-pressed={isSelected}
                    onClick={() => toggleCategory(category.key)}
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-colors ${isSelected ? "border-primary bg-primary text-on-primary" : "border-outline"}`}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                  </button>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold text-on-surface">{category.name}</h3>
                    <p className="mt-1 truncate text-xs text-on-surface-variant">
                      {stats ? `Live data — updated ${formatWhen(stats.generatedAt)}` : "Loading live counts…"}
                    </p>
                  </div>
                  <div className="hidden w-28 shrink-0 sm:block">
                    <p className="text-xs font-medium text-on-surface">
                      {stats ? formatCount(category.recordCount, category.unit) : "—"}
                    </p>
                    <p className="mt-1 text-[11px] text-on-surface-variant">
                      {stats ? formatBytes(category.sizeBytes) : "—"}
                    </p>
                  </div>
                  <ChevronDown className="h-4 w-4 shrink-0 text-on-surface-variant" />
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex flex-col gap-3 rounded-lg bg-primary/5 p-3 text-xs sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2 text-on-surface-variant">
              <Info className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <p className="font-medium text-primary">
                  {lastBackup ? "Manifest saved to:" : storage ? "Manifests will be saved to:" : "Manifest will be downloaded as:"}
                </p>
                <p className="mt-1 break-all">
                  {lastBackup
                    ? lastBackup.filePath
                    : savedTo || (storage ? "Documents/MonteAI_Backups" : "Your browser's downloads folder")}
                </p>
                {lastRun?.dataZipPath && (
                  <p className="mt-1 break-all text-on-surface-variant">Data zip: {lastRun.dataZipPath}</p>
                )}
                {lastRun?.pdfDir && (
                  <p className="mt-1 break-all text-on-surface-variant">
                    PDFs: {lastRun.pdfDir} ({lastRun.pdfFiles} files, {formatBytes(lastRun.pdfBytes)}
                    {lastRun.skippedFiles > 0 ? `, ${lastRun.skippedFiles} skipped` : ""})
                  </p>
                )}
                {history.length > 1 && !lastRun && (
                  <p className="mt-1 text-on-surface-variant">
                    {history.length} manifests on disk — latest shown above.
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 sm:text-right">
              <FolderOpen className="h-6 w-6 text-primary" />
              <div>
                <p className="text-on-surface-variant">Total Size (selected)</p>
                <p className="mt-1 font-semibold text-primary">{totalSizeLabel}</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
