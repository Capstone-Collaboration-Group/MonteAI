using Microsoft.EntityFrameworkCore;
using server.Data;
using server.Models.Entities;
using server.Repositories.Interfaces;

namespace server.Repositories
{
    public class AnnouncementRepository : IAnnouncementRepository
    {
        private readonly AppDbContext _db;

        public AnnouncementRepository(AppDbContext db)
        {
            _db = db;
        }
        public async Task<IEnumerable<Announcement>> GetAllAnnouncementsAsync()
            => await _db.Announcements
                .Include(a => a.CreatedByAdmin)
                .Include(b => b.CreatedByProgramHead)
                .OrderByDescending(a => a.CreatedAt)
                .ToListAsync();
        public async Task<Announcement?> GetAnnouncementByIdAsync(Guid id)
            => await _db.Announcements
                .Include(a => a.CreatedByAdmin)
                .Include(b => b.CreatedByProgramHead)
                .FirstOrDefaultAsync(a => a.Id == id);

        public async Task<bool> CreateAnnouncementAsync(Announcement announcement)
        {
            var existing = await _db.Announcements
                .Where(a => a.Subject == announcement.Subject)
                .FirstOrDefaultAsync();
            if (existing != null) return false;

            await _db.Announcements.AddAsync(announcement);
            await _db.SaveChangesAsync();
            return true;
        }
        public async Task<bool> UpdateAnnouncementAsync(Announcement announcement)
        {
            var existing = await _db.Announcements.FindAsync(announcement.Id);
            if (existing == null) return false;

            existing.Subject = announcement.Subject;
            existing.Content = announcement.Content;
            existing.Category = announcement.Category;
            existing.Institute = announcement.Institute;
            existing.Priority = announcement.Priority;
            existing.AttachmentUrls = announcement.AttachmentUrls;
            existing.LastModified = announcement.LastModified;

            await _db.SaveChangesAsync();
            return true;
        }
        public async Task<bool> DeleteAnnouncementAsync(Guid id)
        {
            var existing = await _db.Announcements.FindAsync(id);
            if (existing == null) return false;

             _db.Announcements.Remove(existing);
            await _db.SaveChangesAsync();
            return true;
        }
    }
}
