using server.Models.DTOs.ChatMessage;
using server.Models.Agent;

// server/Services/Interfaces/IChatMessageService.cs
//
// Persistence contract for chat messages (Firestore-backed).

namespace server.Services.Interfaces
{
    public interface IChatMessageService
    {
        /// <summary>
        /// Persists one message. When <paramref name="sources"/> is provided
        /// (assistant messages), they are serialized into the SourcesJson
        /// field and echoed back on the response DTO.
        /// </summary>
        Task<ChatMessageResponseDto> CreateAsync(
            CreateChatMessageDto dto,
            string sessionId,
            IReadOnlyList<ChatSourceDto>? sources = null);

        /// <summary>
        /// Loads the session's prior turns (oldest-first, capped) as
        /// conversation memory for the agent. Call BEFORE persisting the
        /// current user message so the current turn is not duplicated.
        /// </summary>
        Task<IReadOnlyList<ConversationTurn>> GetHistoryAsync(Guid sessionId, int maxTurns = 10);
    }
}
