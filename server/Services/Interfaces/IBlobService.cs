
using server.Models.DTOs.Backup;

namespace server.Services.Interfaces
{
    public interface IBlobService
    {
        Task<string> UploadAsync(Stream fileStream, string fileName, string contentType, string? nameHint = null);
        Task DeleteAsync(string blobUrl);
        string GenerateSasUrl(string blobUrl, int expiryMinutes);
        /// <summary>
        /// Container-level read-only SAS for the backup PDF pull (the whole
        /// container, one signing instead of one per blob).
        /// </summary>
        string GenerateContainerSasUrl(int expiryMinutes);
        /// <summary>
        /// Lists PDF blobs in the thesis container (name, size, last modified)
        /// for the backup inventory. Non-PDF blobs (e.g. ingest staging text)
        /// are excluded.
        /// </summary>
        Task<IReadOnlyList<BackupManifestThesisFileDto>> ListPdfBlobsAsync(CancellationToken cancellationToken = default);
        /// <summary>Streams one PDF blob to <paramref name="destination"/> (server-side scheduled backups).</summary>
        Task CopyPdfAsync(string blobName, Stream destination, CancellationToken cancellationToken = default);
    }
}