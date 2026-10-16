// server/Services/AI/FoundryAgentBackend.cs
//
// ILlmBackend implementation that talks to an Azure AI Foundry AGENT via the
// Responses API (Azure.AI.Extensions.OpenAI's ProjectResponsesClient, which
// derives from OpenAI.Responses.ResponsesClient). This is the ONLY production
// backend since the Phi-4-mini retirement — gpt-5-nano agents serve both the
// "planner" (strict JSON) and "synth" (prose) stages.
//
// Agent selection: LlmCall.TargetAgent is set by LlmClientPool during routing
// (one pool entry = one Foundry agent). The backend caches one
// ProjectResponsesClient per agent name (clients are cheap wrappers over the
// shared AIProjectClient pipeline).
//
// Instructions: agent system prompts are BAKED into the Foundry agent
// definition (monteai-agent-planner / monteai-agent-synth) — see AgentPrompts.cs.
// Any SystemChatMessage in the call is therefore SKIPPED here; only history,
// few-shot turns and the live user prompt are sent as input items.
//
// Per-request knobs the Responses API allows alongside an agent: only
// MaxOutputTokenCount + input items. Temperature and text format are REJECTED
// (HTTP 400 invalid_payload, "Not allowed when agent is specified") — they
// must be configured on the agent definition itself in Foundry Studio.
// The planner agent MUST have response format = JSON object there, or the
// planner protocol degrades to the single-shot RAG fallback.
//
// This file is the only place allowed to touch preview APIs (OPENAI001/AAIP001).

#pragma warning disable OPENAI001
#pragma warning disable AAIP001

using System.Collections.Concurrent;
using System.Runtime.CompilerServices;
using System.Text;
using Azure.AI.Extensions.OpenAI;
using Azure.AI.Projects;
using Azure.Identity;
using Microsoft.Extensions.Options;
using OpenAI.Chat;
using OpenAI.Responses;
using server.Configuration;

namespace server.Services.AI
{
    public sealed class FoundryAgentBackend : ILlmBackend
    {
        private readonly AIProjectClient _projectClient;
        private readonly LlmPoolConfig _config;
        private readonly ILogger<FoundryAgentBackend> _logger;

        /// <summary>One ProjectResponsesClient per agent name, reused across requests.</summary>
        private readonly ConcurrentDictionary<string, ProjectResponsesClient> _clients = new();

        public FoundryAgentBackend(
            AIProjectClient projectClient,
            IOptions<LlmPoolConfig> config,
            ILogger<FoundryAgentBackend> logger)
        {
            _projectClient = projectClient;
            _config = config.Value;
            _logger = logger;
        }

        public async Task<LlmCompletion> CompleteAsync(LlmCall call, CancellationToken cancellationToken = default)
        {
            var agentName = RequireAgentName(call);
            var client = GetClient(agentName);
            var options = BuildOptions(call);

            ResponseResult response = await client.CreateResponseAsync(options, cancellationToken);

            var text = response.GetOutputText() ?? string.Empty;
            var (inputTokens, outputTokens) = ReadUsage(response);

            _logger.LogDebug(
                "Foundry agent {Agent}: completed ({In}/{Out} tokens, {Chars} chars)",
                agentName, inputTokens, outputTokens, text.Length);

            return new LlmCompletion(text, inputTokens, outputTokens);
        }

        public async IAsyncEnumerable<string> StreamDeltas(
            LlmCall call,
            [EnumeratorCancellation] CancellationToken cancellationToken = default)
        {
            var agentName = RequireAgentName(call);
            var client = GetClient(agentName);
            var options = BuildOptions(call);

            // NOTE: not awaited — CreateResponseStreamingAsync returns the
            // collection itself; enumeration performs the request.
            var updates = client.CreateResponseStreamingAsync(options, cancellationToken);
            await foreach (var update in updates)
            {
                switch (update)
                {
                    case StreamingResponseOutputTextDeltaUpdate delta
                        when !string.IsNullOrEmpty(delta.Delta):
                        yield return delta.Delta;
                        break;

                    case StreamingResponseErrorUpdate error:
                        // Surfaced as an exception so the caller's stall/drop
                        // handling and the pool's cooldown recording apply.
                        throw new InvalidOperationException(
                            $"Foundry agent '{agentName}' stream error: {error.Message}");
                }
            }
        }

        // ────────────────────────── helpers ──────────────────────────

        private ProjectResponsesClient GetClient(string agentName) =>
            _clients.GetOrAdd(agentName, name =>
            {
                _logger.LogInformation("Creating ProjectResponsesClient for Foundry agent {Agent}", name);
                return _projectClient.ProjectOpenAIClient.GetProjectResponsesClientForAgentEndpoint(name);
            });

        private static string RequireAgentName(LlmCall call) =>
            !string.IsNullOrWhiteSpace(call.TargetAgent)
                ? call.TargetAgent
                : throw new InvalidOperationException(
                    "LlmCall.TargetAgent is not set — the pool must route to a specific Foundry agent before calling the backend.");

        private static CreateResponseOptions BuildOptions(LlmCall call)
        {
            // When the request targets a Foundry AGENT, the service rejects
            // (HTTP 400 invalid_payload) any per-request temperature or text
            // format — both are baked into the agent definition ("Not allowed
            // when agent is specified"). Only input items and the output token
            // cap travel per-request.
            var options = new CreateResponseOptions
            {
                MaxOutputTokenCount = call.MaxOutputTokens,
            };

            // System instructions are baked into the Foundry agent — skip any
            // system message so it cannot compete with (or leak past) them.
            foreach (var message in call.Messages)
            {
                switch (message)
                {
                    case SystemChatMessage:
                        break;
                    case UserChatMessage:
                        options.InputItems.Add(ResponseItem.CreateUserMessageItem(ExtractText(message)));
                        break;
                    case AssistantChatMessage:
                        options.InputItems.Add(ResponseItem.CreateAssistantMessageItem(ExtractText(message)));
                        break;
                }
            }

            return options;
        }

        /// <summary>Concatenates the text parts of a chat message (all MonteAI prompts are plain text).</summary>
        private static string ExtractText(ChatMessage message)
        {
            var sb = new StringBuilder();
            var content = message.Content;
            for (var i = 0; i < content.Count; i++)
            {
                var text = content[i]?.Text;
                if (!string.IsNullOrEmpty(text))
                {
                    sb.Append(text);
                }
            }
            return sb.ToString();
        }

        private static (int? Input, int? Output) ReadUsage(ResponseResult response)
        {
            var usage = response.Usage;
            if (usage is null) return (null, null);
            return ((int?)usage.InputTokenCount, (int?)usage.OutputTokenCount);
        }
    }
}
