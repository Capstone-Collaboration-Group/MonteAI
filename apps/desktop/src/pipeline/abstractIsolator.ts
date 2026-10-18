// apps/desktop/src/pipeline/abstractIsolator.ts
//
// Title-page metadata extraction for the ingestion pipeline. Runs on the
// combined text of PDF pages 1-2 (the title/approval pages), where the
// repository's thesis format places the title, authors, and publication year.

interface ExtractedMetadata {
    /** Empty string when the title page shows no match — the server then falls back to the SQL catalog row. */
    title:           string;
    /** Empty string when not found. NEVER a placeholder like "Unknown": sentinels used to overwrite real values and get embedded into vectors. */
    authors:         string;
    /** Empty string when not found. Never defaults to the current year — a wrong year would be embedded as fact. */
    publicationYear: string;
    url:             string;
}

export function extractMetadata(rawText: string, blobUrl: string): ExtractedMetadata {
    // Match "Authors: Mark Villanueva"
    const authorMatch = rawText.match(/Authors?:\s*([^]+?)(?=\s{2,}|Publication Year:|$)/i);
    const authors = authorMatch ? authorMatch[1].trim() : '';

    // Match "Publication Year: 2025"
    const yearMatch = rawText.match(/Publication Year:\s*(\d{4})/i);
    const publicationYear = yearMatch ? yearMatch[1] : '';

    // Title is everything before "Authors:"
    const titleMatch = rawText.match(/^([\s\S]*?)(?=\s{2,}Authors?:)/i);
    const title = titleMatch ? titleMatch[1].trim() : '';

    return { title, authors, publicationYear, url: blobUrl };
}