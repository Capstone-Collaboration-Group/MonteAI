using server.Models.DTOs.ProgramHead;
using server.Models.DTOs.User;

namespace server.Services.Interfaces
{
    public interface IProgramHeadService
    {
        Task<IEnumerable<UserResponseDto>> GetAllAsync();

        Task<UserResponseDto?> GetByIdAsync(string id);

        Task<bool> CreateAsync(RegisterUserDto createDto);

        Task<bool> UpdateAsync(UpdateProgramHeadDto updateDto, string id);
        Task<bool> DeleteAsync(string id);


    }
}