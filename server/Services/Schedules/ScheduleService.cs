using AutoMapper;
using server.Models.DTOs.Schedule;
using server.Models.Entities;
using server.Repositories.Interfaces;
using server.Services.Interfaces;

namespace server.Services.Schedules
{
    public class ScheduleService: IScheduleService
    {
        private readonly IScheduleRepository _repo;
        private readonly IMapper _mapper;

        public ScheduleService(IScheduleRepository repo, IMapper mapper)
        {
            _repo = repo;
            _mapper = mapper;
        }

        public async Task<IEnumerable<ScheduleResponseDto>> GetAllAsync()
        {
            var result = await _repo.GetAllSchedulesAsync();

            var responseDto = _mapper.Map<IEnumerable<ScheduleResponseDto>>(result);

            return responseDto;
        }

        public async Task<ScheduleResponseDto?> GetByIdAsync(Guid id)
        {
            var result = await _repo.GetScheduleByIdAsync(id);
            var responseDto = _mapper.Map<ScheduleResponseDto>(result);

            return responseDto;

        }
        public async Task<ScheduleResponseDto?> GetByGroupIdAsync(Guid groupId)
        {
            var result = await _repo.GetScheduleByGroupIdAsync(groupId);

            var responseDto = _mapper.Map<ScheduleResponseDto>(result);

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

            return await _repo.UpdateScheduleAsync(existing);
        }

        public async Task<bool> DeleteAsync(Guid id )
        {
            var result = await _repo.DeleteScheduleAsync(id);
            return result;

        }

    }
}
