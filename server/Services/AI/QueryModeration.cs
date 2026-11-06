// server/Services/AI/QueryModeration.cs
//
// Deterministic, lexicon+heuristic query classification shared by:
//   - MonteAiAgentService — refusal classes get a canned reply (no LLM,
//     no retrieval, no cache write);
//   - AnalyticsService    — only RESEARCH queries are recorded into
//     ActivityLogs and surfaced as top queries / suggestion chips.
//
// Refusal checks run BEFORE research eligibility, including on mixed
// attack/research requests. Unknown but harmless questions can still go
// through chat; they are not automatically promoted into public suggestions.
// This is a deterministic promotion policy, not a complete jailbreak detector.

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

        /// <summary>Instruction overrides, role overrides, or prompt extraction.</summary>
        PromptInjection = 3,

        /// <summary>Repository/account mutations — chat is read-only.</summary>
        AdministrativeAction = 4,

        /// <summary>Non-research tasks such as writing code, stories, or recipes.</summary>
        OutOfScope = 5,

        /// <summary>No clear research intent; chat may answer, but analytics skips it.</summary>
        Unknown = 6,
    }

    public static class QueryModeration
    {
        public static QueryClass Classify(string? query)
        {
            if (string.IsNullOrWhiteSpace(query)) return QueryClass.Noise;

            var text = NormalizeDiacritics(query).ToLowerInvariant();
            var words = WordSeparators.Replace(text, " ").Trim();
            var foldedWords = WordSeparators.Replace(FoldLeetspeak(text), " ").Trim();
            if (IsHarmfulCore(words, foldedWords)) return QueryClass.Harmful;
            if (PromptInjectionPatterns.Any(pattern => pattern.IsMatch(text) || pattern.IsMatch(words) || pattern.IsMatch(foldedWords))) return QueryClass.PromptInjection;
            if (AdminActionPattern.IsMatch(words) || AdminActionPattern.IsMatch(foldedWords)) return QueryClass.AdministrativeAction;
            if (OutOfScopePatterns.Any(pattern => pattern.IsMatch(text) || pattern.IsMatch(words) || pattern.IsMatch(foldedWords))) return QueryClass.OutOfScope;
            if (IsNoiseCore(text, words)) return QueryClass.Noise;
            return IsResearchCore(words) ? QueryClass.Research : QueryClass.Unknown;
        }

        /// <summary>True for harmful/explicit content; other refusal classes are separate.</summary>
        public static bool IsHarmful(string? query) => Classify(query) == QueryClass.Harmful;

        /// <summary>True when the query belongs in analytics (top queries / suggestions).</summary>
        public static bool IsRecordable(string? query) =>
            query is { Length: <= 500 } && Classify(query) == QueryClass.Research;

        /// <summary>
        /// True for capability small-talk ("what can you do / help me with?",
        /// "Hi! What can you help me with?"). The agent answers these with a
        /// fixed, citation-free reply — no retrieval (which would attach
        /// unrelated theses) and no LLM call (no quota tick).
        /// </summary>
        public static bool IsCapability(string? query) =>
            !string.IsNullOrWhiteSpace(query) && IsCapabilityCore(Compact(query));

        private static bool IsCapabilityCore(string compact) =>
            compact.Length <= 60 &&
            (CapabilityCompact.Contains(compact, StringComparer.Ordinal) ||
             // The tail alone is too loose ("studies that help me with" would
             // hit) — a real capability question addresses the assistant, so
             // it contains "you" ("can YOU help me", "what can YOU do").
             (compact.Contains("you", StringComparison.Ordinal) &&
               NoiseCapabilitySuffixes.Any(suffix => compact.EndsWith(suffix, StringComparison.Ordinal))));

        private const RegexOptions MatchingOptions = RegexOptions.Compiled | RegexOptions.CultureInvariant;
        private static readonly Regex WordSeparators = new(@"[^\p{L}\p{N}]+", MatchingOptions);
        private const string CommandPrefix = @"(?:^|[.!?;,]\s*|\b(?:please|and|then|also)\s+)(?:please\s+)?(?:(?:can|could|would|will)\s+you\s+|i\s+(?:want|need|would like)\s+you\s+to\s+|help\s+me\s+)?(?:please\s+)?";

        // Action/target pairs, not topic bans: research ABOUT system prompts,
        // jailbreak detection, or digital storytelling remains legitimate.
        private static readonly Regex[] PromptInjectionPatterns =
        [
            new(@"\b(?:ignore|disregard|forget|override|bypass|disable|suspend|replace)\s+(?:(?:all|any|the|your|my|our|previous|prior|earlier|system|developer|safety|security|existing|these|those|above|content)\s+){0,6}(?:instructions?|rules?|prompts?|restrictions?|guardrails?|safeguards?|filters?|polic(?:y|ies))\b", MatchingOptions),
            new(@"\b(?:ignore|disregard|forget)\s+(?:all\s+)?(?:previous|prior|earlier|above)\b|\b(?:do not|don t|never)\s+(?:follow|obey|apply|enforce)\s+(?:(?:the|your|previous|system|developer|safety)\s+){0,5}(?:instructions?|rules?|restrictions?|polic(?:y|ies))\b", MatchingOptions),
            new(@"\b(?:reveal|show|print|repeat|output|display|share|leak|dump|expose|quote|recite|return|give|encode|translate|convert)\s+(?:(?:me|us|the|a|an|all|entire|full|exact|hidden|original|complete|verbatim|text|of)\s+){0,6}(?:your\s+(?:(?:system|developer|initial|hidden|internal)\s+)?(?:prompt|instructions?|configuration|config|rules?|polic(?:y|ies))|(?:system|developer|hidden|internal)\s+(?:prompt|instructions?|message|configuration))\b|\b(?:describe|explain)\s+your\s+(?:(?:system|developer|initial|hidden|internal)\s+)?(?:prompt|instructions?|configuration|config|rules?|polic(?:y|ies))\b", MatchingOptions),
            new(@"\bwhat\s+(?:is|are|was|were)\s+your\s+(?:(?:system|developer|initial|hidden|internal)\s+)?(?:prompt|instructions?|configuration|config|rules?|polic(?:y|ies))\b|\bwhat were you told\b|\b(?:output|return|print|dump)\b.{0,100}\b(?:system prompt|developer instructions)\b", MatchingOptions),
            new(@"\b(?:pretend\s+(?:(?:that\s+)?you\s+(?:are|re)|to\s+be)|you\s+are\s+now|from\s+now\s+on\s+you|do\s+anything\s+now|never\s+refuse|always\s+obey|stay\s+in\s+character)\b|^you are (?:a|an)\b|\b(?:enable|enter|activate|switch to|turn on)\s+(?:developer|dan|jailbreak|unrestricted|god)\s+mode\b|\b(?:jailbreak|unrestrict)\s+(?:yourself|your|this|the)\b|\bfirst say\b|\bsay ok then\b", MatchingOptions),
            new(CommandPrefix + @"(?:act\s+as|role\s*play\s+as)\b", MatchingOptions),
            new(@"\b(?:huwag|wag)\s+(?:mo\s+|mong\s+)?sundin\s+(?:(?:ang|mga|iyong|dating)\s+){0,4}(?:instructions?|rules?|patakaran|tagubilin)\b|\b(?:ipakita|ibigay|ilabas|sabihin)\s+(?:(?:mo|ang|iyong|mga|sa akin)\s+){0,4}(?:system prompt|developer instructions|iyong instructions)\b", MatchingOptions),
        ];

        private static readonly Regex AdminActionPattern = new(
            @"\b(?:approve|reject|delete|remove|archive|publish|reindex)\s+(?:(?:this|that|the|my|all|these|those|our)\s+){0,3}(?:thes(?:is|es)|stud(?:y|ies)|papers?|submissions?|records?|accounts?|users?|index|database|documents?)\b|" +
            @"\b(?:approve|reject|delete|archive|publish)\s+(?:this|my)\b|\b(?:mark as indexed|reindex for me)\b|" +
            @"\b(?:change|update|reset|set)\s+(?:my|the|your)\s+(?:account|password|role)\b|" +
            @"\b(?:make|give|grant)\s+me\s+(?:an?\s+)?admin\b|\bgrant admin\b|\b(?:promote|assign)\s+me\b|\b(?:set|change|update)\b.{0,30}\brole to admin\b",
            MatchingOptions);

        private static readonly Regex[] OutOfScopePatterns =
        [
            new(CommandPrefix + @"(?:write|compose|generate|create|tell)\s+(?:(?:me|a|an|the|some)\s+){0,3}(?:poems?|stor(?:y|ies)|jokes?|essays?|recipes?|songs?)\b", MatchingOptions),
            new(CommandPrefix + @"(?:write|compose|generate|create|do)\s+(?:(?:me|my|a|an|the|some|new|complete)\s+){0,4}(?:thes(?:is|es)|dissertations?|research papers?|assignments?|homework)\b", MatchingOptions),
            new(CommandPrefix + @"(?:write|generate|create|fix|debug|repair)\b.{0,50}\b(?:code|scripts?|functions?|programs?|methods?)\b|\b(?:fix|debug|repair)\s+(?:my|this|the|our)\s+(?:code|scripts?|functions?|programs?|methods?)\b", MatchingOptions),
            new(CommandPrefix + @"(?:translate|calculate)\b|^(?:what is|what s|how is|tell me)\s+(?:the\s+)?(?:weather|time|date|horoscope)\b", MatchingOptions),
        ];

        // Positive evidence is necessary for promotion. The topic vocabulary
        // covers common catalog searches; unfamiliar harmless topics still
        // reach the agent, rather than being refused just for being unfamiliar.
        private static readonly Regex ResearchReferencePattern = new(
            @"\b(?:thes(?:is|es)|stud(?:y|ies)|research|papers?|dissertations?|repository|catalog|literature|methodolog(?:y|ies)|findings|abstracts?|citations?|bibliograph(?:y|ies))\b",
            MatchingOptions);
        private static readonly Regex ResearchLookupPattern = new(
            @"^who\s+(?:authored|wrote|is\s+(?:the\s+)?author\s+of)\s+\p{L}.{2,}$|^(?:what\s+year|when)\s+(?:was|is)\b.+\b(?:published|written|submitted|completed)\b|\b(?:iso\s*(?:iec\s*)?|iec\s*)\d+(?:\s+\d+)*\b",
            MatchingOptions);
        private static readonly Regex ResearchTopicPattern = new(
            @"\b(?:education(?:al)?|learning|literacy|gamification|pedagogy|students?|teachers?|classrooms?|curriculum|academic|assessment|teaching|computational|computing|computer|software|algorithms?|technology|artificial intelligence|machine learning|computer vision|ai|iot|cloud|data|databases?|cybersecurity|cyberbullying|encryption|prompt injection|jailbreak detection|environment(?:al)?|renewable|energy|climate|agriculture|irrigation|water|wastewater|waste|sustainability|pollution|business|marketing|entrepreneurship|finance|financial|accounting|startups?|commerce|health|nutrition|psychology|medicine)\b",
            MatchingOptions);
        private static readonly Regex ResearchRequestPattern = new(
            @"^(?:please\s+)?(?:(?:can|could|would|will)\s+you\s+)?(?:please\s+)?(?:find|list|show|search|look\s+for|looking\s+for|recommend|suggest|summari[sz]e|compare|cite|explain|analy[sz]e|describe|what|which|who|when|where|how|why|any|are\s+there|is\s+there|do\s+you\s+have)\b",
            MatchingOptions);
        private static readonly Regex PersonalOrTaskPattern = new(
            @"\b(?:i|me|my|mine|you|your|yours|we|us|our|this|that|it|them|is|are|was|were|can|must|should|tell|say|write|generate|execute|pretend|obey|hack|steal|leak|reveal)\b",
            MatchingOptions);

        private static bool IsResearchCore(string words) =>
            ResearchLookupPattern.IsMatch(words) ||
            ((ResearchReferencePattern.IsMatch(words) || ResearchTopicPattern.IsMatch(words)) &&
             (ResearchRequestPattern.IsMatch(words) || !PersonalOrTaskPattern.IsMatch(words)));

        // ─────────────────────────── harmful ───────────────────────────

        /// <summary>
        /// Terms/phrases match with word boundaries and optional separators
        /// between letters: "tang ina" and "f.u.c.k" still hit, but "puta"
        /// inside "computational" and "titi" inside "competition" do not.
        /// </summary>
        private static readonly string[] HarmfulTerms =
[
    // English profanity / slurs
    "fuck", "fuckyou", "fuckoff", "fucker", "fucking", "motherfucker", "mofo", "shit", "shithead",
    "bullshit", "bitch", "bitches", "asshole", "arsehole", "cunt", "dickhead",
    "dipshit", "jackass", "cocksucker", "twat", "wanker", "whore", "slut",
    "bastard", "douchebag", "retard", "faggot", "fag", "tranny", "dyke",
    "nigg", "chink", "kike", "wetback", "gook",
    "asswhole", "assfukka", "fatass", "biatch", "bollock", "bollok", "bellend",
    "ballbag", "ballsack", "nutsack", "numbnuts", "schlong", "skank", "tosser",
    "twunt", "cocksuck", "cocksuk", "coksuck", "cokmunch", "cockface", "cockhead",
    "cockmunch", "carpetmunch", "fudgepack", "fannyflaps", "pissflaps", "pissoff",
    "knobhead", "knobead", "knobend", "knobjock", "knobjoke", "nobhead", "nobjock",
    "nobjoke", "donkeyribber", "goatse", "buceta", "boiolas", "cyberfuc", "fcuk",
    "fukk", "fukwit", "fukwhit", "fukka", "phuck", "phukk", "fuxor", "muthafeck",
    "jism", "jizz", "titwank", "tittywank", "dildo", "rimjaw", "shemale",
    "clit", "clits", "cnut", "kock", "cawk", "kawk", "duche",
    "doosh", "fook", "fooker", "fuk", "fuker", "fuks", "fux", "phuk", "phuks",
    "hoer", "jiz", "jizm", "pisser", "pissers", "pusse",
"pussi", "pussies", "pussys", "rimming", "scrote", "scroat", "titties", "titt",
"wank", "wanky", "cummer", "cums", "fags", "fagot", "fagots", "faggs", "faggitt",
// compact-safe
"cunnilingus", "cunilingus", "cunillingus", "kunilingus", "fellatio", "felching",
"gangbang", "hardcoresex", "hotsex", "phonesex", "gaysex", "masturbat", "masterbat",
"masterb8", "m45terbate", "ma5terb8", "cumshot", "ejaculat", "ejakulat", "orgasm",
"orgasim", "pornography", "bestiality", "beastiality", "buttplug", "smegma",
// whole-word
"anus", "porn", "porno", "p0rn", "penis", "vagina", "vulva", "clitoris",
"scrotum", "rectum", "semen", "testicle", "testical", "labia", "boner", "horny",

    // Filipino / Tagalog profanity
    "putangina", "putanginamo", "potangina", "tangina", "tanginamo",
    "kinangina", "kingina", "ampota", "putragis", "putres", "punyeta",
    "punyemas", "pucha", "pakyu", "pakshet", "pakshit", "bwisit", "buwisit",
    "pisti", "pesteng", "lintik", "hinayupak", "hayup", "tarantado",
    "gunggong", "kupal", "pokpok", "kantot", "jakol", "burat", "pekpek",
    "puke", "walanghiya", "inutil", "ungas", "siraulo", "ulol",
    "puta", "pota", "tite", "titi", "leche", "dick",
    "pussy", "piss", "tits", "fag", "kys", "esmiringhoy",
    "ponyeta", "bilat", "engot", "ogag", "gaga", "ratbu", "tete", "teti",
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
        /// Word-boundary terms matched against the diacritic-folded original
        /// text — short terms where a compact substring would over-match:
        /// "gag order" must NOT flag "gago", "who are you?" must NOT flag
        /// "whoar", "analysis"/"canal" must NOT flag "anal", "Japan" must NOT
        /// flag "jap", "class"/"pass"/"assessment" must NOT flag "ass",
        /// "cocktail" must NOT flag "cock", "raccoon" must NOT flag "coon",
        /// "spice" must NOT flag "spic", "parse" must NOT flag "arse",
        /// "shore" must NOT flag "hore", "taekwondo" must NOT flag "tae".
        /// </summary>
        private static readonly Regex HarmfulWordRegex = new(
            @"\b(kys|gago|gagi|bobo|tanga|ulol|kupal|kopal|ass|arse|anal|jap|spic|coon|cock|cok|hore|whoar|tae)\b",
            RegexOptions.IgnoreCase | RegexOptions.Compiled | RegexOptions.CultureInvariant);

        // These entries were deliberately stems in the original lexicon.
        // Preserve suffix matching at the START of a word, not inside innocent
        // words. Other terms require both boundaries.
        private static readonly HashSet<string> HarmfulStems = new(StringComparer.Ordinal)
        {
            "nigg", "masturbat", "masterbat", "ejaculat", "ejakulat", "cocksuck", "fudgepack",
        };

        private static readonly Regex HarmfulSeparatedPattern = new(
            @"\b(?:" + string.Join('|', HarmfulTerms.Distinct(StringComparer.Ordinal).Select(term =>
                string.Join(@"\s*", FoldLeetspeak(term).Select(c => Regex.Escape(c.ToString()))) +
                (HarmfulStems.Contains(term) ? @"\p{L}*" : string.Empty))) + @")\b",
            MatchingOptions);

        // Directed harm or explicit-content requests, including research words
        // used as a pretext. Academic references to abuse/detection alone are
        // not treated as requests to carry out that abuse.
        private static readonly Regex HarmfulRequestPattern = new(
            @"\b(?:how\s+(?:to|do i|can i)|help\s+me|teach\s+me\s+(?:how\s+)?to|instructions\s+(?:to|for))\s+(?:make\s+(?:a\s+)?bomb|kill|hurt|poison|stab|shoot|rape|molest|steal|hack)\b|" +
            @"\b(?:write|generate|show|send|give|create|describe)\b.{0,60}\b(?:explicit sexual|sexual content|erotica|nudes?|nsfw)\b|" +
            @"\b(?:you\s+are|you\s+re|ur)\s+(?:an?\s+)?(?:stupid|idiot|moron|worthless|useless)\b",
            MatchingOptions);

        private static bool IsHarmfulCore(string words, string foldedWords) =>
            HarmfulWordRegex.IsMatch(words) || HarmfulWordRegex.IsMatch(foldedWords) ||
            HarmfulSeparatedPattern.IsMatch(words) || HarmfulSeparatedPattern.IsMatch(foldedWords) ||
            HarmfulRequestPattern.IsMatch(words) || HarmfulRequestPattern.IsMatch(foldedWords);

        private static string FoldLeetspeak(string text) => text
            .Replace('0', 'o').Replace('1', 'i').Replace('3', 'e')
            .Replace('4', 'a').Replace('@', 'a').Replace('5', 's').Replace('$', 's')
            .Replace('7', 't').Replace('!', 'i');

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
        /// Capability small-talk ("what can you do / help me with"). Kept
        /// separate from the exact set because it answers a distinct need:
        /// "Hi! What can you help me with?" compacts to a phrase nobody can
        /// enumerate up front — without this it classified as Research and
        /// the guaranteed retrieval attached unrelated theses as Sources to a
        /// pure small-talk message.
        /// </summary>
        private static readonly string[] CapabilityCompact =
        [
            "whatcanyoudo", "whatdoyoudo", "whatcanyouhelpmewith", "howcanyouhelpmewith",
            "howcanyouhelpme", "whatcanyoudoforme", "whatdoyoudoforme", "whatcanyoudowithme",
            "whatdoyoudohere", "whatkindofhelpcanyougive", "whatcanyouassistmewith",
            "howcanyouassistme", "tellmewhatcanyoudo", "tellmewhatyoucando",
            "whatcanidaskyou", "whatquestionscanyouanswer", "yourcapabilities",
        ];

        /// <summary>
        /// Capability-question TAILS for greeting hybrids the exact list cannot
        /// enumerate ("Hi! What can you help me with?" compacts to
        /// "hiwhatcanyouhelpmewith"). Only short queries qualify (≤ 60 compact
        /// chars) so a genuine research question that merely ends with the
        /// same words still classifies as Research.
        /// </summary>
        private static readonly string[] NoiseCapabilitySuffixes =
        [
            "canyouhelpme", "helpmewith", "canyoudoforme", "doyoudoforme",
            "assistmewith", "canyouassistme", "helpmewiththis",
        ];

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

        private static bool IsNoiseCore(string query, string words)
        {
            var compact = Compact(query);

            if (NoiseExactCompact.Contains(compact)) return true;

            // Greeting + capability hybrid ("Hi! What can you help me with?")
            // — matched on its compact tail within small-talk length.
            if (IsCapabilityCore(compact)) return true;

            foreach (var phrase in NoiseContains)
            {
                if (words.Contains(phrase, StringComparison.Ordinal)) return true;
            }

            // Gibberish: no letters at all, a mega-word, too few vowels, or
            // one/two letters repeated (aaaaaaaa / hahahahaha).
            var letters = new string(words.Where(char.IsLetter).ToArray());
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

        /// <summary>Folds accents/full-width characters and removes invisible format characters.</summary>
        private static string NormalizeDiacritics(string text)
        {
            var normalized = text.Normalize(NormalizationForm.FormKD);
            var sb = new StringBuilder(normalized.Length);
            foreach (var c in normalized)
            {
                var category = System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c);
                if (category != System.Globalization.UnicodeCategory.NonSpacingMark &&
                    category != System.Globalization.UnicodeCategory.Format)
                {
                    sb.Append(c);
                }
            }
            return sb.ToString().Normalize(NormalizationForm.FormC);
        }

        /// <summary>Lowercase + keep only [a-z0-9] for small-talk matching.</summary>
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
