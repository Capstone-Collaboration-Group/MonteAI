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


        [Required]
        [Range(1, int.MaxValue, ErrorMessage = "Version number must be at least 1.")]
        public int VersionNumber { get; set; } = 0;

        [Required]
        [MaxLength(2048)]
        public string FilePath { get; set; } = string.Empty;

        [Required]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public DateTime UploadedAt { get; set; } = DateTime.Now;


        public Thesis Thesis { get; set; } = null!;

        public ICollection<Review> Reviews { get; set; } = new List<Review>();

    }
}
