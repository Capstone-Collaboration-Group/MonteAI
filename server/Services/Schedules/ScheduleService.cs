using AutoMapper;
using server.Models.DTOs.PanelistSchedule;
using server.Models.DTOs.Schedule;
using server.Models.Entities;
using server.Services.Caching;
using server.Repositories.Interfaces;
using server.Services.Interfaces;

namespace server.Services.Schedules
{
    public class ScheduleService: IScheduleService
    {
        private readonly IScheduleRepository _repo;
        private readonly IMapper _mapper;
        private readonly IFacultyRepository _facultyRepo;
        private readonly IProgramHeadRepository _programHeadRepo;
        private readonly IAdminRepository _adminRepo;
        private readonly IResponseCache _cache;

        public ScheduleService(
            IScheduleRepository repo,
            IMapper mapper,
            IFacultyRepository facultyRepo,
            IProgramHeadRepository programHeadRepo,
            IAdminRepository adminRepo,
            IResponseCache cache)
        {
            _repo = repo;
            _mapper = mapper;
            _facultyRepo = facultyRepo;
            _programHeadRepo = programHeadRepo;
            _adminRepo = adminRepo;
            _cache = cache;
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
            var responseDto = await _cache.GetOrCreateAsync(
                CacheRegions.Schedules,
                "all",
                TimeSpan.FromSeconds(45),
                async _ =>
                {
                    var result = await _repo.GetAllSchedulesAsync();
                    var dtos = _mapper.Map<List<ScheduleResponseDto>>(result);
                    ApplyPanelistNames(dtos, await BuildPanelistNamesAsync());
                    return dtos;
                }) ?? [];

            return responseDto;
        }

        public async Task<ScheduleResponseDto?> GetByIdAsync(Guid id)
        {
            var responseDto = await _cache.GetOrCreateAsync(
                CacheRegions.Schedules,
                $"id:{id:N}",
                TimeSpan.FromSeconds(45),
                async _ =>
                {
                    var result = await _repo.GetScheduleByIdAsync(id);
                    var dto = _mapper.Map<ScheduleResponseDto>(result);
                    if (dto is not null)
                        ApplyPanelistNames([dto], await BuildPanelistNamesAsync());
                    return dto;
                });

            return responseDto;

        }
        public async Task<ScheduleResponseDto?> GetByGroupIdAsync(Guid groupId)
        {
            var responseDto = await _cache.GetOrCreateAsync(
                CacheRegions.Schedules,
                $"group:{groupId:N}",
                TimeSpan.FromSeconds(45),
                async _ =>
                {
                    var result = await _repo.GetScheduleByGroupIdAsync(groupId);
                    var dto = _mapper.Map<ScheduleResponseDto>(result);
                    if (dto is not null)
                        ApplyPanelistNames([dto], await BuildPanelistNamesAsync());
                    return dto;
                });

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
            if (result) await InvalidateScheduleCachesAsync();

            return result;
        }
        public async Task<bool> UpdateAsync(UpdateScheduleDto updateDto, Guid id)
        {
            var existing = await _repo.GetScheduleByIdAsync(id);
            if (existing == null) return false;

            _mapper.Map(updateDto, existing);
            
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
                }
                foreach (var kept in existing.Panelists.Where(p => incomingIds.Contains(p.PanelistId)))
                {
                    var match = updateDto.Panelists.First(p => p.PanelistId == kept.PanelistId);
                    kept.PanelistType = match.PanelistType;
                }

            } 
           
            var result = await _repo.UpdateScheduleAsync(existing);
            if (result) await InvalidateScheduleCachesAsync();

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
            if (result) await InvalidateScheduleCachesAsync();
            return result;
        }

        public async Task<bool> DeleteAsync(Guid id )
        {
            var result = await _repo.DeleteScheduleAsync(id);
            if (result) await InvalidateScheduleCachesAsync();
            return result;

        }

        private Task InvalidateScheduleCachesAsync()
            => _cache.InvalidateAsync(CacheRegions.Schedules, CacheRegions.ThesisCatalog);

    }
}
