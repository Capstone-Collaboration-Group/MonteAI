// server/Infrastructure/AgentConcurrencyGate.cs
//
// Caps how many agent runs (planner + synthesizer LLM calls) execute at once.
// The free-tier Azure OpenAI deployment sustains only ~1-2 concurrent calls;
// without a gate a burst of users turns into 429s and multiplied zero-byte
// stalls for everyone. Beyond the cap, requests wait here and the agent
// surfaces the queue depth to users via SSE status frames
// ("The AI assistant is busy — about 3 ahead of you…").
//
// Registered as a SINGLETON in Program.cs (shared state across requests) —
// deliberately NOT in a Scrutor-scanned namespace.

using Microsoft.Extensions.Options;
using server.Configuration;

namespace server.Infrastructure
{
    public interface IAgentConcurrencyGate
    {
        /// <summary>Permits currently configured for concurrent agent runs.</summary>
        int MaxConcurrency { get; }

        /// <summary>How many requests are waiting for a permit right now.</summary>
        int WaitingCount { get; }

        /// <summary>Non-blocking acquire. True when a permit was taken.</summary>
        bool TryEnter();

        /// <summary>Blocking acquire; dispose the result to release the permit.</summary>
        Task<Releaser> WaitAsync(CancellationToken cancellationToken);

        /// <summary>RAII handle that releases the permit exactly once.</summary>
        public sealed class Releaser : IDisposable
        {
            private readonly SemaphoreSlim _semaphore;
            private int _released;

            internal Releaser(SemaphoreSlim semaphore) => _semaphore = semaphore;

            public void Dispose()
            {
                if (Interlocked.Exchange(ref _released, 1) == 0)
                {
                    _semaphore.Release();
                }
            }
        }
    }

    public sealed class AgentConcurrencyGate : IAgentConcurrencyGate
    {
        private readonly SemaphoreSlim _semaphore;
        private int _waiting;

        public AgentConcurrencyGate(IOptions<MonteAiAgentConfig> config)
        {
            MaxConcurrency = Math.Max(1, config.Value.MaxConcurrentAgentRuns);
            _semaphore = new SemaphoreSlim(MaxConcurrency, MaxConcurrency);
        }

        public int MaxConcurrency { get; }

        public int WaitingCount => Volatile.Read(ref _waiting);

        public bool TryEnter() => _semaphore.Wait(0);

        public async Task<IAgentConcurrencyGate.Releaser> WaitAsync(CancellationToken cancellationToken)
        {
            Interlocked.Increment(ref _waiting);
            try
            {
                await _semaphore.WaitAsync(cancellationToken);
            }
            finally
            {
                Interlocked.Decrement(ref _waiting);
            }
            return new IAgentConcurrencyGate.Releaser(_semaphore);
        }
    }
}
