using System.ComponentModel.DataAnnotations;
using server.Models.DTOs.ResearchGroup;

namespace server.Models.DTOs.Student
{
    public class CreateStudentDto
    {
        [Required]
        public string Id { get; set; } = string.Empty;

        [Required]
        [EmailAddress]
        [MaxLength(100)]
        public string Email { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string FirstName { get; set; } = string.Empty;

        public char? MiddleInitial { get; set; }

        [Required]
        [MaxLength(50)]
        public string LastName { get; set; } = string.Empty;

        [MaxLength(10)]
        public string? Suffix { get; set; }

        [Required]
        public string StudentNumber { get; set; } = string.Empty;

        public Guid? GroupId { get; set; }

        [Required]
        [MaxLength(50)]
        public string Position { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string Institute { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string Program { get; set; } = string.Empty;

        [Required]
        public int YearLevel { get; set; }

        [Required]
        public char Section { get; set; }
    }

     public class UpdateStudentDto
    {
        [EmailAddress]
        [MaxLength(100)]
        public string? Email { get; set; }

        [MaxLength(50)]
        public string? FirstName { get; set; }

        public char? MiddleInitial { get; set; }

        [MaxLength(50)]
        public string? LastName { get; set; }

        [MaxLength(10)]
        public string? Suffix { get; set; }

        public string? StudentNumber { get; set; }

        public Guid? GroupId { get; set; }

        [MaxLength(50)]
        public string? Position { get; set; }

        [MaxLength(100)]
        public string? Institute { get; set; }

        [MaxLength(100)]
        public string? Program { get; set; }

        public int? YearLevel { get; set; }

        public char? Section { get; set; }

        public bool? IsActive { get; set; }
    }

     public class StudentResponseDto
    {
        public string Id { get; set; } = string.Empty;

        public string Email { get; set; } = string.Empty;

        public string FirstName { get; set; } = string.Empty;

        public char? MiddleInitial { get; set; }

        public string LastName { get; set; } = string.Empty;

        public string? Suffix { get; set; }

        public string StudentNumber { get; set; } = string.Empty;

        public ResearchGroupResponseDto? ResearchGroup { get; set; }

        public string Position { get; set; } = string.Empty;

        public string Institute { get; set; } = string.Empty;

        public string Program { get; set; } = string.Empty;

        public int YearLevel { get; set; }

        public char Section { get; set; }

        public string Role { get; set; } = string.Empty;

        public bool? IsActive { get; set; }

        public DateTime CreatedAt { get; set; }

        public DateTime UpdatedAt { get; set; }
    }
}