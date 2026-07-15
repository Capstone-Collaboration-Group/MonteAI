using System.ComponentModel.DataAnnotations;

namespace server.Models.DTOs.Submission
{
    public class CreateSubmissionDto
    {
        [Required]
        public Guid ThesisId { get; set; }

        [Required]
        public string StudentNumber { get; set; } = string.Empty;
        [MaxLength(999)]
        public string? Notes { get; set; }

    }
    public class UpdateSubmissionDto
    {
        [MaxLength(999)]
        public string? Notes { get; set; }
    }
    public class SubmissionResponseDto
    {
        public Guid Id { get; set; }
        public Guid ThesisId { get; set; }
        public string StudentNumber { get; set; } = string.Empty;
        public DateTime SubmittedAt { get; set; }
        public string? Notes { get; set; }
        public string? ThesisTitle { get; set; }
        public string? StudentName { get; set; }
    }
}
