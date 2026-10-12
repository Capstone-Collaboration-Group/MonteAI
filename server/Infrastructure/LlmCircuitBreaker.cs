// server/Infrastructure/LlmCircuitBreaker.cs
//
// Failure-count circuit breaker over the Azure OpenAI calls. The Foundry
// free-tier deployment intermittently accepts requests and returns zero
// bytes; each sick call burns a 20-40s timeout. After
// CircuitBreakerFailureThreshold consecutive failures the circuit opens and
// agent runs fail FAST with a friendly error for CircuitBreakerBreakSeconds,
// instead of every concurrent user individually waiting out the timeouts.
// After the break window one probe request is allowed through: success
// closes the circuit, failure re-opens it for another window.
//
// Deterministic fast-path answers and semantic-cache hits never consult the
// breaker — they make no LLM calls and keep working during an outage.
//
// Registered as a SINGLETON in Program.cs — deliberately NOT in a
// Scrutor-scanned namespace.

using Microsoft.Extensions.Options;
using server.Configuration;

namespace server.Infrastructure
{
    /// <summary>Thrown when the circuit is open; carries the user-facing message.</summary>
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

    public interface ILlmCircuitBreaker
    {
        /// <summary>True while the breaker is refusing new LLM calls.</summary>
        bool IsOpen { get; }

        /// <summary>Called after any successful LLM response — closes the circuit.</summary>
        void RecordSuccess();

        /// <summary>Called after a failed LLM call (timeout / transport error).</summary>
        void RecordFailure(string stage);
    }

    public sealed class LlmCircuitBreaker : ILlmCircuitBreaker
    {
        public const string UserFacingMessage =
            "The AI assistant is having trouble reaching its model service right now. " +
            "Please try again in about a minute.";

        private readonly int _failureThreshold;
        private readonly TimeSpan _breakDuration;
        private readonly ILogger<LlmCircuitBreaker> _logger;
        private readonly object _lock = new();

        private int _consecutiveFailures;
        private DateTime _openUntilUtc = DateTime.MinValue;

        public LlmCircuitBreaker(IOptions<MonteAiAgentConfig> config, ILogger<LlmCircuitBreaker> logger)
        {
            _failureThreshold = Math.Max(1, config.Value.CircuitBreakerFailureThreshold);
            _breakDuration = TimeSpan.FromSeconds(Math.Max(1, config.Value.CircuitBreakerBreakSeconds));
            _logger = logger;
        }

        public bool IsOpen
        {
            get
            {
                lock (_lock)
                {
                    return DateTime.UtcNow < _openUntilUtc;
                }
            }
        }

        public void RecordSuccess()
        {
            lock (_lock)
            {
                if (_consecutiveFailures > 0 || _openUntilUtc > DateTime.MinValue)
                {
                    _logger.LogInformation(
                        "LLM circuit breaker closed after {Failures} consecutive failure(s)",
                        _consecutiveFailures);
                }
                _consecutiveFailures = 0;
                _openUntilUtc = DateTime.MinValue;
            }
        }

        public void RecordFailure(string stage)
        {
            lock (_lock)
            {
                _consecutiveFailures++;
                if (_consecutiveFailures >= _failureThreshold)
                {
                    _openUntilUtc = DateTime.UtcNow + _breakDuration;
                    _logger.LogWarning(
                        "LLM circuit breaker OPENED after {Failures} consecutive failures (last: {Stage}) — failing fast for {Seconds}s",
                        _consecutiveFailures, stage, _breakDuration.TotalSeconds);
                }
            }
        }
    }
}
