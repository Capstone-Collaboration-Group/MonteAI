using Mapster;
using Microsoft.EntityFrameworkCore;
using server.Data;
using server.Models.Entities;
using server.Repositories.Interfaces;

namespace server.Repositories
{
    public class ThesisRepository : IThesisRepository
    {
        private readonly AppDbContext _db;

        public ThesisRepository(AppDbContext db)
        {
            _db = db;
        }

        public async Task<IEnumerable<Thesis>> GetFirst20ThesisAsync()
        {
  


            return await _db.Theses.Take(20).ToListAsync();
        }
        public async Task<Thesis?> GetThesisByIdAsync(Guid id)
            => await _db.Theses.FindAsync(id);

        public async Task<bool> UpdateDetailsAsync(Thesis updatedThesis)
        {

            var existing = await _db.Theses.FindAsync(updatedThesis.Id);
            if (existing == null) return false;

            updatedThesis.UpdatedAt = DateTime.UtcNow;

            _db.Theses.Update(updatedThesis);
            await _db.SaveChangesAsync();

            return true;
        }

        public async Task<bool> UpdateStatusAsync(Guid id, string status)
        {
            var existing = await _db.Theses.FindAsync(id);
            if (existing == null) return false;

            existing.Status = status;
            existing.UpdatedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync();

            return true;
        }

        public async Task<bool> DeleteThesisAsync(Guid id)
        {
            var existing = await _db.Theses.FindAsync(id);
            if (existing == null) return false;

            _db.Theses.Remove(existing);
            await _db.SaveChangesAsync();
            return true;
        }



    }
}
