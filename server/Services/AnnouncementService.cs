using AutoMapper;
using server.Models.DTOs.Announcement;
using server.Models.Entities;
using server.Services.Caching;
using server.Repositories.Interfaces;
using server.Services.Interfaces;

namespace server.Services
{
    public class AnnouncementService : IAnnouncementService
    {
        private readonly IAnnouncementRepository _repo;
        private readonly ILogger<AnnouncementService> _logger;
        private readonly IMapper _mapper;
        private readonly IResponseCache _cache;

        public AnnouncementService(
            IAnnouncementRepository repo,
            ILogger<AnnouncementService> logger,
            IMapper mapper,
            IResponseCache cache)
        {
            _repo = repo;
            _logger = logger;
            _mapper = mapper;
            _cache = cache;
        }

        public async Task<IEnumerable<AnnouncementResponseDto>> GetAllAsync()
        {
            var announcementDto = await _cache.GetOrCreateAsync(
                CacheRegions.Announcements,
                "all",
                TimeSpan.FromMinutes(3),
                async _ =>
                {
                    var announcements = await _repo.GetAllAnnouncementsAsync();
                    return _mapper.Map<List<AnnouncementResponseDto>>(announcements);
                }) ?? [];
            _logger.LogInformation("Fetched {count} announcements.", announcementDto.Count());

            return announcementDto;
        }
        public async Task<AnnouncementResponseDto?> GetByIdAsync(Guid id)
        {
            var responseDto = await _cache.GetOrCreateAsync(
                CacheRegions.Announcements,
                $"id:{id:N}",
                TimeSpan.FromMinutes(3),
                async _ =>
                {
                    var result = await _repo.GetAnnouncementByIdAsync(id);
                    return result is null ? null : _mapper.Map<AnnouncementResponseDto>(result);
                });
            if (responseDto is null)
            {
                _logger.LogWarning("Announcement {Id} not found.", id);
                return null;
            }
            _logger.LogInformation("Fetched Announcement {Id}.", responseDto.Id);
            return responseDto;
        }
        public async Task<bool> CreateAsync(CreateAnnouncementDto createDto, string userId, string role)
        {
            var announcement = _mapper.Map<Announcement>(createDto);
            announcement.CreatedAt = DateTime.UtcNow;
            if (role == "Admin")
                announcement.CreatedByAdminId = userId;
            if (role == "ProgramHead")
                announcement.CreatedByProgramHeadId = userId;
            
                var result = await _repo.CreateAnnouncementAsync(announcement);
            if (result) await _cache.InvalidateAsync(CacheRegions.Announcements);
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
            if (result) await _cache.InvalidateAsync(CacheRegions.Announcements);

            _logger.LogInformation("Performed Update Query on Announcement ID: {Id}", announcement.Id);

            return result;
        }
        public async Task<bool> DeleteAsync(Guid id)
        {
            var result = await _repo.DeleteAnnouncementAsync(id);
            if (result) await _cache.InvalidateAsync(CacheRegions.Announcements);
            _logger.LogInformation("Performed Delete Query on Announcement ID: {Id}", id);
            return result;
        }
    }
}
