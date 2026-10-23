using server.Models.Entities;

namespace server.Repositories.Interfaces
{
    public interface INotificationRepository
    {
        /// <summary>Newest-first page of a user's notifications.</summary>
        Task<List<Notification>> GetByUserAsync(string userId, int page, int pageSize, CancellationToken ct = default);

        Task<int> GetUnreadCountAsync(string userId, CancellationToken ct = default);

        Task<int> GetTotalCountAsync(string userId, CancellationToken ct = default);

        Task<Notification?> GetByIdAsync(Guid id, CancellationToken ct = default);

        /// <summary>Marks one row read; returns false when missing or not owned by the user.</summary>
        Task<bool> MarkReadAsync(Guid id, string userId, CancellationToken ct = default);

        Task<int> MarkAllReadAsync(string userId, CancellationToken ct = default);

        /// <summary>Inserts a batch of fan-out rows and saves in one transaction.</summary>
        Task CreateManyAsync(IEnumerable<Notification> notifications, CancellationToken ct = default);

        /// <summary>All active user ids (across the four role tables) for college-wide fan-out.</summary>
        Task<List<string>> GetAllActiveUserIdsAsync(CancellationToken ct = default);

        /// <summary>Active user ids limited to one institute (Students/Faculties/ProgramHeads).</summary>
        Task<List<string>> GetActiveUserIdsByInstituteAsync(string institute, CancellationToken ct = default);
    }
}
