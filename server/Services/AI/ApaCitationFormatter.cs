// server/Services/AI/ApaCitationFormatter.cs
//
// APA 7th-edition reference formatter for cited chat sources — the tool
// behind the "Cite" button on assistant messages (copy an APA citation).
//
// Reference form (APA 7, unpublished manuscript / thesis):
//   Cruz, J. D., & Santos, M. R. (2024). Title of the thesis [Unpublished manuscript]. Colegio de Montalban.
//   Title of the thesis (2024). [Unpublished manuscript]. Colegio de Montalban.   ← no authors
//
// Author names arrive as display strings joined with ", " (see
// ThesisAuthorNames.Join): "Juan D. Cruz Jr., Maria Santos". Each name is
// normally "Given [Middle] Surname [Suffix]" — the LAST non-suffix token is
// treated as the surname (best-effort: multi-word Filipino surnames such as
// "Dela Cruz" collapse to the final word; names already written
// "Surname, Given" pass through unchanged).
//
// Output is PLAIN TEXT: APA italics cannot round-trip through the clipboard,
// so titles/institutions are not italicized.

using System.Text.RegularExpressions;
using server.Models.DTOs.ChatMessage;
using server.Services.Interfaces;

namespace server.Services.AI
{
    public class ApaCitationFormatter : IApaCitationFormatter
    {
        private const string Institution = "Colegio de Montalban";
        private const string WorkType = "[Unpublished undergraduate thesis]";
        private const string FallbackTitle = "Untitled thesis";

        /// <summary>Publication year field → the first 19xx/20xx token (the field can carry extra text).</summary>
        private static readonly Regex YearRegex = new(@"\b(?:19|20)\d{2}\b", RegexOptions.Compiled);

        /// <summary>Generational suffixes that sit AFTER the surname in APA author elements.</summary>
        private static readonly HashSet<string> Suffixes = new(StringComparer.OrdinalIgnoreCase)
        {
            "jr.", "jr", "sr.", "sr", "ii", "iii", "iv", "v",
        };

        public string FormatApa7(ChatSourceDto source)
        {
            ArgumentNullException.ThrowIfNull(source);

            var year = ExtractYear(source.PublicationYear);
            var title = string.IsNullOrWhiteSpace(source.Title) ? FallbackTitle : source.Title.Trim();
            var authors = FormatAuthorList(SplitAuthors(source.Authors));

            return authors is null
                ? $"{title} ({year}). {WorkType}. {Institution}."
                : $"{authors} ({year}). {title} {WorkType}. {Institution}.";
        }

        public IReadOnlyList<string> FormatAll(IReadOnlyList<ChatSourceDto> sources)
        {
            ArgumentNullException.ThrowIfNull(sources);
            return sources.Select(FormatApa7).ToList();
        }

        /// <summary>
        /// Splits the stored Authors string into individual names.
        /// ";" and newlines are explicit per-author separators (admin-entered
        /// "Dela Cruz, J.; Santos, M." stays intact); otherwise ", " — the
        /// join separator used by ThesisAuthorNames.Join.
        /// </summary>
        private static List<string> SplitAuthors(string? raw)
        {
            if (string.IsNullOrWhiteSpace(raw)) return [];

            var separator = raw.Contains(';') ? ";" : raw.Contains('\n') ? "\n" : ", ";
            return raw
                .Split(separator, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Where(name => name.Length > 0)
                .ToList();
        }

        /// <summary>APA author element: "Cruz, J. D., &amp; Santos, M." — null when there are no authors.</summary>
        private static string? FormatAuthorList(List<string> names)
        {
            if (names.Count == 0) return null;

            // APA 7: 21+ authors list the first 19, an ellipsis, then the last.
            IEnumerable<string> effective = names.Count > 21
                ? names.Take(19).Append("…").Append(names[^1])
                : names;

            var formatted = effective.Select(FormatAuthor).ToList();

            if (formatted.Count == 1) return formatted[0];
            return $"{string.Join(", ", formatted[..^1])}, & {formatted[^1]}";
        }

        /// <summary>"Juan D. Cruz Jr." → "Cruz, J. D., Jr." (best-effort surname heuristic — see file header).</summary>
        private static string FormatAuthor(string name)
        {
            if (string.IsNullOrWhiteSpace(name)) return string.Empty;
            name = name.Trim();

            // Already "Surname, Given" — leave it alone.
            if (name.Contains(',')) return name;

            var tokens = name.Split(' ', StringSplitOptions.RemoveEmptyEntries);

            // Peel a trailing suffix so the surname is the token before it.
            string? suffix = null;
            if (tokens.Length > 1 && Suffixes.Contains(tokens[^1]))
            {
                suffix = char.ToUpperInvariant(tokens[^1][0]) + tokens[^1][1..];
                tokens = tokens[..^1];
            }

            if (tokens.Length == 0) return name;

            var surname = tokens[^1];
            var initials = tokens[..^1]
                .Select(token => InitialOf(token))
                .Where(i => i.Length > 0);

            var core = $"{surname}, {string.Join(" ", initials)}".TrimEnd(' ', ',');
            return suffix is null ? core : $"{core}, {suffix}";
        }

        /// <summary>"Juan" → "J." ; "D." → "D." ; "McDonald" → "M."</summary>
        private static string InitialOf(string token)
        {
            var first = token.Trim().TrimStart('.');
            return first.Length > 0 ? $"{char.ToUpperInvariant(first[0])}." : string.Empty;
        }

        private static string ExtractYear(string? publicationYear)
        {
            if (string.IsNullOrWhiteSpace(publicationYear)) return "n.d.";
            return YearRegex.Match(publicationYear) is { Success: true } m ? m.Value : "n.d.";
        }
    }
}
