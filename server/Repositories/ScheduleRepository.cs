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
                .FirstAsync();
        public async Task<bool> CreateScheduleAsync(Schedule schedule)
        {
            var result = await _db.Schedules.FindAsync(schedule.ScheduleId);
            if (result != null) return false;

            await _db.Schedules.AddAsync(schedule);
            await _db.SaveChangesAsync();
            return true;
        }

        public async Task<bool> UpdateScheduleAsync(Schedule schedule)
        {
            var result = await _db.Schedules.FindAsync(schedule.ScheduleId);
            if (result == null) return false;
            result.GroupId = schedule.GroupId;
            result.Date = schedule.Date;
            result.StartTime = schedule.StartTime;
            result.EndingTime = schedule.EndingTime;
            result.RoomVenue = schedule.RoomVenue;
            result.AdditionalInformation = schedule.AdditionalInformation;
            
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
