// server/Services/AI/ILlmBackend.cs
//
// The seam between the MonteAI agent loop and whatever model API actually
// serves a call. MonteAiAgentService speaks only this interface + the OpenAI
// ChatMessage type (already its prompt-assembly currency); each backend
// translates to its native protocol.
//
// Implementations (Scrutor picks these up — namespace server.Services.AI,
// matching interface, scoped lifetime like the rest of the AI services):
//   - FoundryAgentBackend — Azure AI Foundry agent via the Responses API
//     (gpt-5-nano). The ONLY production backend as of the Phi-4-mini
//     retirement; the interface exists so a second model family can be added
//     later as one class + one config entry.
//
// LlmCall.Role selects which stage's configuration applies ("planner" or
// "synth"); backends ignore it except for logging. JsonMode documents intent
// only for AGENT backends — Foundry rejects a per-request text format on
// agent calls, so the planner agent must have response format = JSON baked
// in Foundry Studio (see AgentPrompts.cs header).

using OpenAI.Chat;

namespace server.Services.AI
{
    /// <summary>One LLM invocation requested by the agent loop.</summary>
    /// <param name="Role">"planner" or "synth" — selects pool routing and timeouts.</param>
    /// <param name="Messages">Full message list (system first, when the entry does not bake instructions).</param>
    /// <param name="Temperature">Sampling temperature for this stage.</param>
    /// <param name="MaxOutputTokens">Output token cap for this stage.</param>
    /// <param name="JsonMode">True = server-enforced JSON object output (planner only).</param>
    /// <param name="TargetAgent">
    /// Foundry agent name to call. Set by LlmClientPool during routing — the
    /// agent service never fills this in.
    /// </param>
    public sealed record LlmCall(
        string Role,
        IReadOnlyList<ChatMessage> Messages,
        float Temperature,
        int MaxOutputTokens,
        bool JsonMode,
        string? TargetAgent = null);

    /// <summary>Non-streaming completion result.</summary>
    /// <param name="Text">Raw completion text (may be empty on degenerate responses).</param>
    /// <param name="InputTokens">Prompt tokens, when the backend reports them.</param>
    /// <param name="OutputTokens">Completion tokens, when the backend reports them.</param>
    public sealed record LlmCompletion(
        string Text,
        int? InputTokens,
        int? OutputTokens);

    public interface ILlmBackend
    {
        /// <summary>
        /// Runs one non-streaming completion. Throws on transport failure,
        /// timeout, or a service-reported error — the pool records the failure
        /// against the entry and may fail over to another deployment.
        /// </summary>
        Task<LlmCompletion> CompleteAsync(LlmCall call, CancellationToken cancellationToken = default);

        /// <summary>
        /// Streams the completion as plain text deltas. Yields nothing on an
        /// empty response. A mid-stream service error surfaces as an exception
        /// from the enumerator (the caller's stall/drop handling applies).
        /// </summary>
        IAsyncEnumerable<string> StreamDeltas(LlmCall call, CancellationToken cancellationToken = default);
    }
}
