// server/Infrastructure/EmailQueue.cs
//
// In-process queue for outbound email — same posture as ThesisIngestionQueue:
// request handlers enqueue (never block on SMTP round-trips) and EmailWorker
// drains the channel in the background. Unbounded because email volume here
// is tiny (security notices) and dropping a password-change email is worse
// than queueing it.
//
// Registered as a SINGLETON in Program.cs (outside the Scrutor scan —
// shared state).

using System.Threading.Channels;

namespace server.Infrastructure
{
    /// <summary>One queued outbound email.</summary>
    /// <param name="To">Recipient address.</param>
    /// <param name="Subject">Subject line.</param>
    /// <param name="HtmlBody">HTML body.</param>
    /// <param name="TextBody">Plain-text alternative for mail clients that strip HTML.</param>
    public sealed record EmailJob(
        string To,
        string Subject,
        string HtmlBody,
        string TextBody);

    public interface IEmailQueue
    {
        /// <summary>Offers a job to the background worker. Never blocks.</summary>
        void Enqueue(EmailJob job);

        /// <summary>Drains queued jobs until the channel completes (host shutdown).</summary>
        IAsyncEnumerable<EmailJob> DequeueAllAsync(CancellationToken cancellationToken);
    }

    public sealed class EmailQueue : IEmailQueue
    {
        private readonly Channel<EmailJob> _channel =
            Channel.CreateUnbounded<EmailJob>(new UnboundedChannelOptions
            {
                SingleReader = true,
                SingleWriter = false,
            });

        public void Enqueue(EmailJob job)
        {
            _channel.Writer.TryWrite(job);
        }

        public async IAsyncEnumerable<EmailJob> DequeueAllAsync(
            [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken)
        {
            await foreach (var job in _channel.Reader.ReadAllAsync(cancellationToken))
            {
                yield return job;
            }
        }
    }
}
