// server/Services/AI/MonteAiAgentService.cs
//
// The MonteAI agent orchestrator — the heart of the "agentic" behaviour.
//
// One user message flows through this service as follows:
//
//   AgentChatRequest (query + conversation memory)
//        │
//        ▼
//   ┌───────────────────────── RunAgentLoopAsync ─────────────────────────┐
//   │  for up to MaxAgentIterations (default 3):                          │
//   │     1. PLANNER (Phi-4-mini, temp 0, capped tokens):                 │
//   │        "given the question + tool results so far, next action?"     │
//   │        -> strict JSON: {"tool": "...", "toolArgs": {...}}           │
//   │                       or {"final": true}                            │
//   │     2. AgentJson.ParseAction — malformed JSON? fall back to RAG.    │
//   │     3. IAgentToolbox.ExecuteAsync — run the chosen tool, collect    │
//   │        its observation (fed back to the planner) and its citations. │
//   │     4. Loop ends on "final", an unparseable step, or the cap.       │
//   └──────────────────────────────────────────────────────────────────────┘
//        │  if NO tool ever ran (e.g. greeting, or agent mode disabled):
//        ▼     one guaranteed semantic_search keeps answers grounded
//   Merge + dedupe sources (by thesis), cap at MaxSources
//        │
//        ▼
//   ┌────────────────────── Synthesis ───────────────────────┐
//   │  SYNTHESIZER (Phi-4-mini, temp 0.2):                   │
//   │  system prompt (citation rules) + memory + question +  │
//   │  numbered sources -> the user-visible answer           │
//   └─────────────────────────────────────────────────────────┘
//        │
//        ▼
//   Grounding pass (free, no LLM call): any [Source n] marker in the answer
//   that does not map to a real retrieved source is stripped.
//        │
//        ▼
//   AgentChatResult { Answer, Sources, Trace, UsedFallback }
//        │
//        ├── non-streaming endpoint: returned as-is
//         └─ streaming endpoint:  SourcesDiscovered -> AnswerDelta* -> Completed
//
// COST CONTROLS (Azure AI Foundry credits):
//   - planner + synthesizer calls are the only paid LLM calls, both token-capped
//   - the query is embedded once per turn and reused by every semantic search
//     (PineconeService re-embeds per call, but the loop caps iterations at 3)
//   - observations are truncated by the toolbox before entering prompts
//   - EnableAgentMode=false collapses everything to one retrieval + one answer

using System.Runtime.CompilerServices;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;
using OpenAI.Chat;
using server.Configuration;
using server.Models.Agent;
using server.Models.DTOs.ChatMessage;
using server.Models.Retrieval;
using server.Services.AI.Agent;
using server.Services.Interfaces;

namespace server.Services.AI
{
    public class MonteAiAgentService : IMonteAiAgentService
    {
        private readonly ChatClient _chatClient;
        private readonly IAgentToolbox _toolbox;
        private readonly IPineconeService _pineconeService;
        private readonly MonteAiAgentConfig _config;
        private readonly ILogger<MonteAiAgentService> _logger;

        /// <summary>Matches the inline citation markers the synthesizer is instructed to emit.</summary>
        private static readonly Regex SourceRefRegex = new(@"\[Source (\d+)\]", RegexOptions.Compiled);

        /// <summary>Internal loop outcome handed from the planning phase to the synthesis phase.</summary>
        private sealed record AgentLoopOutcome(
            IReadOnlyList<ChatSourceDto> Sources,
            IReadOnlyList<ToolInvocation> Trace,
            IReadOnlyList<string> Observations,
            bool UsedFallback);

        public MonteAiAgentService(
            ChatClient chatClient,
            IAgentToolbox toolbox,
            IPineconeService pineconeService,
            IOptions<MonteAiAgentConfig> config,
            ILogger<MonteAiAgentService> logger)
        {
            _chatClient = chatClient;
            _toolbox = toolbox;
            _pineconeService = pineconeService;
            _config = config.Value;
            _logger = logger;
        }

        // ────────────────────── non-streaming entry point ──────────────────────

        /// <inheritdoc />
        public async Task<AgentChatResult> GenerateResponseAsync(AgentChatRequest request, CancellationToken cancellationToken = default)
        {
            var query = SanitizeQuery(request.UserQuery);

            if(IsOutOfScope(query))
            {
                const string refusal = "I'm MonteAI, a thesis research assistant for Colegio de Montalban's institutional repository. " +
                           "I can only help with questions about academic theses and research papers. " +
                           "Try asking something like: *\"What theses are about machine learning in education?\"*";
                return new AgentChatResult(refusal, [], [], false);
            }

            var loop = await RunAgentLoopAsync(query, request.History, cancellationToken);
            var answer = await SynthesizeAsync(query, request.History, loop, cancellationToken);
            answer = EnforceGrounding(answer, loop.Sources.Count);

            return new AgentChatResult(answer, loop.Sources, loop.Trace, loop.UsedFallback);
        }

        // ────────────────────── streaming entry point ──────────────────────

        /// <inheritdoc />
        public async IAsyncEnumerable<AgentStreamEvent> StreamResponseAsync(
            AgentChatRequest request,
            [EnumeratorCancellation] CancellationToken cancellationToken = default)
        {
            var query = SanitizeQuery(request.UserQuery);

            // 1. Planning + tools run to completion first (non-streamed).
            var loop = await RunAgentLoopAsync(query, request.History, cancellationToken);

            // 2. Citations are emitted before the first token so the UI can
            //    render the source panel while the answer streams in.
            yield return new AgentStreamEvent.SourcesDiscovered(loop.Sources);

            // 3. Stream the synthesized answer.
            var answerBuilder = new StringBuilder();
            await foreach (var delta in StreamSynthesisAsync(query, request.History, loop, cancellationToken))
            {
                answerBuilder.Append(delta);
                yield return new AgentStreamEvent.AnswerDelta(delta);
            }

            // 4. Grounding pass + terminal event (the controller persists this).
            var answer = EnforceGrounding(answerBuilder.ToString(), loop.Sources.Count);
            yield return new AgentStreamEvent.Completed(
                new AgentChatResult(answer, loop.Sources, loop.Trace, loop.UsedFallback));
        }
        private static readonly HashSet<string> OutOfScopePatterns = new(StringComparer.OrdinalIgnoreCase)
        {
             "write code", "loop code", "generate code", "fix my code", "debug",
            "write a function", "write a program", "write a script",
            "translate", "essay", "poem", "story", "recipe", "calculate",

            // System prompt extraction — direct
            "system prompt", "your prompt", "your instructions", "your configuration",
            "your config", "your rules", "what were you told", "what is your prompt",
            "print your", "repeat your", "output your", "reveal your", "show your",
            "display your", "share your instructions",

            // System prompt extraction — indirect/creative (#1, #3, #7)
            "simulate a debug", "debug error", "simulate an error",
            "write a story where", "write a poem", "output as a poem",
            "as a poem", "in a poem", "in french", "in spanish", // translate-the-prompt attacks (#5)

            // Structured output attacks (#4)
            "system_prompt", "\"system_prompt\"",

            // Encoding attacks (#6)
            "base64", "encode your", "base64-encode",

            // Anchor compliance attacks (#9)
            "first say", "say ok then", "say \"ok\"",

            // Role-play override (#2)
            "pretend you are", "you are now", "act as", "developer mode",
            "ignore previous", "ignore all previous", "disregard your",
            "you are a helpful assistant that",
        };
        private bool IsOutOfScope(string query)
        {
            return OutOfScopePatterns.Any(p => query.Contains(p, StringComparison.OrdinalIgnoreCase));
        }

        // ────────────────────── phase 1: plan / act / observe ──────────────────────

        /// <summary>
        /// Runs the bounded ReAct-style loop. Guarantees at least one retrieval
        /// attempt even when the planner finishes immediately (greetings) or
        /// fails to produce valid JSON (fallback to classic RAG).
        /// </summary>
        private async Task<AgentLoopOutcome> RunAgentLoopAsync(
            string query,
            IReadOnlyList<ConversationTurn> history,
            CancellationToken ct)
        {
            var observations = new List<string>();
            var sources = new List<ChatSourceDto>();
            var trace = new List<ToolInvocation>();
            var usedFallback = false;
            var calledAnyTool = false;

            if (_config.EnableAgentMode)
            {
                var systemPrompt = AgentPrompts.PlanningSystemPrompt
                    .Replace("{TOOLS}", _toolbox.GetToolManifest())
                    .Replace("{MAX_STEPS}", _config.MaxAgentIterations.ToString());

                for (var step = 0; step < _config.MaxAgentIterations; step++)
                {
                    var messages = BuildPlanningMessages(systemPrompt, query, history, observations);
                    var completion = await _chatClient.CompleteChatAsync(messages, PlanningOptions(), ct);
                    LogUsage("planner", completion.Value.Usage);

                    var action = AgentJson.ParseAction(completion.Value.Content.Count > 0
                        ? completion.Value.Content[0]?.Text
                        : null);

                    if (action is null)
                    {
                        // Small model produced unparseable output — degrade to
                        // single-shot RAG rather than erroring out.
                        usedFallback = true;
                        _logger.LogWarning("Planner returned unparseable JSON on step {Step} — falling back to direct RAG", step + 1);
                        break;
                    }

                    if (action.Final || string.IsNullOrWhiteSpace(action.Tool))
                    {
                        _logger.LogInformation("Planner finished after {Step} steps: {Thought}", step + 1, action.Thought);
                        break;
                    }

                    var result = await _toolbox.ExecuteAsync(action.Tool!, action.ToolArgs, ct);
                    calledAnyTool = true;
                    observations.Add(result.Observation);
                    sources = MergeSources(sources, result.Sources);
                    trace.Add(new ToolInvocation(
                        action.Tool!,
                        AgentJson.ArgsToString(action.ToolArgs),
                        Summarize(result)));

                    if (sources.Count >= _config.MaxSources)
                    {
                        _logger.LogInformation("Source cap ({Cap}) reached — ending agent loop early", _config.MaxSources);
                        break;
                    }
                }
            }
            else
            {
                usedFallback = true;
            }

            // Grounding guarantee: if no tool ran (greeting, immediate "final",
            // or agent mode disabled), still attempt one semantic search so
            // research questions can never be answered without retrieval.
            if (!calledAnyTool)
            {
                var chunks = await _pineconeService.RetrieveRelevantChunksAsync(query, cancellationToken: ct);
                var fallbackSources = chunks.Select(ToSource).ToList();
                observations.Add($"semantic_search (automatic): {chunks.Count} passages retrieved for the original question.");
                sources = MergeSources(sources, fallbackSources);
            }

            return new AgentLoopOutcome(sources, trace, observations, usedFallback);
        }

        // ────────────────────── phase 2: synthesis ──────────────────────

        private async Task<string> SynthesizeAsync(
            string query,
            IReadOnlyList<ConversationTurn> history,
            AgentLoopOutcome loop,
            CancellationToken ct)
        {
            var messages = BuildAnswerMessages(query, history, loop);
            var completion = await _chatClient.CompleteChatAsync(messages, AnswerOptions(), ct);
            LogUsage("synthesizer", completion.Value.Usage);

            return (completion.Value.Content.Count > 0
                ? completion.Value.Content[0]?.Text
                : null)?.Trim() ?? "I could not generate a response. Please try rephrasing your question.";
        }

        private async IAsyncEnumerable<string> StreamSynthesisAsync(
            string query,
            IReadOnlyList<ConversationTurn> history,
            AgentLoopOutcome loop,
            [EnumeratorCancellation] CancellationToken ct = default)
        {
            var messages = BuildAnswerMessages(query, history, loop);
            var updates = _chatClient.CompleteChatStreamingAsync(messages, AnswerOptions(), ct);

            await foreach (var update in updates)
            {
                var content = update.ContentUpdate;
                for (var i = 0; i < content.Count; i++)
                {
                    var text = content[i]?.Text;
                    if (!string.IsNullOrEmpty(text))
                    {
                        yield return text;
                    }
                }
            }
        }

        // ────────────────────── grounding ──────────────────────

        /// <summary>
        /// Structural hallucination guard (free, no extra LLM call): strips any
        /// [Source n] citation that does not reference a real retrieved source.
        /// </summary>
        private string EnforceGrounding(string answer, int sourceCount)
        {
            if (sourceCount == 0) return answer;

            var stripped = 0;
            var enforced = SourceRefRegex.Replace(answer, match =>
            {
                var valid = int.TryParse(match.Groups[1].Value, out var n) && n >= 1 && n <= sourceCount;
                if (!valid) stripped++;
                return valid ? match.Value : string.Empty;
            });

            if (stripped > 0)
            {
                _logger.LogWarning("Grounding pass removed {Count} invalid source citations", stripped);
            }

            return enforced;
        }

        // ────────────────────── prompt assembly ──────────────────────

        private List<ChatMessage> BuildPlanningMessages(
            string systemPrompt,
            string query,
            IReadOnlyList<ConversationTurn> history,
            IReadOnlyList<string> observations)
        {
            var messages = new List<ChatMessage> { new SystemChatMessage(systemPrompt) };

            // ORDER MATTERS (validated against the live Phi-4-mini deployment):
            //   1. real conversation memory FIRST
            //   2. few-shot protocol examples SECOND (adjacent to the question)
            //   3. the current planning step LAST
            // Placing history after the few-shot block made the planner treat
            // the conversation as finished and answer {"final": true} to
            // research questions without calling any tool.
            messages.AddRange(ToChatMessages(history));

            // Few-shot protocol examples as REAL turns — the pattern priming
            // that makes Phi-4-mini emit the correct JSON schema (see
            // AgentPrompts header for the validation notes).
            foreach (var (exampleUser, exampleAssistant) in AgentPrompts.PlanningFewShot)
            {
                messages.Add(new UserChatMessage(exampleUser));
                messages.Add(new AssistantChatMessage(exampleAssistant));
            }

            // The current planning step (mirrors the fourth few-shot input shape).
            messages.Add(new UserChatMessage(AgentPrompts.BuildPlanningUserPrompt(query, observations)));
            return messages;
        }

        private List<ChatMessage> BuildAnswerMessages(
            string query,
            IReadOnlyList<ConversationTurn> history,
            AgentLoopOutcome loop)
        {
            var messages = new List<ChatMessage> { new SystemChatMessage(AgentPrompts.AnswerSystemPrompt) };
            messages.AddRange(ToChatMessages(history));
            messages.Add(new UserChatMessage(AgentPrompts.BuildAnswerUserPrompt(query, BuildSourcesBlock(loop.Sources), loop.Observations)));
            return messages;
        }

        /// <summary>Replays conversation memory (capped) as real chat turns.</summary>
        private List<ChatMessage> ToChatMessages(IReadOnlyList<ConversationTurn> history)
        {
            var capped = history.Count > _config.HistoryMessageCount
                ? history.Skip(history.Count - _config.HistoryMessageCount).ToList()
                : history.ToList();

            var messages = new List<ChatMessage>(capped.Count);
            foreach (var turn in capped)
            {
                if (string.IsNullOrWhiteSpace(turn.Content)) continue;
                messages.Add(string.Equals(turn.Role, "assistant", StringComparison.OrdinalIgnoreCase)
                    ? new AssistantChatMessage(turn.Content)
                    : new UserChatMessage(turn.Content));
            }
            return messages;
        }

        /// <summary>Renders the numbered source block the synthesizer cites with [Source n].</summary>
        private static string BuildSourcesBlock(IReadOnlyList<ChatSourceDto> sources)
        {
            if (sources.Count == 0)
            {
                return "(No sources were retrieved. If the question is a greeting or small talk, reply conversationally; otherwise state that the repository has no relevant material and suggest broadening the question.)";
            }

            var sb = new StringBuilder();
            for (var i = 0; i < sources.Count; i++)
            {
                var s = sources[i];
                sb.Append("[Source ").Append(i + 1).Append("]\n")
                  .Append("  Title: ").Append(s.Title ?? "Untitled").Append('\n')
                  .Append("  Author(s): ").Append(string.IsNullOrWhiteSpace(s.Authors) ? "Unknown" : s.Authors).Append('\n')
                  .Append("  Year: ").Append(string.IsNullOrWhiteSpace(s.PublicationYear) ? "n.d." : s.PublicationYear).Append('\n')
                  .Append("  ThesisId: ").Append(s.ThesisId ?? "n/a").Append('\n')
                  .Append("  Excerpt: ").Append(s.Snippet ?? "(no excerpt)").Append('\n');
            }
            return sb.ToString();
        }

        // ────────────────────── helpers ──────────────────────

        /// <summary>
        /// Planner call options. The JSON response format is REQUIRED: it is
        /// the server-enforced half of the validated Phi-4-mini recipe (see
        /// AgentPrompts header) — without it the model answers in prose and
        /// every request would degrade to the fallback path.
        /// </summary>
        private ChatCompletionOptions PlanningOptions() => new()
        {
            Temperature = _config.PlanningTemperature,
            MaxOutputTokenCount = _config.PlanningMaxOutputTokens,
            ResponseFormat = ChatResponseFormat.CreateJsonObjectFormat(),
        };

        private ChatCompletionOptions AnswerOptions() => new()
        {
            Temperature = _config.AnswerTemperature,
            MaxOutputTokenCount = _config.AnswerMaxOutputTokens,
        };

        private string SanitizeQuery(string query)
        {
            var trimmed = query.Trim();
            return trimmed.Length > _config.MaxQueryLength ? trimmed[.._config.MaxQueryLength] : trimmed;
        }

        /// <summary>Merges new sources into the list, deduplicating per thesis and keeping the strongest matches first.</summary>
        private List<ChatSourceDto> MergeSources(List<ChatSourceDto> current, IReadOnlyList<ChatSourceDto> additions)
        {
            var merged = new List<ChatSourceDto>(current);
            foreach (var source in additions)
            {
                var key = source.ThesisId ?? source.Title ?? source.Url ?? Guid.NewGuid().ToString();
                if (merged.Any(existing =>
                        (existing.ThesisId ?? existing.Title ?? existing.Url) == key))
                {
                    continue;
                }
                merged.Add(source);
            }

            return merged
                .OrderByDescending(s => s.Score ?? 0)
                .Take(_config.MaxSources)
                .ToList();
        }

        private static ChatSourceDto ToSource(Chunk chunk) => new()
        {
            ThesisId = chunk.ThesisId,
            Title = chunk.Title,
            Authors = chunk.Authors,
            PublicationYear = chunk.PublicationYear,
            Snippet = chunk.Text.Length > 400 ? chunk.Text[..400] + "…" : chunk.Text,
            Score = double.TryParse(chunk.RelevanceScore, out var score) ? score : null,
            Url = chunk.Url,
        };

        private static string Summarize(ToolExecutionResult result)
            => result.Observation.Length > 200 ? result.Observation[..200] + "…" : result.Observation;

        private void LogUsage(string stage, ChatTokenUsage? usage)
            => _logger.LogInformation(
                "MonteAI agent ({Stage}) — input tokens: {In}, output tokens: {Out}",
                stage, usage?.InputTokenCount, usage?.OutputTokenCount);
    }
}
