using System.ComponentModel.DataAnnotations;

namespace server.Models.DTOs.Admin
{
    public class CreateAdminDto
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
        [MaxLength(100)]
        public string Position { get; set; } = string.Empty;
    }

    public class UpdateAdminDto
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

        [MaxLength(100)]
        public string? Position { get; set; }

        public bool? IsActive { get; set; }
    }

     public class AdminResponseDto
    {
        public string Id { get; set; } = string.Empty;

        public string Email { get; set; } = string.Empty;

        public string FirstName { get; set; } = string.Empty;

        public char? MiddleInitial { get; set; }

        public string LastName { get; set; } = string.Empty;

        public string? Suffix { get; set; }

        public string Position { get; set; } = string.Empty;

        public string Role { get; set; } = string.Empty;

        public bool? IsActive { get; set; }

        public DateTime CreatedAt { get; set; }

        public DateTime UpdatedAt { get; set; }
    }
}