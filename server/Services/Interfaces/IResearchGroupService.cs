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
        Task<bool> SendInvitationAsync(Guid groupId, string studentId);
        Task<bool> AcceptInvitationAsync(Guid groupId, string studentId);
        Task<bool> DeclineInvitationAsync(Guid groupId, string studentId);
        Task<bool> CancelInvitationAsync(Guid groupId, string studentId);
        Task<IEnumerable<ResearchGroupInvitationDto>> GetInvitationsAsync(Guid groupId);
        Task<bool> RemoveMemberAsync(Guid groupId, string studentId);

    }
}
