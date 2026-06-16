using System.ComponentModel.DataAnnotations;

namespace server.Models.Entities
{
    public class Thesis 
    {
        [Key]
        public Guid Id { get; set; }

        [Required]
        [MaxLength(255)]
        public string? Title{ get; set; }

        public ICollection<Submission> Submissions { get; set; } = [];

        [Required]
        public string? Abstract { get; set; }

        [Required]
        public string FilePath { get; set; } = string.Empty;

        [Required]
        public string UploadedById { get; set; } = string.Empty;

        [Required]
        [MaxLength(15)]
        public string? Status { get; set; } = "Pending";

        public string? PineconeStatus { get; set; } = "None";

        public DateTime? SubmittedAt { get; set; }
        public DateTime? ReviewedAt { get; set; }
        public DateTime? ApprovedAt { get; set; }
        public DateTime? RejectedAt { get; set; }
        public DateTime? IndexedAt { get; set; }


        public DateTime UpdatedAt { get; set; }


    }
}
