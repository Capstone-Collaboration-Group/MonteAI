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
        //Might want to include Panelists in this query soon
        public async Task<IEnumerable<Schedule>> GetAllSchedulesAsync() 
            => await _db.Schedules
                .Include(s => s.Panelists)
                .Include(s => s.ResearchGroup)
                    .ThenInclude(rg => rg.Leader)
                .ToListAsync();

        public async Task<Schedule?> GetScheduleByIdAsync(Guid id)
            => await _db.Schedules
                .Include(s => s.Panelists)
                .Include(s => s.ResearchGroup)
                    .ThenInclude(rg => rg!.Leader)
                .FirstOrDefaultAsync(s => s.ScheduleId == id);

        public async Task<Schedule?> GetScheduleByGroupIdAsync(Guid groupId)
            => await _db.Schedules
                .Where(s => s.GroupId == groupId)
                .FirstOrDefaultAsync();

        // A panelist may never be booked into an overlapping time slot, and on a
        // given day must stay in a single room (no room-hopping between defenses).
        // Same-room, non-overlapping defenses on the same day remain allowed.
        private async Task<bool> HasPanelistConflictAsync(Schedule schedule, Guid? excludeScheduleId)
        {
            var panelistIds = schedule.Panelists
                .Select(p => p.PanelistId)
                .Distinct()
                .ToList();
            if (panelistIds.Count == 0) return false;

            return await _db.PanelistSchedules
                .Include(ps => ps.Schedule)
                .AnyAsync(ps =>
                    panelistIds.Contains(ps.PanelistId) &&
                    (excludeScheduleId == null || ps.ScheduleId != excludeScheduleId) &&
                    ps.Schedule!.Date == schedule.Date &&
                    (ps.Schedule.RoomVenue != schedule.RoomVenue ||
                     (ps.Schedule.StartTime < schedule.EndingTime &&
                      ps.Schedule.EndingTime > schedule.StartTime)));
        }

        public async Task<bool> CreateScheduleAsync(Schedule schedule)
        {
            var hasConflict = await _db.Schedules
                .AnyAsync(s => s.Date == schedule.Date &&
                       s.RoomVenue == schedule.RoomVenue &&
                       s.StartTime < schedule.EndingTime &&
                       s.EndingTime > schedule.StartTime);
            if (hasConflict) return false;

            if (await HasPanelistConflictAsync(schedule, excludeScheduleId: null)) return false;

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

            if (await HasPanelistConflictAsync(schedule, schedule.ScheduleId)) return false;

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
