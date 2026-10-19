using AutoMapper;
using server.Models.DTOs.Announcement;
using server.Models.Entities;
using server.Repositories.Interfaces;
using server.Services.Interfaces;
using NotificationKinds = server.Models.Entities.NotificationKinds;

namespace server.Services
{
    public class AnnouncementService : IAnnouncementService
    {
        private readonly IAnnouncementRepository _repo;
        private readonly ILogger<AnnouncementService> _logger;
        private readonly IMapper _mapper;
        private readonly INotificationService _notifications;
        private readonly IProgramHeadRepository _programHeadRepo;

        public AnnouncementService(
            IAnnouncementRepository repo,
            ILogger<AnnouncementService> logger,
            IMapper mapper,
            INotificationService notifications,
            IProgramHeadRepository programHeadRepo)
        {
            _repo = repo;
            _logger = logger;
            _mapper = mapper;
            _notifications = notifications;
            _programHeadRepo = programHeadRepo;
        }

        public async Task<IEnumerable<AnnouncementResponseDto>> GetAllAsync()
        {
            var announcements = await _repo.GetAllAnnouncementsAsync();

            var announcementDto = _mapper.Map<IEnumerable<AnnouncementResponseDto>>(announcements);
            _logger.LogInformation("Fetched {count} announcements.", announcementDto.Count());

            return announcementDto;
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
            // Id is NEWID() on SQL Server; generating it here keeps the value
            // available for fan-out targeting and works on SQLite test hosts.
            announcement.Id = Guid.NewGuid();
            announcement.CreatedAt = DateTime.UtcNow;
            if (role == "Admin")
                announcement.CreatedByAdminId = userId;
            if (role == "ProgramHead")
                announcement.CreatedByProgramHeadId = userId;
            
                var result = await _repo.CreateAnnouncementAsync(announcement);
            _logger.LogInformation("Performed Announcement Creation");
            if (result)
                await FanOutAsync(announcement, userId, role);
            return result;
        }

        // Audience mirrors MappingProfile's Institute rule: Admin-authored =>
        // college-wide ("All"), ProgramHead-authored => the head's institute.
        // Best-effort — NotificationService never throws.
        private async Task FanOutAsync(Announcement announcement, string userId, string role)
        {
            var title = announcement.Subject;
            var body = announcement.Content.Length > 300
                ? announcement.Content[..300] + "…"
                : announcement.Content;
            var targetId = announcement.Id.ToString();

            if (role == "ProgramHead" && !string.IsNullOrEmpty(userId))
            {
                var head = await _programHeadRepo.GetProgramHeadByIdAsync(userId);
                var institute = head?.Institute;
                if (!string.IsNullOrEmpty(institute))
                {
                    await _notifications.NotifyInstituteAsync(
                        institute, NotificationKinds.Announcement, title, body,
                        NotificationKinds.TargetAnnouncement, targetId);
                    return;
                }
            }

            if (role == "Admin")
            {
                await _notifications.NotifyAllActiveUsersAsync(
                    NotificationKinds.Announcement, title, body,
                    NotificationKinds.TargetAnnouncement, targetId);
            }
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
