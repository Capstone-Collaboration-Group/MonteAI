using server.Models.DTOs.ProgramHead;

namespace server.Services.Interfaces
{
    public interface IProgramHeadService
    {
        Task<IEnumerable<ProgramHeadResponseDto>> GetAllAsync();

        Task<ProgramHeadResponseDto?> GetByIdAsync(string id);

        Task<bool> CreateAsync(CreateProgramHeadDto createDto);

        Task<bool> UpdateAsync(UpdateProgramHeadDto updateDto);
        Task<bool> DeleteAsync(string id);


    }
}