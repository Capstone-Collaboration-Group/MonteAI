using server.Models.DTOs.Notification;

namespace server.Services.Interfaces
{
    public interface INotificationService
    {
        /// <summary>Paged notifications for the given user (newest first).</summary>
        Task<NotificationPageResponseDto> GetPagedAsync(string userId, int page, int pageSize);

        Task<int> GetUnreadCountAsync(string userId);

        /// <summary>Mark one notification read; false when missing/not owned.</summary>
        Task<bool> MarkReadAsync(Guid id, string userId);

        Task<int> MarkAllReadAsync(string userId);

        /// <summary>
        /// Best-effort single-recipient notify — never throws, so a notification
        /// failure can never fail the business action that triggered it.
        /// </summary>
        Task NotifyUserAsync(string userId, string type, string title, string body, string targetType, string? targetId);

        /// <summary>Best-effort fan-out to an explicit recipient list.</summary>
        Task NotifyManyAsync(IEnumerable<string> userIds, string type, string title, string body, string targetType, string? targetId);

        /// <summary>All active users (college-wide audience).</summary>
        Task NotifyAllActiveUsersAsync(string type, string title, string body, string targetType, string? targetId);

        /// <summary>Active users of one institute (institute-wide audience).</summary>
        Task NotifyInstituteAsync(string institute, string type, string title, string body, string targetType, string? targetId);
    }
}
