// server/Services/AI/Agent/AgentPrompts.cs
//
// Every prompt used by the MonteAI agent, in one documented place.
//
// Two stages:
//   1. PLANNER  — sees the tool results so far and decides the next action as
//                strict JSON (protocol below). NOT user-visible.
//   2. SYNTHESIZER — sees the conversation + gathered sources and writes the
//                final, citation-grounded answer. The ONLY stage the user sees.
//
// ── WHERE THE INSTRUCTIONS LIVE (Phi-4-mini retirement) ──────────────────────
// System instructions are NO LONGER sent by the server — they are baked into
// the two Azure AI Foundry agents that LlmClientPool routes to:
//   - monteai-agent-planner: paste the old PlanningSystemPrompt body below
//     (with {TOOLS} rendered via AgentToolbox.GetToolManifest() and
//     {MAX_STEPS} set to 3 — i.e. "You have at most 3 steps in total"), and
//     configure a JSON object response format on the agent.
//   - monteai-agent-synth: paste the old AnswerSystemPrompt body verbatim.
// MonteAiAgentService therefore never constructs a SystemChatMessage.
// Changing either Foundry agent requires a republish; changing THIS file
// requires only a server redeploy.
//
// What REMAINS here (server-side, every request):
//   - PlanningFewShot + BuildPlanningUserPrompt — chat-turn priming and the
//     per-step user prompt (see the recipe below for why these stay turns).
//   - BuildAnswerUserPrompt — the SOURCES/QUESTION user message.
//
// ── VALIDATED PROMPTING RECIPE FOR THE PLANNER ───────────────────────────────
// The old Phi-4-mini deployment ignored format instructions phrased in prose
// ("respond with ONLY a JSON object") and schemas listed in a system prompt.
// The ONLY reliable combination (measured 4/4 valid actions vs 0/4 prose-only) was:
//     a) JSON object response format                (now: baked on the agent —
//        Foundry rejects a per-request text format alongside an agent)
//     b) few-shot examples as REAL chat turns   (pattern-matching, not prose)
//     c) schema rules in the instructions       (now baked into the agent)
// The few-shot turns are kept for gpt-5-nano: they still prime the schema AND
// teach the "next step after tool results" input format. Any prompt change
// here should be re-validated with `dotnet run --project server -- --prompt-check`
// before shipping.
//
// MESSAGE ORDER ALSO MATTERS: conversation history must be placed BEFORE the
// few-shot examples (see MonteAiAgentService.BuildPlanningMessages). With
// history after the examples the planner treated the conversation as finished
// and returned {"final": true} for research questions without running a tool.
//
// Degradation is still safe by design: AgentJson tolerates fences/prose, and
// MonteAiAgentService falls back to single-shot RAG when parsing fails.

using System.Text;

namespace server.Services.AI.Agent
{
    internal static class AgentPrompts
    {
        /// <summary>
        /// Few-shot examples injected as REAL user/assistant chat turns before
        /// the actual question. This in-conversation pattern priming is what
        /// makes the planner emit the correct schema (see the file header).
        /// Trimmed from 12 to 6 examples to fit the ~1000-token/query budget:
        /// author + duplicate-topic/code cases were dropped (author/year
        /// shapes live in the tool manifest and IsOutOfScope pre-blocks code
        /// requests). The LAST example teaches the "tool results so far"
        /// input format used by BuildPlanningUserPrompt; the fourth teaches
        /// the needsMore two-step chain; the sixth teaches follow-up
        /// rewriting ("tell me more about the source you provided" must
        /// search the PREVIOUS USER QUESTION's topic, not the meta-phrase —
        /// a raw meta-query semantically matches this repository's own
        /// MonteAI thesis and returns it as a false source). The follow-up
        /// example is intentionally NOT last so it cannot leak attention
        /// into a live greeting ("hi!" was mis-answered as a search when a
        /// full-prompt-shaped search example sat directly before it).
        /// </summary>
        public static readonly (string User, string Assistant)[] PlanningFewShot =
        [
            (
                "What theses use machine learning for student performance?",
                """{"thought": "topic question", "tool": "semantic_search", "toolArgs": {"query": "machine learning student performance prediction"}, "needsMore": false}"""
            ),
            (
                "Show me theses published between 2019 and 2022 about modular learning",
                """{"thought": "year-bounded search", "tool": "semantic_search", "toolArgs": {"query": "modular learning", "yearFrom": 2019, "yearTo": 2022}, "needsMore": false}"""
            ),
            (
                "Any thesis about ISO 25010?",
                """{"thought": "exact standard number", "tool": "keyword_search", "toolArgs": {"term": "ISO 25010"}, "needsMore": false}"""
            ),
            (
                "Tell me the abstract of the thesis titled Predicting Student Success Using Ensemble Models",
                """{"thought": "locate first, then metadata", "tool": "semantic_search", "toolArgs": {"query": "Predicting Student Success Using Ensemble Models"}, "needsMore": true}"""
            ),
            (
                "hi!",
                """{"thought": "greeting", "final": true}"""
            ),
            (
                "RESEARCH QUESTION:\nCan you tell me more about the sources you provided?\n\nPREVIOUS USER QUESTION:\nShow me theses about wastewater treatment in schools",
                """{"thought": "follow-up — search the earlier topic from the previous question", "tool": "semantic_search", "toolArgs": {"query": "wastewater treatment in schools"}, "needsMore": false}"""
            ),
            (
                "RESEARCH QUESTION:\nWhat theses use machine learning for student performance?\n\nTOOL RESULTS SO FAR:\n[Result 1]\nsemantic_search retrieved 2 relevant passages:\n- [Source 1] Predicting Student Success Using Ensemble Models | Author(s): Dela Cruz | Year: 2024\n- [Source 2] ML-based Academic Analytics | Author(s): Unknown | Year: 2023\n\nDecide the next action, or finish if the results above are enough to answer.",
                """{"thought": "results sufficient", "final": true}"""
            ),
        ];

        /// <summary>
        /// User prompt for each planning step. Mirrors the input format of the
        /// last few-shot example so the model recognizes the shape. When the
        /// conversation has a previous user question, it is surfaced as a
        /// PREVIOUS USER QUESTION block so follow-ups like "tell me more about
        /// the source you provided" can be rewritten to the earlier topic
        /// (a raw meta-query matches this repository's own MonteAI thesis).
        /// </summary>
        public static string BuildPlanningUserPrompt(
            string userQuery,
            IReadOnlyList<string> observations,
            string? previousUserQuestion = null)
        {
            var sb = new StringBuilder();
            sb.Append("RESEARCH QUESTION:\n").AppendLine(userQuery);

            var hasPrevious = !string.IsNullOrWhiteSpace(previousUserQuestion);
            if (hasPrevious)
            {
                sb.Append("\nPREVIOUS USER QUESTION:\n").AppendLine(TruncateForPrompt(previousUserQuestion!, 240));
            }

            if (observations.Count == 0)
            {
                sb.Append("\nNo tools have been called yet. Decide the first action.");
            }
            else
            {
                sb.AppendLine("\nTOOL RESULTS SO FAR:");
                for (var i = 0; i < observations.Count; i++)
                {
                    sb.Append("[Result ").Append(i + 1).Append("]\n").AppendLine(observations[i]);
                }
                sb.Append("\nDecide the next action, or finish if the results above are enough to answer.");
            }

            if (hasPrevious)
            {
                sb.Append("\nIf the RESEARCH QUESTION is a follow-up about the PREVIOUS USER QUESTION (e.g. \"the source you provided\"), put that earlier topic into the search query.");
            }

            sb.Append("\n\nReply with one JSON object with exactly the keys shown in the examples above.");
            return sb.ToString();
        }

        /// <summary>Flattens and caps a quoted block so one long turn cannot blow the prompt budget.</summary>
        private static string TruncateForPrompt(string text, int max)
        {
            var flat = text.ReplaceLineEndings(" ").Trim();
            return flat.Length <= max ? flat : flat[..max] + "…";
        }

        /// <summary>
        /// User prompt for the synthesis stage: the question, the gathered sources, and leftover tool observations.
        /// The trailing instruction depends on whether sources exist:
        ///  - hasSources: narrate from the sources AND explicitly FORBIND the
        ///    agent's fixed "No relevant theses were found…" reply (reserved
        ///    for empty sources) — gpt-5-nano fired it even with 4 sources
        ///    when none directly matched the asked method.
        ///  - no sources: nothing here — the block text below already mirrors
        ///    the agent's own no-sources/greeting rules verbatim so the two
        ///    instruction sets cannot fight each other.
        /// </summary>
        public static string BuildAnswerUserPrompt(
            string userQuery,
            string sourcesBlock,
            IReadOnlyList<string> observations,
            bool hasSources)
        {
            var sb = new StringBuilder();
            sb.Append("SOURCES:\n").AppendLine(sourcesBlock);
            sb.Append("\nQUESTION:\n").AppendLine(userQuery);

            if (observations.Count > 0)
            {
                sb.AppendLine("\nADDITIONAL RETRIEVAL NOTES (for context only, prefer SOURCES when citing):");
                for (var i = 0; i < observations.Count; i++)
                {
                    sb.Append("[Note ").Append(i + 1).Append("] ").AppendLine(observations[i]);
                }
            }

            if (hasSources)
            {
                sb.Append("\nWrite a natural narrative answer (not a bullet list). Attribute findings to authors, e.g. \"According to Basulgan et al. (2025)…\". Keep the [Source n] marker after each cited claim.");
                sb.Append("\nSOURCES ARE NON-EMPTY — the fixed \"No relevant theses were found…\" reply is FORBIDDEN here; it is reserved for an EMPTY sources list. If no source directly answers the question, still write prose grounded strictly in the sources above: name the closest ones, summarize what they DO cover, and state plainly that their abstracts do not explicitly address the asked aspect. Never invent findings beyond them.");
            }

            return sb.ToString();
        }
    }
}
