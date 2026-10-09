
namespace server.Services.Interfaces
{
    public interface IBlobService
    {
        Task<string> UploadAsync(Stream fileStream, string fileName, string contentType, string? nameHint = null);
        Task DeleteAsync(string blobUrl);
        string GenerateSasUrl(string blobUrl, int expiryMinutes);
    }
}