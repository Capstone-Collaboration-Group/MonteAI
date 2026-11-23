using server.Models.DTOs.Backup;

namespace server.Services.Interfaces
{
    public interface IBackupService
    {
        Task<BackupStatsDto> GetStatsAsync(CancellationToken cancellationToken = default);

        Task<BackupManifestDto> CreateManifestAsync(
            IReadOnlyCollection<string> categoryKeys,
            CancellationToken cancellationToken = default);

        /// <summary>
        /// Container SAS + PDF inventory so the desktop can pull thesis files
        /// straight from Blob storage (no 800 MB through the API).
        /// </summary>
        Task<BackupPdfPlanDto> GetPdfPlanAsync(CancellationToken cancellationToken = default);

        /// <summary>
        /// Builds the full data-copy zip (manifest + database.json + firestore.json
        /// + database.bacpac when selected) at <paramref name="zipFilePath"/>.
        /// Throws ArgumentException for unknown categories, InvalidOperationException
        /// when a selected exporter (sqlpackage/Firestore) is unavailable — before
        /// any zip bytes exist.
        /// </summary>
        Task WriteExportZipAsync(
            IReadOnlyCollection<string> categoryKeys,
            string zipFilePath,
            CancellationToken cancellationToken = default);

        /// <summary>
        /// Server-side scheduled run: writes backup_&lt;stamp&gt;/{data.zip, files/, manifest.json}
        /// into <paramref name="outputFolder"/> and prunes old backup_* folders beyond
        /// <paramref name="keepCount"/>.
        /// </summary>
        Task<BackupScheduledRunDto> WriteScheduledBackupAsync(
            string outputFolder,
            IReadOnlyCollection<string> categoryKeys,
            int keepCount,
            CancellationToken cancellationToken = default);
    }
}
