using System.ComponentModel.DataAnnotations;

namespace server.Models.Entities
{
    public class Schedule
    {
        [Key]
        public Guid ScheduleId { get; set; } 

        public string? ScheduledBy { get; set; }

        public string? GroupId { get; set; }

        public DateOnly Date { get; set; }

        public TimeOnly StartTime { get; set; }

        public TimeOnly EndingTime { get; set; }

        public string? RoomVenue { get; set; } 

        public string? AdditionalInformation { get; set; }
        
        public ICollection<PanelistSchedule>? Panelists { get; set; } 


   
    }
}
