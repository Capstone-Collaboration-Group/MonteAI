// apps/desktop/src/pipeline/chunker.ts
//
// Word-based fixed-size chunking with overlap for the abstract text.
//
// NOTE: chunkSize/overlap are counted in WORDS, not model tokens. A 512-word
// chunk is roughly 650-700 tokens for text-embedding-3-small, safely inside
// the model's 8191-token input limit. The values are chosen to keep whole
// abstracts in 1-2 chunks (abstracts are typically 150-350 words).

/**
 * Splits text into overlapping word chunks.
 * @param text      Raw abstract text.
 * @param chunkSize Words per chunk (default pipeline usage: 512).
 * @param overlap   Words shared between consecutive chunks, preserving context
 *                  across boundaries (default pipeline usage: 50).
 */
export function chunkText(
    text:      string,
    chunkSize: number,
    overlap:   number
): string[] {
    const words  = text.split(/\s+/).filter(Boolean);
    const chunks: string[] = [];
    let start = 0;

    while (start < words.length) {
        const chunk = words.slice(start, start + chunkSize).join(' ');
        chunks.push(chunk);
        if (start + chunkSize >= words.length) break;
        // Guard against a non-positive step (overlap >= chunkSize would loop forever).
        const step = Math.max(1, chunkSize - overlap);
        start += step;
    }

    return chunks;
}
