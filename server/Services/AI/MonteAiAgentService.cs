// server/Services/AI/MonteAiAgentService.cs
//
// The MonteAI agent orchestrator — the heart of the "agentic" behaviour.
//
// One user message flows through increasingly expensive paths; the first
// match wins, so most research-month traffic never reaches the LLM:
//
//   1. DETERMINISTIC FAST PATH (zero LLM calls):
//      "who authored X" / "what year was X" / "find studies about X"
//      -> one retrieval + string template.
//   2. SEMANTIC ANSWER CACHE (zero LLM calls):
//      near-duplicate of a recent question (cosine >= 0.95 on query
//      embeddings) -> previously grounded answer served instantly.
//   3. AGENT PIPELINE (LLM calls, gated + pool-protected):
//        ┌───────────────────── RunAgentLoopEventsAsync ─────────────────┐
//        │ for up to MaxAgentIterations (default 3):                     │
//        │    1. PLANNER (Foundry gpt-5-nano agent, strict JSON):        │
//        │       -> {"tool": "...", "toolArgs": {...},                   │
//        │           "needsMore": true|false}                            │
//        │                      or {"final": true}                       │
//        │    2. Run the chosen tool; needsMore=false ends the loop      │
//        │       right after this one tool (no confirm-planner call).    │
//        │    3. Empty results earn one retry turn regardless.           │
//        │ if NO tool ever ran: one guaranteed semantic_search fallback. │
//        └───────────────────────────────────────────────────────────────┘
//        -> SYNTHESIZER (Foundry gpt-5-nano agent, temp 0.2) streams the grounded answer
//        -> answer is stored in the semantic cache for future near-duplicates
//
// CAPACITY CONTROLS (gpt-5-nano Foundry agents, multiple deployments):
//   - AgentConcurrencyGate: MaxConcurrentAgentRuns permits; queued users see
//     "about N ahead of you…" status frames, shed after MaxGateWaitSeconds.
//   - LlmClientPool: per-deployment concurrency caps, least-outstanding
//     routing and escalating cool-downs; a pool-wide outage throws
//     LlmUnavailableException so ChatController answers 503 / SSE "error".
//   - Per-user ChatLimit (Program.cs) caps each user's messages/minute.
//   - Planner/synthesizer calls are token-capped; observations truncated.

using System.Diagnostics;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;
using OpenAI.Chat;
using server.Configuration;
using server.Infrastructure;
using server.Models.Agent;
using server.Models.DTOs.ChatMessage;
using server.Models.Retrieval;
using server.Services.AI.Agent;
using server.Services.Interfaces;

namespace server.Services.AI
{
    public class MonteAiAgentService : IMonteAiAgentService
    {
        // All LLM traffic flows through the pool (per-deployment concurrency,
        // least-outstanding routing, cool-downs — see LlmClientPool). The
        // planner vs synthesizer distinction survives as LlmCall.Role, which
        // selects the pool entry, timeout and response format.
        private readonly ILlmClientPool _pool;
        private readonly IAgentToolbox _toolbox;
        private readonly IPineconeService _pineconeService;
        private readonly IDeterministicResponder _deterministic;
        private readonly ISemanticAnswerCache _cache;
        private readonly IAgentConcurrencyGate _gate;
        private readonly IThesisMetadataResolver _metadataResolver;
        private readonly MonteAiAgentConfig _config;
        private readonly ILogger<MonteAiAgentService> _logger;

        /// <summary>Scope refusal reused by both entry points.</summary>
        private const string RefusalText =
            "I'm MonteAI, a thesis research assistant for Colegio de Montalban's institutional repository. " +
            "I can only help with questions about academic theses and research papers. " +
            "Try asking something like: *\"What theses are about renewable energy?\"*";

        /// <summary>Harmful-content refusal (slurs, threats, harassment — see QueryModeration).</summary>
        private const string HarmfulRefusalText =
            "I can't help with that message. MonteAI is a thesis research assistant for Colegio de Montalban's " +
            "institutional repository — please keep this conversation respectful and research-focused. " +
            "Try asking something like: *\"What theses are about research assistant??\"*";

        /// <summary>Appended when the model stream dies mid-answer; also excluded from the cache.</summary>
        private const string MidStreamDropNotice =
            "\n\n*(The connection to the model dropped mid-answer — it may be incomplete. Ask again to regenerate.)*";

        /// <summary>Matches the inline citation markers the synthesizer is instructed to emit.</summary>
        private static readonly Regex SourceRefRegex = new(@"\[Source (\d+)\]", RegexOptions.Compiled);

        /// <summary>Internal loop outcome handed from the planning phase to the synthesis phase.</summary>
        private sealed record AgentLoopOutcome(
            IReadOnlyList<ChatSourceDto> Sources,
            IReadOnlyList<ToolInvocation> Trace,
            IReadOnlyList<string> Observations,
            bool UsedFallback);

        /// <summary>Terminal item of the loop event stream (pairs with AgentStreamEvent.Status frames).</summary>
        private sealed record LoopCompleted(AgentLoopOutcome Outcome);

        public MonteAiAgentService(
            ILlmClientPool pool,
            IAgentToolbox toolbox,
            IPineconeService pineconeService,
            IDeterministicResponder deterministic,
            ISemanticAnswerCache cache,
            IAgentConcurrencyGate gate,
            IThesisMetadataResolver metadataResolver,
            IOptions<MonteAiAgentConfig> config,
            ILogger<MonteAiAgentService> logger)
        {
            _pool = pool;
            _toolbox = toolbox;
            _pineconeService = pineconeService;
            _deterministic = deterministic;
            _cache = cache;
            _gate = gate;
            _metadataResolver = metadataResolver;
            _config = config.Value;
            _logger = logger;
        }

        // ────────────────────── non-streaming entry point ──────────────────────

        /// <inheritdoc />
        public async Task<AgentChatResult> GenerateResponseAsync(AgentChatRequest request, CancellationToken cancellationToken = default)
        {
            // Single pipeline: drain the streaming events, keeping only the
            // terminal result (Status/Delta frames are ignored).
            AgentChatResult? result = null;
            await foreach (var evt in StreamResponseAsync(request, cancellationToken))
            {
                if (evt is AgentStreamEvent.Completed completed)
                {
                    result = completed.Result;
                }
            }

            return result ?? new AgentChatResult(
                "I could not generate a response. Please try rephrasing your question.", [], [], true);
        }

        // ────────────────────── streaming entry point ──────────────────────

        /// <inheritdoc />
        public async IAsyncEnumerable<AgentStreamEvent> StreamResponseAsync(
            AgentChatRequest request,
            [EnumeratorCancellation] CancellationToken cancellationToken = default)
        {
            var query = SanitizeQuery(request.UserQuery);

            // 0. Harmful content — refuse before anything else runs (no
            //    retrieval, no LLM, no cache). Checked ahead of the scope
            //    patterns so "fuck you write code" gets the harm refusal, not
            //    the off-topic one. Also never recorded into analytics
            //    (QueryModeration.IsHarmful is the same gate).
            var queryClass = QueryModeration.Classify(query);
            if (queryClass == QueryClass.Harmful)
            {
                _logger.LogInformation("Blocked harmful chat query");
                yield return new AgentStreamEvent.Completed(new AgentChatResult(HarmfulRefusalText, [], [], false));
                yield break;
            }

            if (IsOutOfScope(query))
            {
                yield return new AgentStreamEvent.Completed(new AgentChatResult(RefusalText, [], [], false));
                yield break;
            }

            // 1b. Non-follow-up noise — greetings, thanks, identity small
            //     talk ("who are you?"), keyboard gibberish. Retrieval on
            //     these attaches unrelated above-threshold theses as Sources
            //     (semantic_search("Hello") matches the catalog), so they
            //     skip the deterministic path, cache, gate and agent loop
            //     entirely: synthesis runs with an empty sources block and
            //     BuildSourcesBlock's greeting rule produces a warm reply.
            //     Meta follow-ups ("expand your previous answer", "more about
            //     it") ARE classified Noise but must keep the full pipeline
            //     so retrieval can blend with the previous user question.
            var isFollowUp = ContextDependentFollowUp.IsMatch(query);
            var skipRetrieval = queryClass == QueryClass.Noise && !isFollowUp;
            if (skipRetrieval)
            {
                _logger.LogInformation("Noise query — answering with synthesis only (no retrieval)");
                var noiseOutcome = new AgentLoopOutcome([], [], [], false);
                yield return new AgentStreamEvent.SourcesDiscovered([]);
                yield return new AgentStreamEvent.Status("Writing your answer…");
                var noiseBuilder = new StringBuilder();
                await foreach (var delta in StreamSynthesisAsync(query, request.History, noiseOutcome, cancellationToken))
                {
                    noiseBuilder.Append(delta);
                    yield return new AgentStreamEvent.AnswerDelta(delta);
                }
                // Never cached: every session greets with the same words.
                yield return new AgentStreamEvent.Completed(
                    new AgentChatResult(noiseBuilder.ToString(), [], [], false, UsedLlm: true));
                yield break;
            }

            // 1. Deterministic fast path — retrieval + template, zero LLM calls.
            if (_config.DeterministicFastPathEnabled)
            {
                var deterministic = await _deterministic.TryAnswerAsync(query, cancellationToken);
                if (deterministic is not null)
                {
                    _logger.LogInformation("Deterministic fast path answered without LLM calls");
                    yield return new AgentStreamEvent.SourcesDiscovered(deterministic.Sources);
                    yield return new AgentStreamEvent.AnswerDelta(deterministic.Answer);
                    yield return new AgentStreamEvent.Completed(
                        new AgentChatResult(deterministic.Answer, deterministic.Sources, [], false));
                    yield break;
                }
            }

            // 2. Semantic cache — near-duplicate of a recent question, zero LLM calls.
            //    Topic-void follow-ups ("tell me more about the source you
            //    provided") mean the same words on every topic — a cache hit
            //    would replay one session's answer for another topic's
            //    conversation, so those queries bypass read AND write.
            //    (isFollowUp was computed with the noise gate in step 1b.)
            var cached = isFollowUp ? null : await _cache.TryGetAsync(query, cancellationToken);
            if (cached is not null)
            {
                // Cached citations may predate the author-resolution fix —
                // fill their author/year from SQL/Firestore (memoized; a no-op
                // when already complete) so the Sources panel never shows
                // "Unknown" for a resolvable thesis. Deep-copied so the shared
                // cache entry is not mutated by concurrent requests.
                var cachedSources = cached.Sources
                    .Select(s => new ChatSourceDto
                    {
                        ThesisId = s.ThesisId,
                        Title = s.Title,
                        Authors = s.Authors,
                        PublicationYear = s.PublicationYear,
                        Snippet = s.Snippet,
                        Score = s.Score,
                        Url = s.Url,
                    })
                    .ToList();
                await _metadataResolver.EnrichAsync(cachedSources, cancellationToken);

                yield return new AgentStreamEvent.SourcesDiscovered(cachedSources);
                yield return new AgentStreamEvent.Status("Answer ready — served from cache");
                yield return new AgentStreamEvent.AnswerDelta(cached.Answer);
                yield return new AgentStreamEvent.Completed(
                    new AgentChatResult(cached.Answer, cachedSources, [], false));
                yield break;
            }

            // 3. Agent pipeline under the concurrency gate. WaitAsync completes
            //    synchronously when a permit is free; under load we surface the
            //    queue depth as status frames while waiting, and shed the
            //    request (friendly unavailable message) once it has waited
            //    MaxGateWaitSeconds without a permit.
            var waitTask = _gate.WaitAsync(cancellationToken);
            var gateDeadline = DateTime.UtcNow.AddSeconds(Math.Max(1, _config.MaxGateWaitSeconds));
            while (!waitTask.IsCompleted)
            {
                if (DateTime.UtcNow >= gateDeadline)
                {
                    // Do not leak the permit when it eventually arrives: hand
                    // the eventual Releaser straight back to the gate.
                    _ = waitTask.ContinueWith(
                        t => { if (t.Status == TaskStatus.RanToCompletion) t.Result.Dispose(); },
                        CancellationToken.None,
                        TaskContinuationOptions.ExecuteSynchronously,
                        TaskScheduler.Default);
                    throw new LlmUnavailableException(
                        "The AI assistant is at capacity right now — too many requests are in the queue. " +
                        "Please try again in about a minute.");
                }

                yield return new AgentStreamEvent.Status(
                    $"The AI assistant is busy — about {Math.Max(1, _gate.WaitingCount)} ahead of you…");
                await Task.WhenAny(waitTask, Task.Delay(2500, cancellationToken));
            }
            using var gateReleaser = await waitTask;

            AgentLoopOutcome? loop = null;
            await foreach (var item in RunAgentLoopEventsAsync(query, request.History, cancellationToken))
            {
                switch (item)
                {
                    case AgentStreamEvent.Status status:
                        yield return status;
                        break;
                    case LoopCompleted completed:
                        loop = completed.Outcome;
                        break;
                }
            }

            // 4. Citations before the first token, then stream the synthesis.
            yield return new AgentStreamEvent.SourcesDiscovered(loop!.Sources);
            yield return new AgentStreamEvent.Status("Writing your answer…");

            var answerBuilder = new StringBuilder();
            await foreach (var delta in StreamSynthesisAsync(query, request.History, loop, cancellationToken))
            {
                answerBuilder.Append(delta);
                yield return new AgentStreamEvent.AnswerDelta(delta);
            }

            // 5. Grounding pass, cache store, terminal event.
            var answer = EnforceGrounding(answerBuilder.ToString(), loop.Sources.Count);
            // Never cache a dropped-stream partial — nor a topic-void
            // follow-up, whose raw text is shared across sessions/topics.
            if (!answer.Contains(MidStreamDropNotice, StringComparison.Ordinal) && !isFollowUp)
            {
                await _cache.RememberAsync(query, answer, loop.Sources, cancellationToken);
            }

            yield return new AgentStreamEvent.Completed(
                new AgentChatResult(answer, loop.Sources, loop.Trace, loop.UsedFallback, UsedLlm: true));
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
        /// Runs the bounded ReAct-style loop as an event stream: Status frames
        /// while planning/tools run, terminated by <see cref="LoopCompleted"/>.
        /// The planner signals "needsMore": true only when a second tool is
        /// genuinely required; otherwise the loop ends after ONE tool and
        /// synthesis runs directly (halving LLM calls per normal turn).
        /// Guarantees at least one retrieval attempt even when the planner
        /// finishes immediately (greetings) or fails to produce valid JSON
        /// (fallback to classic RAG).
        /// </summary>
        private async IAsyncEnumerable<object> RunAgentLoopEventsAsync(
            string query,
            IReadOnlyList<ConversationTurn> history,
            [EnumeratorCancellation] CancellationToken ct)
        {
            var observations = new List<string>();
            var sources = new List<ChatSourceDto>();
            var trace = new List<ToolInvocation>();
            var usedFallback = false;
            var calledAnyTool = false;

            if (_config.EnableAgentMode)
            {
                yield return new AgentStreamEvent.Status("Understanding your question…");

                for (var step = 0; step < _config.MaxAgentIterations; step++)
                {
                    var messages = BuildPlanningMessages(query, history, observations);

                    // A planner timeout / transport failure must not kill the
                    // whole request: degrade to the guaranteed single-shot
                    // retrieval below, exactly like unparseable planner JSON.
                    // A pool-wide outage (every entry cooling down) instead
                    // fails fast — synthesis could not run either.
                    // (No `yield` inside this try/catch — required in iterators.)
                    LlmCompletion completion;
                    try
                    {
                        completion = await _pool.CompleteAsync(new LlmCall(
                            Role: "planner",
                            Messages: messages,
                            Temperature: _config.PlanningTemperature,
                            MaxOutputTokens: _config.PlanningMaxOutputTokens,
                            JsonMode: true), ct);
                    }
                    catch (LlmUnavailableException)
                    {
                        throw;
                    }
                    catch (Exception ex) when (!ct.IsCancellationRequested)
                    {
                        usedFallback = true;
                        _logger.LogWarning(ex, "Planner call failed on step {Step} — falling back to direct RAG", step + 1);
                        break;
                    }
                    LogUsage("planner", completion);

                    var action = AgentJson.ParseAction(
                        string.IsNullOrEmpty(completion.Text) ? null : completion.Text);

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

                    yield return new AgentStreamEvent.Status(StatusForTool(action.Tool!));

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

                    // One-tool default: end the loop right after this tool
                    // unless the planner explicitly asked for another one
                    // ("needsMore": true). This replaces the old confirm-
                    // planner call, which in practice just repeated {"final":
                    // true} and doubled the LLM cost of a normal turn. Empty
                    // results earn one extra planner turn so a failed first
                    // search can still be retried with a different tool.
                    if (!action.NeedsMore &&
                        (result.Sources.Count > 0 || step == _config.MaxAgentIterations - 1))
                    {
                        _logger.LogInformation(
                            "Planner needsMore=false after {Tool} — ending loop at step {Step}",
                            action.Tool, step + 1);
                        break;
                    }
                }
            }
            else
            {
                usedFallback = true;
            }

            if (!calledAnyTool)
            {
                // Grounding guarantee: no tool ran (greeting, immediate "final",
                // or agent mode disabled) — one retrieval keeps the answer
                // grounded in the repository. A topic-void follow-up ("tell me
                // more about the source you provided") is blended with the
                // previous user question so this guaranteed retrieval stays on
                // the conversation's topic — the raw meta-phrase semantically
                // matches this repository's own MonteAI thesis (whose chapter
                // text is about sources, citations and research assistants).
                var fallbackQuery = query;
                var previousUserQuestion = LastUserQuestion(history);
                if (previousUserQuestion is not null && ContextDependentFollowUp.IsMatch(query))
                {
                    fallbackQuery = BlendWithHistory(previousUserQuestion, query);
                }
                var fallbackSources = (await _pineconeService.RetrieveRelevantChunksAsync(fallbackQuery, cancellationToken: ct))
                    .Select(ToSource).ToList();
                observations.Add($"semantic_search (automatic): {fallbackSources.Count} passages retrieved for the original question.");
                sources = MergeSources(sources, fallbackSources);
            }

            // ONE enrichment point for the merged list (id-memoized, so the
            // toolbox's earlier enrichments are free here): fills whatever the
            // single-shot fallback or older vectors still lack, BEFORE
            // SourcesDiscovered, the synthesis prompt, the semantic cache and
            // the persisted SourcesJson all consume this list — this is what
            // turns "Author(s): Unknown" into "Author(s): Dela Cruz | Year:
            // 2024" so the synthesizer writes "Dela Cruz et al. (2024)…".
            await _metadataResolver.EnrichAsync(sources, ct);

            yield return new LoopCompleted(new AgentLoopOutcome(sources, trace, observations, usedFallback));
        }

        /// <summary>User-facing progress text for one planner tool choice.</summary>
        private static string StatusForTool(string toolName) => toolName switch
        {
            "semantic_search" => "Searching the repository…",
            "keyword_search" => "Running keyword search…",
            "thesis_metadata" => "Looking up thesis details…",
            _ => "Running a repository search…",
        };

        // ────────────────────── phase 2: synthesis ──────────────────────

        /// <summary>
        /// Streams the synthesized answer, guarded against hung requests.
        /// Observed on this deployment: some streaming requests get NO bytes at
        /// all (a hang), while a fresh request answers within ~2s. So each
        /// attempt only waits FirstTokenTimeoutSeconds for its first update;
        /// on a stall it is abandoned and a brand-new streaming request is sent
        /// (up to StreamAttempts). A drop AFTER the first token is not retried
        /// (tokens already reached the client) — the partial is kept, a drop
        /// notice is appended, and such partials are excluded from the semantic
        /// cache. If every attempt stalls before the first token, the answer is
        /// made with one normal (non-streaming) completion and emitted as a
        /// single delta. StreamSynthesis=false skips streaming entirely.
        /// </summary>
        private async IAsyncEnumerable<string> StreamSynthesisAsync(
            string query,
            IReadOnlyList<ConversationTurn> history,
            AgentLoopOutcome loop,
            [EnumeratorCancellation] CancellationToken ct = default)
        {
            var messages = BuildAnswerMessages(query, history, loop);

            // One LlmCall description reused by every attempt — the pool
            // resolves the actual Foundry agent/timeout per attempt.
            var synthCall = new LlmCall(
                Role: "synth",
                Messages: messages,
                Temperature: _config.AnswerTemperature,
                MaxOutputTokens: _config.AnswerMaxOutputTokens,
                JsonMode: false);

            var promptChars = messages.Sum(m => m.Content.Sum(c => c.Text?.Length ?? 0));
            var stopwatch = Stopwatch.StartNew();
            _logger.LogInformation("MonteAI synthesis starting — prompt ≈ {Chars} chars", promptChars);

            if (_config.StreamSynthesis)
            {
                var maxAttempts = Math.Max(1, _config.StreamAttempts);
                for (var attempt = 1; attempt <= maxAttempts; attempt++)
                {
                    using var firstUpdateCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
                    firstUpdateCts.CancelAfter(TimeSpan.FromSeconds(Math.Max(1, _config.FirstTokenTimeoutSeconds)));

                    var enumerator = _pool
                        .StreamDeltasAsync(synthCall, firstUpdateCts.Token)
                        .GetAsyncEnumerator(firstUpdateCts.Token);
                    var stalled = false;

                    // NOTE: C# forbids `yield` inside a try block that has a catch
                    // clause, so the guarded first read is a tiny try/catch with no
                    // yield, nested in an outer try/finally that owns the disposal.
                    try
                    {
                        var hasUpdate = false;
                        try
                        {
                            hasUpdate = await enumerator.MoveNextAsync();
                        }
                        catch (Exception ex) when (!ct.IsCancellationRequested)
                        {
                            // The pool already recorded the failure against the
                            // entry (cool-down) when the stream never started.
                            stalled = true;
                            _logger.LogWarning(
                                "MonteAI streaming attempt {Attempt}/{Max} stalled with no update within {Seconds}s ({ErrorType}: {Reason}) — abandoning this attempt, retrying with a fresh request",
                                attempt, maxAttempts, _config.FirstTokenTimeoutSeconds, ex.GetType().Name, ex.Message);
                            _logger.LogDebug(ex, "MonteAI streaming stall detail (attempt {Attempt}/{Max})", attempt, maxAttempts);
                        }

                        if (!stalled)
                        {
                            // First update arrived: disarm the guard for the rest of the stream.
                            firstUpdateCts.CancelAfter(Timeout.InfiniteTimeSpan);
                            _logger.LogInformation(
                                "MonteAI synthesis first update after {Ms} ms (attempt {Attempt})",
                                stopwatch.ElapsedMilliseconds, attempt);

                            while (hasUpdate)
                            {
                                // No `yield` inside a try/catch (C# forbids it), so
                                // buffer this update's text and run the next MoveNext
                                // under the same guard as the first-token read — a
                                // mid-stream drop (free-tier stall on a later page)
                                // must not kill the request after tokens already
                                // reached the client.
                                List<string> texts = [];
                                var droppedMidStream = false;
                                try
                                {
                                    var text = enumerator.Current;
                                    if (!string.IsNullOrEmpty(text))
                                    {
                                        texts.Add(text);
                                    }
                                    hasUpdate = await enumerator.MoveNextAsync();
                                }
                                catch (Exception ex) when (!ct.IsCancellationRequested)
                                {
                                    droppedMidStream = true;
                                    _logger.LogWarning(
                                        "MonteAI stream dropped mid-stream on attempt {Attempt} after {Ms} ms ({ErrorType}: {Reason}) — keeping the partial answer",
                                        attempt, stopwatch.ElapsedMilliseconds, ex.GetType().Name, ex.Message);
                                    _logger.LogDebug(ex, "MonteAI mid-stream drop detail (attempt {Attempt})", attempt);
                                }

                                foreach (var text in texts)
                                {
                                    yield return text;
                                }

                                if (droppedMidStream)
                                {
                                    // Retrying now would duplicate tokens already
                                    // sent to the client — keep the partial instead.
                                    yield return MidStreamDropNotice;
                                    yield break;
                                }
                            }
                            yield break;
                        }
                    }
                    finally
                    {
                        try { await enumerator.DisposeAsync(); }
                        catch { /* disposing an abandoned/cancelled stream may throw; irrelevant to the answer */ }
                    }
                    // stalled -> loop: send a brand-new streaming request.
                }

                _logger.LogWarning("MonteAI streaming stalled on all {Max} attempts — using a non-streaming completion", maxAttempts);
            }

            // Non-streaming path: StreamSynthesis=false, or every stream attempt stalled.
            LlmCompletion fallbackCompletion;
            try
            {
                fallbackCompletion = await _pool.CompleteAsync(synthCall, ct);
            }
            catch (Exception ex) when (!ct.IsCancellationRequested)
            {
                _logger.LogWarning(ex,
                    "MonteAI non-streaming synthesis failed after retries ({ErrorType}: {Reason}) — client gets a friendly unavailable message",
                    ex.GetType().Name, ex.Message);
                throw ex is LlmUnavailableException
                    ? ex
                    : new LlmUnavailableException(LlmClientPool.UserFacingMessage, ex);
            }
            LogUsage("synthesizer", fallbackCompletion);

            var answer = fallbackCompletion.Text?.Trim();
            if (string.IsNullOrEmpty(answer))
            {
                answer = "I could not generate a response. Please try rephrasing your question.";
            }

            _logger.LogInformation("MonteAI non-streaming synthesis finished after {Ms} ms", stopwatch.ElapsedMilliseconds);
            yield return answer;
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
            string query,
            IReadOnlyList<ConversationTurn> history,
            IReadOnlyList<string> observations)
        {
            // NO system message: the planner's instructions (including the
            // rendered tool manifest and MAX_STEPS) are baked into the
            // monteai-agent-planner Foundry agent definition — see
            // AgentPrompts.cs for the copy-paste source.
            var messages = new List<ChatMessage>();

            // ORDER MATTERS (validated against the live deployment):
            //   1. real conversation memory FIRST
            //   2. few-shot protocol examples SECOND (adjacent to the question)
            //   3. the current planning step LAST
            // Placing history after the few-shot block made the planner treat
            // the conversation as finished and answer {"final": true} to
            // research questions without calling any tool.
            messages.AddRange(ToChatMessages(history));

            // Few-shot protocol examples as REAL turns — the pattern priming
            // that makes the model emit the correct JSON schema (see
            // AgentPrompts header for the validation notes).
            foreach (var (exampleUser, exampleAssistant) in AgentPrompts.PlanningFewShot)
            {
                messages.Add(new UserChatMessage(exampleUser));
                messages.Add(new AssistantChatMessage(exampleAssistant));
            }

            // The current planning step (mirrors the last few-shot input shape).
            // The previous user question (when any) is surfaced inside the prompt
            // so follow-ups can be rewritten to the earlier topic.
            messages.Add(new UserChatMessage(
                AgentPrompts.BuildPlanningUserPrompt(query, observations, LastUserQuestion(history))));
            return messages;
        }

        private List<ChatMessage> BuildAnswerMessages(
            string query,
            IReadOnlyList<ConversationTurn> history,
            AgentLoopOutcome loop)
        {
            // NO system message: the synthesizer's instructions are baked into
            // the monteai-agent-synth Foundry agent definition.
            var messages = new List<ChatMessage>();
            messages.AddRange(ToChatMessages(history));
            // Observations are intentionally NOT replayed here: they repeat the
            // same excerpts already rendered by BuildSourcesBlock (up to 4000
            // chars each), which only inflated the prompt, cost and latency.
            messages.Add(new UserChatMessage(AgentPrompts.BuildAnswerUserPrompt(
                query, BuildSourcesBlock(loop.Sources), [], loop.Sources.Count > 0)));
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

        /// <summary>
        /// Topic-void follow-ups ("tell me more about the source you provided")
        /// whose meaning depends on the previous turn. Retrieval keyed on the
        /// raw phrase matches this repository's own MonteAI thesis (its chapter
        /// text is about sources, citations and research assistants), and the
        /// semantic cache would replay one topic's answer for every session
        /// that repeats the phrase — so both are bypassed/blended for these
        /// queries. "previous answer" covers the Expand button's prompt, which
        /// QueryModeration also classes as Noise but must still reach the
        /// blended-retrieval pipeline.
        /// </summary>
        private static readonly Regex ContextDependentFollowUp = new(
            @"\b(you\s+(?:provided|mentioned|gave|listed|found|showed|shared)|the\s+(?:source|sources|study|studies|thesis|theses|paper|papers|result|results|passage|passages|work|works)\b[^?]{0,40}\b(?:provided|mentioned|above|earlier|before|listed|found)|more\s+about\s+(?:it|them|this|that|those|these)\b|previous\s+answer)",
            RegexOptions.IgnoreCase | RegexOptions.Compiled | RegexOptions.CultureInvariant);

        /// <summary>Most recent user message from conversation memory (null when none).</summary>
        private static string? LastUserQuestion(IReadOnlyList<ConversationTurn> history)
        {
            for (var i = history.Count - 1; i >= 0; i--)
            {
                var turn = history[i];
                if (string.Equals(turn.Role, "user", StringComparison.OrdinalIgnoreCase)
                    && !string.IsNullOrWhiteSpace(turn.Content))
                {
                    return turn.Content;
                }
            }
            return null;
        }

        /// <summary>Blends the previous question with the current follow-up so retrieval keeps the conversation's topic (capped).</summary>
        private static string BlendWithHistory(string previousUserQuestion, string followUp)
        {
            const int maxLength = 400;
            var blended = $"{previousUserQuestion} {followUp}".Trim();
            return blended.Length <= maxLength ? blended : blended[..maxLength];
        }

        /// <summary>
        /// Renders the numbered source block the synthesizer cites with [Source n].
        /// Uses FullExcerpt (complete abstract) when present — the 600-char
        /// Snippet cut methodology sentences off the END of abstracts, which
        /// made the synthesizer report "no explicit indication" of methods
        /// that were in fact embedded in Pinecone. Kept within the ~4000-char
        /// cap per source (4-6 sources ≈ 3k tokens of prompt). ThesisId is
        /// intentionally omitted (only the planner's tool observations need it).
        /// </summary>
        private static string BuildSourcesBlock(IReadOnlyList<ChatSourceDto> sources)
        {
            if (sources.Count == 0)
            {
                // Mirrors the Foundry synth agent's no-sources/greeting rules
                // VERBATIM — the previous wording ("suggest broadening the
                // question") directly contradicted the agent's fixed reply
                // and gave the model two conflicting instructions.
                return "(No sources were retrieved for this question. If it is a greeting or small talk, reply warmly as MonteAI — a thesis-research assistant for Colegio de Montalban's institutional repository. Otherwise reply with EXACTLY: \"No relevant theses were found in the repository for this topic. Please try a different topic or different keywords.\")";
            }

            var sb = new StringBuilder();
            for (var i = 0; i < sources.Count; i++)
            {
                var s = sources[i];
                sb.Append("[Source ").Append(i + 1).Append("]\n")
                  .Append("  Title: ").Append(s.Title ?? "Untitled").Append('\n')
                  .Append("  Author(s): ").Append(string.IsNullOrWhiteSpace(s.Authors) ? "Unknown" : s.Authors).Append('\n')
                  .Append("  Year: ").Append(string.IsNullOrWhiteSpace(s.PublicationYear) ? "n.d." : s.PublicationYear).Append('\n')
                  .Append("  Excerpt: ").Append(s.FullExcerpt ?? s.Snippet ?? "(no excerpt)").Append('\n');
            }
            return sb.ToString();
        }

        // ────────────────────── helpers ──────────────────────

        private string SanitizeQuery(string query)
        {
            var trimmed = query.Trim();
            return trimmed.Length > _config.MaxQueryLength ? trimmed[.._config.MaxQueryLength] : trimmed;
        }

        /// <summary>
        /// Merges new sources into the list, allowing up to
        /// MaxPassagesPerThesis passages per thesis (default 1 — the sources
        /// panel lists STUDIES, so one document can only claim one source
        /// slot with its strongest passage), keeping the strongest matches
        /// first.
        /// </summary>
        private List<ChatSourceDto> MergeSources(List<ChatSourceDto> current, IReadOnlyList<ChatSourceDto> additions)
        {
            var merged = new List<ChatSourceDto>(current);
            var perThesis = new Dictionary<string, int>(StringComparer.Ordinal);
            foreach (var existing in merged)
            {
                var key = existing.ThesisId ?? existing.Title ?? existing.Url ?? Guid.NewGuid().ToString();
                perThesis[key] = perThesis.GetValueOrDefault(key) + 1;
            }

            var maxPerThesis = Math.Max(1, _config.MaxPassagesPerThesis);
            foreach (var source in additions)
            {
                var key = source.ThesisId ?? source.Title ?? source.Url ?? Guid.NewGuid().ToString();
                if (perThesis.GetValueOrDefault(key) >= maxPerThesis)
                {
                    continue;
                }
                perThesis[key] = perThesis.GetValueOrDefault(key) + 1;
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
            Snippet = chunk.Text.Length > 600 ? chunk.Text[..600] + "…" : chunk.Text,
            FullExcerpt = chunk.Text.Length > 4000 ? chunk.Text[..4000] + "…" : chunk.Text,
            Score = double.TryParse(chunk.RelevanceScore, out var score) ? score : null,
            Url = chunk.Url,
        };

        private static string Summarize(ToolExecutionResult result)
            => result.Observation.Length > 200 ? result.Observation[..200] + "…" : result.Observation;

        private void LogUsage(string stage, LlmCompletion result)
            => _logger.LogInformation(
                "MonteAI agent ({Stage}) — input tokens: {In}, output tokens: {Out}",
                stage, result.InputTokens, result.OutputTokens);
    }
}