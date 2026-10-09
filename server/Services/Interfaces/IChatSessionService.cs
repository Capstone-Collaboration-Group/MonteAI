using server.Models.DTOs.ChatSession;

namespace server.Services.Interfaces
{
    public interface IChatSessionService
    {
        // GetAllAsync
        Task<IEnumerable<ChatSessionResponseDto>> GetAllAsync(string userId);
        // GetByIdAsync
        Task<ChatSessionResponseDto?> GetByIdAsync(Guid id);

        /// <summary>
        /// Returns the owning user id of a session (null when the session does
        /// not exist). Used by ChatController to enforce session ownership —
        /// a user must never be able to post into someone else's session.
        /// </summary>
        Task<string?> GetOwnerUserIdAsync(Guid id);
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
