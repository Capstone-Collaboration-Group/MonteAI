using AutoMapper;
using server.Models.DTOs.Announcement;
using server.Models.Entities;
using server.Repositories.Interfaces;
using server.Services.Interfaces;

namespace server.Services
{
    public class AnnouncementService : IAnnouncementService
    {
        private readonly IAnnouncementRepository _repo;
        private readonly ILogger<AnnouncementService> _logger;
        private readonly IMapper _mapper;

        public AnnouncementService(IAnnouncementRepository repo, ILogger<AnnouncementService> logger, IMapper mapper)
        {
            _repo = repo;
            _logger = logger;
            _mapper = mapper;
        }

        public async Task<IEnumerable<AnnouncementResponseDto>> GetAllAsync()
        {
            var result = await _repo.GetAllAnnouncementsAsync();

            var responseDto = _mapper.Map<IEnumerable<AnnouncementResponseDto>>(result);
            _logger.LogInformation("Fetched {count} announcements.", responseDto.Count());

            return responseDto;
        }
        public async Task<AnnouncementResponseDto?> GetByIdAsync(Guid id)
        {
            var result = await _repo.GetAnnouncementByIdAsync(id);
            if (result == null)
        {
        _logger.LogWarning("Announcement {Id} not found.", id);
        return null;
        }

            var responseDto = _mapper.Map<AnnouncementResponseDto>(result);
            _logger.LogInformation("Fetched Announcement {Id}.", responseDto.Id);
            return responseDto;
        }
        public async Task<bool> CreateAsync(CreateAnnouncementDto createDto, string userId, string role)
        {
            var announcement = _mapper.Map<Announcement>(createDto);
            Console.WriteLine(userId + ":" + role);
            if (role == "Admin")
                announcement.CreatedByAdminId = userId;
            if (role == "ProgramHead")
                announcement.CreatedByProgramHeadId = userId;
            
                var result = await _repo.CreateAnnouncementAsync(announcement);
            _logger.LogInformation("Performed Announcement Creation");
            return result;
        }
        public async Task<bool> UpdateAsync(UpdateAnnouncementDto updateDto, Guid id, string userId, string role)
        {
            var announcement = _mapper.Map<Announcement>(updateDto);
            announcement.Id = id;
            Console.WriteLine(userId + ":" + role + " " + announcement.Id);
            if (role == "Admin")
                announcement.CreatedByAdminId = userId; 
            if (role == "ProgramHead")
                announcement.CreatedByProgramHeadId = userId;
            var result = await _repo.UpdateAnnouncementAsync(announcement);

            _logger.LogInformation("Performed Update Query on Announcement ID: {Id}", announcement.Id);

            return result;
        }
        public async Task<bool> DeleteAsync(Guid id)
        {
            var result = await _repo.DeleteAnnouncementAsync(id);
            _logger.LogInformation("Performed Delete Query on Announcement ID: {Id}", id);
            return result;
        }
    }
}
