using System.ComponentModel.DataAnnotations;

namespace server.Models.Entities
{
    public class Schedule
    {
        [Key]
        public Guid ScheduleId { get; set; }

        public string ScheduledBy { get; set; } = string.Empty;

        public Guid? GroupId { get; set; }
        public ResearchGroup? ResearchGroup { get; set; } 


        public DateOnly Date { get; set; }

        public TimeOnly StartTime { get; set; }

        public TimeOnly EndingTime { get; set; }

        [Required]
        public string? RoomVenue { get; set; } 

        public string? AdditionalInformation { get; set; }

        public ICollection<PanelistSchedule> Panelists { get; set; } = [];


   
    }
}
