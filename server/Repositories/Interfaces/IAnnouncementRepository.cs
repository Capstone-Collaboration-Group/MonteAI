using server.Models.Entities;

namespace server.Repositories.Interfaces
{
    public interface IAnnouncementRepository
    {
        Task<IEnumerable<Announcement>> GetAllAnnouncementsAsync();

        Task<Announcement?> GetAnnouncementByIdAsync(Guid id);

        Task<bool> CreateAnnouncementAsync(Announcement announcement);

        Task<bool> UpdateAnnouncementAsync(Announcement anouncement);

        Task<bool> DeleteAnnouncementAsync(Guid id);
    }
}
