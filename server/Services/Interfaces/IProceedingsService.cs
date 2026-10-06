namespace server.Services.Interfaces
{
    public interface IProceedingsService
    {
        /// <summary>Null when the thesis does not exist.</summary>
        Task<byte[]?> GenerateProceedingsAsync(Guid thesisId);
    }
}
