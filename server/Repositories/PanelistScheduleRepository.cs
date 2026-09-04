using Mapster;
using Microsoft.EntityFrameworkCore;
using server.Data;
using server.Models.Entities;
using server.Repositories.Interfaces;

namespace server.Repositories
{
    public class PanelistScheduleRepository : IPanelistScheduleRepository
    {
        private readonly AppDbContext _db;
        
        public PanelistScheduleRepository(AppDbContext db)
        {
            _db = db;
        }
        public async Task<IEnumerable<PanelistSchedule>> GetAllPanelistSchedulesAsync()
              => await _db.PanelistSchedules.ToListAsync();

        public async Task<IEnumerable<PanelistSchedule>> GetAllPanelistSchedulesWithDetailsAsync()
            => await _db.PanelistSchedules
                .AsNoTracking()
                .Include(ps => ps.Schedule)
                    .ThenInclude(s => s!.ResearchGroup)
                .ToListAsync();

        public async Task<PanelistSchedule?> GetPanelistScheduleByIdAsync(Guid scheduleId, string panelistId)
            => await _db.PanelistSchedules.FindAsync(scheduleId, panelistId);

        public async Task<bool> CreatePanelistScheduleAsync(PanelistSchedule panelistSchedule)
        {
            var existing = await _db.PanelistSchedules.FindAsync(panelistSchedule.ScheduleId, panelistSchedule.PanelistId);
            if (existing != null) return false;

            await _db.PanelistSchedules.AddAsync(panelistSchedule);
            await _db.SaveChangesAsync();
            return true;
        }
        public async Task<bool> UpdatePanelistScheduleAsync(PanelistSchedule panelistSchedule)
        {
            // No Updates since the mapper already assigns the tracked entity with the values 
            await _db.SaveChangesAsync();
            return true;
        }

        public async Task<bool> DeletePanelistScheduleAsync(Guid scheduleId, string panelistId)
        {
            var result = await _db.PanelistSchedules.FindAsync(scheduleId, panelistId);
            if (result == null) return false;

            _db.PanelistSchedules.Remove(result);
            await _db.SaveChangesAsync();
            return true;
        }
    }
}
