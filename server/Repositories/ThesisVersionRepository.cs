using Microsoft.EntityFrameworkCore;
using server.Data;
using server.Models.DTOs.Thesis;
using server.Models.Entities;

namespace server.Repositories
{
    public class ThesisVersionRepository
    (
        AppDbContext db
    )
    {
        public async Task<IEnumerable<ThesisVersion>> GetVersionsByThesisId(Guid thesisId)
            => await db.ThesisVersions.ToListAsync();

        public async Task<ThesisVersion?> GetVersionById(Guid versionId)
            => await db.ThesisVersions.FindAsync(versionId);

        //public async Task<ThesisVersion?> GetLatestVersion(Guid thesisId)
        //{

        //}

        //public async Task<int> GetNextVersionNumber(Guid thesisId)
        //{

        //}
        public async Task<bool> CreateThesisVersion(ThesisVersion thesisVersion)
        {
            await db.ThesisVersions.AddAsync(thesisVersion);
            await db.SaveChangesAsync();
            return true;
        }

        public async Task<bool> DeleteThesisVersions(Guid versionId)
        {
            var existing = await db.ThesisVersions.FindAsync(versionId);

            if (existing == null) return false;

            return true;
        }
    }
}
