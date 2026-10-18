// server/Services/Theses/ThesisSectionFilter.cs
//
// Decides WHICH parts of a full-text PDF extract are indexed as body chunks.
// Only the sections MonteAI should cite are kept:
//   Chapter 1 (Introduction / The Problem and its Background)
//   Chapter 3 (Methodology)
//   Chapter 4 (Results and Discussion)
//   Chapter 5 (Summary, Conclusions and Recommendations = the Conclusion)
// Chapter 2 (Review of Related Literature) is deliberately EXCLUDED — chat
// answers must come from the institution's own findings, not from surveys of
// other people's work — as are front matter, acknowledgements, bibliography,
// appendices and annexes.
//
// Two detection modes:
//   1. "CHAPTER <n>" headings (Arabic / Roman / word numbers) when present.
//   2. Unnumbered section titles (INTRODUCTION, METHODOLOGY, …) as a fallback
//      for theses that never print a chapter line.
// When neither is found the caller treats the document as metadata-only.

using System.Text.RegularExpressions;

namespace server.Services.Theses
{
    public static class ThesisSectionFilter
    {
        public readonly record struct Result(
            IReadOnlyList<string> Sections,
            bool HeadingsDetected);

        // "CHAPTER 1", "Chapter IV", "chapter three" at the start of a line.
        private static readonly Regex ChapterHeading = new(
            @"^[ \t]*(?:CHAPTER|Chapter)[ \t]+(?<num>[0-9]{1,2}|[IVXLCivxlc]{1,6}|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN)\b",
            RegexOptions.Multiline | RegexOptions.Compiled);

        // Full-line back-matter / front-matter titles — always boundaries, and
        // always dropped, in BOTH detection modes (they otherwise leak into
        // the tail of the last kept chapter).
        private static readonly Regex DropTitleBoundary = new(
            @"^[ \t]*(?:BIBLIOGRAPHY|REFERENCES|APPENDI[XC][A-Z ]*|ACKNOWLEDGE?MENTS?|ABSTRACT|CURRICULUM VITAE|VITA|LIST OF (?:TABLES|FIGURES|SYMBOLS))[ \t.:]*$",
            RegexOptions.Multiline | RegexOptions.IgnoreCase | RegexOptions.Compiled);

        // Unnumbered section titles used when no CHAPTER headings exist.
        private static readonly Regex KeepTitleBoundary = new(
            @"^[ \t]*(?:INTRODUCTION|THE PROBLEM AND ITS BACKGROUND|REVIEW OF RELATED LITERATURE|LITERATURE REVIEW|METHODOLOGY|METHODOLOGICAL APPROACH|RESULTS AND DISCUSSION|SUMMARY,? CONCLUSIONS? AND RECOMMENDATIONS?|CONCLUSIONS?|SUMMARY AND CONCLUSIONS?)[ \t.:]*$",
            RegexOptions.Multiline | RegexOptions.IgnoreCase | RegexOptions.Compiled);

        /// <summary>
        /// Splits <paramref name="fullText"/> at recognized headings and
        /// returns only the indexable sections (chapters 1/3/4/5).
        /// <c>HeadingsDetected</c> is false when the document shows no
        /// recognizable structure — the caller should fall back to
        /// metadata-only ingestion instead of indexing the whole text.
        /// </summary>
        public static Result ExtractIndexableSections(string? fullText)
        {
            if (string.IsNullOrWhiteSpace(fullText))
                return new Result(Array.Empty<string>(), false);

            // Pass 1: CHAPTER-based segmentation.
            var chapterMatches = ChapterHeading.Matches(fullText);
            var boundaries = new List<(int Start, int? Chapter, bool Keep)>();

            foreach (Match match in chapterMatches)
            {
                var number = ParseChapterNumber(match.Groups["num"].Value);
                if (number is null) continue;
                boundaries.Add((match.Index, number, IsKeptChapter(number.Value)));
            }

            // Back-matter titles are boundaries (and dropped) even in
            // chapter mode — they sit after Chapter 5 with no CHAPTER line.
            foreach (Match match in DropTitleBoundary.Matches(fullText))
                boundaries.Add((match.Index, null, false));

            // Pass 2 (fallback): unnumbered section titles, only when the
            // document has no CHAPTER headings at all. Mixing both would let
            // a stray "RESULTS" table header re-slice a structured thesis.
            if (chapterMatches.Count == 0)
            {
                foreach (Match match in KeepTitleBoundary.Matches(fullText))
                {
                    var keep = !IsExcludedTitle(match.Value);
                    boundaries.Add((match.Index, null, keep));
                }
            }

            if (boundaries.Count == 0)
                return new Result(Array.Empty<string>(), false);

            boundaries.Sort((a, b) => a.Start.CompareTo(b.Start));

            var sections = new List<string>();
            for (var i = 0; i < boundaries.Count; i++)
            {
                if (!boundaries[i].Keep) continue;

                var start = boundaries[i].Start;
                var end = i + 1 < boundaries.Count ? boundaries[i + 1].Start : fullText.Length;
                var section = fullText[start..end].Trim();
                if (section.Length > 0) sections.Add(section);
            }

            return new Result(sections, true);
        }

        /// <summary>Chapters 1/3/4/5 are citable; 2 (RRL) and 6+ are not.</summary>
        private static bool IsKeptChapter(int number) => number is 1 or 3 or 4 or 5;

        /// <summary>RRL titles are boundaries in fallback mode but never kept.</summary>
        private static bool IsExcludedTitle(string line)
        {
            var trimmed = line.Trim().TrimEnd('.', ':', ' ', '\t').ToUpperInvariant();
            return trimmed.Contains("REVIEW OF RELATED") || trimmed.Contains("LITERATURE REVIEW");
        }

        private static int? ParseChapterNumber(string raw)
        {
            var token = raw.Trim().ToUpperInvariant();

            if (int.TryParse(token, out var arabic)) return arabic;

            if (token.Length > 0 && token.All(c => "IVXLC".Contains(c)))
                return ParseRoman(token);

            return token switch
            {
                "ONE" => 1, "TWO" => 2, "THREE" => 3, "FOUR" => 4, "FIVE" => 5,
                "SIX" => 6, "SEVEN" => 7, "EIGHT" => 8, "NINE" => 9, "TEN" => 10,
                _ => null,
            };
        }

        private static int ParseRoman(string roman)
        {
            var values = new Dictionary<char, int>
            {
                ['I'] = 1, ['V'] = 5, ['X'] = 10, ['L'] = 50, ['C'] = 100,
            };
            var total = 0;
            var previous = 0;
            foreach (var c in roman.ToUpperInvariant().Reverse())
            {
                var current = values[c];
                total += current < previous ? -current : current;
                previous = current;
            }
            return total;
        }
    }
}
