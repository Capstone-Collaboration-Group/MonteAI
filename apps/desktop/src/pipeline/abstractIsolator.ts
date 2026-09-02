interface ExtractedMetadata {
    title:           string;
    authors:         string;
    publicationYear: string;
    url:             string;
}

interface IsolatedAbstract {
    abstract: string | null;
    found:    boolean;
}

export function isolateAbstract(rawText: string): IsolatedAbstract {
    const abstractPattern =
        /\bAbstract\s+([\s\S]*?)(?=\s+(?:Introduction|Keywords|Table of Contents|Chapter\s+1|Acknowledgements|URL:|Record ID:)|$)/i;

    const match = rawText.match(abstractPattern);

    if (!match || !match[1].trim()) {
        return { abstract: null, found: false };
    }

    return {
        abstract: match[1].trim(),
        found: true,
    };
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