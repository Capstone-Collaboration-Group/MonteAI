using System.Text.RegularExpressions;
using OpenAI.Chat;
using server.Services.Interfaces;

namespace server.Services.AI
{
    public class MonteAiResponseService : IMonteAiResponseService
    {
        private readonly ChatClient _chatClient;
        private readonly IPineconeService _pineconeService;
        private readonly ILogger<MonteAiResponseService> _logger;

        private static readonly Regex AnswerPattern = new(
            @"===ANSWER_START===([\s\S]*?)===ANSWER_END===", RegexOptions.Compiled);
         
        private const string SystemPrompt = @"You are MonteAI's research assistant. Act as a doctorate-level researcher.
When given source abstracts and a query, synthesize the key findings into a clear, single-paragraph response.
Each source includes Author(s), Title, and Year fields. When citing a source inline. 
You should strictly include the bracketed source number and the author's surname in an APA 7th edition citation style(e.g. Dela Cruz et al., 2024]).
If Author(s) is 'Unknown', cite as [Source 1] only — do not invent an author.
You MUST surround your final response with these exact delimiters:
===ANSWER_START===
(Your single-paragraph summary here)
===ANSWER_END===";

        public MonteAiResponseService(
            ChatClient chatClient,
            IPineconeService pineconeService,
            ILogger<MonteAiResponseService> logger)
        {
            _chatClient = chatClient;
            _pineconeService = pineconeService;
            _logger = logger;
        }

        public async Task<string> GenerateResponseAsync(string userQuery)
        {
            var chunks = await _pineconeService.RetrieveRelevantChunksAsync(userQuery);
            if (chunks == null || chunks.Count == 0)
            {
                return "No relevant sources were found for this query. Try rephrasing or broadening it.";
            }

            var context = string.Join("\n\n", chunks.Select((c, i) =>
                $"[Source {i + 1}]\n" +
                $"Author(s): {(string.IsNullOrWhiteSpace(c.Authors) ? "Unknown" : c.Authors)}\n" +
                $"Title: {c.Title ?? "Untitled"}\n" +
                $"Year: {c.PublicationYear ?? "n.d."}\n" +
                $"Content: {c.Text}"));
            var userPrompt = $@"SOURCES:
{context}

QUERY:
{userQuery}

Summarize the key findings relevant to the query in one paragraph, citing sources using APA 7th edition citation style by number where applicable.";

            var messages = new List<ChatMessage>
            {
                new SystemChatMessage(SystemPrompt),
                new UserChatMessage(userPrompt)
            };

            // Temperature lowered slightly to 0.2 for better compliance on smaller models like Phi-4-mini
            var options = new ChatCompletionOptions
            {
                MaxOutputTokenCount = 600,
                Temperature = 0.2f
            };

            var completion = await _chatClient.CompleteChatAsync(messages, options);

            _logger.LogInformation("MonteAI response — input tokens: {In}, output tokens: {Out}",
                completion.Value.Usage?.InputTokenCount, completion.Value.Usage?.OutputTokenCount);

            var raw = completion.Value.Content[0].Text;
            var match = AnswerPattern.Match(raw);

            return match.Success ? match.Groups[1].Value.Trim() : raw.Trim();
        }
    }
}