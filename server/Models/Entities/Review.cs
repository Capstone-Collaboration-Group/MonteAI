using System.ComponentModel.DataAnnotations;

namespace server.Models.Entities
{
    public class Review
    {
        [Key]
        public Guid Id { get; set; }

        [Required]
        public Guid ThesisId { get; set; }
        public Thesis? Thesis { get; set; }

        [Required]
        public string ReviewerId { get; set; } = string.Empty;

        [Required]
        public string Decision { get; set; } = string.Empty;

        [MaxLength(1000)]
        public string?  Comments { get; set; }

        public DateTime? ReviewedAt { get; set; }

    }
}
