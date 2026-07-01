using System.ComponentModel.DataAnnotations;

namespace server.Models.Entities
{
    public class Student : User
    {
        [Key]
        [Required]
        public string Id { get; set; } = string.Empty;

        [Required]
        public string? StudentNumber { get; set; }

        public Guid? GroupId { get; set; }

        public virtual ResearchGroup? ResearchGroup { get; set; }

        [Required]
        [MaxLength(50)]
        public string? Position { get; set; }

        [Required]
        [MaxLength(100)]
        public string? Institute { get; set; }

        [Required]
        [MaxLength(100)]
        public string? Program { get; set; }

        [Required]
        public int? YearLevel { get; set; }

        [Required]
        [MaxLength(1)]
        public char Section { get; set; }
    }
}
