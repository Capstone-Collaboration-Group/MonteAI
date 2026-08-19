namespace server.Services.Interfaces
{
    public interface IProceedingsService
    {
        Task<byte[]> GenerateProceedingsAsync(Guid thesisId);
    }
}