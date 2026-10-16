// server/Configuration/LlmPoolConfig.cs
//
// Configuration for the LLM deployment pool — the set of Azure AI Foundry
// agents (gpt-5-nano and any future model) that the MonteAI agent loop calls
// for its "planner" and "synth" stages.
//
// Bound from the "AzureAI" section of appsettings*.json. ProjectEndpoint is
// the Foundry project URL; AgentName must match an agent you created in that
// project (each agent bakes its own instructions — see LlmPoolConfig remarks
// in Program.cs and the AgentPrompts.cs header).
//
// Adding capacity = adding an entry here (each entry gets its own semaphore
// of MaxConcurrency permits and its own cooldown tracking). Removing a model
// = deleting its entry. No code changes.

using System.ComponentModel.DataAnnotations;

namespace server.Configuration
{
    public class LlmPoolConfig
    {
        public const string SectionName = "AzureAI";

        /// <summary>
        /// Foundry project endpoint:
        /// https://{resource}.services.ai.azure.com/api/projects/{project}
        /// </summary>
        public string ProjectEndpoint { get; set; } = string.Empty;

        /// <summary>One entry per poolable agent deployment.</summary>
        public List<LlmPoolEntry> Deployments { get; set; } = new();
    }

    public class LlmPoolEntry
    {
        /// <summary>Stable name for logs/traces (e.g. "nano-planner").</summary>
        [Required]
        public string Name { get; set; } = string.Empty;

        /// <summary>Foundry agent name this entry calls (e.g. "monteai-agent-planner").</summary>
        [Required]
        public string AgentName { get; set; } = string.Empty;

        /// <summary>
        /// Which agent-loop stages this entry may serve: "planner", "synth",
        /// or both. The pool never routes a call to an entry whose Roles does
        /// not contain the requested stage.
        /// </summary>
        public List<string> Roles { get; set; } = new();

        /// <summary>
        /// Concurrent calls allowed against this entry. Sizing for a 30-user
        /// burst: planner entries ~8 (short JSON calls), synth entries ~12
        /// (longer streaming calls). Default: 4.
        /// </summary>
        public int MaxConcurrency { get; set; } = 4;

        /// <summary>
        /// Per-call network timeout. Planner defaults to 20s (fail fast, the
        /// loop degrades to single-shot RAG); synth defaults to 30s. Default: 30.
        /// </summary>
        public int TimeoutSeconds { get; set; } = 30;

        /// <summary>
        /// Kept for config symmetry/future non-agent backends. With Foundry
        /// AGENT endpoints this has no per-request effect: the service rejects
        /// a text format on agent calls ("Not allowed when agent is
        /// specified") — the planner agent must be configured with response
        /// format = JSON object in Foundry Studio instead. Default: false.
        /// </summary>
        public bool JsonMode { get; set; }
    }
}
