// server/Services/AI/Agent/AgentJson.cs
//
// JSON-protocol helpers for talking to Phi-4-mini WITHOUT relying on native
// OpenAI function calling (which small models deployed on Azure AI Foundry do
// not reliably support).
//
// Protocol: the planner is instructed to answer with a single JSON object:
//     {"thought": "...", "tool": "semantic_search", "toolArgs": {"query": "..."}}
//     {"thought": "...", "final": true}
//
// Small models frequently wrap that JSON in markdown fences or prose, so
// <see cref="ExtractJsonObject"/> recovers the first balanced JSON object from
// the raw completion before deserialization. If extraction fails, the agent
// falls back to the classic single-shot RAG path instead of erroring out.

using server.Models.Agent;
using System.Text;
using System.Text.Json;

namespace server.Services.AI.Agent
{
    public static class AgentJson
    {
        private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);

        private sealed class PlannerDto
        {
            public string? Thought { get; set; }
            public string? Tool { get; set; }
            public JsonElement? ToolArgs { get; set; }
            public bool Final { get; set; }
        }

        /// <summary>
        /// Extracts the first balanced JSON object from an LLM completion,
        /// tolerating ```json fences and surrounding prose. Returns null when
        /// no parsable object exists.
        /// </summary>
        public static string? ExtractJsonObject(string? raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return null;

            var text = raw.Trim();
            // Strip a markdown code fence if present.
            if (text.StartsWith("```"))
            {
                var firstNewLine = text.IndexOf('\n');
                if (firstNewLine >= 0) text = text[(firstNewLine + 1)..];
                var closingFence = text.LastIndexOf("```", StringComparison.Ordinal);
                if (closingFence >= 0) text = text[..closingFence];
            }

            var start = text.IndexOf('{');
            if (start < 0) return null;

            var depth = 0;
            var inString = false;
            var escaped = false;
            for (var i = start; i < text.Length; i++)
            {
                var c = text[i];
                if (escaped) { escaped = false; continue; }
                if (c == '\\' && inString) { escaped = true; continue; }
                if (c == '"') { inString = !inString; continue; }
                if (inString) continue;
                if (c == '{') depth++;
                else if (c == '}')
                {
                    depth--;
                    if (depth == 0) return text.Substring(start, i - start + 1);
                }
            }
            return null;
        }

        /// <summary>Parses a planner completion into an <see cref="AgentAction"/>. Null when unparseable.</summary>
        public static AgentAction? ParseAction(string? raw)
        {
            var json = ExtractJsonObject(raw);
            if (json is null) return null;
            try
            {
                var dto = JsonSerializer.Deserialize<PlannerDto>(json, Options);
                if (dto is null) return null;
                return new AgentAction
                {
                    Thought = dto.Thought,
                    Tool = dto.Tool,
                    ToolArgs = dto.ToolArgs,
                    Final = dto.Final,
                };
            }
            catch (JsonException)
            {
                return null;
            }
        }

        /// <summary>Serializes tool arguments (or "{}") for tracing.</summary>
        public static string ArgsToString(JsonElement? args)
            => args is { } element ? element.GetRawText() : "{}";

        /// <summary>Reads a string argument from the tool-args JSON object.</summary>
        public static string? GetStringArg(JsonElement? args, string name)
            => args is { ValueKind: JsonValueKind.Object } && args.Value.TryGetProperty(name, out var value)
                && value.ValueKind == JsonValueKind.String
                ? value.GetString()
                : null;

        /// <summary>Reads an integer argument from the tool-args JSON object.</summary>
        public static int? GetIntArg(JsonElement? args, string name)
            => args is { ValueKind: JsonValueKind.Object } && args.Value.TryGetProperty(name, out var value)
                && value.ValueKind is JsonValueKind.Number && value.TryGetInt32(out var parsed)
                ? parsed
                : null;
    }
}
