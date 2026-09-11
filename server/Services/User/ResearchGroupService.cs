using AutoMapper;
using System.Security.Claims;
using server.Data;
using server.Models.DTOs.ResearchGroup;
using server.Models.Entities;
using server.Repositories.Interfaces;
using server.Services.Interfaces;

namespace server.Services.User
{
    public class ResearchGroupService
    (
        IResearchGroupRepository repo,
        IMapper mapper,
        AppDbContext db,
        IHttpContextAccessor httpContext
    ) : IResearchGroupService
    {
        private const int MaxGroupSize = 4;

        private string UserId => httpContext.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new UnauthorizedAccessException();

        private string Role => httpContext.HttpContext?.User.FindFirstValue(ClaimTypes.Role)
            ?? string.Empty;

        public async Task<IEnumerable<ResearchGroupResponseDto>> GetAllAsync()
        {
            var groups = (await repo.GetAllResearchGroupsAsync()).ToList();

            switch (Role)
            {
                case "Student":
                    groups = groups.Where(g => g.Students.Any(s => s.Id == UserId)).ToList();
                    break;
                case "ProgramHead":
                    var head = await db.ProgramHeads.FindAsync(UserId)
                        ?? throw new UnauthorizedAccessException();
                    groups = groups
                        .Where(g => g.Students.Any(s =>
                            s.Program == head.ProgramHandled &&
                            s.Institute == head.Institute))
                        .ToList();
                    break;
                case "Admin":
                case "Faculty":
                    break;
                default:
                    throw new UnauthorizedAccessException();
            }

            return mapper.Map<IEnumerable<ResearchGroupResponseDto>>(groups);
        }

        public async Task<ResearchGroupResponseDto?> GetByIdAsync(Guid groupId)
        {
            var group = await repo.GetResearchGroupByIdAsync(groupId);
            if (group is null) return null;

            await EnsureCanViewAsync(group);
            return mapper.Map<ResearchGroupResponseDto>(group);
        }

        public async Task<ResearchGroupResponseDto?> CreateAsync(CreateResearchGroupDto dto)
        {
            if (Role is not ("Admin" or "Student"))
                throw new UnauthorizedAccessException();

            // Students always lead the group they create; only Admin may appoint a leader.
            var leaderId = Role == "Student" ? UserId : dto.LeaderId;
            if (string.IsNullOrWhiteSpace(leaderId))
                throw new InvalidOperationException("A leader student is required.");

            var leader = await db.Students.FindAsync(leaderId)
                ?? throw new KeyNotFoundException("Leader student was not found.");
            if (leader.GroupId.HasValue)
                throw new InvalidOperationException("A student may belong to only one research group.");

            var group = mapper.Map<ResearchGroup>(dto);
            group.LeaderId = leaderId;
            group.AdviserId = Role == "Admin" ? dto.AdviserId : null;

            var created = await repo.CreateResearchGroupAsync(group);
            if (!created) return null;

            leader.GroupId = group.Id;
            leader.Position = "Leader";
            await db.SaveChangesAsync();

            var saved = await repo.GetResearchGroupByIdAsync(group.Id);
            return saved is null ? null : mapper.Map<ResearchGroupResponseDto>(saved);
        }

        public async Task<bool> UpdateAsync(Guid groupId, UpdateResearchGroupDto updateDto)
        {
            var group = await repo.GetResearchGroupByIdAsync(groupId)
                ?? throw new KeyNotFoundException();

            await EnsureCanManageAsync(group);

            if (Role == "Student" &&
                (updateDto.ResearchTitle is not null ||
                 updateDto.AdviserId is not null ||
                 updateDto.LeaderId is not null))
            {
                throw new UnauthorizedAccessException("Students may only update the group name.");
            }

            var entity = mapper.Map<ResearchGroup>(updateDto);
            entity.Id = groupId;
            return await repo.UpdateResearchGroupAsync(entity);
        }

        public async Task<bool> DeleteAsync(Guid groupId)
        {
            if (Role != "Admin") throw new UnauthorizedAccessException();

            return await repo.DeleteResearchGroupAsync(groupId);
        }

        public async Task<bool> AddMemberAsync(Guid groupId, string studentId)
        {
            var group = await repo.GetResearchGroupByIdAsync(groupId)
                ?? throw new KeyNotFoundException();

            await EnsureCanManageAsync(group);

            if (group.Students.Count >= MaxGroupSize)
                throw new InvalidOperationException(
                    $"A research group may have at most {MaxGroupSize} members.");

            var student = await db.Students.FindAsync(studentId);
            if (student is null) return false;

            // Students may only invite classmates from the same program as the group's leader.
            if (Role == "Student")
            {
                var leader = group.Leader ?? await db.Students.FindAsync(group.LeaderId);
                if (leader is not null &&
                    !string.Equals(
                        student.Program?.Trim(),
                        leader.Program?.Trim(),
                        StringComparison.OrdinalIgnoreCase))
                {
                    throw new InvalidOperationException(
                        "You may only invite students from your own program.");
                }
            }

            return await repo.AddMemberAsync(groupId, studentId);
        }

        public async Task<bool> RemoveMemberAsync(Guid groupId, string studentId)
        {
            var group = await repo.GetResearchGroupByIdAsync(groupId)
                ?? throw new KeyNotFoundException();

            await EnsureCanManageAsync(group);

            if (studentId == group.LeaderId)
                throw new InvalidOperationException("The group leader cannot be removed.");

            return await repo.RemoveMemberAsync(groupId, studentId);
        }

        private async Task EnsureCanViewAsync(ResearchGroup group)
        {
            if (Role is "Admin" or "Faculty") return;
            if (Role == "Student" && group.Students.Any(s => s.Id == UserId)) return;
            if (Role == "ProgramHead" && await IsProgramHeadScopeAsync(group)) return;
            throw new UnauthorizedAccessException();
        }

        private async Task EnsureCanManageAsync(ResearchGroup group)
        {
            if (Role == "Admin") return;
            if (Role == "Student" && group.LeaderId == UserId) return;
            if (Role == "ProgramHead" && await IsProgramHeadScopeAsync(group)) return;
            throw new UnauthorizedAccessException();
        }

        private async Task<bool> IsProgramHeadScopeAsync(ResearchGroup group)
        {
            var head = await db.ProgramHeads.FindAsync(UserId);
            return head is not null && group.Students.Any(s =>
                s.Program == head.ProgramHandled &&
                s.Institute == head.Institute);
        }
    }
}
