using server.Models.DTOs.Notification;
using server.Models.Entities;
using server.Repositories.Interfaces;
using server.Services.Interfaces;

namespace server.Services.Notification
{
    // Fan-out notifications. Every Notify* helper is deliberately BEST-EFFORT
    // (try/catch + log): a full disk or dead DB during a notify must never
    // roll back the group/schedule/announcement action that triggered it.
    public class NotificationService : INotificationService
    {
        private const int MaxPageSize = 100;

        private readonly INotificationRepository _repo;
        private readonly ILogger<NotificationService> _logger;

        public NotificationService(INotificationRepository repo, ILogger<NotificationService> logger)
        {
            _repo = repo;
            _logger = logger;
        }

        public async Task<NotificationPageResponseDto> GetPagedAsync(string userId, int page, int pageSize)
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, MaxPageSize);

            var items = await _repo.GetByUserAsync(userId, page, pageSize);

            return new NotificationPageResponseDto
            {
                Items = items.Select(Map).ToList(),
                TotalCount = await _repo.GetTotalCountAsync(userId),
                UnreadCount = await _repo.GetUnreadCountAsync(userId),
                Page = page,
                PageSize = pageSize,
            };
        }

        public async Task<int> GetUnreadCountAsync(string userId)
            => await _repo.GetUnreadCountAsync(userId);

        public async Task<bool> MarkReadAsync(Guid id, string userId)
            => await _repo.MarkReadAsync(id, userId);

        public async Task<int> MarkAllReadAsync(string userId)
            => await _repo.MarkAllReadAsync(userId);

        public async Task NotifyUserAsync(string userId, string type, string title, string body, string targetType, string? targetId)
            => await NotifyManyAsync([userId], type, title, body, targetType, targetId);

        public async Task NotifyManyAsync(IEnumerable<string> userIds, string type, string title, string body, string targetType, string? targetId)
        {
            var recipients = userIds
                .Where(id => !string.IsNullOrWhiteSpace(id))
                .Distinct()
                .ToList();
            if (recipients.Count == 0) return;

            var rows = recipients.Select(userId => new Models.Entities.Notification
            {
                Id = Guid.NewGuid(),
                UserId = userId,
                Type = type,
                Title = title,
                Body = body,
                TargetType = targetType,
                TargetId = targetId,
                IsRead = false,
                CreatedAt = DateTime.UtcNow,
            }).ToList();

            try
            {
                await _repo.CreateManyAsync(rows);
                _logger.LogInformation(
                    "Notified {Count} user(s) for {Type} (target {TargetType}/{TargetId})",
                    rows.Count, type, targetType, targetId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Failed to persist {Count} notification row(s) for {Type} — continuing without notifications",
                    rows.Count, type);
            }
        }

        public async Task NotifyAllActiveUsersAsync(string type, string title, string body, string targetType, string? targetId)
        {
            try
            {
                var userIds = await _repo.GetAllActiveUserIdsAsync();
                await NotifyManyAsync(userIds, type, title, body, targetType, targetId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to resolve active users for {Type} fan-out — notification skipped", type);
            }
        }

        public async Task NotifyInstituteAsync(string institute, string type, string title, string body, string targetType, string? targetId)
        {
            if (string.IsNullOrWhiteSpace(institute)) return;
            try
            {
                var userIds = await _repo.GetActiveUserIdsByInstituteAsync(institute);
                await NotifyManyAsync(userIds, type, title, body, targetType, targetId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to resolve institute {Institute} users for {Type} fan-out — notification skipped", institute, type);
            }
        }

        private static NotificationResponseDto Map(Models.Entities.Notification n) => new()
        {
            Id = n.Id,
            Type = n.Type,
            Title = n.Title,
            Body = n.Body,
            TargetType = n.TargetType,
            TargetId = n.TargetId,
            IsRead = n.IsRead,
            CreatedAt = n.CreatedAt,
        };
    }
}
