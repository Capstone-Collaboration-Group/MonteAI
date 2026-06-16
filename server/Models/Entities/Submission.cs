using System.ComponentModel.DataAnnotations;

namespace server.Models.Entities
{
    public class Submission
    {
        [Key]
        public int? Id { get; set; }

        [Required]
        public string? ThesisId { get; set; }
        [Required]
        public string? StudentNumber { get; set; }

        [Required]
        public string? SubmittedAt { get; set; }

        [MaxLength(999)]
        public string? Notes { get; set; }


    }
}
