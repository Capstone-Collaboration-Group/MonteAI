using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace server.Models.Entities
{
    public class Submission
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public Guid Id { get; set; }

        [Required]
        public Guid ThesisId { get; set; }
   
        [Required]
        public string? StudentNumber { get; set; }

        [Required]
        public DateTime SubmittedAt { get; set; }    

        [MaxLength(999)]
        public string? Notes { get; set; }
        
        // Navigation Properties
        public Thesis? Thesis { get; set; }
        public Student? Student { get; set; }
    }
}
