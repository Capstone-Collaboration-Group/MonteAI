using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace server.Models.Entities
{
    public class PanelistSchedule
    {
        [Key]
        public Guid ScheduleId { get; set; }

        public Schedule? Schedule { get; set; }

        public string PanelistId { get; set; } = string.Empty;

        public string? PanelistType { get; set; }

    }
}
