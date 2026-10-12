// server/Infrastructure/SemanticAnswerCache.cs
//
// In-memory semantic cache for completed chat answers. Research-month
// traffic is highly repetitive (students ask near-identical questions about
// the same theses), so near-duplicate queries are served instantly with zero
// LLM calls: embed the query (one cheap embedding API call), cosine against
// recent query embeddings, and on a hit (>= SemanticCacheCosineThreshold)
// return the previously grounded answer + its sources.
//
// Scope decisions:
//   - Conservative threshold (0.95): only near-duplicates hit, so answers
//     stay correct; broader reuse risks stale/wrong answers.
//   - TTL (default 30 days) + max-entries cap with oldest-first eviction —
//     a single process's memory, wiped on restart (fine: it's a cache).
//   - Any embedding failure is swallowed: the cache NEVER breaks a request,
//     it just misses.
//   - Answers that are the "could not generate" placeholder are not stored.
//
// Registered as a SINGLETON in Program.cs — deliberately NOT in a
// Scrutor-scanned namespace.

using System.Collections.Concurrent;
using Microsoft.Extensions.Options;
using OpenAI.Embeddings;
using server.Configuration;
using server.Models.DTOs.ChatMessage;

namespace server.Infrastructure
{
    public sealed record SemanticCacheHit(string Answer, IReadOnlyList<ChatSourceDto> Sources);

    public interface ISemanticAnswerCache
    {
        /// <summary>Returns a cached answer for a near-duplicate query, or null.</summary>
        Task<SemanticCacheHit?> TryGetAsync(string query, CancellationToken cancellationToken);

        /// <summary>Stores a completed answer for future near-duplicate queries.</summary>
        Task RememberAsync(string query, string answer, IReadOnlyList<ChatSourceDto> sources, CancellationToken cancellationToken);
    }

    public sealed class SemanticAnswerCache : ISemanticAnswerCache
    {
        private sealed record Entry(float[] Embedding, string Answer, IReadOnlyList<ChatSourceDto> Sources, DateTime StoredUtc);

        private readonly EmbeddingClient _embeddingClient;
        private readonly MonteAiAgentConfig _config;
        private readonly ILogger<SemanticAnswerCache> _logger;
        private readonly ConcurrentQueue<Entry> _entries = new();
        private int _count;

        public SemanticAnswerCache(
            EmbeddingClient embeddingClient,
            IOptions<MonteAiAgentConfig> config,
            ILogger<SemanticAnswerCache> logger)
        {
            _embeddingClient = embeddingClient;
            _config = config.Value;
            _logger = logger;
        }

        public async Task<SemanticCacheHit?> TryGetAsync(string query, CancellationToken cancellationToken)
        {
            if (!_config.SemanticCacheEnabled || Volatile.Read(ref _count) == 0)
            {
                return null;
            }

            float[] queryEmbedding;
            try
            {
                queryEmbedding = await EmbedAsync(query, cancellationToken);
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Semantic cache lookup embedding failed — treating as a miss");
                return null;
            }

            var threshold = _config.SemanticCacheCosineThreshold;
            var ttl = TimeSpan.FromHours(Math.Max(1, _config.SemanticCacheTtlHours));
            var cutoff = DateTime.UtcNow - ttl;

            SemanticCacheHit? best = null;
            var bestScore = threshold;

            foreach (var entry in _entries)
            {
                if (entry.StoredUtc < cutoff) continue;

                var score = CosineSimilarity(queryEmbedding, entry.Embedding);
                if (score >= bestScore)
                {
                    bestScore = score;
                    best = new SemanticCacheHit(entry.Answer, entry.Sources);
                }
            }

            if (best is not null)
            {
                _logger.LogInformation("Semantic cache HIT (cosine {Score:F3})", bestScore);
            }

            return best;
        }

        public async Task RememberAsync(
            string query,
            string answer,
            IReadOnlyList<ChatSourceDto> sources,
            CancellationToken cancellationToken)
        {
            if (!_config.SemanticCacheEnabled) return;
            // Never cache the degradation placeholder.
            if (string.IsNullOrWhiteSpace(answer) ||
                answer.Contains("could not generate a response", StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            try
            {
                var embedding = await EmbedAsync(query, cancellationToken);
                _entries.Enqueue(new Entry(embedding, answer, sources, DateTime.UtcNow));

                var maxEntries = Math.Max(1, _config.SemanticCacheMaxEntries);
                var newCount = Interlocked.Increment(ref _count);
                while (newCount > maxEntries && _entries.TryDequeue(out _))
                {
                    newCount = Interlocked.Decrement(ref _count);
                }
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception ex)
            {
                // Caching is best-effort — a failure here must never fail the request.
                _logger.LogWarning(ex, "Semantic cache store failed (answer already generated)");
            }
        }

        private async Task<float[]> EmbedAsync(string query, CancellationToken ct)
        {
            var result = await _embeddingClient.GenerateEmbeddingAsync(query, cancellationToken: ct);
            return result.Value.ToFloats().ToArray();
        }

        /// <summary>Cosine similarity over two equal-length embedding vectors.</summary>
        private static float CosineSimilarity(float[] a, float[] b)
        {
            if (a.Length != b.Length || a.Length == 0) return 0f;

            double dot = 0, normA = 0, normB = 0;
            for (var i = 0; i < a.Length; i++)
            {
                dot += (double)a[i] * b[i];
                normA += (double)a[i] * a[i];
                normB += (double)b[i] * b[i];
            }

            var denominator = Math.Sqrt(normA) * Math.Sqrt(normB);
            return denominator == 0 ? 0f : (float)(dot / denominator);
        }
    }
}
