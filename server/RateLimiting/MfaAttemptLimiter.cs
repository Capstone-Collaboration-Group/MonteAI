using System.Collections.Concurrent;

namespace server.RateLimiting
{
    public interface IMfaAttemptLimiter
    {
        /// <summary>True when this key is already at/over the limit (do not even try the code).</summary>
        bool WouldBlock(string key);
        /// <summary>Records a failed attempt; returns false when the limit is exceeded.</summary>
        bool RecordFailure(string key);
        /// <summary>Records a successful attempt by clearing the window.</summary>
        void RecordSuccess(string key);
        void Reset(string key);
    }

    // Fixed-window limiter: 5 failed attempts per 5 minutes per key (uid).
    // In-memory singleton — resets on server restart, matches the existing
    // ChatLimit posture. Lives outside server.Services.* so the Scrutor
    // scan does not register it scoped (a scoped instance would reset per request).
    public class MfaAttemptLimiter : IMfaAttemptLimiter
    {
        public const int PermitLimit = 5;
        public static readonly TimeSpan Window = TimeSpan.FromMinutes(5);

        private readonly ConcurrentDictionary<string, WindowCounter> _windows = new();

        private sealed class WindowCounter
        {
            public DateTimeOffset WindowStart;
            public int Failures;
        }

        public bool WouldBlock(string key)
        {
            if (!_windows.TryGetValue(key, out var counter))
                return false;
            lock (counter)
            {
                if (DateTimeOffset.UtcNow - counter.WindowStart >= Window)
                {
                    counter.WindowStart = DateTimeOffset.UtcNow;
                    counter.Failures = 0;
                }
                return counter.Failures >= PermitLimit;
            }
        }

        public bool RecordFailure(string key)
        {
            var now = DateTimeOffset.UtcNow;
            var counter = _windows.GetOrAdd(key, _ => new WindowCounter { WindowStart = now });
            lock (counter)
            {
                if (now - counter.WindowStart >= Window)
                {
                    counter.WindowStart = now;
                    counter.Failures = 0;
                }
                counter.Failures++;
                return counter.Failures <= PermitLimit;
            }
        }

        public void RecordSuccess(string key) => Reset(key);

        public void Reset(string key) => _windows.TryRemove(key, out _);
    }
}
