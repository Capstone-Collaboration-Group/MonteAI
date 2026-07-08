using Microsoft.EntityFrameworkCore;
using server.Data;
using server.Models.Entities;
using server.Repositories.Interfaces;

namespace server.Repositories
{
    public class ScheduleRepository : IScheduleRepository
    {
        private readonly AppDbContext _db;

        public ScheduleRepository(AppDbContext db)
        {
            _db = db;
        }
        public async Task<IEnumerable<Schedule>> GetAllSchedulesAsync() => await _db.Schedules.ToListAsync();

        public async Task<Schedule?> GetScheduleByIdAsync(Guid id) => await _db.Schedules.FindAsync(id);

        public async Task<Schedule?> GetScheduleByGroupIdAsync(Guid groupId)
            => await _db.Schedules.
                Where(s => s.GroupId == groupId)
                .FirstOrDefaultAsync();
        public async Task<bool> CreateScheduleAsync(Schedule schedule)
        {
            var hasConflict = await _db.Schedules
                .AnyAsync(s => s.Date == schedule.Date &&
                       s.RoomVenue == schedule.RoomVenue &&
                       s.StartTime < schedule.EndingTime &&
                       s.EndingTime > schedule.StartTime);
            if (hasConflict) return false;

            await _db.Schedules.AddAsync(schedule);
            await _db.SaveChangesAsync();
            return true;
        }

        public async Task<bool> UpdateScheduleAsync(Schedule schedule)
        {
           // No assigns since it was already updated from the mapper.

            var hasConflict = await _db.Schedules
                    .AnyAsync(s => s.ScheduleId != schedule.ScheduleId &&
                              s.Date == schedule.Date &&
                              s.RoomVenue == schedule.RoomVenue &&
                              s.StartTime < schedule.EndingTime &&
                              s.EndingTime > schedule.StartTime);
            if (hasConflict) return false;
            
            await _db.SaveChangesAsync();
            return true;
        }

        public async Task<bool> DeleteScheduleAsync(Guid id)
        {
            var result = await _db.Schedules.FindAsync(id);
            if (result == null) return false;

            _db.Schedules.Remove(result);
            await _db.SaveChangesAsync();
            return true;

        }

    }
}
