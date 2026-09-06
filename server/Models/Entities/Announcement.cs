using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace server.Models.Entities
{
    public class Announcement
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public Guid Id { get; set; }

        [Required]
        public string Subject { get; set; } = string.Empty;
        [Required]
        public string Content { get; set; } = string.Empty;

        public List<string> AttachmentUrls { get; set; } = new();

        [Required]
        public string Category { get; set; } = string.Empty;

        [Required]
        public string Institute { get; set; } = string.Empty;

        [Required]
        public string Priority { get; set; } = string.Empty;
        
        public DateTime? CreatedAt { get; set; }

        public DateTime? LastModified { get; set; }

        public string? CreatedByAdminId{ get; set; }

        public Admin? CreatedByAdmin { get; set; }

        public string? CreatedByProgramHeadId { get; set; }
        public ProgramHead? CreatedByProgramHead { get; set; }
    }
}
