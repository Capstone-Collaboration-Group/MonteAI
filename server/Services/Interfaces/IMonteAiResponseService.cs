namespace server.Services.Interfaces
{
    public interface IMonteAiResponseService
    {
        Task<string> GenerateResponseAsync(string userQuery);
    }
}
