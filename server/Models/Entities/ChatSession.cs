using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace server.Models.Entities
{
    public class ChatSession
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public Guid Id { get; set; }

        [Required]
        public string UserId { get; set; } = string.Empty;
// changed the public string? and inputted = string.Empty; for no conflict
        [Required]
        public string Title { get; set; } = string.Empty;
// removed the ? to not be nullable 
        public DateTime CreatedAt { get; set; }

        public DateTime LastChatDate { get; set; }
    }
}
