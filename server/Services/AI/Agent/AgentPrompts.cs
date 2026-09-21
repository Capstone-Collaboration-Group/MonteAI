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
// ── VALIDATED PROMPTING RECIPE FOR Phi-4-mini-instruct ──────────────────────
// Phi-4-mini on Azure AI Foundry ignores format instructions phrased in prose
// ("respond with ONLY a JSON object"), ignores schemas listed in the system
// prompt, and ignores assistant-turn prefills. Measured against the live
// deployment, the ONLY reliable combination is:
//     a) ResponseFormat = json_object          (server-enforced valid JSON)
//     b) few-shot examples as REAL chat turns  (pattern-matching, not prose)
//     c) the schema rules repeated in the system prompt
// This recipe scored 4/4 valid actions vs 0/4 for prose-only prompts. Any
// prompt change here should be re-validated with a harness before shipping.
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
        /// System prompt for the planning stage. {TOOLS} and {MAX_STEPS} are
        /// replaced at runtime (see AgentToolbox.GetToolManifest).
        /// </summary>
        public const string PlanningSystemPrompt =
            """
            You are the planner of MonteAI, a thesis-research assistant. You reply with exactly one JSON object and nothing else. You NEVER write prose.

            RULES (follow these in order):
            1. Research questions ALWAYS start with semantic_search. Only use keyword_search when the user asks for an exact acronym, standard number, or precise title.
            2. If a tool returned results, decide if they are enough to answer. If yes, {"final": true}. If not, call another tool.
            3. You have at most {MAX_STEPS} steps in total.

            Built-in tools (you call these yourself — they search the institutional repository, not the internet):
            {TOOLS}

            "final": true means you have enough information to answer, or the message is a greeting/small talk.
            "final" must be true or absent — never false. If results are insufficient, call a tool again instead.
            """;

        /// <summary>
        /// Few-shot examples injected as REAL user/assistant chat turns before
        /// the actual question. This in-conversation pattern priming is what
        /// makes Phi-4-mini emit the correct schema (see the file header).
        /// The fourth example also teaches the "next step after tool results"
        /// input format used by BuildPlanningUserPrompt.
        /// </summary>
        public static readonly (string User, string Assistant)[] PlanningFewShot =
        [
            (
                "What theses use machine learning for student performance?",
                """{"thought": "Topic question; semantic search is the default", "tool": "semantic_search", "toolArgs": {"query": "machine learning student performance prediction"}}"""
            ),
            (
                "Any thesis about ISO 25010?",
                """{"thought": "Exact standard number; keyword search fits", "tool": "keyword_search", "toolArgs": {"term": "ISO 25010"}}"""
            ),
            (
                "hi!",
                """{"thought": "Greeting; no research needed", "final": true}"""
            ),
            (
                "RESEARCH QUESTION:\nWhat theses use machine learning for student performance?\n\nTOOL RESULTS SO FAR:\n[Result 1]\nsemantic_search retrieved 2 relevant passages:\n- [Source 1] Predicting Student Success Using Ensemble Models | Author(s): Dela Cruz | Year: 2024\n- [Source 2] ML-based Academic Analytics | Author(s): Unknown | Year: 2023\n\nDecide the next action, or finish if the results above are enough to answer.",
                """{"thought": "Two relevant sources retrieved; enough to answer", "final": true}"""
            ),
        ];

        /// <summary>
        /// User prompt for each planning step. Mirrors the input format of the
        /// fourth few-shot example so the model recognizes the shape.
        /// </summary>
        public static string BuildPlanningUserPrompt(string userQuery, IReadOnlyList<string> observations)
        {
            var sb = new StringBuilder();
            sb.Append("RESEARCH QUESTION:\n").AppendLine(userQuery);

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

            sb.Append("\n\nReply with one JSON object with exactly the keys shown in the examples above.");
            return sb.ToString();
        }

        /// <summary>System prompt for the synthesis (answer) stage.</summary>
        public const string AnswerSystemPrompt =
            """
            You are MonteAI, a doctorate-level research assistant for thesis studies at Colegio de Montalban.
            You answer the user's question using ONLY the numbered SOURCES provided in the user message and the earlier conversation.

            Rules:
            - Cite sources inline with the bracketed source number and the author's surname, APA 7th edition style, e.g.: [Dela Cruz et al., 2024][Source 1].
            - If an author is listed as 'Unknown', cite as [Source 1] only — never invent an author, title, year, or finding.
            - If the sources do not answer the question, say clearly that the repository does not contain relevant material and suggest how to broaden the question.
            - If the message is a greeting or small talk, reply briefly and warmly without citations.
            - Never fabricate citations or numbers. Stay grounded in the source excerpts.
            - Keep the answer focused and structured; use a short paragraph or a few short paragraphs.
            """;

        /// <summary>User prompt for the synthesis stage: the question, the gathered sources, and leftover tool observations.</summary>
        public static string BuildAnswerUserPrompt(
            string userQuery,
            string sourcesBlock,
            IReadOnlyList<string> observations)
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

            sb.Append("\nWrite the final answer now, citing sources as instructed.");
            return sb.ToString();
        }
    }
}
