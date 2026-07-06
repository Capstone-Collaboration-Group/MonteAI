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
        private readonly ILogger<ScheduleService> _logger;
        private readonly IMapper _mapper;

        public ScheduleService(IScheduleRepository repo, ILogger<ScheduleService> logger, IMapper mapper)
        {
            _repo = repo;
            _logger = logger;
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
            var createSchedule = _mapper.Map<Schedule>(createDto);

            var result = await _repo.CreateScheduleAsync(createSchedule);

            return result;
        }
        public async Task<bool> UpdateAsync(UpdateScheduleDto updateDto)
        {
            var updateSchedule = _mapper.Map<Schedule>(updateDto);

            var result = await _repo.UpdateScheduleAsync(updateSchedule);

            return result;
        }

        public async Task<bool> DeleteAsync(Guid id )
        {
            var result = await _repo.DeleteScheduleAsync(id);
            return result;

        }

    }
}
