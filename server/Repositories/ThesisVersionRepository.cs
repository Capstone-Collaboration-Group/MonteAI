using Microsoft.EntityFrameworkCore;
using server.Data;
using server.Models.DTOs.Thesis;
using server.Models.Entities;
using server.Repositories.Interfaces;

namespace server.Repositories
{
    public class ThesisVersionRepository : IThesisVersionRepository
    {
        private readonly AppDbContext db;

        public ThesisVersionRepository(AppDbContext dbContext)
        {
            db = dbContext;
        }
        public async Task<IEnumerable<ThesisVersion>> GetVersionsByThesisId(Guid thesisId)
            => await db.ThesisVersions
                .Where(v => v.ThesisId == thesisId)
                .OrderBy(v => v.VersionNumber)
                .ToListAsync();

        public async Task<ThesisVersion?> GetByIdAsync(Guid versionId)
            => await db.ThesisVersions
                    .FirstOrDefaultAsync(v => v.Id == versionId);



        public async Task<ThesisVersion?> GetLatestThesisIdAsync(Guid thesisId)
            => await db.ThesisVersions
                    .Where(v => v.ThesisId == thesisId)
                    .OrderByDescending(v => v.VersionNumber)
                    .FirstOrDefaultAsync();


        public async Task<int> GetNextVersionNumber(Guid thesisId)
            => (await db.ThesisVersions
                .Where(v => v.ThesisId == thesisId)
                .MaxAsync(v => (int?)v.VersionNumber) ?? 0) + 1;
        public async Task<bool> CreateThesisVersion(ThesisVersion thesisVersion)
        {
            await db.ThesisVersions.AddAsync(thesisVersion);
            await db.SaveChangesAsync();
            return true;
        }

        public async Task<bool> DeleteAllExceptLatestAsync(Guid thesisId)
        {
            var latest = await db.ThesisVersions
                .Where(v => v.ThesisId == thesisId)
                .OrderByDescending(v => v.VersionNumber)
                .FirstOrDefaultAsync();

            if (latest is null) return false;

            var old = await db.ThesisVersions
                .Where(v => v.ThesisId == thesisId && v.Id != latest.Id)
                .ToListAsync();

            db.ThesisVersions.RemoveRange(old);
            await db.SaveChangesAsync();
            return true;

        }
    }
}
