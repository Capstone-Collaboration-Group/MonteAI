import { useState } from "react";
import {
  Archive,
  CalendarDays,
  Check,
  ChevronDown,
  CloudUpload,
  Download,
  FileText,
  FolderOpen,
  Info,
  MessageSquareText,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { Button } from "../Button";
import { Card } from "../Card";

type BackupCategory = {
  name: string;
  description: string;
  icon: LucideIcon;
  records: string;
  size: string;
  fileType: string;
};

const backupCategories: BackupCategory[] = [
  {
    name: "User Information",
    description: "Student, faculty, and admin accounts with their profiles and roles.",
    icon: UserRound,
    records: "248 records",
    size: "~ 2.4 MB",
    fileType: "application/json",
  },
  {
    name: "Faculty and Program Head Information",
    description: "Faculty members and program head details, including departments and assignments.",
    icon: UsersRound,
    records: "56 records",
    size: "~ 1.1 MB",
    fileType: "application/json",
  },
  {
    name: "Thesis Files",
    description: "All thesis documents in PDF format.",
    icon: FileText,
    records: "132 files",
    size: "~ 842 MB",
    fileType: "application/pdf",
  },
  {
    name: "Defense Schedules",
    description: "Scheduled thesis defenses with date, time, and panel information.",
    icon: CalendarDays,
    records: "48 records",
    size: "~ 320 KB",
    fileType: "application/json",
  },
  {
    name: "Thesis Annotations",
    description: "Annotations and comments from Firestore.",
    icon: MessageSquareText,
    records: "317 records",
    size: "~ 1.6 MB",
    fileType: "application/json",
  },
];

const version = "mock-v1";
const totalSize = "~ 846 MB";

export function BackupPanel() {
  const [selected, setSelected] = useState(() => new Set(backupCategories.map(({ name }) => name)));
  const [lastBackup, setLastBackup] = useState<string | null>(null);

  const toggleCategory = (name: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const startBackup = () => {
    const timestamp = new Date().toISOString();
    const backup = {
      version,
      createdAt: timestamp,
      source: "MonteSkolar desktop mock backup",
      categories: backupCategories
        .filter(({ name }) => selected.has(name))
        .map(({ name, description, records, fileType }) => ({ name, description, records, fileType })),
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `monte-skolar-backup-${timestamp.slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setLastBackup(`C:\\Users\\DELL\\Desktop\\MonteAI_Backups\\backup_${timestamp.replace(/[:.]/g, "-").slice(0, 19)}.zip`);
  };

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
                Back up all data that has not been backed up yet. Your data will be saved locally on this computer for offline access and safety.
              </p>
            </div>
          </div>
          <div className="flex min-w-60 items-center gap-3 rounded-xl bg-primary/5 px-4 py-3">
            <Archive className="h-10 w-10 rounded-xl bg-primary/10 p-3 text-primary" />
            <div className="text-xs">
              <p className="font-semibold text-primary">Last Backup</p>
              <p className="mt-1 text-on-surface-variant">{lastBackup ? "Backup completed just now" : "No previous backup found"}</p>
              <p className="mt-0.5 text-on-surface-variant">{lastBackup ? version : "—"}</p>
            </div>
          </div>
        </header>

        <Card className="rounded-md border-outline-variant/60 bg-surface p-4 sm:p-5">
          <div className="flex flex-col gap-3 border-b border-outline-variant/50 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-on-surface">Data to Backup</h2>
              <p className="mt-1 text-xs text-on-surface-variant">Select the data you want to back up. All selected data will be saved to your local machine.</p>
            </div>
            <Button onClick={startBackup} disabled={selected.size === 0} className="flex items-center justify-center gap-2 rounded-md px-5">
              <Download className="h-4 w-4" />
              Start Backup
            </Button>
          </div>

          <div className="divide-y divide-outline-variant/40">
            {backupCategories.map((category) => {
              const isSelected = selected.has(category.name);
              return (
                <div key={category.name} className="flex items-center gap-3 py-3.5 sm:gap-4">
                  <button
                    type="button"
                    aria-label={`${isSelected ? "Deselect" : "Select"} ${category.name}`}
                    aria-pressed={isSelected}
                    onClick={() => toggleCategory(category.name)}
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-colors ${isSelected ? "border-primary bg-primary text-on-primary" : "border-outline"}`}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                  </button>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <category.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold text-on-surface">{category.name}</h3>
                    <p className="mt-1 truncate text-xs text-on-surface-variant">{category.description}</p>
                  </div>
                  <div className="hidden w-28 shrink-0 sm:block">
                    <p className="text-xs font-medium text-on-surface">{category.records}</p>
                    <p className="mt-1 text-[11px] text-on-surface-variant">{category.size}</p>
                  </div>
                  <ChevronDown className="h-4 w-4 shrink-0 text-on-surface-variant" />
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex flex-col gap-3 rounded-lg bg-primary/5 p-3 text-xs sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2 text-on-surface-variant">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div>
                <p className="font-medium text-primary">Backup will be saved to:</p>
                <p className="mt-1 break-all">{lastBackup || "C:\\Users\\DELL\\Desktop\\MonteAI_Backups\\backup_2026-09-09_14-30-22.zip"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:text-right">
              <FolderOpen className="h-6 w-6 text-primary" />
              <div>
                <p className="text-on-surface-variant">Total Size (estimated)</p>
                <p className="mt-1 font-semibold text-primary">{selected.size ? totalSize : "—"}</p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}