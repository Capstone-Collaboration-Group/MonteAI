using server.Models.DTOs.Faculty;

namespace server.Services.Interfaces
{
    public interface IFacultyService
    {
        Task<IEnumerable<FacultyResponseDto>> GetAllAsync();
        Task<FacultyResponseDto?> GetByIdAsync(string id);
        Task<bool> CreateAsync(CreateFacultyDto createDto);
        Task<bool> UpdateAsync(UpdateFacultyDto updateDto);
        Task<bool> DeleteAsync(string id);

    }
}