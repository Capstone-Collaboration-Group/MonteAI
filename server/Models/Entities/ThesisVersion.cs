using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace server.Models.Entities
{
    public class ThesisVersion
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public Guid Id { get; set; }

        [Required]
        public Guid ThesisId { get; set; }

        public int VersionNumber { get; set; }

        [Required]
        [MaxLength(2048)] 
        public string FilePath { get; set; } = string.Empty;
        public string? UploadedById { get; set; }
        public DateTime UploadedAt { get; set; }

        [MaxLength(500)]
        public string? ChangeNote { get; set; }

        public Thesis Thesis { get; set; } = null!;
    }
}
