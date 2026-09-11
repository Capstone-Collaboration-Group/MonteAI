using server.Models.DTOs.ChatSession;

namespace server.Services.Interfaces
{
    public interface IChatSessionService
    {
        // GetAllAsync
        Task<IEnumerable<ChatSessionResponseDto>> GetAllAsync(string userId);
        // GetByIdAsync
        Task<ChatSessionResponseDto?> GetByIdAsync(Guid id);
        // CreateAsync
        Task<ChatSessionResponseDto> CreateAsync(CreateChatSessionDto chatSession);
        // UpdateAsync
        Task<bool> UpdateAsync(UpdateChatSessionDto chatSession, Guid sessionId);

        // TouchAsync — bump LastChatDate after new activity in a session
        Task<bool> TouchAsync(Guid id);

        // DeleteAsync
        Task<bool> DeleteAsync(Guid id);

        
    }
}
