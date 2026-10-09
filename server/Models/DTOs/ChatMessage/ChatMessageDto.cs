using System.ComponentModel.DataAnnotations;

// server/Models/DTOs/ChatMessage/ChatMessageDto.cs
//
// Contracts for creating and reading chat messages.
//
// A message round-trip:
//   POST /chat/sessions/{id}/messages            (CreateChatMessageDto in)
//   -> persisted user message                    (ChatMessageResponseDto out)
//   -> agent generates an answer
//   -> persisted assistant message WITH Sources  (ChatMessageResponseDto out,
//      Sources = the structured citations for the answer)

namespace server.Models.DTOs.ChatMessage
{
    public class CreateChatMessageDto
    {
        [Required]
        public string Role { get; set; } = string.Empty;

        [Required]
        public string Content { get; set; } = string.Empty;
    }

    public class ChatMessageResponseDto
    {
        public string Id { get; set; } = string.Empty;

        public string SessionId { get; set; } = string.Empty;

        public string Role { get; set; } = string.Empty;

        public string Content { get; set; } = string.Empty;

        public DateTime Timestamp { get; set; }

        /// <summary>
        /// Structured citations for assistant messages (null on user messages
        /// and on legacy assistant messages persisted before sources existed).
        /// Populated from the Firestore "SourcesJson" field.
        /// </summary>
        public List<ChatSourceDto>? Sources { get; set; }
    }
}
