using server.Models.DTOs.ResearchGroup;

namespace server.Services.Interfaces
{
    public interface IResearchGroupService
    {
        Task<IEnumerable<ResearchGroupResponseDto>> GetAllAsync();
        Task<ResearchGroupResponseDto?> GetByIdAsync(Guid groupId);
        Task<bool> CreateAsync(CreateResearchGroupDto createDto);
        Task<bool> UpdateAsync(UpdateResearchGroupDto updateDto);
        Task<bool> DeleteAsync(Guid groupId);

    }
}
