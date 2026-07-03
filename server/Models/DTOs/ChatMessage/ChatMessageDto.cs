using System.ComponentModel.DataAnnotations;

namespace server.Models.DTOs.ChatMessage
{
    public class CreateChatMessageDto
    {
        [Required]
        public string SessionId { get; set; } = string.Empty;

        [Required]
        public string Role { get; set; } = string.Empty;

        [Required]
        public string Content { get; set; } = string.Empty;
    }

    // No DTO class for UpdateChatMessageDto since hindi naman usually inuupdate ang chat messages 

    public class ChatMessageResponseDto
    {
        public string Id { get; set; } = string.Empty;

        public string SessionId { get; set; } = string.Empty;

        public string Role { get; set; } = string.Empty;

        public string Content { get; set; } = string.Empty;

        public DateTime? Timestamp { get; set; }
    }
}