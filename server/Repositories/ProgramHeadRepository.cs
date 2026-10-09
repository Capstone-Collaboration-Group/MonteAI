using Microsoft.EntityFrameworkCore;
using server.Data;
using server.Models.Entities;
using server.Repositories.Interfaces;

namespace server.Repositories
{
    public class ProgramHeadRepository : IProgramHeadRepository
    {
        private readonly AppDbContext _db;

        public ProgramHeadRepository(AppDbContext db)
        {
            _db = db;
        }

        // GetAllProgramHeadsAsync
        public async Task<IEnumerable<ProgramHead>> GetAllProgramHeadsAsync() => await _db.ProgramHeads.ToListAsync();

        // GetProgramHeadByIdAsync
        public async Task<ProgramHead?> GetProgramHeadByIdAsync(string id) => await _db.ProgramHeads.FindAsync(id);

        // CreateProgramHeadAsync
        public async Task<bool> CreateProgramHeadAsync(ProgramHead programHead)
        {
            Console.WriteLine($"Id is {programHead.Id}");
            var result = await _db.ProgramHeads.FindAsync(programHead.Id);
            if (result != null) return false;

            await _db.ProgramHeads.AddAsync(programHead);
            await _db.SaveChangesAsync();

            return true;

        }

        // UpdateProgramHeadAsync — partial update: only non-null fields are written
        public async Task<bool> UpdateProgramHeadAsync(ProgramHead programHead, string id)
        {
            var result = await _db.ProgramHeads.FindAsync(id);
            if (result == null) return false;
            // Eww ampangit, needs refactor
            if (programHead.Email != null) result.Email = programHead.Email;
            if (programHead.FirstName != null) result.FirstName = programHead.FirstName;
            if (programHead.MiddleInitial != null) result.MiddleInitial = programHead.MiddleInitial;
            if (programHead.LastName != null) result.LastName = programHead.LastName;
            if (programHead.Suffix != null) result.Suffix = programHead.Suffix;
            if (programHead.Role != null) result.Role = programHead.Role;
            if (programHead.Institute != null) result.Institute = programHead.Institute;
            if (programHead.ProgramHandled != null) result.ProgramHandled = programHead.ProgramHandled;
            if (programHead.IsActive != null) result.IsActive = programHead.IsActive;
            result.UpdatedAt = programHead.UpdatedAt;

            await _db.SaveChangesAsync();

            return true;
        }

        // DeleteProgramHeadAsync
        public async Task<bool> DeleteProgramHeadAsync(string id)
        {
            var result = await _db.ProgramHeads.FindAsync(id);
            if (result == null) return false;

            _db.ProgramHeads.Remove(result);
            await _db.SaveChangesAsync();
            return true;
        }

    }
}