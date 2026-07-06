using server.Models.Entities;

namespace server.Repositories.Interfaces
{
    public interface IPanelistScheduleRepository
    {
        Task<IEnumerable<PanelistSchedule>> GetAllPanelistSchedulesAsync();

        Task<PanelistSchedule?> GetPanelistScheduleByIdAsync(Guid scheduleId, string panelistId);

        Task<bool> CreatePanelistScheduleAsync(PanelistSchedule panelistSchedule);

        Task<bool> UpdatePanelistScheduleAsync(PanelistSchedule panelistSchedule);

        Task<bool> DeletePanelistScheduleAsync(Guid scheduleId, string panelistId);

    }
}
