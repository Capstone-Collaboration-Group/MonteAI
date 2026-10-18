// server/Infrastructure/ThesisIngestionQueue.cs
//
// In-process job queue for full-text thesis ingestion. POST /thesis/ingest/full
// enqueues a job and returns 202 immediately; ThesisIngestionWorker drains the
// channel and runs the heavy chunk→embed→upsert phase in the background so
// concurrent approvals never block each other or hold HTTP connections open.
//
// Unbounded on purpose: approvals are low-volume (a handful of admins during
// research month) and each job is already bounded by MaxChunksPerIngest — a
// bounded channel would risk dropping a job under a burst, while queueing
// costs nothing.
//
// Registered as a SINGLETON in Program.cs (deliberately outside the Scrutor
// scan — shared state, same posture as AgentConcurrencyGate / SemanticAnswerCache).
// The worker is the only consumer; the channel supports multiple readers safely
// but only one is registered.

using System.Collections.Concurrent;
using System.Runtime.CompilerServices;
using System.Threading.Channels;

namespace server.Infrastructure
{
    /// <summary>One queued body-ingestion job.</summary>
    /// <param name="ThesisId">Thesis whose full text should be chunked + upserted.</param>
    /// <param name="StagingBlobUrl">
    /// Blob URL of the staged extracted text. Always written before enqueueing;
    /// the worker deletes it after a successful ingest. Startup recovery
    /// re-downloads from here when FullText is null (process restart).
    /// </param>
    /// <param name="FullText">
    /// Extracted text carried in-memory on the normal path (avoids a blob
    /// round-trip); null when recovered from staging after a restart.
    /// </param>
    /// <param name="Title">Title-page title for body-chunk metadata.</param>
    /// <param name="Authors">Title-page authors for body-chunk metadata.</param>
    /// <param name="PublicationYear">Title-page year for body-chunk metadata.</param>
    public sealed record ThesisIngestionJob(
        Guid ThesisId,
        string StagingBlobUrl,
        string? FullText,
        string? Title,
        string? Authors,
        string? PublicationYear);

    public interface IThesisIngestionQueue
    {
        /// <summary>Offers a job to the background worker. Never blocks.</summary>
        void Enqueue(ThesisIngestionJob job);

        /// <summary>Drains queued jobs until the channel completes (host shutdown).</summary>
        IAsyncEnumerable<ThesisIngestionJob> DequeueAllAsync(CancellationToken cancellationToken);
    }

    public sealed class ThesisIngestionQueue : IThesisIngestionQueue
    {
        // Used only to dedupe re-enqueues of the same thesis (startup recovery
        // racing a live approval, or a double-clicked approve button) — a second
        // job for the same thesis would just redo the same work.
        private readonly ConcurrentDictionary<Guid, byte> _queued = new();

        private readonly Channel<ThesisIngestionJob> _channel =
            Channel.CreateUnbounded<ThesisIngestionJob>(new UnboundedChannelOptions
            {
                SingleReader = true,
                SingleWriter = false,
            });

        public void Enqueue(ThesisIngestionJob job)
        {
            if (!_queued.TryAdd(job.ThesisId, 0))
            {
                return; // already queued — idempotent
            }

            if (!_channel.Writer.TryWrite(job))
            {
                _queued.TryRemove(job.ThesisId, out _);
            }
        }

        public async IAsyncEnumerable<ThesisIngestionJob> DequeueAllAsync(
            [EnumeratorCancellation] CancellationToken cancellationToken)
        {
            await foreach (var job in _channel.Reader.ReadAllAsync(cancellationToken))
            {
                _queued.TryRemove(job.ThesisId, out _);
                yield return job;
            }
        }
    }
}
