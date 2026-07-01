using System.ComponentModel.DataAnnotations;

namespace server.Models.DTOs.Thesis
{
    public class CreateThesisDto
    {
        [Required]
        [MaxLength(255)]
        public string Title { get; set; } = string.Empty;

        [Required]
        public string Abstract { get; set; } = string.Empty;

        [Required]
        public string FilePath { get; set; } = string.Empty;

        [Required]
        public string UploadedById { get; set; } = string.Empty;
    }

    public class UpdateThesisDto
    {
        [MaxLength(255)]
        public string? Title { get; set; }
        public string? Abstract { get; set; }
        public string? FilePath { get; set; }
    }

    public class UpdateThesisStatusDto
    {
        [Required]
        [MaxLength(15)]
        public string Status { get; set; } = string.Empty;
    }

    public class ThesisResponseDto
    {
        public Guid Id { get; set; }
        public string? Title { get; set; }
        public string? Abstract { get; set; }
        public string FilePath { get; set; } = string.Empty;
        public string UploadedById { get; set; } = string.Empty;
        public string? Status { get; set; }
        public string? PineconeStatus { get; set; }
        public DateTime? SubmittedAt { get; set; }
        public DateTime? ReviewedAt { get; set; }
        public DateTime? ApprovedAt { get; set; }
        public DateTime? RejectedAt { get; set; }
        public DateTime? IndexedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
}
