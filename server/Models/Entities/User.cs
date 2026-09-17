
using System.ComponentModel.DataAnnotations;

namespace server.Models.Entities
{
    public abstract class User
    {
        [EmailAddress]
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
        public bool IsEmailVerified { get; set; }
        [MaxLength(6)]
        public string? OtpCode { get; set; }
        public DateTime? OtpExpiresAt { get; set; }
        public DateTime? OtpWindowStartedAt { get; set; }
        public int OtpResendCount { get; set; }
       
        
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
}