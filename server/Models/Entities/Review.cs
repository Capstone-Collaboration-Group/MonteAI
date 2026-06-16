using System.ComponentModel.DataAnnotations;

namespace server.Models.Entities
{
    public class Review
    {
        [Key]
        public int? Id { get; set; }

        [Required]
        public int? ThesisId { get; set; }

        [Required]
        public string?  ReviewerId { get; set; }

        [Required]
        public string? Decision { get; set; }

        [MaxLength(1000)]
        public string?  Comments { get; set; }

        public DateTime? ReviewedAt { get; set; }

    }
}
