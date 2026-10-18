// server/Services/Theses/ThesisAuthorNames.cs
//
// Author-name formatting shared by the catalog mapping (MappingProfile →
// ThesisResponseDto.Authors) and the citation metadata resolver, so vector
// metadata and the UI always show the SAME names for the same thesis.

using server.Models.Entities;
using UserEntity = server.Models.Entities.User;

namespace server.Services.Theses
{
    public static class ThesisAuthorNames
    {
        /// <summary>
        /// The research group's members as display names: leader first,
        /// deduped by Id, then alphabetical. Empty for admin-archived/legacy
        /// theses without a group.
        /// </summary>
        public static List<string> FromResearchGroup(ResearchGroup? group)
            => group == null
                ? []
                : group.Students
                    .OrderByDescending(s => s.Id == (group.LeaderId ?? s.Id))
                    .ThenBy(s => s.LastName)
                    .ThenBy(s => s.FirstName)
                    .Select(FormatPersonName)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList();

        /// <summary>Joins resolved author names for vector metadata / prompts.</summary>
        public static string? Join(IReadOnlyList<string>? authors)
            => authors is { Count: > 0 } ? string.Join(", ", authors) : null;

        // "Juan D. Cruz Jr." — skips missing middle initial/suffix.
        // (Aliased: the sibling `server.Services.User` namespace shadows the
        // `User` type name from inside this namespace.)
        public static string FormatPersonName(UserEntity user)
            => string.Join(" ", new[]
            {
                user.FirstName,
                user.MiddleInitial is null ? null : $"{user.MiddleInitial}.",
                user.LastName,
                user.Suffix
            }.Where(part => !string.IsNullOrWhiteSpace(part)));
    }
}
