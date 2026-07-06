using System.ComponentModel.DataAnnotations;

namespace server.Models.DTOs.Review
{
    public class CreateReviewDto
    {
        [Required]
        public Guid ThesisId { get; set; }

        [Required]
        public string ReviewerId { get; set; } = string.Empty;

        [Required]
        public string Decision { get; set; } = string.Empty;

        [MaxLength(1000)]
        public string? Comments { get; set; }
    }

     public class UpdateReviewDto
     {
        public string? Decision { get; set; }

        [MaxLength(1000)]
        public string? Comments { get; set; }
     }

    public class ReviewResponseDto
    {
        public Guid Id { get; set; }

        public Guid ThesisId { get; set; }

        public string ReviewerId { get; set; } = string.Empty;

        public string Decision { get; set; } = string.Empty;

        public string? Comments { get; set; }

        public DateTime? ReviewedAt { get; set; }
    }
}