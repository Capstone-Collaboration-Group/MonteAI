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
            string contentType)
        {
            var blobName = $"{Guid.NewGuid()}_{fileName}";
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
            var blobName = Path.GetFileName(new Uri(blobUrl).AbsolutePath);
            var blobClient = _container.GetBlobClient(blobName);
            await blobClient.DeleteIfExistsAsync();
            _logger.LogInformation("Deleted blob: {BlobName}", blobName);
        }
        public string GenerateSasUrl(string blobUrl, int expiryMinutes)
        {
            var blobName = Path.GetFileName(new Uri(blobUrl).AbsolutePath);
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
    }
}