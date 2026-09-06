using System.ComponentModel.DataAnnotations;
using server.Models.DTOs.PanelistSchedule;
using server.Models.DTOs.ResearchGroup;

namespace server.Models.DTOs.Schedule
{
    public class CreateScheduleDto
    {
        [Required]
        public string ScheduledBy { get; set; } = string.Empty;

        public Guid? GroupId { get; set; }
            
        [Required]
        public DateOnly Date { get; set; }

        [Required]
        public TimeOnly StartTime { get; set; }

        [Required]
        public TimeOnly EndingTime { get; set; }

        [Required]
        public string RoomVenue { get; set; } = string.Empty;

        public string? AdditionalInformation { get; set; }
        [Required]
        [MinLength(1, ErrorMessage = "At least 3 panelist is required for a defense schedule")]
        public List<CreatePanelistEntryDto> Panelists { get; set; } = [];
    }

    public class CreatePanelistEntryDto
    {
        [Required]
        public string PanelistId { get; set; } = string.Empty;
        [Required]
        public string PanelistType { get; set; } = string.Empty;
    }
    public class UpdateScheduleDto
    {
        public Guid? GroupId { get; set; }

        public DateOnly? Date { get; set; }

        public TimeOnly? StartTime { get; set; }

        public TimeOnly? EndingTime { get; set; }

        public string? RoomVenue { get; set; }

        public string? AdditionalInformation { get; set; }

        public List<PanelistScheduleResponseDto>? Panelists { get; set; }
    }

    // Narrow, purpose-built DTO for drag/resize. Date & time are required
    // (non-nullable) so a missing/invalid field fails model binding loudly
    // instead of silently writing DateOnly.MinValue ("0001-01-01") to the DB.
    public class UpdateScheduleTimesDto
    {
        [Required]
        public DateOnly Date { get; set; }

        [Required]
        public TimeOnly StartTime { get; set; }

        [Required]
        public TimeOnly EndingTime { get; set; }
    }

    public class ScheduleResponseDto
    {
        public Guid ScheduleId { get; set; }

        public string ScheduledBy { get; set; } = string.Empty;

        public ResearchGroupResponseDto? ResearchGroup { get; set; }

        public DateOnly Date { get; set; }

        public TimeOnly StartTime { get; set; }

        public TimeOnly EndingTime { get; set; }

        public string RoomVenue { get; set; } = string.Empty;

        public string? AdditionalInformation { get; set; }

        public List<PanelistScheduleResponseDto> Panelists { get; set;} = [];
    }
    // ResearchGroup is excluded in the response because its a navigation property 

}