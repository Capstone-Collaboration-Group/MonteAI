using server.Models.DTOs.Announcement;

namespace server.Services.Interfaces
{
    public interface IAnnouncementService
    {
        Task<IEnumerable<AnnouncementResponseDto>> GetAllAsync();
        Task<AnnouncementResponseDto?> GetByIdAsync(Guid id);
        Task<bool> CreateAsync(CreateAnnouncementDto createDto);
        Task<bool> UpdateAsync(UpdateAnnouncementDto updateDto);
        Task<bool> DeleteAsync(Guid id);
    }
}
