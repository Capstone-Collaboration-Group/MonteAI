using System.Text.RegularExpressions;
using server.Models.DTOs.ChatMessage;

namespace server.Services.AI
{
    /// <summary>
    /// Conservative evidence check for explicit "find/list studies about X"
    /// requests. A high vector score can match the application/context while
    /// missing the actual topic. Check each thesis against the ORIGINAL
    /// subject, not just the planner's potentially broader search query.
    /// This is a lexical backstop, not a semantic reranker or proof of findings.
    /// </summary>
    internal sealed class TopicQuery
    {
        private static readonly Regex QueryPattern = new(
            @"^(?:can\s+you\s+)?(?:find|list|show|search\s+for|look\s+for|looking\s+for)\s+(?:me\s+)?(?:some\s+|any\s+)?(?:studies|research|papers|theses|thesis|works)\s+(?:about|on|regarding|related\s+to|for)\s+(?<subject>.+?)[\s\?.!]*$",
            RegexOptions.IgnoreCase | RegexOptions.Compiled | RegexOptions.CultureInvariant);

        // Compound questions, alternatives/negation, and date constraints need
        // the agent's interpretation/structured filters, not an all-terms gate.
        private static readonly Regex NonTopicClause = new(
            @"\?|,\s*(?:and\s+|then\s+)?(?:what|when|how|why|who|which|is|was|are|were|did|does|do|can|could|please)\b|\b(?:or|not|without|excluding|except)\b|\b(?:19|20)\d{2}\b",
            RegexOptions.IgnoreCase | RegexOptions.Compiled | RegexOptions.CultureInvariant);

        // Keep the ISO spelling aliases accepted by keyword_search equivalent
        // here too, without conflating different standard numbers.
        private static readonly Regex StandardDesignation = new(
            @"\bISO(?:\s*/\s*IEC)?\s*(?<num>\d+(?:\.\d+)*)\b",
            RegexOptions.IgnoreCase | RegexOptions.Compiled | RegexOptions.CultureInvariant);

        private static readonly Regex WordPattern = new(@"[\p{L}\p{N}]+", RegexOptions.Compiled);

        private static readonly HashSet<string> StopWords = new(StringComparer.Ordinal)
        {
            "a", "an", "the", "and", "of", "on", "in", "for", "to", "with", "by", "at",
            "from", "as", "into", "within", "about", "using", "use", "uses", "used",
            "that", "which", "are", "is", "be", "has", "have", "their", "its",
            "this", "those", "these", "any", "some",
        };

        private readonly string[] _terms;
        private readonly string _phrase;

        private TopicQuery(string subject, string[] terms)
        {
            Subject = subject;
            _terms = terms;
            _phrase = $" {string.Join(" ", terms)} ";
        }

        public string Subject { get; }

        public static TopicQuery? TryParse(string query)
        {
            var match = QueryPattern.Match(query.Trim());
            if (!match.Success) return null;

            var subject = match.Groups["subject"].Value.Trim();
            if (subject.Length < 3 || NonTopicClause.IsMatch(subject)) return null;

            var terms = GetTerms(subject);
            return terms.Length == 0 ? null : new TopicQuery(subject, terms);
        }

        /// <summary>
        /// Every substantive topic term must occur in this thesis' title or
        /// abstract. Does not use author names or unrelated theses as evidence.
        /// Common inflections are normalized; synonyms still need rephrasing.
        /// The synthesizer must assess whether the text supports the requested
        /// method/findings, rather than treating a term mention as proof.
        /// </summary>
        public bool HasTopicEvidence(ChatSourceDto source)
        {
            var sourceTerms = GetTerms(source.Title)
                .Concat(GetTerms(source.FullExcerpt ?? source.Snippet))
                .ToHashSet(StringComparer.Ordinal);
            return _terms.All(sourceTerms.Contains);
        }

        /// <summary>
        /// A template additionally needs the topic phrase in one field, in
        /// order. Scattered terms or paraphrases go to the agent for judgment.
        /// </summary>
        public bool HasDirectEvidence(ChatSourceDto source) =>
            HasPhrase(source.Title) || HasPhrase(source.FullExcerpt ?? source.Snippet);

        private bool HasPhrase(string? text) =>
            $" {string.Join(" ", GetTerms(text))} ".Contains(_phrase, StringComparison.Ordinal);

        private static string[] GetTerms(string? text) =>
            string.IsNullOrWhiteSpace(text)
                ? []
                : WordPattern.Matches(StandardDesignation.Replace(text, "ISO ${num}").ToLowerInvariant())
                    .Select(m => m.Value)
                    .Where(word => !StopWords.Contains(word))
                    .Select(NormalizeTerm)
                    .ToArray();

        private static string NormalizeTerm(string word)
        {
            if (word.Length > 4 && word.EndsWith("ies", StringComparison.Ordinal))
                word = word[..^3] + "y";
            else if (word.Length > 3 && word.EndsWith('s') &&
                     !word.EndsWith("ss", StringComparison.Ordinal) &&
                     !word.EndsWith("us", StringComparison.Ordinal) &&
                     !word.EndsWith("is", StringComparison.Ordinal))
                word = word[..^1];

            // detecting/detection/detected/detects -> detect; plural assistants
            // -> assistant. Whole tokens only: no substring keyword matches.
            if (word.Length > 5 && word.EndsWith("ing", StringComparison.Ordinal))
                return word[..^3];
            if (word.Length > 6 && word.EndsWith("tion", StringComparison.Ordinal))
                return word[..^3];
            if (word.Length > 5 && word.EndsWith("ed", StringComparison.Ordinal))
                return word[..^2];
            return word;
        }
    }
}
