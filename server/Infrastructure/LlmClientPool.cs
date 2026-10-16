// server/Infrastructure/LlmClientPool.cs
//
// Routes LLM calls to a healthy Foundry-agent pool entry for the requested
// role ("planner" / "synth"). One entry = one Foundry agent deployment with
// its own concurrency budget and cooldown tracking — this replaces BOTH the
// old AgentConcurrencyGate-for-LLM-calls and the global LlmCircuitBreaker:
//
//   - Per-entry SemaphoreSlim(MaxConcurrency): the real concurrency limit.
//     Adding capacity = adding a config entry, no code change.
//   - Least-outstanding-requests routing among healthy entries serving the role.
//   - On failure the entry enters a cooldown (escalating with consecutive
//     failures) and CompleteAsync FAILS OVER to the next healthy entry for the
//     same role. When every entry is cooling down the pool throws
//     LlmUnavailableException so the controller's 503/SSE-error path applies.
//   - Streaming does not fail over inside the pool: a stalled stream surfaces
//     as an exception and MonteAiAgentService's existing StreamAttempts loop
//     simply calls the pool again, which now avoids the cooled-down entry.
//
// The request-level gate (AgentConcurrencyGate) is UNRELATED: it bounds how
// many agent REQUESTS are in the pipeline at once (queue UX); this pool
// bounds how many LLM CALLS each deployment handles.
//
// Registered as a SINGLETON in Program.cs — deliberately NOT in a
// Scrutor-scanned namespace (shared state + singleton ILlmBackend).

using System.Runtime.CompilerServices;
using Microsoft.Extensions.Options;
using server.Configuration;
using server.Services.AI;

namespace server.Infrastructure
{
    /// <summary>Thrown when no pool entry can serve a call (all cooling down / none configured).</summary>
    public sealed class LlmUnavailableException : Exception
    {
        public LlmUnavailableException(string message) : base(message)
        {
        }

        public LlmUnavailableException(string message, Exception innerException)
            : base(message, innerException)
        {
        }
    }

    public interface ILlmClientPool
    {
        /// <summary>One non-streaming completion, routed to a healthy entry for <see cref="LlmCall.Role"/>.</summary>
        Task<LlmCompletion> CompleteAsync(LlmCall call, CancellationToken cancellationToken = default);

        /// <summary>Streaming completion deltas, routed to a healthy entry for <see cref="LlmCall.Role"/>.</summary>
        IAsyncEnumerable<string> StreamDeltasAsync(LlmCall call, CancellationToken cancellationToken = default);
    }

    public sealed class LlmClientPool : ILlmClientPool
    {
        public const string UserFacingMessage =
            "The AI assistant is having trouble reaching its model service right now. " +
            "Please try again in about a minute.";

        private sealed class Entry
        {
            public required LlmPoolEntry Config { get; init; }
            public required HashSet<string> Roles { get; init; }
            public required SemaphoreSlim Semaphore { get; init; }

            /// <summary>In-flight calls + callers queued on the semaphore (for least-outstanding routing).</summary>
            public int Outstanding;

            public int ConsecutiveFailures;

            /// <summary>UTC ticks until which this entry is skipped (0 = healthy). Volatile.</summary>
            public long CooldownUntilUtcTicks;

            public bool IsCoolingDown(DateTime nowUtc) =>
                Volatile.Read(ref CooldownUntilUtcTicks) > nowUtc.Ticks;
        }

        private readonly ILlmBackend _backend;
        private readonly ILogger<LlmClientPool> _logger;
        private readonly List<Entry> _entries;

        public LlmClientPool(
            ILlmBackend backend,
            IOptions<LlmPoolConfig> config,
            ILogger<LlmClientPool> logger)
        {
            _backend = backend;
            _logger = logger;

            _entries = (config.Value.Deployments ?? new List<LlmPoolEntry>())
                .Where(e => !string.IsNullOrWhiteSpace(e.Name) && !string.IsNullOrWhiteSpace(e.AgentName))
                .Select(e => new Entry
                {
                    Config = e,
                    Roles = new HashSet<string>(e.Roles ?? new List<string>(), StringComparer.OrdinalIgnoreCase),
                    Semaphore = new SemaphoreSlim(Math.Max(1, e.MaxConcurrency), Math.Max(1, e.MaxConcurrency)),
                })
                .ToList();

            if (_entries.Count == 0)
            {
                _logger.LogWarning(
                    "LlmClientPool has NO entries — every planner/synth call will fail. " +
                    "Configure AzureAI:Deployments in appsettings.");
            }
            else
            {
                _logger.LogInformation(
                    "LlmClientPool ready: {Count} entries ({Entries})",
                    _entries.Count,
                    string.Join(", ", _entries.Select(e => $"{e.Config.Name}[{string.Join('|', e.Roles)}×{e.Config.MaxConcurrency}]")));
            }
        }

        // ────────────────────────── non-streaming ──────────────────────────

        public async Task<LlmCompletion> CompleteAsync(LlmCall call, CancellationToken cancellationToken = default)
        {
            Exception? lastFailure = null;

            foreach (var entry in CandidatesFor(call.Role))
            {
                Interlocked.Increment(ref entry.Outstanding);
                try
                {
                    await entry.Semaphore.WaitAsync(cancellationToken);
                }
                catch
                {
                    Interlocked.Decrement(ref entry.Outstanding);
                    throw;
                }

                try
                {
                    using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                    timeoutCts.CancelAfter(TimeSpan.FromSeconds(Math.Max(1, entry.Config.TimeoutSeconds)));

                    var result = await _backend.CompleteAsync(
                        ForEntry(call, entry),
                        timeoutCts.Token);

                    RecordSuccess(entry);
                    return result;
                }
                catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
                {
                    throw;
                }
                catch (Exception ex)
                {
                    RecordFailure(entry, "complete", ex);
                    lastFailure = ex;
                    // fall through to the next healthy entry (failover)
                }
                finally
                {
                    entry.Semaphore.Release();
                    Interlocked.Decrement(ref entry.Outstanding);
                }
            }

            throw new LlmUnavailableException(
                $"{UserFacingMessage} (no healthy pool entry for role '{call.Role}')", lastFailure!);
        }

        // ────────────────────────── streaming ──────────────────────────

        public async IAsyncEnumerable<string> StreamDeltasAsync(
            LlmCall call,
            [EnumeratorCancellation] CancellationToken cancellationToken = default)
        {
            var entry = CandidatesFor(call.Role).FirstOrDefault()
                ?? throw new LlmUnavailableException(
                    $"{UserFacingMessage} (no healthy pool entry for role '{call.Role}')");

            Interlocked.Increment(ref entry.Outstanding);
            try
            {
                await entry.Semaphore.WaitAsync(cancellationToken);
            }
            catch
            {
                Interlocked.Decrement(ref entry.Outstanding);
                throw;
            }

            // Entry timeout guards the stream until the first delta; after that
            // it is disarmed so a long answer is not killed mid-generation
            // (the caller owns first-token/stall policy beyond this point).
            using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeoutCts.CancelAfter(TimeSpan.FromSeconds(Math.Max(1, entry.Config.TimeoutSeconds)));

            var enumerator = _backend
                .StreamDeltas(ForEntry(call, entry), timeoutCts.Token)
                .GetAsyncEnumerator(timeoutCts.Token);

            var firstDelta = true;
            var succeeded = false;
            try
            {
                while (true)
                {
                    string? next = null;
                    var hasValue = false;
                    var failed = false;
                    Exception? failure = null;

                    // C# forbids yield inside a try that has a catch — buffer one
                    // MoveNext result here, yield outside, mirroring the agent
                    // service's mid-stream guard.
                    try
                    {
                        hasValue = await enumerator.MoveNextAsync();
                        if (hasValue) next = enumerator.Current;
                    }
                    catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
                    {
                        throw;
                    }
                    catch (Exception ex)
                    {
                        failed = true;
                        failure = ex;
                    }

                    if (failed)
                    {
                        if (firstDelta)
                        {
                            // Never produced a byte — count it against the entry.
                            RecordFailure(entry, "stream", failure);
                        }
                        else
                        {
                            // Tokens already reached the caller — do not cool the
                            // entry down for a mid-stream drop; surface it so the
                            // caller keeps its partial answer.
                            _logger.LogWarning(failure,
                                "LlmClientPool stream for role {Role} dropped mid-stream on entry {Entry}",
                                call.Role, entry.Config.Name);
                        }
                        throw failure!;
                    }

                    if (!hasValue) break;

                    if (firstDelta)
                    {
                        firstDelta = false;
                        succeeded = true;
                        timeoutCts.CancelAfter(Timeout.InfiniteTimeSpan);
                        RecordSuccess(entry);
                    }

                    yield return next!;
                }
            }
            finally
            {
                try { await enumerator.DisposeAsync(); }
                catch { /* disposing an abandoned stream may throw */ }

                entry.Semaphore.Release();
                Interlocked.Decrement(ref entry.Outstanding);
                _ = succeeded; // reserved for future metrics
            }
        }

        // ────────────────────────── routing / health ──────────────────────────

        /// <summary>
        /// Bakes the entry's Foundry agent name (and JSON mode, if the entry
        /// forces it) into the call for this hop. The caller's Role stays on
        /// the record for logging/traceability.
        /// </summary>
        private static LlmCall ForEntry(LlmCall call, Entry entry) =>
            call with
            {
                TargetAgent = entry.Config.AgentName,
                JsonMode = call.JsonMode || entry.Config.JsonMode,
            };

        /// <summary>
        /// Healthy entries serving the role, least-outstanding first. Entries
        /// past their cooldown deadline rejoin automatically.
        /// </summary>
        private List<Entry> CandidatesFor(string role)
        {
            var nowUtc = DateTime.UtcNow;
            return _entries
                .Where(e => e.Roles.Contains(role) && !e.IsCoolingDown(nowUtc))
                .OrderBy(e => Volatile.Read(ref e.Outstanding))
                .ThenBy(e => e.Config.Name, StringComparer.Ordinal)
                .ToList();
        }

        private void RecordSuccess(Entry entry)
        {
            Volatile.Write(ref entry.CooldownUntilUtcTicks, 0L);
            Volatile.Write(ref entry.ConsecutiveFailures, 0);
        }

        private void RecordFailure(Entry entry, string stage, Exception? ex = null)
        {
            var failures = Interlocked.Increment(ref entry.ConsecutiveFailures);
            var cooldownSeconds = Math.Min(60, 5 * failures);
            Volatile.Write(
                ref entry.CooldownUntilUtcTicks,
                DateTime.UtcNow.AddSeconds(cooldownSeconds).Ticks);

            _logger.LogWarning(ex,
                "LlmClientPool entry {Entry} failed during {Stage} ({Failures} consecutive) — cooling down {Seconds}s",
                entry.Config.Name, stage, failures, cooldownSeconds);
        }
    }
}
