
using System.ComponentModel.DataAnnotations;

namespace server.Models.Entities
{
    public abstract class User
    {
        // --- TOTP MFA (all four role tables) ---
        // TotpSecretEncrypted is stored data-protection-encrypted (purpose
        // "MonteAI.TotpSecret.v1"); never log or return it outside enroll.
        public bool TotpEnabled { get; set; }

        [MaxLength(512)]
        public string? TotpSecretEncrypted { get; set; }

        // Highest TOTP time-step (unix/30) already accepted — replay guard.
        public long TotpLastUsedStep { get; set; }

        // SHA-256 hashes of the 8 single-use recovery codes (JSON array via
        // value converter in AppDbContext). Null until enrollment confirms.
        public List<string>? RecoveryCodeHashes { get; set; }

        [EmailAddress]
        // Students and faculty (and the other role tables sharing this base)
        // only use PNM addresses. Decorative for EF — enforcement happens in
        // the DTOs and the AuthController registration check.
        [RegularExpression(@"^[a-zA-Z0-9._%+-]+@(student\.)?pnm\.edu\.ph$", ErrorMessage = "Email must be a valid @pnm.edu.ph or @student.pnm.edu.ph address.")]
        [MaxLength(100)]
        [Required]
        public string? Email { get; set;  }

        [MaxLength(50)]
        [Required]
        
        public string? FirstName { get; set; }

        [Required]
        public char? MiddleInitial { get; set; }
        [MaxLength(50)]
        [Required]
        public string? LastName { get; set; }
        [MaxLength(10)]
        public string? Suffix { get; set; }
        [MaxLength(20)]
        [Required]
        public string? Role { get; set; }
        public bool? IsActive { get; set; }

        [MaxLength(32)]
        public string? PrivacyNoticeVersion { get; set; }

        public DateTime? PrivacyNoticeAcceptedAt { get; set; }

        [MaxLength(32)]
        public string? TermsVersion { get; set; }

        public DateTime? TermsAcceptedAt { get; set; }
       
        
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
}