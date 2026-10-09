using Microsoft.EntityFrameworkCore;
using server.Data;
using server.Models.Entities;
using server.Repositories.Interfaces;

namespace server.Repositories
{
    public class FacultyRepository : IFacultyRepository
    {
        private readonly AppDbContext _db;

        public FacultyRepository(AppDbContext db)
        {
            _db = db;
        }

        // GetAllFacultyAsync 
        public async Task<IEnumerable<Faculty>> GetAllFacultyAsync() => await _db.Faculties.ToListAsync();

        // GetFacultyByIdAsync
        public async Task<Faculty?> GetFacultyByIdAsync(string id) => await _db.Faculties.FindAsync(id);

        // CreateFacultyAsync
        public async Task<bool> CreateFacultyAsync(Faculty faculty)
        {
            var result = await _db.Faculties.FindAsync(faculty.Id);
            if (result != null) return false;
            await _db.Faculties.AddAsync(faculty);

            await _db.SaveChangesAsync();
            return true;
        }

        // UpdateFacultyAsync — partial update: only non-null fields are written
        public async Task<bool> UpdateFacultyAsync(Faculty faculty, string id)
        {
            var result = await _db.Faculties.FindAsync(id);
            if (result == null) return false;
            // Eww ampangit, needs refactor
            if (faculty.FirstName != null) result.FirstName = faculty.FirstName;
            if (faculty.MiddleInitial != null) result.MiddleInitial = faculty.MiddleInitial;
            if (faculty.LastName != null) result.LastName = faculty.LastName;
            if (faculty.Email != null) result.Email = faculty.Email;
            if (faculty.Suffix != null) result.Suffix = faculty.Suffix;
            if (faculty.Role != null) result.Role = faculty.Role;
            if (faculty.Institute != null) result.Institute = faculty.Institute;
            if (faculty.IsActive != null) result.IsActive = faculty.IsActive;
            result.UpdatedAt = faculty.UpdatedAt;

            await _db.SaveChangesAsync();

            return true;
        }

        // DeleteFacultyAsync
        public async Task<bool> DeleteFacultyAsync(string id)
        {
            var result = await _db.Faculties.FindAsync(id);
            if (result == null) return false;
            _db.Faculties.Remove(result);
            await _db.SaveChangesAsync();
            return true;
        }
    }
}