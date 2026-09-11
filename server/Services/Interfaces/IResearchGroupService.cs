using server.Models.DTOs.ResearchGroup;

namespace server.Services.Interfaces
{
    public interface IResearchGroupService
    {
        Task<IEnumerable<ResearchGroupResponseDto>> GetAllAsync();
        Task<ResearchGroupResponseDto?> GetByIdAsync(Guid groupId);
        Task<ResearchGroupResponseDto?> CreateAsync(CreateResearchGroupDto createDto);
        Task<bool> UpdateAsync(Guid groupId, UpdateResearchGroupDto updateDto);
        Task<bool> DeleteAsync(Guid groupId);
        Task<bool> AddMemberAsync(Guid groupId, string studentId);
        Task<bool> RemoveMemberAsync(Guid groupId, string studentId);

    }
}
