namespace server.Models.Entities
{
    public class PanelistSchedule
    {
        public Guid ScheduleId { get; set; }

        public Schedule? Schedule { get; set; } 

        public Guid PanelistId { get; set; } 

        public string PanelistType { get; set; }
    }
}
