using System.ComponentModel.DataAnnotations;

namespace server.Models.Entities
{
    public class Faculty : User
    {
        [Key]
        public string? Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string? Institute { get; set; }
    }
}
