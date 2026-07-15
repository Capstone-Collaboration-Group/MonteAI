using server.Models.DTOs.ChatMessage;

namespace server.Services.Interfaces
{
    public interface IChatMessageService
    {
        Task<ChatMessageResponseDto> CreateAsync(CreateChatMessageDto dto, string sessionId);
    }
}
