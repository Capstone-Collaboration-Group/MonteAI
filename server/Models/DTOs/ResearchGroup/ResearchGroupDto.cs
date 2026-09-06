using System.ComponentModel.DataAnnotations;

namespace server.Models.DTOs.ResearchGroup
{
    public class CreateResearchGroupDto
    {
        [Required]
        [MaxLength(100)]
        public string GroupName { get; set; } = string.Empty;

        [Required]
        [MaxLength(255)]
        public string ResearchTitle { get; set; } = string.Empty;

        [Required]
        public string AdviserId { get; set; } = string.Empty;

        [Required]
        public string LeaderId { get; set; } = string.Empty;
    }

     public class UpdateResearchGroupDto
    {
        [MaxLength(100)]
        public string? GroupName { get; set; }

        [MaxLength(255)]
        public string? ResearchTitle { get; set; }

        public string? AdviserId { get; set; }

        public string? LeaderId { get; set; }
    }

    public class ResearchGroupResponseDto
    {
        public Guid Id { get; set; }

        public string GroupName { get; set; } = string.Empty;

        public string ResearchTitle { get; set; } = string.Empty;

        public string AdviserId { get; set; } = string.Empty;

        public string LeaderId { get; set; } = string.Empty;

        /// Institute of the group's leader student (resolved via Leader nav).
        public string Institute { get; set; } = string.Empty;

        public DateTime CreatedAt { get; set; }

        public DateTime UpdatedAt { get; set; }
    }
}