using System.ComponentModel.DataAnnotations;

namespace server.Models.Entities
{
    public class Submission
    {
        [Key]
        public Guid Id { get; set; }

        [Required]
        public Guid ThesisId { get; set; }
   
        [Required]
        public string? StudentNumber { get; set; }

        [Required]
        public string? SubmittedAt { get; set; }

        [MaxLength(999)]
        public string? Notes { get; set; }
        
        // Navigation Properties
        public Thesis? Thesis { get; set; }
        public Student? Student { get; set; }
    }
}
