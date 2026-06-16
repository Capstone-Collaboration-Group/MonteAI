using System.ComponentModel.DataAnnotations;

namespace server.Models.Entities
{
    public class Admin : User
    {
        [Key]
        public string Id { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]

        public string? Position { get; set; }

    }
}
