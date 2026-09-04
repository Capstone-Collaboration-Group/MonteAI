using server.Models.Entities;

namespace server.Repositories.Interfaces
{
    public interface IPanelistScheduleRepository
    {
        Task<IEnumerable<PanelistSchedule>> GetAllPanelistSchedulesAsync();

        // Returns every assignment with its Schedule (and the schedule's ResearchGroup)
        // loaded so the service can build per-panelist assignment summaries.
        Task<IEnumerable<PanelistSchedule>> GetAllPanelistSchedulesWithDetailsAsync();

        Task<PanelistSchedule?> GetPanelistScheduleByIdAsync(Guid scheduleId, string panelistId);

        Task<bool> CreatePanelistScheduleAsync(PanelistSchedule panelistSchedule);

        Task<bool> UpdatePanelistScheduleAsync(PanelistSchedule panelistSchedule);

        Task<bool> DeletePanelistScheduleAsync(Guid scheduleId, string panelistId);

    }
}
