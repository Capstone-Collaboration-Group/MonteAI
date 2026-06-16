using System.ComponentModel.DataAnnotations;

namespace server.Models.Entities
{
    public class ChatSession
    {
        [Key]
        public Guid? Id { get; set; }

        [Required]
        public string? UserId { get; set; }

        [Required]
        public string? Title { get; set; }

        public DateTime? CreatedAt { get; set; }

        public DateTime? LastChatDate { get; set; }
    }
}
