// packages/types/src/backup.ts
//
// Shared contracts for the desktop Backup feature. Option 1 (inventory
// manifest) + Route B full data copy: SQL JSON dump, .bacpac snapshot,
// PDF pulls via SAS, and Firestore export.

export type BackupCategoryKey = "database" | "bacpac" | "thesis-files" | "firestore";

export interface BackupCategoryStats {
  key: BackupCategoryKey;
  name: string;
  /** Null when the source cannot be counted (e.g. Firestore unreachable). */
  recordCount: number | null;
  /** Null when size is not measurable up front (everything but PDFs). */
  sizeBytes: number | null;
  /** Unit label: "rows" | "export" | "files" | "docs". */
  unit: string;
}

export interface BackupStatsResponse {
  generatedAt: string;
  /** Sum of measurable category sizes; null when nothing is measurable. */
  totalSizeBytes: number | null;
  categories: BackupCategoryStats[];
}

export interface BackupManifestThesisFile {
  blobName: string;
  sizeBytes: number;
  lastModified: string | null;
}

export interface BackupManifestCategory {
  key: BackupCategoryKey;
  name: string;
  recordCount: number | null;
  sizeBytes: number | null;
  unit: string;
  /** Per-table counts for the database category; per-collection for firestore. */
  counts?: Record<string, number>;
  thesisFiles?: BackupManifestThesisFile[];
}

export interface BackupManifest {
  manifestVersion: string;
  kind: string;
  createdAt: string;
  note: string;
  categories: BackupManifestCategory[];
}

export interface BackupManifestRequest {
  categories: BackupCategoryKey[];
}

/** Local backup file recorded by the desktop main process. */
export interface BackupHistoryEntry {
  fileName: string;
  filePath: string;
  sizeBytes: number;
  createdAt: string;
}

export interface BackupPdfFile {
  blobName: string;
  sizeBytes: number;
}

/** Server-side plan for the desktop to pull PDFs directly from Blob storage. */
export interface BackupPdfPlan {
  containerSasUrl: string;
  generatedAt: string;
  totalBytes: number;
  files: BackupPdfFile[];
}

export interface BackupStartRequest {
  baseURL: string;
  authToken?: string;
  categories: BackupCategoryKey[];
}

export interface BackupProgress {
  phase: "data" | "pdfs" | "done";
  transferredBytes: number;
  /** Phase total when known (null while the data zip streams without Content-Length). */
  totalBytes: number | null;
  completedFiles: number;
  totalFiles: number;
}

export interface BackupRunResult {
  dataZipPath: string | null;
  pdfDir: string | null;
  pdfFiles: number;
  pdfBytes: number;
  skippedFiles: number;
}
