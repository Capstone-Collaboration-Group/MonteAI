// server/Services/Theses/AbstractChunker.cs
//
// Server-side port of apps/desktop/src/pipeline/chunker.ts — word-based
// fixed-size chunking with overlap, used when the server indexes an abstract
// itself (admin archival uploads) instead of receiving chunks from the
// Electron pipeline via POST /thesis/ingest.
//
// NOTE: chunkSize/overlap are counted in WORDS, not model tokens. A 512-word
// chunk is roughly 650-700 tokens for text-embedding-3-small, safely inside
// the model's 8191-token input limit, and keeps typical abstracts
// (150-350 words) in 1-2 chunks.

namespace server.Services.Theses
{
    public static class AbstractChunker
    {
        public const int DefaultChunkWords = 512;
        public const int DefaultOverlapWords = 50;

        /// <summary>
        /// Splits text into overlapping word chunks.
        /// </summary>
        /// <param name="text">Raw abstract text.</param>
        /// <param name="chunkSize">Words per chunk.</param>
        /// <param name="overlap">Words shared between consecutive chunks.</param>
        public static IReadOnlyList<string> Chunk(
            string? text,
            int chunkSize = DefaultChunkWords,
            int overlap = DefaultOverlapWords)
        {
            if (string.IsNullOrWhiteSpace(text)) return [];

            // null separator = any whitespace (spaces, tabs, newlines).
            var words = text.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries);
            if (words.Length == 0) return [];

            var chunks = new List<string>();
            var start = 0;

            while (start < words.Length)
            {
                var take = Math.Min(chunkSize, words.Length - start);
                chunks.Add(string.Join(' ', words, start, take));

                if (start + take >= words.Length) break;

                // Guard against a non-positive step (overlap >= chunkSize
                // would loop forever) — mirrors the desktop chunker.
                var step = Math.Max(1, chunkSize - overlap);
                start += step;
            }

            return chunks;
        }
    }
}
