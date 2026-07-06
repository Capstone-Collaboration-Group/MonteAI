using Microsoft.EntityFrameworkCore;
using server.Data;
using server.Models.Entities;
using server.Repositories.Interfaces;

namespace server.Repositories
{
    public class ResearchGroupRepository 
    (
        AppDbContext _db
    ) : IResearchGroupRepository
    {
        public async Task<IEnumerable<ResearchGroup>> GetAllResearchGroupsAsync()
            => await _db.ResearchGroups
                    .Include(rg => rg.Adviser)
                    .Include(rg => rg.Students)
                    .ToListAsync();
        public async Task<ResearchGroup?> GetResearchGroupByIdAsync(Guid id)
            => await _db.ResearchGroups
                    .Include(rg => rg.Adviser)
                    .Include(rg => rg.Students)
                    .FirstOrDefaultAsync(rg => rg.Id == id);

        public async Task<bool> CreateResearchGroupAsync(ResearchGroup researchGroup)
        {
            var existing = await _db.ResearchGroups.FindAsync(researchGroup.Id);
            if (existing != null) return false;

            await _db.ResearchGroups.AddAsync(researchGroup);
            await _db.SaveChangesAsync();

            return true;

        }
        public async Task<bool> UpdateResearchGroupAsync(ResearchGroup researchGroup)
        {
            var existing = await _db.ResearchGroups.FindAsync(researchGroup.Id);
            if (existing == null) return false;

            existing.GroupName = researchGroup.GroupName;
            existing.ResearchTitle = researchGroup.ResearchTitle;
            existing.AdviserId = researchGroup.AdviserId;
            existing.LeaderId = researchGroup.LeaderId;
            existing.UpdatedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync();
            return true;
        }
        public async Task<bool> DeleteResearchGroupAsync(Guid id)
        {
            var existing = await _db.ResearchGroups.FindAsync(id);
            if (existing == null) return false;

            _db.ResearchGroups.Remove(existing);
            return true;
        }
    }
}
