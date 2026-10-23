// server/Configuration/MonteAiAgentConfig.cs
//
// Cost & behaviour knobs for the MonteAI agent loop.
//
// These settings exist to keep Azure AI Foundry spend under control while the
// project runs on limited credits: every planner/synthesizer call is capped by
// token limits, the number of agent iterations is bounded, and agent mode can
// be disabled entirely (falling back to a single retrieve-then-answer RAG call)
// via "MonteAI:Agent:EnableAgentMode": false.
//
// Bound from the "MonteAI:Agent" section of appsettings*.json.

namespace server.Configuration
{
    public class MonteAiAgentConfig
    {
        public const string SectionName = "MonteAI:Agent";

        /// <summary>
        /// When true, chat requests run through the full agentic loop
        /// (plan -> tool -> observe -> answer). When false, the service falls
        /// back to the cheaper single-shot RAG path (embed -> retrieve -> answer).
        /// Default: true.
        /// </summary>
        public bool EnableAgentMode { get; set; } = true;

        /// <summary>
        /// Maximum number of plan/act iterations per user message. Each
        /// iteration costs one planner call plus any tool calls.
        /// Default: 3.
        /// </summary>
        public int MaxAgentIterations { get; set; } = 3;

        /// <summary>
        /// How many prior chat messages (user + assistant turns) are replayed
        /// into the planner and synthesizer prompts as conversation memory.
        /// Kept small for the ~1000-token/query budget — history is the main
        /// token cost after the first turn. Default: 3.
        /// </summary>
        public int HistoryMessageCount { get; set; } = 3;

        /// <summary>
        /// Token cap for each planner response (the planner only emits a small
        /// JSON action object). The cap counts gpt-5-nano's REASONING tokens
        /// too: at 250 the visible JSON was intermittently truncated/empty
        /// (a silent single-shot RAG fallback), so the cap is 512 — only paid
        /// when the model actually reasons longer. Default: 512.
        /// </summary>
        public int PlanningMaxOutputTokens { get; set; } = 512;

        /// <summary>
        /// Token cap for the final synthesized answer. Default: 800.
        /// </summary>
        public int AnswerMaxOutputTokens { get; set; } = 800;

        /// <summary>
        /// When true the final answer is streamed token-by-token (SSE deltas).
        /// When false it is generated with one normal completion and sent as a
        /// single delta � use this if the deployment's streaming endpoint
        /// never returns data. Default: true.
        /// </summary>
        public bool StreamSynthesis { get; set; } = true;

        /// <summary>
        /// Seconds to wait for the FIRST streamed update before abandoning that
        /// attempt. Healthy requests on this deployment answer in ~2s. Default: 10.
        /// </summary>
        public int FirstTokenTimeoutSeconds { get; set; } = 10;

        /// <summary>
        /// How many fresh streaming requests to try before giving up on
        /// streaming and using one non-streaming completion. A hung streaming
        /// request is abandoned after FirstTokenTimeoutSeconds. Default: 2.
        /// </summary>
        public int StreamAttempts { get; set; } = 2;

        /// <summary>
        /// Sampling temperature for planner calls (low = deterministic JSON).
        /// Default: 0.0.
        /// </summary>
        public float PlanningTemperature { get; set; } = 0.0f;

        /// <summary>
        /// Sampling temperature for the final answer. Default: 0.2.
        /// </summary>
        public float AnswerTemperature { get; set; } = 0.2f;

        /// <summary>
        /// Maximum number of deduplicated sources attached to one answer.
        /// Planner observations stay ~150 tokens/source (600-char Snippet),
        /// while the SYNTHESIS sources block now carries FullExcerpt (up to
        /// 4000 chars ≈ 1000 tokens/source) so methodology sentences at the
        /// end of abstracts reach the synthesizer. Default: 6.
        /// </summary>
        public int MaxSources { get; set; } = 6;

        /// <summary>
        /// How many retrieved passages may be attached per thesis. One:
        /// every answer cites a study at most ONCE (the strongest passage),
        /// so a single document can no longer occupy 3 of the source slots
        /// and show up as "[Source 1] … [Source 2] … [Source 3]" with the
        /// identical title — the sources panel lists studies, not excerpts.
        /// Default: 1.
        /// </summary>
        public int MaxPassagesPerThesis { get; set; } = 1;

        /// <summary>
        /// Hard cap on the length of a single user query accepted by the
        /// agent (characters). Longer queries are truncated. Default: 2000.
        /// </summary>
        public int MaxQueryLength { get; set; } = 2000;

        // ────────────── capacity stack (zero-dollar load shedding) ──────────────

        /// <summary>
        /// How many agent runs (planner + synthesizer LLM calls) may execute
        /// concurrently. Requests beyond this wait in a queue whose position is
        /// surfaced to the user via SSE status frames. Sized to the Azure AI
        /// Foundry gpt-5-nano agent pool (multiple deployments — the real
        /// per-deployment cap lives in AzureAI:Deployments:MaxConcurrency).
        /// Default: 30 (research-month burst target).
        /// </summary>
        public int MaxConcurrentAgentRuns { get; set; } = 30;

        /// <summary>
        /// Hard ceiling on how long one request may sit in the gate queue
        /// before it is shed with a friendly unavailable message (via
        /// LlmUnavailableException). Without a deadline a request behind a
        /// stalled run could wait indefinitely. Default: 45 seconds.
        /// </summary>
        public int MaxGateWaitSeconds { get; set; } = 45;

        /// <summary>
        /// When true, simple factual lookups ("who authored X", "what year was
        /// X", "find studies about X") are answered by retrieval + templates
        /// with ZERO LLM calls. Default: true.
        /// </summary>
        public bool DeterministicFastPathEnabled { get; set; } = true;

        /// <summary>
        /// When true, near-duplicate questions are served from an in-memory
        /// semantic cache (cosine similarity over query embeddings) instead of
        /// running the agent again. Default: true.
        /// </summary>
        public bool SemanticCacheEnabled { get; set; } = true;

        /// <summary>
        /// Cosine similarity required between two query embeddings for the
        /// cache to treat them as the same question. 0.95 = near-duplicate
        /// only (conservative — avoids stale/wrong hits). Default: 0.95.
        /// </summary>
        public float SemanticCacheCosineThreshold { get; set; } = 0.95f;

        /// <summary>How long a cached answer stays valid. Default: 720 hours (30 days).</summary>
        public int SemanticCacheTtlHours { get; set; } = 720;

        /// <summary>Maximum entries kept in the semantic cache (oldest evicted first). Default: 500.</summary>
        public int SemanticCacheMaxEntries { get; set; } = 500;
    }
}