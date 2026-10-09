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
        /// iteration costs one Phi-4-mini planning call plus any tool calls.
        /// Default: 3.
        /// </summary>
        public int MaxAgentIterations { get; set; } = 3;

        /// <summary>
        /// How many prior chat messages (user + assistant turns) are replayed
        /// into the planner and synthesizer prompts as conversation memory.
        /// Default: 10.
        /// </summary>
        public int HistoryMessageCount { get; set; } = 10;

        /// <summary>
        /// Token cap for each planner response (the planner only emits a small
        /// JSON action object). Default: 250.
        /// </summary>
        public int PlanningMaxOutputTokens { get; set; } = 250;

        /// <summary>
        /// Token cap for the final synthesized answer. Default: 800.
        /// </summary>
        public int AnswerMaxOutputTokens { get; set; } = 800;

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
        /// Protects both the prompt size and the citation panel in the UI.
        /// Default: 8.
        /// </summary>
        public int MaxSources { get; set; } = 8;

        /// <summary>
        /// Hard cap on the length of a single user query accepted by the
        /// agent (characters). Longer queries are truncated. Default: 2000.
        /// </summary>
        public int MaxQueryLength { get; set; } = 2000;
    }
}
