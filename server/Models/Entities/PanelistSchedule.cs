namespace server.Models.Entities
{
    public class PanelistSchedule
    {
        public Guid ScheduleId { get; set; }

        public Schedule? Schedule { get; set; }

        public string PanelistId { get; set; } = string.Empty;

        public string? PanelistType { get; set; }

    }
}
