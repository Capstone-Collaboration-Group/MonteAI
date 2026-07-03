using System.ComponentModel.DataAnnotations;
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
    }

    public class UpdateScheduleDto
    {
        public Guid? GroupId { get; set; }

        public DateOnly? Date { get; set; }

        public TimeOnly? StartTime { get; set; }

        public TimeOnly? EndingTime { get; set; }

        public string? RoomVenue { get; set; }

        public string? AdditionalInformation { get; set; }
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
    }
    // ResearchGroup is excluded in the response because its a navigation property 

}