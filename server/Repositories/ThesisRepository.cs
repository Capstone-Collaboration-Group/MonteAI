using Mapster;
using Microsoft.EntityFrameworkCore;
using server.Data;
using server.Models.DTOs.Thesis;
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
            return await _db.Theses
                .Include(t => t.ResearchGroup)
                    .ThenInclude(rg => rg.Schedules)
                .OrderBy(t => t.SubmittedAt)
                .Take(20)
                .ToListAsync();
        }
        public async Task<Thesis?> GetThesisByIdAsync(Guid id)
            => await _db.Theses.FindAsync(id);

        /// <summary>
        /// Exact-match (LIKE) search over titles and abstracts. LIKE
        /// wildcards inside the term are escaped so user input is matched
        /// literally. The result set is intentionally small (agent tool use).
        /// </summary>
        public async Task<IReadOnlyList<Thesis>> SearchByKeywordAsync(string term, int limit, CancellationToken cancellationToken = default)
        {
            var escaped = term
                .Replace("[", "[[]")
                .Replace("%", "[%]")
                .Replace("_", "[_]");
            var pattern = $"%{escaped}%";

            return await _db.Theses
                .Where(t => EF.Functions.Like(t.Title!, pattern) || EF.Functions.Like(t.Abstract!, pattern))
                .OrderByDescending(t => t.SubmittedAt)
                .Take(Math.Clamp(limit, 1, 10))
                .ToListAsync(cancellationToken);
        }

        public async Task<Thesis> SubmitAsync(Thesis submitThesis)
        {
            var existing = await _db.Theses
                .Where(t => t.Title == submitThesis.Title)
                .FirstOrDefaultAsync();
            if (existing != null)
                throw new InvalidOperationException($"A thesis with Title: {submitThesis.Title} Already exists");

            await _db.Theses.AddAsync(submitThesis);
            await _db.SaveChangesAsync();
            return submitThesis;


        }

        public async Task<bool> ExistsByGroupIdAsync(Guid groupId)
        {
            return await _db.Theses
            .AnyAsync(t => t.GroupId == groupId);
        }

        public async Task<bool> UpdateDetailsAsync(Guid id, Thesis updatedThesis)
        {

            var existing = await _db.Theses.FindAsync(id);
            if (existing == null) return false;

            if (updatedThesis.Title is not null)
                existing.Title = updatedThesis.Title;
            if (updatedThesis.Abstract is not null)
                existing.Abstract = updatedThesis.Abstract;
            if (updatedThesis.FilePath is not null)
                existing.FilePath = updatedThesis.FilePath;

            existing.UpdatedAt = DateTime.UtcNow;
            
            await _db.SaveChangesAsync();

            return true;
        }



        public async Task<bool> UpdateStatusAsync(Guid id, Thesis updateThesis)
        {
            var existing = await _db.Theses.FindAsync(id);
            if (existing == null) return false;

            existing.Status = updateThesis.Status;
            existing.UpdatedAt = DateTime.UtcNow;

            switch(updateThesis.Status)
            {
                case "Under Review":
                    existing.ReviewedAt = DateTime.UtcNow;
                    break;
                case "Approved":
                    existing.ApprovedAt = DateTime.UtcNow;
                    break;
                case "Rejected":
                    existing.RejectedAt = DateTime.UtcNow;
                    break;
                case "Indexed":
                    existing.IndexedAt = DateTime.UtcNow;
                    break;
            }

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
