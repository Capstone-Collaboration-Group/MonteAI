using System.ComponentModel.DataAnnotations;

namespace server.Models.DTOs.ChatSession
{
    public class CreateChatSessionDto
    {
        [Required]
        public string UserId { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string Title { get; set; } = string.Empty;
    }

     public class UpdateChatSessionDto
    {
        [Required]
        [MaxLength(100)]
        public string Title { get; set; } = string.Empty;
    }

     public class ChatSessionResponseDto
    {
        public Guid Id { get; set; }

        public string UserId { get; set; } = string.Empty;

        public string Title { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; }

        public DateTime LastChatDate { get; set; }
    }
}