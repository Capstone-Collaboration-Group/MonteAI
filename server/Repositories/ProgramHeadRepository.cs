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

        // UpdateProgramHeadAsync
        public async Task<bool> UpdateProgramHeadAsync(ProgramHead programHead, string id)
        {
            var result = await _db.ProgramHeads.FindAsync(id);
            if (result == null) return false;

            result.Email = programHead.Email;
            result.FirstName = programHead.FirstName;
            result.MiddleInitial = programHead.MiddleInitial;
            result.LastName = programHead.LastName;
            result.Suffix = programHead.Suffix;
            result.Institute = programHead.Institute;
            result.ProgramHandled = programHead.ProgramHandled;
            result.IsActive = programHead.IsActive;
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