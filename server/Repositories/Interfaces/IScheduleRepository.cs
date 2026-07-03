using server.Models.Entities;

namespace server.Repositories.Interfaces
{
    public interface IScheduleRepository
    {
        Task<IEnumerable<Schedule>> GetAllSchedulesAsync();

        Task<Schedule?> GetScheduleByIdAsync(Guid id);

        Task<Schedule?> GetScheduleByGroupIdAsync(Guid groupId);


        Task<bool> CreateScheduleAsync(Schedule schedule);

        Task<bool> UpdateScheduleAsync(Schedule schedule);

        Task<bool> DeleteScheduleAsync(Guid id);


    }
}
