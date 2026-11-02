using System.Globalization;
using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using server.Configuration;
using server.Infrastructure;
using server.Models.Agent;
using server.Models.DTOs.ChatMessage;
using server.Models.Retrieval;
using server.Services.AI;
using server.Services.Interfaces;

namespace server.Tests;

public class TopicRetrievalTests
{
    private const string InjectionQuery =
        "Find theses about detecting prompt injection in research assistants.";

    [Theory]
    [InlineData(0.28)]
    [InlineData(0.50)]
    [InlineData(0.90)]
    public async Task DeterministicLookup_ContextOnlyMatchesFallThroughRegardlessOfScore(double score)
    {
        var pinecone = new FakePinecone(ContextOnlyMatches(score));
        var responder = CreateResponder(pinecone, new MonteAiAgentConfig());

        var answer = await responder.TryAnswerAsync(InjectionQuery, CancellationToken.None);

        Assert.Null(answer);
        Assert.Equal(QueryClass.Research, QueryModeration.Classify(InjectionQuery));
    }

    [Fact]
    public async Task DeterministicLookup_RequiresEvidenceAndScoreForEveryListedThesis()
    {
        var supported = Thesis("Modular Learning in Basic Education", "A study of modular learning.", 0.33);
        var unrelated = Thesis("Student Monitoring", "A smart ID attendance monitoring system.", 0.32);
        var weak = Thesis("Modular Learning at Home", "A study of modular learning at home.", 0.24);
        var pinecone = new FakePinecone([unrelated, weak, supported]);
        var responder = CreateResponder(pinecone, new MonteAiAgentConfig());

        var answer = await responder.TryAnswerAsync("Find studies about modular learning.", CancellationToken.None);

        Assert.NotNull(answer);
        Assert.Equal(supported.ThesisId, Assert.Single(answer.Sources).ThesisId);
        Assert.DoesNotContain(unrelated.Title!, answer.Answer);
        Assert.DoesNotContain(weak.Title!, answer.Answer);
    }

    [Fact]
    public async Task DeterministicLookup_ChecksTheFullAbstractNotJustTheSnippet()
    {
        var abstractText = new string('x', 650) + " The study evaluates modular learning.";
        var source = Thesis("Learning Outcomes", abstractText, 0.33);
        var responder = CreateResponder(new FakePinecone([source]), new MonteAiAgentConfig());

        var answer = await responder.TryAnswerAsync("Find studies about modular learning.", CancellationToken.None);

        Assert.NotNull(answer);
        var citation = Assert.Single(answer.Sources);
        Assert.DoesNotContain("modular learning", citation.Snippet!);
        Assert.Contains("modular learning", citation.FullExcerpt!);
    }

    [Fact]
    public async Task DeterministicLookup_ParaphrasedTopicNeedsTheAgentRatherThanATemplate()
    {
        var source = Thesis("Prompt Injection Detection for Research Assistants",
            "A research assistant detects prompt injection using a classifier.", 0.40);
        var responder = CreateResponder(new FakePinecone([source]), new MonteAiAgentConfig());

        var answer = await responder.TryAnswerAsync(InjectionQuery, CancellationToken.None);

        Assert.Null(answer);
    }

    [Fact]
    public async Task DeterministicLookup_RespectsTheConfiguredSourceCap()
    {
        var sources = Enumerable.Range(0, 5)
            .Select(i => Thesis($"Modular Learning {i}", "A study of modular learning.", 0.35 - i * 0.01))
            .ToList();
        var responder = CreateResponder(new FakePinecone(sources), new MonteAiAgentConfig { MaxSources = 2 });

        var answer = await responder.TryAnswerAsync("Find studies about modular learning.", CancellationToken.None);

        Assert.NotNull(answer);
        Assert.Equal(sources.Take(2).Select(s => s.ThesisId), answer.Sources.Select(s => s.ThesisId));
    }

    [Theory]
    [InlineData("Who authored the thesis titled Modular Learning in Basic Education?")]
    [InlineData("Who authored Modular Learning in Basic Education?")]
    [InlineData("What year was the thesis titled Modular Learning in Basic Education published?")]
    [InlineData("List studies by Test Author.")]
    public async Task AgentLookup_ValidTitleAuthorAndYearLookupsStillUseTheFastPath(string query)
    {
        var supported = Thesis("Modular Learning in Basic Education", "A study of modular learning.", 0.30);
        var neighbor = Thesis("Student Monitoring", "A smart ID attendance monitoring system.", 0.90)
            with { Authors = "Other Author", PublicationYear = "2025" };
        var harness = CreateAgent([neighbor, supported], []);

        var result = await harness.Agent.GenerateResponseAsync(new AgentChatRequest(query, []));

        Assert.False(result.UsedLlm);
        Assert.Empty(harness.Pool.Calls);
        Assert.Equal(supported.ThesisId, Assert.Single(result.Sources).ThesisId);
        Assert.Contains("Test Author", result.Answer);
        Assert.Contains("2026", result.Answer);
        Assert.DoesNotContain(neighbor.Title!, result.Answer);
    }

    [Theory]
    [InlineData("ISO/IEC 25010", "ISO 25010")]
    [InlineData("ISO 25010", "ISO/IEC 25010")]
    [InlineData("ISO25010", "ISO/IEC 25010")]
    [InlineData("ISO / IEC 25010", "ISO25010")]
    public async Task DeterministicLookup_PreservesStandardDesignationAliases(string requested, string written)
    {
        var supported = Thesis("Software Quality Evaluation", $"The software was evaluated using {written}.", 0.33);
        var otherStandard = Thesis("Quality Management", "The study uses ISO 9001.", 0.40);
        var responder = CreateResponder(new FakePinecone([otherStandard, supported]), new MonteAiAgentConfig());

        var answer = await responder.TryAnswerAsync($"Find studies about {requested}.", CancellationToken.None);

        Assert.NotNull(answer);
        Assert.Equal(supported.ThesisId, Assert.Single(answer.Sources).ThesisId);
    }

    [Fact]
    public async Task AgentLookup_PreservesStandardDesignationAliases()
    {
        var supported = Thesis("Software Quality Evaluation", "The software was evaluated using ISO 25010.", 0.33);
        var otherStandard = Thesis("Quality Management", "The study uses ISO 9001.", 0.40);
        var matches = new List<Chunk> { otherStandard, supported };
        var config = AgentConfig();
        config.DeterministicFastPathEnabled = false;
        var harness = CreateAgent(matches, matches.Select(ToSource).ToList(), config);

        var result = await harness.Agent.GenerateResponseAsync(new AgentChatRequest("Find studies about ISO/IEC 25010.", []));

        Assert.True(result.UsedLlm);
        Assert.Equal(supported.ThesisId, Assert.Single(result.Sources).ThesisId);
        Assert.Contains("ISO 25010", SynthesisPrompt(harness));
        Assert.DoesNotContain(otherStandard.Title!, SynthesisPrompt(harness));
    }

    [Theory]
    [InlineData("Find studies about modular learning, and what were their findings?")]
    [InlineData("Find studies about modular learning, and are their findings comparable?")]
    [InlineData("Find studies about modular learning or online education.")]
    [InlineData("Find studies about modular learning without digital platforms.")]
    [InlineData("Find studies about modular learning in 2026.")]
    public async Task AgentLookup_ComplexConstraintsDeferToThePlannerRatherThanTheAllTermsGate(string query)
    {
        var supported = Thesis("Modular Learning in Basic Education", "A study of modular learning.", 0.33);
        var harness = CreateAgent([supported], [ToSource(supported)]);

        var result = await harness.Agent.GenerateResponseAsync(new AgentChatRequest(query, []));

        Assert.True(result.UsedLlm);
        Assert.Equal(new[] { "planner", "synth" }, harness.Pool.Calls.Select(c => c.Role));
        Assert.Equal(supported.ThesisId, Assert.Single(result.Sources).ThesisId);
    }

    [Fact]
    public async Task AgentLookup_ExactReportedQueryReachesTheLlmWithoutUnrelatedSources()
    {
        var matches = ContextOnlyMatches(0.40);
        var harness = CreateAgent(matches, matches.Select(ToSource).ToList());
        var events = new List<AgentStreamEvent>();

        await foreach (var evt in harness.Agent.StreamResponseAsync(new AgentChatRequest(InjectionQuery, [])))
        {
            events.Add(evt);
        }

        var discovered = Assert.Single(events.OfType<AgentStreamEvent.SourcesDiscovered>());
        var result = Assert.Single(events.OfType<AgentStreamEvent.Completed>()).Result;
        Assert.Empty(discovered.Sources);
        Assert.Empty(result.Sources);
        Assert.True(result.UsedLlm);
        Assert.Equal(harness.Pool.Answer, result.Answer);
        Assert.Equal(new[] { "planner", "synth" }, harness.Pool.Calls.Select(c => c.Role));
        AssertDoesNotSendUnrelatedSourcesToSynthesis(harness, matches);
    }

    [Theory]
    [InlineData("semantic_search")]
    [InlineData("keyword_search")]
    [InlineData("thesis_metadata")]
    public async Task AgentLookup_ChecksTheOriginalTopicEvenWhenThePlannerDropsItsCoreTerms(string tool)
    {
        var matches = ContextOnlyMatches(0.40);
        var config = AgentConfig();
        config.DeterministicFastPathEnabled = false;
        var harness = CreateAgent(matches, matches.Select(ToSource).ToList(), config);
        // A broad planner rewrite must not silently replace the user's actual topic.
        harness.Pool.PlannerReply = JsonSerializer.Serialize(new
        {
            tool,
            toolArgs = new { query = "research assistants", term = "research assistants", thesisId = matches[0].ThesisId },
            needsMore = false,
        });

        var result = await harness.Agent.GenerateResponseAsync(new AgentChatRequest(InjectionQuery, []));

        Assert.True(result.UsedLlm);
        Assert.Empty(result.Sources);
        AssertDoesNotSendUnrelatedSourcesToSynthesis(harness, matches);
    }

    [Fact]
    public async Task AgentLookup_DirectRagFallbackAlsoRejectsContextOnlyMatches()
    {
        var matches = ContextOnlyMatches(0.40);
        var config = AgentConfig();
        config.DeterministicFastPathEnabled = false;
        config.EnableAgentMode = false;
        var harness = CreateAgent(matches, [], config);

        var result = await harness.Agent.GenerateResponseAsync(new AgentChatRequest(InjectionQuery, []));

        Assert.True(result.UsedLlm);
        Assert.True(result.UsedFallback);
        Assert.Empty(result.Sources);
        Assert.Equal("synth", Assert.Single(harness.Pool.Calls).Role);
        AssertDoesNotSendUnrelatedSourcesToSynthesis(harness, matches);
    }

    [Fact]
    public async Task AgentLookup_RejectsACachedAnswerWithUnrelatedCitations()
    {
        var matches = ContextOnlyMatches(0.40);
        var config = AgentConfig();
        config.DeterministicFastPathEnabled = false;
        var harness = CreateAgent(matches, matches.Select(ToSource).ToList(), config);
        harness.Cache.Hit = new SemanticCacheHit("Stale unrelated answer", matches.Select(ToSource).ToList());

        var result = await harness.Agent.GenerateResponseAsync(new AgentChatRequest(InjectionQuery, []));

        Assert.True(result.UsedLlm);
        Assert.Equal(harness.Pool.Answer, result.Answer);
        Assert.Empty(result.Sources);
        AssertDoesNotSendUnrelatedSourcesToSynthesis(harness, matches);
    }

    [Fact]
    public async Task AgentLookup_FiltersBeforeTheCapAndKeepsEvidenceFromTheFullAbstract()
    {
        var unrelated = ContextOnlyMatches(0.90);
        var supported = Thesis("Prompt Injection Detection for Research Assistants",
            new string('x', 650) + " A research assistant detects prompt injection using a classifier.", 0.31);
        var matches = unrelated.Append(supported).ToList();
        var config = AgentConfig();
        config.DeterministicFastPathEnabled = false;
        config.MaxSources = 1;
        var harness = CreateAgent(matches, matches.Select(ToSource).ToList(), config);

        var result = await harness.Agent.GenerateResponseAsync(new AgentChatRequest(InjectionQuery, []));

        Assert.True(result.UsedLlm);
        Assert.Equal(supported.ThesisId, Assert.Single(result.Sources).ThesisId);
        AssertDoesNotSendUnrelatedSourcesToSynthesis(harness, unrelated);
        Assert.Contains("detects prompt injection", SynthesisPrompt(harness));
    }

    [Fact]
    public async Task AgentLookup_NoVerifiedHitsEarnAnotherPlannerTurn()
    {
        var matches = ContextOnlyMatches(0.40);
        var config = AgentConfig();
        config.DeterministicFastPathEnabled = false;
        config.MaxAgentIterations = 2;
        var harness = CreateAgent(matches, matches.Select(ToSource).ToList(), config);

        var result = await harness.Agent.GenerateResponseAsync(new AgentChatRequest(InjectionQuery, []));

        Assert.Empty(result.Sources);
        Assert.Equal(new[] { "planner", "planner", "synth" }, harness.Pool.Calls.Select(c => c.Role));
    }

    private static void AssertDoesNotSendUnrelatedSourcesToSynthesis(Harness harness, IEnumerable<Chunk> matches)
    {
        var prompt = SynthesisPrompt(harness);
        foreach (var match in matches)
        {
            Assert.DoesNotContain(match.Title!, prompt);
        }
    }

    private static string SynthesisPrompt(Harness harness) =>
        string.Join("\n", Assert.Single(harness.Pool.Calls.Where(c => c.Role == "synth"))
            .Messages.SelectMany(m => m.Content).Select(c => c.Text));

    private static MonteAiAgentConfig AgentConfig() => new()
    {
        StreamSynthesis = false,
        MaxAgentIterations = 1,
    };

    private static DeterministicResponder CreateResponder(FakePinecone pinecone, MonteAiAgentConfig config) =>
        new(pinecone, new NoOpMetadataResolver(), Options.Create(config), NullLogger<DeterministicResponder>.Instance);

    private static Harness CreateAgent(List<Chunk> matches, List<ChatSourceDto> toolSources, MonteAiAgentConfig? config = null)
    {
        config ??= AgentConfig();
        var options = Options.Create(config);
        var pool = new FakeLlmPool();
        var cache = new FakeCache();
        var pinecone = new FakePinecone(matches);
        var agent = new MonteAiAgentService(pool, new FakeToolbox(toolSources), pinecone,
            CreateResponder(pinecone, config), cache, new AgentConcurrencyGate(options),
            new NoOpMetadataResolver(), options, NullLogger<MonteAiAgentService>.Instance);
        return new Harness(agent, pool, cache);
    }

    private static List<Chunk> ContextOnlyMatches(double score) =>
    [
        Thesis("MonteAI: An Agentic Multi-Platform Research Assistant System Leveraging Retrieval-Augmented Generation for Thesis Studies at Colegio de Montalban",
            "A research assistant uses retrieval-augmented generation to search and summarize institutional theses.", score),
        Thesis("Student Monitoring Using Smart ID and Web Management System",
            "Student attendance monitoring using smart ID and a web management system.", score - 0.01),
        Thesis("LIBRATRACK: An Attendance Monitoring and Book Borrowing System using Barcode Scanning with Computer Vision",
            "A library system uses barcode scanning and computer vision for attendance and book borrowing.", score - 0.02),
    ];

    private static Chunk Thesis(string title, string abstractText, double score) =>
        new(abstractText, title, null, "Test Author", "2026", null,
            score.ToString("0.###", CultureInfo.InvariantCulture), Guid.NewGuid().ToString());

    private static ChatSourceDto ToSource(Chunk chunk) => new()
    {
        ThesisId = chunk.ThesisId,
        Title = chunk.Title,
        Authors = chunk.Authors,
        PublicationYear = chunk.PublicationYear,
        Snippet = chunk.Text.Length > 600 ? chunk.Text[..600] + "…" : chunk.Text,
        FullExcerpt = chunk.Text,
        Score = double.Parse(chunk.RelevanceScore!, CultureInfo.InvariantCulture),
    };

    private sealed record Harness(MonteAiAgentService Agent, FakeLlmPool Pool, FakeCache Cache);

    private sealed class FakePinecone(List<Chunk> matches) : IPineconeService
    {
        public Task<List<Chunk>> RetrieveRelevantChunksAsync(string query, RetrievalOptions? options = null,
            CancellationToken cancellationToken = default) => Task.FromResult(matches.ToList());

        public Task<int> UpsertMetadataChunkAsync(Guid thesisId, Chunk metadataChunk,
            CancellationToken cancellationToken = default) => throw new NotSupportedException();

        public Task<int> DeleteThesisVectorsAsync(Guid thesisId,
            CancellationToken cancellationToken = default) => throw new NotSupportedException();
    }

    private sealed class NoOpMetadataResolver : IThesisMetadataResolver
    {
        public Task<ResolvedThesisMetadata> ResolveAsync(Guid thesisId, string? preferredAuthors = null,
            string? preferredPublicationYear = null, CancellationToken cancellationToken = default) =>
            Task.FromResult(new ResolvedThesisMetadata(preferredAuthors, preferredPublicationYear));

        public Task EnrichAsync(List<Chunk> chunks, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task EnrichAsync(List<ChatSourceDto> sources, CancellationToken cancellationToken = default) => Task.CompletedTask;
    }

    private sealed class FakeToolbox(List<ChatSourceDto> sources) : IAgentToolbox
    {
        public string GetToolManifest() => "Test search tools";

        public Task<ToolExecutionResult> ExecuteAsync(string toolName, JsonElement? arguments,
            CancellationToken cancellationToken = default) =>
            Task.FromResult(new ToolExecutionResult("Test retrieval returned candidate theses.", sources));
    }

    private sealed class FakeLlmPool : ILlmClientPool
    {
        public List<LlmCall> Calls { get; } = [];
        public string PlannerReply { get; set; } =
            """{"tool":"semantic_search","toolArgs":{"query":"research assistants"},"needsMore":false}""";
        public string Answer { get; } = "No relevant theses were found in the repository for this topic.";

        public Task<LlmCompletion> CompleteAsync(LlmCall call, CancellationToken cancellationToken = default)
        {
            Calls.Add(call);
            return Task.FromResult(new LlmCompletion(call.Role == "planner" ? PlannerReply : Answer, null, null));
        }

        public IAsyncEnumerable<string> StreamDeltasAsync(LlmCall call,
            CancellationToken cancellationToken = default) => throw new NotSupportedException();
    }

    private sealed class FakeCache : ISemanticAnswerCache
    {
        public SemanticCacheHit? Hit { get; set; }

        public Task<SemanticCacheHit?> TryGetAsync(string query, CancellationToken cancellationToken) => Task.FromResult(Hit);

        public Task RememberAsync(string query, string answer, IReadOnlyList<ChatSourceDto> sources,
            CancellationToken cancellationToken) => Task.CompletedTask;
    }
}
