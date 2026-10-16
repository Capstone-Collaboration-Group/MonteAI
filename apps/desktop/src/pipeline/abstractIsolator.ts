// apps/desktop/src/pipeline/abstractIsolator.ts
//
// Title-page metadata extraction for the ingestion pipeline. Runs on the
// combined text of PDF pages 1-2 (the title/approval pages), where the
// repository's thesis format places the title, authors, and publication year.

interface ExtractedMetadata {
    title:           string;
    authors:         string;
    publicationYear: string;
    url:             string;
}

export function extractMetadata(rawText: string, blobUrl: string): ExtractedMetadata {
    // Match "Authors: Mark Villanueva"
    const authorMatch = rawText.match(/Authors?:\s*([^]+?)(?=\s{2,}|Publication Year:|$)/i);
    const authors = authorMatch ? authorMatch[1].trim() : 'Unknown';

    // Match "Publication Year: 2025"
    const yearMatch = rawText.match(/Publication Year:\s*(\d{4})/i);
    const publicationYear = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();

    // Title is everything before "Authors:"
    const titleMatch = rawText.match(/^([\s\S]*?)(?=\s{2,}Authors?:)/i);
    const title = titleMatch ? titleMatch[1].trim() : 'Unknown';

    return { title, authors, publicationYear, url: blobUrl };
}