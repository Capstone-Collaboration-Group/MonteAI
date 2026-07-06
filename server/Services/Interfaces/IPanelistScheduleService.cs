using server.Models.DTOs.PanelistSchedule;

namespace server.Services.Interfaces
{
    public interface IPanelistScheduleService
    {
        Task<IEnumerable<PanelistScheduleResponseDto>> GetAllAsync();

        Task<PanelistScheduleResponseDto?> GetByIdAsync(Guid scheduleId, string panelistId);

        Task<bool> CreateAsync(CreatePanelistScheduleDto createDto);

        Task<bool> UpdateAsync(UpdatePanelistScheduleDto updateDto);

        Task<bool> DeleteAsync(Guid scheduleId, string panelistId);

    }
}
