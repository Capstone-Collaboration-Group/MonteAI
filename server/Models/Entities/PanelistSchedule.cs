using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace server.Models.Entities
{
    public enum PanelistType
    {
        Faculty,
        ProgramHead,
        Admin
    }
    public class PanelistSchedule
    {
        public Guid ScheduleId { get; set; }
        public Schedule? Schedule { get; set;}

        [MaxLength(128)]
        public string PanelistId { get; set; } = string.Empty;
        [Required]
        public PanelistType? PanelistType { get; set; }

        [MaxLength(50)]
        public string? Role { get; set;}
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    }
}
