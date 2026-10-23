// server/Services/AI/QueryModeration.cs
//
// Deterministic, lexicon+heuristic query classification shared by:
//   - MonteAiAgentService — HARMFUL messages get a canned refusal (no LLM,
//     no retrieval, no cache write);
//   - AnalyticsService    — only RESEARCH queries are recorded into
//     ActivityLogs and surfaced as top queries / suggestion chips.
//
// Three classes, first match wins:
//   Harmful — hate speech, slurs, strong profanity, threats, harassment.
//             The agent refuses; never recorded.
//   Noise   — greetings, thanks, identity small talk, our own meta
//             follow-ups ("expand your previous answer…"), and keyboard
//             gibberish. Chat still answers normally; analytics skips it.
//   Research— everything else: a genuine thesis/catalog question.
//
// Matching is spacing/punctuation-proof: "tang ina mo", "f.u.c.k" and
// "Fuck you" all compact to the same key. This is intentionally shallow —
// borderline subtlety is left to the synthesizer's prompt instruction
// (AgentPrompts.BuildAnswerUserPrompt).

using System.Text;
using System.Text.RegularExpressions;

namespace server.Services.AI
{
    public enum QueryClass
    {
        /// <summary>A genuine research question — answer normally AND record.</summary>
        Research = 0,

        /// <summary>Greetings/thanks/meta/gibberish — chat answers, analytics skips.</summary>
        Noise = 1,

        /// <summary>Slurs, threats, harassment — the agent refuses; never recorded.</summary>
        Harmful = 2,
    }

    public static class QueryModeration
    {
        public static QueryClass Classify(string? query)
        {
            if (string.IsNullOrWhiteSpace(query)) return QueryClass.Noise;
            if (IsHarmfulCore(query)) return QueryClass.Harmful;
            if (IsNoiseCore(query)) return QueryClass.Noise;
            return QueryClass.Research;
        }

        /// <summary>True when the agent should refuse instead of answering.</summary>
        public static bool IsHarmful(string? query) => Classify(query) == QueryClass.Harmful;

        /// <summary>True when the query belongs in analytics (top queries / suggestions).</summary>
        public static bool IsRecordable(string? query) => Classify(query) == QueryClass.Research;

        // ─────────────────────────── harmful ───────────────────────────

        /// <summary>
        /// Substring needles matched against the COMPACT form (lowercase,
        /// diacritics folded, non-alphanumerics stripped) so spacing and
        /// punctuation evasion ("tang ina", "f.u.c.k") still hits.
        /// Only strong, unambiguous terms — mild words that could appear in
        /// legitimate research (e.g. "rape" in legal studies) stay out.
        /// </summary>
        private static readonly string[] HarmfulCompactNeedles =
[
    // English profanity / slurs
    "fuck", "fucker", "fucking", "motherfucker", "mofo", "shit", "shithead",
    "bullshit", "bitch", "bitches", "asshole", "arsehole", "cunt", "dickhead",
    "dipshit", "jackass", "cocksucker", "twat", "wanker", "whore", "slut",
    "bastard", "douchebag", "retard", "faggot", "fag", "tranny", "dyke",
    "nigg", "chink", "spic", "kike", "wetback", "gook", "coon",
    "asswhole", "assfukka", "fatass", "biatch", "bollock", "bollok", "bellend",
    "ballbag", "ballsack", "nutsack", "numbnuts", "schlong", "skank", "tosser",
    "twunt", "cocksuck", "cocksuk", "coksuck", "cokmunch", "cockface", "cockhead",
    "cockmunch", "carpetmunch", "fudgepack", "fannyflaps", "pissflaps", "pissoff",
    "knobhead", "knobead", "knobend", "knobjock", "knobjoke", "nobhead", "nobjock",
    "nobjoke", "donkeyribber", "goatse", "buceta", "boiolas", "cyberfuc", "fcuk",
    "fukk", "fukwit", "fukwhit", "fukka", "phuck", "phukk", "fuxor", "muthafeck",
    "jism", "jizz", "titwank", "tittywank", "dildo", "rimjaw", "shemale",
    "arse", "clit", "clits", "cnut", "cok", "kock", "cawk", "kawk", "duche",
"doosh", "fook", "fooker", "fuk", "fuker", "fuks", "fux", "phuk", "phuks",
"hoer", "hore", "whoar", "jap", "jiz", "jizm", "pisser", "pissers", "pusse",
"pussi", "pussies", "pussys", "rimming", "scrote", "scroat", "titties", "titt",
"wank", "wanky", "cummer", "cums", "fags", "fagot", "fagots", "faggs", "faggitt",
// compact-safe
"cunnilingus", "cunilingus", "cunillingus", "kunilingus", "fellatio", "felching",
"gangbang", "hardcoresex", "hotsex", "phonesex", "gaysex", "masturbat", "masterbat",
"masterb8", "m45terbate", "ma5terb8", "cumshot", "ejaculat", "ejakulat", "orgasm",
"orgasim", "pornography", "bestiality", "beastiality", "buttplug", "smegma",
// whole-word
"anal", "anus", "porn", "porno", "p0rn", "penis", "vagina", "vulva", "clitoris",
"scrotum", "rectum", "semen", "testicle", "testical", "labia", "boner", "horny",
"cunnilingus", "cunilingus", "cunillingus", "kunilingus", "fellatio", "felching",
"gangbang", "hardcoresex", "hotsex", "phonesex", "gaysex", "masturbat", "masterbat",
"masterb8", "m45terbate", "ma5terb8", "cumshot", "ejaculat", "ejakulat", "orgasm",
"orgasim", "pornography", "bestiality", "beastiality", "buttplug", "smegma",

    // Filipino / Tagalog profanity
    "putangina", "putanginamo", "potangina", "tangina", "tanginamo",
    "kinangina", "kingina", "ampota", "putragis", "putres", "punyeta",
    "punyemas", "pucha", "pakyu", "pakshet", "pakshit", "bwisit", "buwisit",
    "pisti", "pesteng", "lintik", "hinayupak", "hayup", "tarantado",
    "gunggong", "kupal", "pokpok", "kantot", "jakol", "burat", "pekpek",
    "puke", "walanghiya", "inutil", "ungas", "siraulo", "ulol", "gago",
    "puta", "pota", "tanga", "bobo", "tite", "titi", "leche", "dick", "cock",
    "pussy", "piss", "tits", "ass", "fag", "coon", "kys", "esmiringhoy",
    "ponyeta", "kantot", "bilat", "engot", "ogag", "gaga", "ratbu", "tete", "teti", "tae",
    "kiki", "tinil", "timang", "hudas", "poki",

    // Cebuano
    "yawa", "pisteyawa", "buang", "atay",

    // Threats / calls for self-harm (compact phrases)
    "killyou", "killyourself", "killyourselves", "kys", "hurtyou", "rapeyou",
    "rapedyou", "molestyou", "stabyou", "shootyou", "beatyouup", "hangyourself",
    "gofuckyourself", "godie", "gokillyourself", "hopeyoudie", "diebitch",
    "patayinkita", "papatayinkita", "patayka", "mamatayka", "magpakamatay",
    "gagahasainkita", "ipapapatayka",
];

        /// <summary>
        /// Word-boundary terms matched against the lowercased original text —
        /// short words where a compact substring would over-match
        /// ("gag order" must NOT flag "gago").
        /// </summary>
        private static readonly Regex HarmfulWordRegex = new(
            @"\b(kys|gago|gagi|bobo|tanga|ulol|kupal|kopal)\b",
            RegexOptions.IgnoreCase | RegexOptions.Compiled | RegexOptions.CultureInvariant);

        private static bool IsHarmfulCore(string query)
        {
            if (HarmfulWordRegex.IsMatch(NormalizeDiacritics(query))) return true;

            var compact = Compact(query);
            foreach (var needle in HarmfulCompactNeedles)
            {
                if (compact.Contains(needle, StringComparison.Ordinal)) return true;
            }
            return false;
        }

        // ──────────────────────────── noise ────────────────────────────

        /// <summary>Exact small-talk / identity replies (matched on the compact form).</summary>
        private static readonly HashSet<string> NoiseExactCompact = new(StringComparer.Ordinal)
        {
            "hi", "hello", "hey", "yo", "sup", "hola", "howdy", "kumusta", "kumustaka", "hiya",
            "thanks", "thankyou", "thanku", "thx", "salamat", "salamatpo", "ty",
            "bye", "goodbye", "seeyou", "goodnight", "goodmorning", "goodafternoon", "goodevening",
            "howareyou", "whoareyou", "whatareyou", "whatisthis",
            "whatcanyoudo", "whatdoyoudo", "help", "test", "ok", "okay", "cool", "nice",
            "wow", "haha", "lol", "lmao", "yes", "no", "maybe",
        };

        /// <summary>
        /// Meta follow-ups whose text is identical across sessions/topics —
        /// the chat pipeline handles them via history blending, but they must
        /// not pollute top queries or suggestion chips. Mirrors the agent's
        /// ContextDependentFollowUp intent plus the Expand button's prompt.
        /// </summary>
        private static readonly string[] NoiseContains =
        [
            "your previous answer", "previous answer", "expand your previous",
            "more detail and examples",
            "the source you provided", "the sources you provided", "sources you provided",
            "you provided", "you mentioned", "you listed", "you showed me", "you shared with me",
            "more about it", "more about them", "more about this", "more about that",
            "more about those", "more about these",
        ];

        /// <summary>A single whitespace-free token longer than 30 chars — keyboard mash.</summary>
        private static readonly Regex MegaWordRegex = new(@"\S{31,}", RegexOptions.Compiled);

        private static bool IsNoiseCore(string query)
        {
            var lowered = NormalizeDiacritics(query).ToLowerInvariant();

            if (NoiseExactCompact.Contains(Compact(query))) return true;

            foreach (var phrase in NoiseContains)
            {
                if (lowered.Contains(phrase, StringComparison.Ordinal)) return true;
            }

            // Gibberish: no letters at all, a mega-word, too few vowels, or
            // one/two letters repeated (aaaaaaaa / hahahahaha).
            var letters = new string(lowered.Where(char.IsLetter).ToArray());
            if (letters.Length == 0) return true;
            if (MegaWordRegex.IsMatch(query)) return true;
            if (letters.Length >= 8 && letters.Distinct().Count() <= 2) return true;
            if (letters.Length >= 12)
            {
                var vowels = letters.Count(c => "aeiou".IndexOf(c) >= 0);
                if (vowels / (double)letters.Length < 0.15) return true;
            }

            return false;
        }

        // ─────────────────────── normalization helpers ───────────────────────

        /// <summary>Folds diacritics (ñ→n, é→e) so compact matching sees plain ASCII.</summary>
        private static string NormalizeDiacritics(string text)
        {
            var normalized = text.Normalize(NormalizationForm.FormD);
            var sb = new StringBuilder(normalized.Length);
            foreach (var c in normalized)
            {
                var category = System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c);
                if (category != System.Globalization.UnicodeCategory.NonSpacingMark)
                {
                    sb.Append(c);
                }
            }
            return sb.ToString().Normalize(NormalizationForm.FormC);
        }

        /// <summary>Lowercase + keep only [a-z0-9] — the evasion-proof match key.</summary>
        private static string Compact(string text)
        {
            var folded = NormalizeDiacritics(text).ToLowerInvariant();
            var sb = new StringBuilder(folded.Length);
            foreach (var c in folded)
            {
                if ((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')) sb.Append(c);
            }
            return sb.ToString();
        }
    }
}
