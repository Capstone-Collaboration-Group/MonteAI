using System.ComponentModel.DataAnnotations;

namespace server.Models.Entities
{
    public class ProgramHead : User
    {
        [Key]
        public string Id { get; set; } = string.Empty;
        [Required]
        [MaxLength(100)]

        public string? Institute { get; set; }
        [Required]
        [MaxLength(100)]
        public string? ProgramHandled { get; set; }


    }
}
