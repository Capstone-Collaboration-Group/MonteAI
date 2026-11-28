using AutoMapper;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using server.Data;
using server.Models.DTOs.ResearchGroup;
using server.Models.Entities;
using server.Repositories.Interfaces;
using server.Services.Interfaces;
using NotificationKinds = server.Models.Entities.NotificationKinds;

namespace server.Services.User
{
    public class ResearchGroupService
    (
        IResearchGroupRepository repo,
        IMapper mapper,
        AppDbContext db,
        IHttpContextAccessor httpContext,
        INotificationService notifications
    ) : IResearchGroupService
    {
        private const int MaxGroupSize = 8;

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
            var group = await repo.GetResearchGroupByIdAsync(groupId)
                ?? throw new KeyNotFoundException();

            if (Role == "Student")
            {
                if (group.LeaderId != UserId) throw new UnauthorizedAccessException();
                if (group.Students.Any(student => student.Id != group.LeaderId))
                    throw new InvalidOperationException("Remove all research members before deleting the group.");
            }
            else if (Role != "Admin")
            {
                throw new UnauthorizedAccessException();
            }

            var leaderId = group.LeaderId;
            var deleted = await repo.DeleteResearchGroupAsync(groupId);
            if (!deleted) return false;

            // Deleting the group nulls GroupId via the SetNull FK, but the
            // leader's "Leader" position would otherwise stick forever and
            // make them uninvitable to another group (and block thesis
            // leadership checks). Release them back to plain member status.
            var formerLeader = await db.Students.FindAsync(leaderId);
            if (formerLeader is not null)
            {
                formerLeader.GroupId = null;
                formerLeader.Position = "Member";
                await db.SaveChangesAsync();
            }

            return true;
        }

        public async Task<bool> SendInvitationAsync(Guid groupId, string studentId)
        {
            var group = await repo.GetResearchGroupByIdAsync(groupId)
                ?? throw new KeyNotFoundException();

            await EnsureCanManageAsync(group);

            var student = await db.Students.FindAsync(studentId);
            if (student is null) return false;
            if (student.GroupId.HasValue)
                throw new InvalidOperationException("The student already belongs to a research group.");
            if (await db.ResearchGroups.AnyAsync(candidate => candidate.LeaderId == studentId))
                throw new InvalidOperationException("A research group leader cannot be invited as a member.");

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

            var pending = await db.ResearchGroupInvitations
                .FirstOrDefaultAsync(i => i.GroupId == groupId && i.StudentId == studentId && i.Status == "Pending");
            if (pending is not null)
                throw new InvalidOperationException("A research group invitation is already pending for this student.");

            // Members + outstanding invitations must fit the group size.
            var pendingCount = await db.ResearchGroupInvitations
                .CountAsync(i => i.GroupId == groupId && i.Status == "Pending");
            if (group.Students.Count + pendingCount >= MaxGroupSize)
                throw new InvalidOperationException(
                    $"A research group may have at most {MaxGroupSize} members.");

            var invitation = new ResearchGroupInvitation
            {
                GroupId = groupId,
                LeaderId = UserId,
                StudentId = studentId,
                Status = "Pending",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow,
            };
            db.ResearchGroupInvitations.Add(invitation);
            await db.SaveChangesAsync();

            await NotifyInvitationAsync(studentId, group);
            return true;
        }

        public async Task<bool> AcceptInvitationAsync(Guid groupId, string studentId)
        {
            var invitation = await db.ResearchGroupInvitations
                .FirstOrDefaultAsync(i => i.GroupId == groupId && i.StudentId == studentId && i.Status == "Pending");
            if (invitation is null)
                throw new KeyNotFoundException();

            // Only the invited student may accept their own invitation.
            if (invitation.StudentId != UserId)
                throw new UnauthorizedAccessException();

            var group = await repo.GetResearchGroupByIdAsync(groupId);
            if (group is null) return false;

            // Slots may have filled while the invitation was pending.
            if (group.Students.Count >= MaxGroupSize)
                throw new InvalidOperationException(
                    $"A research group may have at most {MaxGroupSize} members.");

            var student = await db.Students.FindAsync(studentId);
            if (student is null) return false;
            if (student.GroupId.HasValue && student.GroupId.Value != groupId)
                throw new InvalidOperationException("You already belong to a research group.");

            invitation.Status = "Accepted";
            invitation.UpdatedAt = DateTime.UtcNow;

            student.GroupId = groupId;
            student.Position = "Member";
            await db.SaveChangesAsync();

            await NotifyGroupMemberAsync(studentId, group, NotificationKinds.GroupAdded, "added to");
            return true;
        }

        public async Task<bool> DeclineInvitationAsync(Guid groupId, string studentId)
        {
            var invitation = await db.ResearchGroupInvitations
                .FirstOrDefaultAsync(i => i.GroupId == groupId && i.StudentId == studentId && i.Status == "Pending");
            if (invitation is null)
                throw new KeyNotFoundException();

            if (invitation.StudentId != UserId)
                throw new UnauthorizedAccessException();

            invitation.Status = "Declined";
            invitation.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
            return true;
        }

        public async Task<bool> CancelInvitationAsync(Guid groupId, string studentId)
        {
            var group = await repo.GetResearchGroupByIdAsync(groupId)
                ?? throw new KeyNotFoundException();

            await EnsureCanManageAsync(group);

            var invitation = await db.ResearchGroupInvitations
                .FirstOrDefaultAsync(i => i.GroupId == groupId && i.StudentId == studentId && i.Status == "Pending");
            if (invitation is null)
                throw new KeyNotFoundException();

            invitation.Status = "Canceled";
            invitation.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync();
            return true;
        }

        public async Task<IEnumerable<ResearchGroupInvitationDto>> GetInvitationsAsync(Guid groupId)
        {
            var group = await repo.GetResearchGroupByIdAsync(groupId)
                ?? throw new KeyNotFoundException();

            await EnsureCanViewAsync(group);

            var invitations = await db.ResearchGroupInvitations
                .Where(i => i.GroupId == groupId && i.Status == "Pending")
                .OrderBy(i => i.CreatedAt)
                .ToListAsync();

            return invitations.Select(i => new ResearchGroupInvitationDto
            {
                Id = i.Id,
                GroupId = i.GroupId,
                LeaderId = i.LeaderId,
                StudentId = i.StudentId,
                Status = i.Status,
                CreatedAt = i.CreatedAt,
                UpdatedAt = i.UpdatedAt,
            }).ToList();
        }

        public async Task<bool> RemoveMemberAsync(Guid groupId, string studentId)
        {
            var group = await repo.GetResearchGroupByIdAsync(groupId)
                ?? throw new KeyNotFoundException();

            await EnsureCanManageAsync(group);

            if (studentId == group.LeaderId)
                throw new InvalidOperationException("The group leader cannot be removed.");

            var removed = await repo.RemoveMemberAsync(groupId, studentId);
            if (removed)
                await NotifyGroupMemberAsync(studentId, group, NotificationKinds.GroupRemoved, "removed from");
            return removed;
        }

        private Task NotifyInvitationAsync(string studentId, ResearchGroup group)
        {
            var title = "Research group invitation";
            var body = $"You have been invited to research group \"{group.GroupName}\""
                + (string.IsNullOrWhiteSpace(group.ResearchTitle)
                    ? "."
                    : $" — {group.ResearchTitle}.");

            return notifications.NotifyUserAsync(
                studentId,
                NotificationKinds.GroupInvitation,
                title,
                body,
                NotificationKinds.TargetResearchGroup,
                group.Id.ToString());
        }

        // Best-effort (NotificationService never throws) — the membership
        // change must stand even if the notification write fails.
        private async Task<bool> NotifyGroupMemberAsync(
            string studentId, ResearchGroup group, string type, string verb)
        {
            var title = type == NotificationKinds.GroupAdded
                ? "Added to a research group"
                : "Removed from a research group";
            var body = $"You have been {verb} research group \"{group.GroupName}\"" +
                       (string.IsNullOrWhiteSpace(group.ResearchTitle)
                            ? "."
                            : $" — {group.ResearchTitle}.");

            await notifications.NotifyUserAsync(
                studentId, type, title, body,
                NotificationKinds.TargetResearchGroup, group.Id.ToString());
            return true;
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
