
namespace server.Services.Interfaces
{
    public interface IBlobService
    {
        Task<string> UploadAsync(Stream fileStream, string fileName, string contentType);
        Task DeleteAsync(string blobUrl);
        string GenerateSasUrl(string blobUrl, int expiryMinutes);
    }
}