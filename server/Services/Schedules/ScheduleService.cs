using AutoMapper;
using Microsoft.EntityFrameworkCore;
using server.Data;
using server.Models.DTOs.PanelistSchedule;
using server.Models.DTOs.Schedule;
using server.Models.Entities;
using server.Repositories.Interfaces;
using server.Services.Interfaces;
using NotificationKinds = server.Models.Entities.NotificationKinds;

namespace server.Services.Schedules
{
    public class ScheduleService: IScheduleService
    {
        private readonly IScheduleRepository _repo;
        private readonly IMapper _mapper;
        private readonly IFacultyRepository _facultyRepo;
        private readonly IProgramHeadRepository _programHeadRepo;
        private readonly IAdminRepository _adminRepo;
        private readonly AppDbContext _db;
        private readonly INotificationService _notifications;
        private readonly ILogger<ScheduleService> _logger;

        public ScheduleService(
            IScheduleRepository repo,
            IMapper mapper,
            IFacultyRepository facultyRepo,
            IProgramHeadRepository programHeadRepo,
            IAdminRepository adminRepo,
            AppDbContext db,
            INotificationService notifications,
            ILogger<ScheduleService> logger)
        {
            _repo = repo;
            _mapper = mapper;
            _facultyRepo = facultyRepo;
            _programHeadRepo = programHeadRepo;
            _adminRepo = adminRepo;
            _db = db;
            _notifications = notifications;
            _logger = logger;
        }

        // PanelistId points at one of three role tables — resolve every id to a
        // readable "First M. Last Suffix" once per request and stamp it on the DTOs.
        private async Task<Dictionary<string, string>> BuildPanelistNamesAsync()
        {
            var names = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

            foreach (var faculty in await _facultyRepo.GetAllFacultyAsync())
                names[faculty.Id] = FormatName(faculty);
            foreach (var programHead in await _programHeadRepo.GetAllProgramHeadsAsync())
                names[programHead.Id] = FormatName(programHead);
            foreach (var admin in await _adminRepo.GetAllAdminsAsync())
                names[admin.Id] = FormatName(admin);

            return names;
        }

        private static string FormatName(server.Models.Entities.User user)
            => string.Join(" ", new[]
            {
                user.FirstName,
                user.MiddleInitial is null ? null : $"{user.MiddleInitial}.",
                user.LastName,
                user.Suffix
            }.Where(part => !string.IsNullOrWhiteSpace(part)));

        private static void ApplyPanelistNames(
            IEnumerable<ScheduleResponseDto> schedules,
            IReadOnlyDictionary<string, string> names)
        {
            foreach (var schedule in schedules)
                foreach (var panelist in schedule.Panelists)
                    if (names.TryGetValue(panelist.PanelistId, out var name))
                        panelist.PanelistName = name;
        }

        public async Task<IEnumerable<ScheduleResponseDto>> GetAllAsync()
        {
            var result = await _repo.GetAllSchedulesAsync();

            var responseDto = _mapper.Map<IEnumerable<ScheduleResponseDto>>(result);

            ApplyPanelistNames(responseDto, await BuildPanelistNamesAsync());

            return responseDto;
        }

        public async Task<ScheduleResponseDto?> GetByIdAsync(Guid id)
        {
            var result = await _repo.GetScheduleByIdAsync(id);
            var responseDto = _mapper.Map<ScheduleResponseDto>(result);

            if (responseDto != null)
                ApplyPanelistNames([responseDto], await BuildPanelistNamesAsync());

            return responseDto;

        }
        public async Task<ScheduleResponseDto?> GetByGroupIdAsync(Guid groupId)
        {
            var result = await _repo.GetScheduleByGroupIdAsync(groupId);

            var responseDto = _mapper.Map<ScheduleResponseDto>(result);

            if (responseDto != null)
                ApplyPanelistNames([responseDto], await BuildPanelistNamesAsync());

            return responseDto;
        }
        public async Task<bool> CreateAsync(CreateScheduleDto createDto)
        {
            // Guard: if any of these were missing from the JSON body they would
            // silently default to DateOnly.MinValue ("0001-01-01") / TimeOnly 00:00
            // and get stored. Reject loudly instead.
            if (createDto.Date == default ||
                createDto.StartTime == default ||
                createDto.EndingTime == default)
                return false;

            var createSchedule = _mapper.Map<Schedule>(createDto);
            createSchedule.Panelists = createDto.Panelists
                .Select(p => _mapper.Map<PanelistSchedule>(p))
                .ToList();
            var result = await _repo.CreateScheduleAsync(createSchedule);

            if (result)
                await NotifyDefenseAsync(
                    createSchedule,
                    NotificationKinds.DefenseScheduled,
                    "Defense scheduled",
                    details => $"You are scheduled for the thesis defense of {details}.");

            return result;
        }
        public async Task<bool> UpdateAsync(UpdateScheduleDto updateDto, Guid id)
        {
            var existing = await _repo.GetScheduleByIdAsync(id);
            if (existing == null) return false;

            _mapper.Map(updateDto, existing);
            
            var addedPanelistIds = new List<string>();
            if(updateDto.Panelists != null)
            {
                var incomingIds = updateDto.Panelists.Select(p => p.PanelistId).ToHashSet();

                var toRemove = existing.Panelists
                    .Where(p => !incomingIds.Contains(p.PanelistId))
                    .ToList();
                foreach (var p in toRemove)
                    existing.Panelists.Remove(p);

                var existingIds = existing.Panelists.Select(p => p.PanelistId).ToHashSet();
                foreach (var incoming in updateDto.Panelists.Where(p => !existingIds.Contains(p.PanelistId)))
                {
                    existing.Panelists.Add(new PanelistSchedule
                    {
                        ScheduleId = existing.ScheduleId,
                        PanelistId = incoming.PanelistId,
                        PanelistType = incoming.PanelistType
                    });
                    addedPanelistIds.Add(incoming.PanelistId);
                }
                foreach (var kept in existing.Panelists.Where(p => incomingIds.Contains(p.PanelistId)))
                {
                    var match = updateDto.Panelists.First(p => p.PanelistId == kept.PanelistId);
                    kept.PanelistType = match.PanelistType;
                }

            } 
           
            var result = await _repo.UpdateScheduleAsync(existing);

            if (result && addedPanelistIds.Count > 0)
                await NotifyPanelistsAsync(existing, addedPanelistIds);

            return result;
        }

        public async Task<bool> UpdateTimesAsync(Guid id, UpdateScheduleTimesDto dto)
        {
            // Same guard as create: never write DateOnly.MinValue / TimeOnly 00:00.
            if (dto.Date == default ||
                dto.StartTime == default ||
                dto.EndingTime == default)
                return false;

            var existing = await _repo.GetScheduleByIdAsync(id);
            if (existing == null) return false;

            // Explicit assignment — no AutoMapper partial-mapping, so the date
            // can never be silently skipped or defaulted to DateOnly.MinValue.
            existing.Date = dto.Date;
            existing.StartTime = dto.StartTime;
            existing.EndingTime = dto.EndingTime;

            var result = await _repo.UpdateScheduleAsync(existing);
            if (result)
                await NotifyDefenseAsync(
                    existing,
                    NotificationKinds.DefenseRescheduled,
                    "Defense rescheduled",
                    details => $"Your thesis defense for {details} has been rescheduled to a new date and time.");

            return result;
        }

        public async Task<bool> DeleteAsync(Guid id )
        {
            // Load BEFORE delete so recipients (group students + panelists)
            // can still be resolved after the row is gone.
            var existing = await _repo.GetScheduleByIdAsync(id);

            var result = await _repo.DeleteScheduleAsync(id);
            if (result && existing != null)
                await NotifyDefenseAsync(
                    existing,
                    NotificationKinds.DefenseCancelled,
                    "Defense cancelled",
                    details => $"Your thesis defense for {details} has been cancelled.");

            return result;

        }

        // ── Notification helpers (best-effort: lookup failures log + skip,
        //    never fail the schedule write) ─────────────────────────────
        private async Task NotifyDefenseAsync(Schedule schedule, string type, string title, Func<string, string> bodyFactory)
        {
            try
            {
                var recipients = await GetDefenseRecipientsAsync(
                    schedule.GroupId, schedule.Panelists.Select(p => p.PanelistId));
                if (recipients.Count == 0) return;

                var body = bodyFactory(await BuildDefenseDetailsAsync(schedule));
                await _notifications.NotifyManyAsync(
                    recipients, type, title, body,
                    NotificationKinds.TargetSchedule, schedule.ScheduleId.ToString());
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Failed to build {Type} notification for schedule {ScheduleId} — skipped",
                    type, schedule.ScheduleId);
            }
        }

        private async Task NotifyPanelistsAsync(Schedule schedule, IEnumerable<string> panelistIds)
        {
            try
            {
                var recipients = panelistIds.Distinct().ToList();
                if (recipients.Count == 0) return;

                var details = await BuildDefenseDetailsAsync(schedule);
                var body = $"You have been assigned as a panelist for the thesis defense of {details}.";
                await _notifications.NotifyManyAsync(
                    recipients, NotificationKinds.PanelistAssigned, "Assigned as panelist", body,
                    NotificationKinds.TargetSchedule, schedule.ScheduleId.ToString());
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Failed to build panelist assignment notification for schedule {ScheduleId} — skipped",
                    schedule.ScheduleId);
            }
        }

        private async Task<List<string>> GetDefenseRecipientsAsync(Guid? groupId, IEnumerable<string>? panelistIds)
        {
            var ids = new List<string>();
            if (groupId is Guid g)
                ids.AddRange(await _db.Students
                    .Where(s => s.GroupId == g)
                    .Select(s => s.Id)
                    .ToListAsync());
            if (panelistIds is not null)
                ids.AddRange(panelistIds);
            return ids.Distinct().ToList();
        }

        /// <summary>"Group Name" on March 5, 2026, 9:00 AM–11:00 AM at Room 101</summary>
        private async Task<string> BuildDefenseDetailsAsync(Schedule schedule)
        {
            var when = $"{schedule.Date:MMMM d, yyyy}, {schedule.StartTime:h:mm tt}–{schedule.EndingTime:h:mm tt}";
            var group = schedule.GroupId is Guid g
                ? await _db.ResearchGroups.FindAsync(g)
                : null;
            var groupName = group?.GroupName ?? "your research group";

            return $"\"{groupName}\" on {when} at {schedule.RoomVenue}";
        }
    }
}
