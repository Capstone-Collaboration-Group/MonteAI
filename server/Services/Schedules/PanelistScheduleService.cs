using AutoMapper;
using server.Models.DTOs.PanelistSchedule;
using server.Models.Entities;
using server.Repositories.Interfaces;
using server.Services.Interfaces;

namespace server.Services.Schedules
{
    public class PanelistScheduleService
        (
        IPanelistScheduleRepository _repo, 
        IMapper _mapper
        ) : IPanelistScheduleService
    {
         public async Task<IEnumerable<PanelistScheduleResponseDto>> GetAllAsync()
         {
            var result = await _repo.GetAllPanelistSchedulesAsync();
            var responseDto = _mapper.Map<IEnumerable<PanelistScheduleResponseDto>>(result);
            return responseDto;
         }
        
        public async Task<PanelistScheduleResponseDto?> GetByIdAsync(Guid scheduleId, string panelistId)
        {
            var result = await _repo.GetPanelistScheduleByIdAsync(scheduleId, panelistId);

            var responseDto = _mapper.Map<PanelistScheduleResponseDto>(result);
            return responseDto;
        }

        public async Task<bool> CreateAsync(CreatePanelistScheduleDto createDto)
        {
            var panelistSchedule = _mapper.Map<PanelistSchedule>(createDto);
            var result = await _repo.CreatePanelistScheduleAsync(panelistSchedule);

            return result;

        }

        public async Task<bool> UpdateAsync(UpdatePanelistScheduleDto updateDto, Guid scheduleId, string panelistId)
        {

            var updatePanelistSchedule = _mapper.Map<PanelistSchedule>(updateDto);
            updatePanelistSchedule.ScheduleId = scheduleId;
            updatePanelistSchedule.PanelistId = panelistId;

            var result = await _repo.UpdatePanelistScheduleAsync(updatePanelistSchedule);

            return result;
        }
        public async Task<bool> DeleteAsync(Guid scheduleId, string panelistId)
        {
            var result = await _repo.DeletePanelistScheduleAsync(scheduleId, panelistId);
            return result;
        }
    }
}
