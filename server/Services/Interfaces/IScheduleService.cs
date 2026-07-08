using server.Models.DTOs.Schedule;

namespace server.Services.Interfaces
{
    public interface IScheduleService
    {
        Task<IEnumerable<ScheduleResponseDto>> GetAllAsync();
        Task<ScheduleResponseDto?> GetByIdAsync(Guid id);

        Task<ScheduleResponseDto?> GetByGroupIdAsync(Guid groupId);

        Task<bool> CreateAsync(CreateScheduleDto createDto);

        Task<bool> UpdateAsync(UpdateScheduleDto updateDto, Guid id);

        Task<bool> DeleteAsync(Guid id);

    }
}
