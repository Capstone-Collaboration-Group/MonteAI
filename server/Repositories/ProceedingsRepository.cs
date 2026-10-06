using Microsoft.EntityFrameworkCore;
using server.Data;
using server.Models.DTOs.Thesis;
using server.Models.Entities;
using server.Repositories.Interfaces;

namespace server.Repositories
{
    public class ProceedingsRepository : IProceedingsRepository
    {
        private readonly AppDbContext _db;

        public ProceedingsRepository(AppDbContext db)
        {
            _db = db;
        }

        public async Task<ProceedingsDataDto?> GetProceedingsDataAsync(Guid thesisId)
        {
            var thesis = await _db.Theses
                .AsNoTracking()
                .Include(t => t.ResearchGroup)
                    .ThenInclude(rg => rg!.Adviser)
                .Include(t => t.ResearchGroup)
                    .ThenInclude(rg => rg!.Leader)
                .Include(t => t.ResearchGroup)
                    .ThenInclude(rg => rg!.Students)
                .Include(t => t.ResearchGroup)
                    .ThenInclude(rg => rg!.Schedules)
                        .ThenInclude(s => s.Panelists)
                .FirstOrDefaultAsync(t => t.Id == thesisId);

            if (thesis == null) return null;

            var data = new ProceedingsDataDto
            {
                ThesisId = thesis.Id,
                WorkingTitle = thesis.Title,
                VersionIds = await _db.ThesisVersions
                    .AsNoTracking()
                    .Where(v => v.ThesisId == thesisId)
                    .OrderBy(v => v.VersionNumber)
                    .Select(v => v.Id)
                    .ToListAsync(),
            };

            var group = thesis.ResearchGroup;
            if (group == null) return data;

            var students = (group.Students ?? []).ToList();

            data.Members = students
                .OrderBy(s => s.Id == group.LeaderId ? 0 : 1) // leader signs first
                .ThenBy(s => s.LastName)
                .ThenBy(s => s.FirstName)
                .Select(s => new ProceedingsMemberDto { Name = FormatName(s) })
                .Where(m => m.Name.Length > 0)
                .ToList();

            data.Programs = students
                .Select(s => s.Program ?? s.Institute)
                .Where(p => !string.IsNullOrWhiteSpace(p))
                .Select(p => p!)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (group.Adviser != null)
            {
                data.AdviserId = group.Adviser.Id;
                data.AdviserName = FormatName(group.Adviser);
            }

            // Latest scheduled defense carries the panel line-up.
            var schedule = (group.Schedules ?? [])
                .OrderByDescending(s => s.Date)
                .ThenByDescending(s => s.StartTime)
                .FirstOrDefault();

            var panelistRows = (schedule?.Panelists ?? [])
                .OrderByDescending(p => p.Role != null && p.Role.Contains("chair", StringComparison.OrdinalIgnoreCase))
                .ThenBy(p => p.CreatedAt)
                .ToList();

            if (panelistRows.Count == 0) return data;

            var names = await GetDisplayNamesAsync(panelistRows.Select(p => p.PanelistId));

            for (var i = 0; i < panelistRows.Count; i++)
            {
                var row = panelistRows[i];
                names.TryGetValue(row.PanelistId, out var name);

                data.Panelists.Add(new ProceedingsPanelistDto
                {
                    Id = row.PanelistId,
                    Name = name ?? string.Empty,
                    // The schedule modal does not always capture a role — the
                    // template's fixed line-up (Chairman + Members) is the fallback.
                    Role = !string.IsNullOrWhiteSpace(row.Role)
                        ? row.Role!
                        : i == 0 ? "Chairman" : "Member",
                });
            }

            return data;
        }

        public async Task<IReadOnlyDictionary<string, string>> GetDisplayNamesAsync(IEnumerable<string> userIds)
        {
            var ids = userIds
                .Where(id => !string.IsNullOrWhiteSpace(id))
                .Distinct(StringComparer.Ordinal)
                .ToList();

            var map = new Dictionary<string, string>(StringComparer.Ordinal);
            if (ids.Count == 0) return map;

            // A reviewer id is a Firebase UID, and every role table uses the UID
            // as its primary key — so the same id may resolve in only one table.
            var students = await _db.Students.AsNoTracking().Where(u => ids.Contains(u.Id)).ToListAsync();
            var faculties = await _db.Faculties.AsNoTracking().Where(u => ids.Contains(u.Id)).ToListAsync();
            var heads = await _db.ProgramHeads.AsNoTracking().Where(u => ids.Contains(u.Id)).ToListAsync();
            var admins = await _db.Admins.AsNoTracking().Where(u => ids.Contains(u.Id)).ToListAsync();

            // Each role table declares its own Id (the Firebase UID) — the shared
            // User base does not carry one, so seed the map per table.
            void Add(string id, User user)
            {
                var name = FormatName(user);
                if (name.Length > 0) map[id] = name;
            }

            foreach (var u in students) Add(u.Id, u);
            foreach (var u in faculties) Add(u.Id, u);
            foreach (var u in heads) Add(u.Id, u);
            foreach (var u in admins) Add(u.Id, u);

            return map;
        }

        private static string FormatName(User user)
        {
            var parts = new List<string>(4);

            if (!string.IsNullOrWhiteSpace(user.FirstName)) parts.Add(user.FirstName.Trim());
            if (user.MiddleInitial is char middle && middle != '\0') parts.Add($"{middle}.");
            if (!string.IsNullOrWhiteSpace(user.LastName)) parts.Add(user.LastName.Trim());
            if (!string.IsNullOrWhiteSpace(user.Suffix)) parts.Add(user.Suffix.Trim());

            return string.Join(' ', parts);
        }
    }
}
