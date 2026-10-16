// server/Tools/PromptCheckRunner.cs
//
// Prompt-validation HARNESS — the hard gate before any planner/synth prompt
// change (or Foundry agent republish) ships. Runs INSTEAD of the web host
// when the process is started with --prompt-check (see Program.cs):
//
//   dotnet run --project server -- --prompt-check              # full live gate
//   dotnet run --project server -- --prompt-check --live-offline
//
// What it does:
//   1. Loads server/appsettings.Development.json (walks up from the binary to
//      the server project) and binds the AzureAI section — ProjectEndpoint +
//      Deployments — exactly like Program.cs does at runtime.
//   2. PLANNER PROTOCOL: replays every AgentPrompts.PlanningFewShot example as
//      a real request (history first, few-shot turns, BuildPlanningUserPrompt
//      last — the same order as MonteAiAgentService.BuildPlanningMessages)
//      against the configured planner Foundry agent (which must have JSON
//      response format baked in Foundry Studio), and asserts the parsed action
//      matches the example's expected tool/final decision.
//   3. PROBES: a few unseen research questions must parse into a known tool
//      or an explicit {"final": true} — never unparseable prose.
//   4. SYNTH SMOKE: one canned SOURCES/QUESTION prompt must return a
//      non-empty answer (validates the monteai-agent-synth instructions bake).
//
// Exit code 0 = all cases pass; 1 = at least one failure (raw completion is
// printed for diagnosis). The live half requires `az login` (or AZURE_* env
// vars / managed identity) because Foundry agents authenticate with
// DefaultAzureCredential, not an API key.

using Azure.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using OpenAI.Chat;
using server.Configuration;
using server.Services.AI;
using server.Services.AI.Agent;

namespace server.Tools
{
    public static class PromptCheckRunner
    {
        /// <summary>Runs the harness; returns the process exit code.</summary>
        public static async Task<int> RunAsync(string[] args)
        {
            var offlineOnly = args.Contains("--live-offline", StringComparer.OrdinalIgnoreCase);

            var appsettingsPath = FindDevelopmentSettings();
            Console.WriteLine($"Config: {appsettingsPath}");

            var config = new ConfigurationBuilder()
                .AddJsonFile(appsettingsPath, optional: false)
                .Build();

            var poolConfig = new LlmPoolConfig();
            config.GetSection(LlmPoolConfig.SectionName).Bind(poolConfig);

            var plannerEntry = poolConfig.Deployments?.FirstOrDefault(e =>
                e.Roles?.Contains("planner", StringComparer.OrdinalIgnoreCase) == true);
            var synthEntry = poolConfig.Deployments?.FirstOrDefault(e =>
                e.Roles?.Contains("synth", StringComparer.OrdinalIgnoreCase) == true);

            if (plannerEntry is null)
            {
                Console.Error.WriteLine("FAIL: no AzureAI:Deployments entry with role 'planner'.");
                return 1;
            }

            Console.WriteLine($"Planner agent: {plannerEntry.AgentName}");
            Console.WriteLine(synthEntry is null
                ? "Synth agent:   (none configured — synth smoke skipped)"
                : $"Synth agent:   {synthEntry.AgentName}");
            Console.WriteLine();

            // ── offline half: prompt assembly + protocol parsing (no network) ──
            var offlineFailures = 0;
            foreach (var (user, assistant) in AgentPrompts.PlanningFewShot)
            {
                var expected = AgentJson.ParseAction(assistant);
                if (expected is null)
                {
                    Console.WriteLine($"FAIL few-shot parse: {Shorten(user)}");
                    offlineFailures++;
                    continue;
                }

                // The user turn must assemble without throwing and be non-empty.
                var prompt = AgentPrompts.BuildPlanningUserPrompt(user, []);
                if (string.IsNullOrWhiteSpace(prompt) || !prompt.Contains("RESEARCH QUESTION:", StringComparison.Ordinal))
                {
                    Console.WriteLine($"FAIL prompt assembly: {Shorten(user)}");
                    offlineFailures++;
                }
            }
            Console.WriteLine(offlineFailures == 0
                ? $"Offline checks OK ({AgentPrompts.PlanningFewShot.Length} few-shot examples parse + assemble)."
                : $"Offline checks FAILED ({offlineFailures}).");
            Console.WriteLine();

            if (offlineOnly)
            {
                return offlineFailures == 0 ? 0 : 1;
            }

            // ── live half: the actual Foundry agents ──
            var projectEndpoint = config["AzureAI:ProjectEndpoint"];
            if (string.IsNullOrWhiteSpace(projectEndpoint))
            {
                Console.Error.WriteLine("FAIL: AzureAI:ProjectEndpoint is missing — set it in appsettings.Development.json.");
                return 1;
            }

            var projectClient = new Azure.AI.Projects.AIProjectClient(
                new Uri(projectEndpoint),
                new DefaultAzureCredential());

            var backend = new FoundryAgentBackend(
                projectClient,
                Options.Create(poolConfig),
                NullLogger<FoundryAgentBackend>.Instance);

            var failures = offlineFailures;
            var plannerTokens = new List<int>();

            // Planner: replay every few-shot example as a real request.
            foreach (var (user, assistant) in AgentPrompts.PlanningFewShot)
            {
                var (failed, inputTokens) = await RunPlannerCaseAsync(backend, plannerEntry, user, expectedRaw: assistant);
                failures += failed;
                if (inputTokens is int t) plannerTokens.Add(t);
            }

            // Probes: unseen questions — must parse into a known tool or final.
            string[] probes =
            [
                "What theses are about climate change adaptation?",
                "Find studies authored by Maria Santos about modular learning",
                "Show me theses published between 2020 and 2024 about online learning",
                "Any thesis about ISO 25010?",
                "Can you fix this C# method for me?",
            ];
            foreach (var probe in probes)
            {
                var (failed, inputTokens) = await RunPlannerCaseAsync(backend, plannerEntry, probe, expectedRaw: null);
                failures += failed;
                if (inputTokens is int t) plannerTokens.Add(t);
            }

            if (plannerTokens.Count > 0)
            {
                Console.WriteLine(
                    $"Planner input tokens: min {plannerTokens.Min()}, avg {plannerTokens.Average():F0}, max {plannerTokens.Max()}");
            }

            // Synth smoke: one canned grounded answer.
            if (synthEntry is not null)
            {
                failures += await RunSynthSmokeAsync(backend, synthEntry);
            }

            Console.WriteLine();
            Console.WriteLine(failures == 0
                ? "ALL CHECKS PASSED — prompts are safe to ship."
                : $"{failures} CHECK(S) FAILED — fix the prompt/agent before shipping.");
            return failures == 0 ? 0 : 1;
        }

        // ────────────────────────── planner cases ──────────────────────────

        /// <summary>
        /// Sends one planning request through the real backend and validates it.
        /// <paramref name="expectedRaw"/> = the few-shot assistant JSON to match
        /// against; null = probe (any known tool or final=true counts).
        /// Returns (failure count, measured input tokens or null on transport failure).
        /// </summary>
        private static async Task<(int Failed, int? InputTokens)> RunPlannerCaseAsync(
            ILlmBackend backend,
            LlmPoolEntry entry,
            string userQuery,
            string? expectedRaw)
        {
            // Same message order as MonteAiAgentService.BuildPlanningMessages with
            // empty history: few-shot turns first, then the current step.
            var messages = new List<ChatMessage>();
            foreach (var (exampleUser, exampleAssistant) in AgentPrompts.PlanningFewShot)
            {
                messages.Add(new UserChatMessage(exampleUser));
                messages.Add(new AssistantChatMessage(exampleAssistant));
            }
            messages.Add(new UserChatMessage(AgentPrompts.BuildPlanningUserPrompt(userQuery, [])));

            var call = new LlmCall(
                Role: "planner",
                Messages: messages,
                Temperature: 0f,
                MaxOutputTokens: 250,
                JsonMode: true,
                TargetAgent: entry.AgentName);

            string text;
            int? inputTokens;
            try
            {
                var result = await backend.CompleteAsync(call);
                text = result.Text;
                inputTokens = result.InputTokens;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"FAIL (transport) {Shorten(userQuery)} — {ex.GetType().Name}: {ex.Message}");
                return (1, null);
            }

            var action = AgentJson.ParseAction(text);
            if (action is null)
            {
                Console.WriteLine($"FAIL (unparseable) {Shorten(userQuery)} [{inputTokens} in]");
                Console.WriteLine($"  raw: {Shorten(text, 400)}");
                return (1, inputTokens);
            }

            if (expectedRaw is not null)
            {
                var expected = AgentJson.ParseAction(expectedRaw);
                var expectedTool = expected?.Final == true ? null : expected?.Tool;
                var actualTool = action.Final ? null : action.Tool;

                if (expectedTool != actualTool)
                {
                    Console.WriteLine($"FAIL (tool mismatch) {Shorten(userQuery)} — expected {expectedTool ?? "(final)"}, got {actualTool ?? "(final)"} [{inputTokens} in]");
                    Console.WriteLine($"  raw: {Shorten(text, 400)}");
                    return (1, inputTokens);
                }
            }
            else
            {
                var knownTool = action.Tool is "semantic_search" or "keyword_search" or "thesis_metadata";
                if (!action.Final && !knownTool)
                {
                    Console.WriteLine($"FAIL (unexpected action) {Shorten(userQuery)} — tool '{action.Tool}' is not a known tool [{inputTokens} in]");
                    Console.WriteLine($"  raw: {Shorten(text, 400)}");
                    return (1, inputTokens);
                }
            }

            Console.WriteLine($"PASS {Shorten(userQuery)} -> {(action.Final ? "final" : action.Tool)} [{inputTokens} in]");
            return (0, inputTokens);
        }

        // ────────────────────────── synth smoke ──────────────────────────

        private static async Task<int> RunSynthSmokeAsync(ILlmBackend backend, LlmPoolEntry entry)
        {
            const string userQuery = "What theses are about machine learning in education?";
            const string sourcesBlock =
                "[Source 1]\n" +
                "  Title: Predicting Student Success Using Ensemble Models\n" +
                "  Author(s): Dela Cruz\n" +
                "  Year: 2024\n" +
                "  ThesisId: 3f2b1c90-8a4e-4d6f-9c21-7b1e5d0a9f33\n" +
                "  Excerpt: This study applies ensemble models to predict student success using LMS clickstream data.\n";

            var messages = new List<ChatMessage>
            {
                new UserChatMessage(AgentPrompts.BuildAnswerUserPrompt(userQuery, sourcesBlock, [])),
            };

            var call = new LlmCall(
                Role: "synth",
                Messages: messages,
                Temperature: 0.2f,
                MaxOutputTokens: 800,
                JsonMode: false,
                TargetAgent: entry.AgentName);

            try
            {
                var result = await backend.CompleteAsync(call);
                if (string.IsNullOrWhiteSpace(result.Text))
                {
                    Console.WriteLine("FAIL (synth smoke) — empty answer");
                    return 1;
                }

                Console.WriteLine($"PASS synth smoke -> {result.Text.Length} chars, {result.InputTokens} in tokens, first line: {Shorten(result.Text.Split('\n')[0], 120)}");
                return 0;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"FAIL (synth smoke transport) — {ex.GetType().Name}: {ex.Message}");
                return 1;
            }
        }

        // ────────────────────────── helpers ──────────────────────────

        private static string Shorten(string? text, int max = 100)
        {
            if (string.IsNullOrEmpty(text)) return "(empty)";
            var flat = text.ReplaceLineEndings(" ");
            return flat.Length <= max ? flat : flat[..max] + "…";
        }

        /// <summary>Walks up from the binary to the server/ folder containing appsettings.Development.json.</summary>
        private static string FindDevelopmentSettings()
        {
            var dir = new DirectoryInfo(AppContext.BaseDirectory);
            while (dir is not null)
            {
                var candidate = Path.Combine(dir.FullName, "appsettings.Development.json");
                if (File.Exists(candidate) && File.Exists(Path.Combine(dir.FullName, "server.csproj")))
                {
                    return candidate;
                }
                dir = dir.Parent;
            }

            throw new FileNotFoundException(
                "Could not locate server/appsettings.Development.json above " + AppContext.BaseDirectory);
        }
    }
}
