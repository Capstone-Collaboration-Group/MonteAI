using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using server.Models.Entities;

namespace server.Models.DTOs.PanelistSchedule
{
     public class CreatePanelistScheduleDto
    {
        [Required]
        public Guid ScheduleId { get; set; }

        [Required]
        public string PanelistId { get; set; } = string.Empty;

        [Required]
        public PanelistType PanelistType { get; set; }
    }

    public class UpdatePanelistScheduleDto
    {
        public PanelistType PanelistType { get; set; }
    }

    public class PanelistScheduleResponseDto
    {
        public Guid ScheduleId { get; set; }

        public string PanelistId { get; set; } = string.Empty;

        public PanelistType PanelistType { get; set; }
    }

}