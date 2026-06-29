using System.ComponentModel.DataAnnotations;

namespace server.Models.DTOs.User
{
    public class RegisterUserDto
    {
        // ── Shared (User base) ────────────────────────────
        [Required]
        public string FirebaseUid { get; set; } = null!;

        [Required]
        [EmailAddress]
        [MaxLength(100)]
        public string Email { get; set; } = null!;

        [Required]
        [MaxLength(50)]
        public string FirstName { get; set; } = null!;

        [Required]
        public char MiddleInitial { get; set; }

        [Required]
        [MaxLength(50)]
        public string LastName { get; set; } = null!;

        [MaxLength(10)]
        public string? Suffix { get; set; }

        [Required]
        [MaxLength(20)]
        public string Role { get; set; } = null!; // "Student" | "Faculty" | "Admin" | "ProgramHead"

        // ── Student-specific ──────────────────────────────
        public string? StudentNumber { get; set; }
        public Guid? GroupId { get; set; }
        public string? Position { get; set; }  // Student: "Leader" | "Member"

        [MaxLength(100)]
        public string? Institute { get; set; }

        [MaxLength(100)]
        public string? Program { get; set; }
        public int? YearLevel { get; set; }
        public string? Section { get; set; }

        // ── Faculty-specific ──────────────────────────────
        // Institute is shared with Student and ProgramHead above

        // ── ProgramHead-specific ──────────────────────────
        [MaxLength(100)]
        public string? ProgramHandled { get; set; }

        // ── Admin-specific ────────────────────────────────
        // Position is shared with Student above
    }



    public class UpdateUserDto
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

        [MaxLength(20)]
        public string? Role { get; set; }

        public bool? IsActive { get; set; }
    }
    public class UserResponseDto
    {
        public string Id { get; set; } = null!;
        public string Email { get; set; } = null!;
        public string FirstName { get; set; } = null!;
        public char MiddleInitial { get; set; }
        public string LastName { get; set; } = null!;
        public string? Suffix { get; set; }
        public string Role { get; set; } = null!;
        public bool? IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
}