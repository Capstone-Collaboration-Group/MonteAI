
using System.ComponentModel.DataAnnotations;

namespace server.Models.Entities
{
    public abstract class User
    {
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
       
        
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }
}