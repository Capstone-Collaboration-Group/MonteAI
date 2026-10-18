// server/Infrastructure/ThesisIngestionWorker.cs
//
// Background consumer of ThesisIngestionQueue — the async half of the
// full-text ingestion pipeline:
//
//   POST /thesis/ingest/full  ──>  metadata vector upserted (sync)
//                               ──>  job enqueued ──>  THIS WORKER
//                                    download staged text
//                                    chunk (512 words / 50 overlap)
//                                    batch-embed + upsert to Pinecone
//                                    mark SQL Status=Indexed
//                                    delete staging blob
//
// Concurrency: at most MaxConcurrentIngestions jobs run at once (semaphore),
// so a burst of approvals cannot stampede the Azure OpenAI embedding TPM.
// Each job retries up to IngestMaxAttempts times with exponential backoff;
// a job that exhausts its retries is marked PineconeStatus=IngestFailed
// (visible to admins; the metadata vector from the sync phase keeps working).
//
// Startup recovery: theses still marked "Indexing" when the process stopped
// (crash/restart mid-job) are re-enqueued from their staging blob. A thesis
// whose staging blob is already gone (finished or never staged) is skipped
// or marked failed.
//
// Registered via AddHostedService in Program.cs (singleton, outside Scrutor).

using Microsoft.Extensions.Options;
using server.Configuration;
using server.Repositories.Interfaces;
using server.Services.Interfaces;

namespace server.Infrastructure
{
    public sealed class ThesisIngestionWorker : BackgroundService
    {
        private readonly IThesisIngestionQueue _queue;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly PineconeConfig _pineconeConfig;
        private readonly ILogger<ThesisIngestionWorker> _logger;

        public ThesisIngestionWorker(
            IThesisIngestionQueue queue,
            IServiceScopeFactory scopeFactory,
            IOptions<PineconeConfig> pineconeConfig,
            ILogger<ThesisIngestionWorker> logger)
        {
            _queue = queue;
            _scopeFactory = scopeFactory;
            _pineconeConfig = pineconeConfig.Value;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            // Recovery BEFORE draining: jobs interrupted by a restart are
            // re-enqueued from their staging blobs, then the normal loop picks
            // them up like any other job.
            await RecoverInterruptedIngestionsAsync(stoppingToken);

            var maxConcurrent = Math.Max(1, _pineconeConfig.MaxConcurrentIngestions);
            using var semaphore = new SemaphoreSlim(maxConcurrent, maxConcurrent);
            var inFlight = new List<Task>();

            _logger.LogInformation(
                "Thesis ingestion worker started (max {Max} concurrent jobs)", maxConcurrent);

            try
            {
                await foreach (var job in _queue.DequeueAllAsync(stoppingToken))
                {
                    await semaphore.WaitAsync(stoppingToken);

                    // Fire the job; the semaphore slot is released in RunJobAsync's
                    // finally. The task list is pruned of completed jobs each round
                    // so it cannot grow unboundedly.
                    var task = RunJobAsync(job, semaphore, stoppingToken);
                    inFlight.Add(task);
                    inFlight.RemoveAll(t => t.IsCompleted);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                // Host shutdown — fall through to drain in-flight jobs below.
            }

            // Graceful shutdown: give in-flight jobs a chance to finish (the
            // host's shutdown timeout bounds this). Interrupted ones are
            // recovered from their staging blobs on the next start.
            try { await Task.WhenAll(inFlight); }
            catch { /* individual failures are already handled + logged */ }

            _logger.LogInformation("Thesis ingestion worker stopped");
        }

        /// <summary>Runs one job with retry/backoff; releases the semaphore slot.</summary>
        private async Task RunJobAsync(ThesisIngestionJob job, SemaphoreSlim semaphore, CancellationToken ct)
        {
            try
            {
                var maxAttempts = Math.Max(1, _pineconeConfig.IngestMaxAttempts);

                for (var attempt = 1; attempt <= maxAttempts; attempt++)
                {
                    try
                    {
                        using var scope = _scopeFactory.CreateScope();
                        var thesisService = scope.ServiceProvider.GetRequiredService<IThesisService>();

                        await thesisService.ProcessQueuedIngestionAsync(job, ct);

                        _logger.LogInformation(
                            "Ingestion job for thesis {ThesisId} completed (attempt {Attempt})",
                            job.ThesisId, attempt);
                        return;
                    }
                    catch (OperationCanceledException) when (ct.IsCancellationRequested)
                    {
                        // Host shutting down mid-job — leave PineconeStatus as
                        // "Indexing"; startup recovery re-queues from the staging blob.
                        _logger.LogInformation(
                            "Ingestion job for thesis {ThesisId} interrupted by shutdown — will recover on next start",
                            job.ThesisId);
                        throw;
                    }
                    catch (Exception ex)
                    {
                        _logger.LogWarning(ex,
                            "Ingestion job for thesis {ThesisId} failed (attempt {Attempt}/{Max})",
                            job.ThesisId, attempt, maxAttempts);

                        if (attempt >= maxAttempts)
                        {
                            await MarkFailedAsync(job.ThesisId);
                            return;
                        }

                        // Exponential backoff: 2s, 4s, … (embedding throttling is
                        // the common failure mode and settles quickly).
                        try
                        {
                            await Task.Delay(TimeSpan.FromSeconds(Math.Pow(2, attempt)), ct);
                        }
                        catch (OperationCanceledException) when (ct.IsCancellationRequested)
                        {
                            await MarkFailedAsync(job.ThesisId);
                            throw;
                        }
                    }
                }
            }
            finally
            {
                semaphore.Release();
            }
        }

        /// <summary>Best-effort "IngestFailed" marker so admins can see the thesis needs a re-ingest.</summary>
        private async Task MarkFailedAsync(Guid thesisId)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var thesisRepo = scope.ServiceProvider.GetRequiredService<IThesisRepository>();
                await thesisRepo.UpdatePineconeStatusAsync(thesisId, "IngestFailed");

                _logger.LogError(
                    "Ingestion permanently failed for thesis {ThesisId} after {Max} attempts — marked IngestFailed",
                    thesisId, Math.Max(1, _pineconeConfig.IngestMaxAttempts));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "Could not mark thesis {ThesisId} as IngestFailed — it may stay stuck in Indexing until manually fixed",
                    thesisId);
            }
        }

        /// <summary>
        /// Re-enqueues theses left in PineconeStatus=Indexing by a crash or
        /// restart. A missing staging blob means the job can never finish —
        /// mark it IngestFailed instead of leaving it stuck.
        /// </summary>
        private async Task RecoverInterruptedIngestionsAsync(CancellationToken ct)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var thesisRepo = scope.ServiceProvider.GetRequiredService<IThesisRepository>();

                var stuck = await thesisRepo.GetIngestingThesesAsync(ct);
                if (stuck.Count == 0) return;

                _logger.LogWarning(
                    "Found {Count} theses stuck in Indexing — recovering from staging blobs", stuck.Count);

                foreach (var thesis in stuck)
                {
                    if (string.IsNullOrWhiteSpace(thesis.IngestStagingUrl))
                    {
                        // No staging blob recorded — the job can never finish.
                        await thesisRepo.UpdatePineconeStatusAsync(thesis.Id, "IngestFailed", ct);
                        _logger.LogWarning(
                            "Thesis {ThesisId} had no staging blob during recovery — marked IngestFailed", thesis.Id);
                        continue;
                    }

                    _queue.Enqueue(new ThesisIngestionJob(
                        thesis.Id, thesis.IngestStagingUrl, FullText: null,
                        Title: null, Authors: null, PublicationYear: null));
                    _logger.LogInformation(
                        "Re-queued interrupted ingestion for thesis {ThesisId}", thesis.Id);
                }
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                // Shutdown during recovery — fine, next start retries.
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Startup ingestion recovery failed — interrupted jobs stay queued until the next restart");
            }
        }
    }
}
