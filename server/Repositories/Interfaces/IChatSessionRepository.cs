using server.Models.Entities;

namespace server.Repositories.Interfaces
{
    public interface IChatSessionRepository
    {
        Task<IEnumerable<ChatSession>> GetAllChatSessionsAsync(string userId);

        Task<ChatSession?> GetChatSessionByIdAsync(Guid id);

        Task<bool> CreateChatSessionAsync(ChatSession chatSession);

        Task<bool> UpdateChatSessionAsync(ChatSession chatSession);

        Task<bool> SetPinnedAsync(Guid id, bool pinned);

        Task<bool> DeleteChatSessionAsync(Guid id);
    }
}
