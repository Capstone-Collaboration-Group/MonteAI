using server.Infrastructure;

namespace server.Services.Interfaces
{
    /// <summary>
    /// Reusable outbound email. Queue* methods are fire-and-forget (background
    /// worker); SendAsync transmits immediately (used by the worker itself).
    /// </summary>
    public interface IEmailService
    {
        /// <summary>Queues an email for background delivery. Never blocks, never throws.</summary>
        void Queue(string to, string subject, string htmlBody, string textBody);

        /// <summary>Queues a pre-built job.</summary>
        void Queue(EmailJob job);

        /// <summary>
        /// Transmits one email over SMTP. Throws on failure so the worker can
        /// retry. No-ops (and logs) when Email:Enabled is false.
        /// </summary>
        Task SendAsync(EmailJob job, CancellationToken cancellationToken = default);
    }
}
