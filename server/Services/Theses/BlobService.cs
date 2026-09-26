using System.Text.RegularExpressions;
using Azure.Storage.Blobs;
using Azure.Storage.Blobs.Models;
using Azure.Storage.Sas;
using server.Services.Interfaces;

namespace server.Services
{
    public class BlobService : IBlobService
    {
        private readonly BlobContainerClient _container;
        private readonly ILogger<BlobService> _logger;

        public BlobService(IConfiguration config, ILogger<BlobService> logger)
        {
            _logger = logger;
            var connectionString = config["AzureStorage:ConnectionString"]!;
            var containerName = config["AzureStorage:ContainerName"]!;
            _container = new BlobContainerClient(connectionString, containerName);
        }

        public async Task<string> UploadAsync(
            Stream fileStream,
            string fileName,
            string contentType,
            string? nameHint = null)
        {
            var blobName = BuildBlobName(fileName, nameHint);
            var blobClient = _container.GetBlobClient(blobName);

            await blobClient.UploadAsync(fileStream, new BlobHttpHeaders
            {
                ContentType = contentType
            });

            _logger.LogInformation("Uploaded blob: {BlobName}", blobName);
            return blobClient.Uri.ToString(); // returns the full blob URL
        }

        public async Task DeleteAsync(string blobUrl)
        {
            var blobName = GetBlobNameFromUrl(blobUrl);
            var blobClient = _container.GetBlobClient(blobName);
            await blobClient.DeleteIfExistsAsync();
            _logger.LogInformation("Deleted blob: {BlobName}", blobName);
        }
        public string GenerateSasUrl(string blobUrl, int expiryMinutes)
        {
            var blobName = GetBlobNameFromUrl(blobUrl);
            var blobClient = _container.GetBlobClient(blobName);

            var sasBuilder = new BlobSasBuilder
            {
                BlobContainerName = _container.Name,
                BlobName = blobName,
                Resource = "b",
                ExpiresOn = DateTimeOffset.UtcNow.AddMinutes(expiryMinutes)
            };
            sasBuilder.SetPermissions(BlobSasPermissions.Read);

            return blobClient.GenerateSasUri(sasBuilder).ToString();
        }

        // Extracts the stored blob name from a full blob URL. Uri.AbsolutePath is
        // still percent-encoded (spaces stay "%20"), but blob names are stored in
        // decoded form — signing the encoded name would produce a SAS for a blob
        // that doesn't exist (404 on fetch). Split on '/' FIRST, then decode, so
        // an encoded '/' (%2F) inside the name can't shift the segment boundary.
        private static string GetBlobNameFromUrl(string blobUrl)
        {
            var segment = new Uri(blobUrl).Segments.Last();
            return Uri.UnescapeDataString(segment);
        }

        // Readable, URL-safe blob name derived from a name hint (the thesis title):
        // lowercase with runs of non-alphanumerics collapsed to "_", plus a short
        // unique suffix so a re-upload or a revision can never overwrite an
        // existing blob (titles repeat across versions).
        private static string BuildBlobName(string fileName, string? nameHint)
        {
            var extension = Path.GetExtension(fileName).ToLowerInvariant();

            var baseName = SanitizeName(nameHint);
            if (baseName.Length == 0)
                baseName = SanitizeName(Path.GetFileNameWithoutExtension(fileName));
            if (baseName.Length == 0)
                baseName = "thesis";

            var unique = Guid.NewGuid().ToString("N")[..8];
            return $"{baseName}_{unique}{extension}";
        }

        private static string SanitizeName(string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return string.Empty;

            var cleaned = Regex
                .Replace(value.Trim().ToLowerInvariant(), "[^a-z0-9]+", "_")
                .Trim('_');

            if (cleaned.Length <= 80) return cleaned;
            return cleaned[..80].TrimEnd('_');
        }
    }
}
