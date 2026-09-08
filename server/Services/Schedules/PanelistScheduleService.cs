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
        IFacultyRepository _facultyRepo,
        IProgramHeadRepository _programHeadRepo,
        IAdminRepository _adminRepo,
        IMapper _mapper
        ) : IPanelistScheduleService
    {
         public async Task<IEnumerable<PanelistResponseDto>> GetAllAsync()
         {
            var faculties = await _facultyRepo.GetAllFacultyAsync();
            var programHeads = await _programHeadRepo.GetAllProgramHeadsAsync();
            var admins = await _adminRepo.GetAllAdminsAsync();

            var assignments = await _repo.GetAllPanelistSchedulesWithDetailsAsync();

            var result = new List<PanelistResponseDto>();

            foreach (var faculty in faculties)
                result.Add(ToPanelist(faculty.Id, faculty, PanelistType.Faculty, faculty.Institute, null, assignments));

            foreach (var programHead in programHeads)
                result.Add(ToPanelist(programHead.Id, programHead, PanelistType.ProgramHead, programHead.Institute, null, assignments));

            foreach (var admin in admins)
                result.Add(ToPanelist(admin.Id, admin, PanelistType.Admin, null, admin.Position, assignments));

            return result;
         }

        private static PanelistResponseDto ToPanelist(
            string id,
            server.Models.Entities.User user,
            PanelistType panelistType,
            string? institute,
            string? position,
            IEnumerable<PanelistSchedule> assignments)
        {
            var personAssignments = assignments
                .Where(a => a.PanelistId == id)
                .Select(a => new PanelistAssignmentSummaryDto
                {
                    ScheduleId = a.ScheduleId,
                    GroupName = a.Schedule?.ResearchGroup?.GroupName ?? string.Empty,
                    Date = a.Schedule?.Date ?? default,
                    StartTime = a.Schedule?.StartTime ?? default,
                    EndingTime = a.Schedule?.EndingTime ?? default
                })
                .ToList();

            return new PanelistResponseDto
            {
                Id = id,
                Email = user.Email ?? string.Empty,
                FirstName = user.FirstName ?? string.Empty,
                MiddleInitial = user.MiddleInitial,
                LastName = user.LastName ?? string.Empty,
                Suffix = user.Suffix,
                Role = user.Role ?? string.Empty,
                Institute = institute,
                Position = position,
                PanelistType = panelistType,
                IsActive = user.IsActive,
                Assignments = personAssignments,
                IsAssigned = personAssignments.Count > 0
            };
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
            // When Mapped, it already assigns the tracked entity and with the updated values from the Dto
            var existing = await _repo.GetPanelistScheduleByIdAsync(scheduleId, panelistId);
            if (existing == null) return false;

            var updatePanelistSchedule = _mapper.Map(updateDto, existing);

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
