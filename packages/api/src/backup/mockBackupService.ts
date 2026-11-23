// packages/api/src/backup/mockBackupService.ts
//
// Stand-in for VITE_USE_MOCK=true: numbers are illustrative and the manifest
// is generated locally — nothing hits the API or Azure. Data-copy exports
// (zip/PDF/bacpac) never run in mock mode.
import type {
  BackupManifest,
  BackupManifestCategory,
  BackupManifestThesisFile,
  BackupStatsResponse,
  BackupCategoryKey,
  BackupCategoryStats,
} from "@monteai/types";
import type { BackupService } from "./types";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const mockFiles: BackupManifestThesisFile[] = Array.from({ length: 12 }, (_, i) => ({
  blobName: `mock_thesis_${String(i + 1).padStart(3, "0")}_{ab12cd34}.pdf`,
  sizeBytes: 6_500_000 + i * 120_000,
  lastModified: new Date(Date.now() - i * 86_400_000).toISOString(),
}));

const categoryMeta: Record<
  BackupCategoryKey,
  { name: string; unit: string; recordCount: number | null; sizeBytes: number | null }
> = {
  database: { name: "Database Records (JSON)", unit: "rows", recordCount: 1843, sizeBytes: null },
  bacpac: { name: "Database Snapshot (.bacpac)", unit: "export", recordCount: null, sizeBytes: null },
  "thesis-files": {
    name: "Thesis Files (PDF)",
    unit: "files",
    recordCount: mockFiles.length,
    sizeBytes: mockFiles.reduce((sum, f) => sum + f.sizeBytes, 0),
  },
  firestore: { name: "Firestore Documents", unit: "docs", recordCount: 612, sizeBytes: null },
};

const allKeys = Object.keys(categoryMeta) as BackupCategoryKey[];

function statsFor(keys: BackupCategoryKey[]): BackupCategoryStats[] {
  return keys.map((key) => ({ key, ...categoryMeta[key] }));
}

export const mockBackupService: BackupService = {
  async getStats(): Promise<BackupStatsResponse> {
    await delay(250);
    const categories = statsFor(allKeys);
    const totalSizeBytes = categories.reduce<number | null>(
      (sum, c) => (c.sizeBytes == null ? sum : (sum ?? 0) + c.sizeBytes),
      null,
    );
    return { generatedAt: new Date().toISOString(), totalSizeBytes, categories };
  },

  async createManifest(categories: BackupCategoryKey[]): Promise<BackupManifest> {
    await delay(400);
    const selected = statsFor(categories).map((stats) => {
      const category: BackupManifestCategory = { ...stats };
      if (stats.key === "database") {
        category.counts = {
          students: 200,
          admins: 48,
          faculties: 42,
          programHeads: 14,
          researchGroups: 31,
          theses: 132,
          thesisVersions: 151,
          submissions: 140,
          reviews: 88,
          schedules: 48,
          panelistSchedules: 144,
          announcements: 26,
          notifications: 310,
          chatSessions: 57,
        };
      } else if (stats.key === "thesis-files") {
        category.thesisFiles = mockFiles;
      } else if (stats.key === "firestore") {
        category.counts = { annotations: 317, abstracts: 132, chatMessages: 163 };
      }
      return category;
    });

    return {
      manifestVersion: "2",
      kind: "monteai-backup-manifest",
      createdAt: new Date().toISOString(),
      note: "MOCK inventory export — generated locally without contacting the API.",
      categories: selected,
    };
  },
};
