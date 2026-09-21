using server.Models.Agent;

// server/Services/Interfaces/IMonteAiAgentService.cs
//
// The MonteAI conversational agent. Replaces the old single-shot
// IMonteAiResponseService: instead of "embed -> retrieve -> answer once",
// the agent plans, calls tools, observes, and only then synthesizes a
// citation-grounded answer — with conversation memory of prior turns.

namespace server.Services.Interfaces
{
    public interface IMonteAiAgentService
    {
        /// <summary>
        /// Runs the full agent loop and returns the completed answer with its
        /// citations. Used by the non-streaming chat endpoint.
        /// </summary>
        Task<AgentChatResult> GenerateResponseAsync(
            AgentChatRequest request,
            CancellationToken cancellationToken = default);

        /// <summary>
        /// Runs the agent loop, then streams the synthesized answer token by
        /// token. Event order: SourcesDiscovered, N x AnswerDelta, Completed.
        /// Used by the SSE chat endpoint.
        /// </summary>
        IAsyncEnumerable<AgentStreamEvent> StreamResponseAsync(
            AgentChatRequest request,
            CancellationToken cancellationToken = default);
    }
}
