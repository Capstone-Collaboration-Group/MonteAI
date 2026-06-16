using System.ComponentModel.DataAnnotations;

namespace server.Models.Entities
{
    // will be stored in Firestore 
    public class ChatMessage
    {
        [Required]
        public string Id { get; set; } =string.Empty;

        public string SessionId { get; set; } = string.Empty;

        [Required]
        public string? Role { get; set; } = string.Empty;

        [Required]
        public string? Content { get; set; } = string.Empty;

        public DateTime? Timestamp { get; set; }
    }
}
