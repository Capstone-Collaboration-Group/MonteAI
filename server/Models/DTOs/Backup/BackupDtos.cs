namespace server.Models.DTOs.Backup
{
    // Shared shapes for the desktop Backup feature.
    // Mirrored client-side by packages/types/src/backup.ts.

    public class BackupCategoryStatsDto
    {
        public string Key { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        /// <summary>Null when the source cannot be counted (e.g. Firestore unreachable).</summary>
        public long? RecordCount { get; set; }
        /// <summary>Null when size is not measurable up front (everything but PDFs).</summary>
        public long? SizeBytes { get; set; }
        /// <summary>Unit label: "rows" | "export" | "files" | "docs".</summary>
        public string Unit { get; set; } = "records";
    }

    public class BackupStatsDto
    {
        public DateTimeOffset GeneratedAt { get; set; }
        public long? TotalSizeBytes { get; set; }
        public IReadOnlyList<BackupCategoryStatsDto> Categories { get; set; } = Array.Empty<BackupCategoryStatsDto>();
    }

    public class BackupManifestThesisFileDto
    {
        public string BlobName { get; set; } = string.Empty;
        public long SizeBytes { get; set; }
        public DateTimeOffset? LastModified { get; set; }
    }

    public class BackupManifestCategoryDto
    {
        public string Key { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public long? RecordCount { get; set; }
        public long? SizeBytes { get; set; }
        public string Unit { get; set; } = "records";
        /// <summary>Per-table counts for the database category; per-collection for firestore.</summary>
        public Dictionary<string, long>? Counts { get; set; }
        public IReadOnlyList<BackupManifestThesisFileDto>? ThesisFiles { get; set; }
    }

    public class BackupManifestDto
    {
        public string ManifestVersion { get; set; } = "2";
        public string Kind { get; set; } = "monteai-backup-manifest";
        public DateTimeOffset CreatedAt { get; set; }
        public string Note { get; set; } = string.Empty;
        public IReadOnlyList<BackupManifestCategoryDto> Categories { get; set; } = Array.Empty<BackupManifestCategoryDto>();
    }

    public class BackupManifestRequestDto
    {
        public List<string>? Categories { get; set; }
    }

    public class BackupPdfFileDto
    {
        public string BlobName { get; set; } = string.Empty;
        public long SizeBytes { get; set; }
    }

    /// <summary>Container-level SAS + PDF inventory for the desktop to pull files directly.</summary>
    public class BackupPdfPlanDto
    {
        public string ContainerSasUrl { get; set; } = string.Empty;
        public DateTimeOffset GeneratedAt { get; set; }
        public long TotalBytes { get; set; }
        public IReadOnlyList<BackupPdfFileDto> Files { get; set; } = Array.Empty<BackupPdfFileDto>();
    }

    public class BackupScheduledRunDto
    {
        public string Folder { get; set; } = string.Empty;
        public string? DataZipPath { get; set; }
        public string? FilesFolder { get; set; }
        public string ManifestPath { get; set; } = string.Empty;
        public int PdfCount { get; set; }
        public long PdfBytes { get; set; }
    }
}
