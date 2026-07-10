using FirebaseAdmin.Auth;
using server.Models.DTOs.Announcement;

namespace server.Services.Interfaces
{
    public interface IAnnouncementService
    {
        Task<IEnumerable<AnnouncementResponseDto>> GetAllAsync();
        Task<AnnouncementResponseDto?> GetByIdAsync(Guid id);
        Task<bool> CreateAsync(CreateAnnouncementDto createDto, string userId, string role);
        Task<bool> UpdateAsync(UpdateAnnouncementDto updateDto, Guid id, string userId, string role);
        Task<bool> DeleteAsync(Guid id);
    }
}
