// server/Models/Agent/AgentModels.cs
//
// Data contracts shared by the agent orchestration layer (kept OUT of the
// Scrutor-scanned server.Services namespaces — they are plain records with no
// matching interfaces):
//
//   ChatController
//       |  AgentChatRequest (query + conversation memory)
//       v
//   MonteAiAgentService  <-- RunAgentLoopAsync uses AgentAction (the planner's
//       |                   parsed JSON decision) and IAgentToolbox
//       |  ToolExecutionResult per step, merged into the source list
//       v
//   AgentChatResult (final answer + ChatSourceDto citations + trace)
//       |
//       +--> non-streaming: returned directly as the persisted assistant message
//       +--> streaming:     surfaced as AgentStreamEvent's (sources -> deltas -> done)

using server.Models.DTOs.ChatMessage;
using System.Text.Json;

namespace server.Models.Agent
{
    /// <summary>One prior conversation turn, replayed into prompts as short-term memory.</summary>
    public record ConversationTurn(string Role, string Content);

    /// <summary>Everything the agent needs to answer one user message.</summary>
    public record AgentChatRequest(string UserQuery, IReadOnlyList<ConversationTurn> History);

    /// <summary>Record of a single tool invocation — used for logging/observability.</summary>
    public record ToolInvocation(string Tool, string ArgumentsJson, string ResultSummary);

    /// <summary>What one tool call produced: text for the LLM ("observation") plus structured citations.</summary>
    public record ToolExecutionResult(string Observation, IReadOnlyList<ChatSourceDto> Sources);

    /// <summary>The final outcome of one agent run.</summary>
    public record AgentChatResult(
        string Answer,
        IReadOnlyList<ChatSourceDto> Sources,
        IReadOnlyList<ToolInvocation> Trace,
        bool UsedFallback);

    /// <summary>
    /// Events emitted by the streaming agent. Order per request:
    /// one <see cref="SourcesDiscovered"/> (may be empty), N <see cref="AnswerDelta"/>,
    /// one <see cref="Completed"/>.
    /// </summary>
    public abstract record AgentStreamEvent
    {
        /// <summary>Emitted once retrieval is done, before the first answer token — lets the UI show citations while the answer streams.</summary>
        public sealed record SourcesDiscovered(IReadOnlyList<ChatSourceDto> Sources) : AgentStreamEvent;

        /// <summary>A fragment of the generated answer.</summary>
        public sealed record AnswerDelta(string Text) : AgentStreamEvent;

        /// <summary>Terminal event carrying the full, grounded result that gets persisted.</summary>
        public sealed record Completed(AgentChatResult Result) : AgentStreamEvent;
    }

    /// <summary>The planner's decision, parsed from its JSON response.</summary>
    public sealed record AgentAction
    {
        public string? Thought { get; init; }

        /// <summary>Name of the tool to call (null when the planner chose to finish).</summary>
        public string? Tool { get; init; }

        /// <summary>Raw JSON object of tool arguments.</summary>
        public JsonElement? ToolArgs { get; init; }

        /// <summary>True when the planner decided no further tool calls are needed.</summary>
        public bool Final { get; init; }
    }
}
