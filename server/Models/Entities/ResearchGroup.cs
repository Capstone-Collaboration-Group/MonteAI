using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace server.Models.Entities
{
    public class ResearchGroup
    {
        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public Guid Id { get; set; }
        [MaxLength(100)]
        public string GroupName { get; set; } = string.Empty;

        public string ResearchTitle { get; set; } = string.Empty;
        [MaxLength(128)]
        public string? AdviserId { get; set; }
        [MaxLength(128)]
        public string LeaderId { get; set; } = string.Empty;


        public DateTime CreatedAt { get; set; }

        public DateTime UpdatedAt { get; set; }
        public virtual ICollection<Student> Students { get; set; } = [];
        public Faculty?  Adviser { get; set; }

    }
}
