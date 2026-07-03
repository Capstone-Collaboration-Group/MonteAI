using System.ComponentModel.DataAnnotations;
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
        [MaxLength(20)]
        public string PanelistType { get; set; } = string.Empty;
    }

    public class UpdatePanelistScheduleDto
    {
        [MaxLength(20)]
        public string? PanelistType { get; set; }
    }

    public class PanelistScheduleResponseDto
    {
        public Guid ScheduleId { get; set; }

        public string PanelistId { get; set; } = string.Empty;

        public string PanelistType { get; set; } = string.Empty;
    }

}