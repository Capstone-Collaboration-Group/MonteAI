using Microsoft.EntityFrameworkCore;
using server.Data;
using server.Models.Entities;
using server.Repositories.Interfaces;

namespace server.Repositories
{
    public class NotificationRepository : INotificationRepository
    {
        private readonly AppDbContext _db;

        public NotificationRepository(AppDbContext db)
        {
            _db = db;
        }

        public async Task<List<Notification>> GetByUserAsync(string userId, int page, int pageSize, CancellationToken ct = default)
            => await _db.Notifications
                .Where(n => n.UserId == userId)
                .OrderByDescending(n => n.CreatedAt)
                .ThenByDescending(n => n.Id)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync(ct);

        public async Task<int> GetUnreadCountAsync(string userId, CancellationToken ct = default)
            => await _db.Notifications
                .CountAsync(n => n.UserId == userId && !n.IsRead, ct);

        public async Task<int> GetTotalCountAsync(string userId, CancellationToken ct = default)
            => await _db.Notifications
                .CountAsync(n => n.UserId == userId, ct);

        public async Task<Notification?> GetByIdAsync(Guid id, CancellationToken ct = default)
            => await _db.Notifications.FindAsync(new object[] { id }, ct);

        public async Task<bool> MarkReadAsync(Guid id, string userId, CancellationToken ct = default)
        {
            var notification = await _db.Notifications
                .FirstOrDefaultAsync(n => n.Id == id && n.UserId == userId, ct);
            if (notification is null) return false;
            if (notification.IsRead) return true; // idempotent

            notification.IsRead = true;
            await _db.SaveChangesAsync(ct);
            return true;
        }

        public async Task<int> MarkAllReadAsync(string userId, CancellationToken ct = default)
        {
            var unread = await _db.Notifications
                .Where(n => n.UserId == userId && !n.IsRead)
                .ToListAsync(ct);
            if (unread.Count == 0) return 0;

            foreach (var notification in unread)
                notification.IsRead = true;
            await _db.SaveChangesAsync(ct);
            return unread.Count;
        }

        public async Task CreateManyAsync(IEnumerable<Notification> notifications, CancellationToken ct = default)
        {
            await _db.Notifications.AddRangeAsync(notifications, ct);
            await _db.SaveChangesAsync(ct);
        }

        public async Task<List<string>> GetAllActiveUserIdsAsync(CancellationToken ct = default)
        {
            var students = await _db.Students.Where(s => s.IsActive == true).Select(s => s.Id).ToListAsync(ct);
            var faculties = await _db.Faculties.Where(f => f.IsActive == true).Select(f => f.Id).ToListAsync(ct);
            var heads = await _db.ProgramHeads.Where(h => h.IsActive == true).Select(h => h.Id).ToListAsync(ct);
            var admins = await _db.Admins.Where(a => a.IsActive == true).Select(a => a.Id).ToListAsync(ct);

            return students
                .Concat(faculties)
                .Concat(heads)
                .Concat(admins)
                .Distinct()
                .ToList();
        }

        public async Task<List<string>> GetActiveUserIdsByInstituteAsync(string institute, CancellationToken ct = default)
        {
            var students = await _db.Students
                .Where(s => s.IsActive == true && s.Institute == institute)
                .Select(s => s.Id).ToListAsync(ct);
            var faculties = await _db.Faculties
                .Where(f => f.IsActive == true && f.Institute == institute)
                .Select(f => f.Id).ToListAsync(ct);
            var heads = await _db.ProgramHeads
                .Where(h => h.IsActive == true && h.Institute == institute)
                .Select(h => h.Id).ToListAsync(ct);

            // Admins have no Institute column — college-wide scope only.
            return students
                .Concat(faculties)
                .Concat(heads)
                .Distinct()
                .ToList();
        }
    }
}
