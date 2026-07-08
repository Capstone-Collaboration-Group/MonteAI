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

        // UpdateFacultyAsync
        public async Task<bool> UpdateFacultyAsync(Faculty faculty, string id)
        {
            var result = await _db.Faculties.FindAsync(id);
            if (result == null) return false;

            result.FirstName = faculty.FirstName;
            result.MiddleInitial = faculty.MiddleInitial;
            result.LastName = faculty.LastName;
            result.Email = faculty.Email;
            result.Role = faculty.Role;
            result.IsActive = faculty.IsActive;
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