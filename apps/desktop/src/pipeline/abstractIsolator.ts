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
        /(?:abstract|summary|executive\s+summary)\s*[\n\r]+([\s\S]*?)(?=\n\s*(?:introduction|keywords|table of contents|chapter\s+1|acknowledgements)|$)/i;

    const match = rawText.match(abstractPattern);

    if (!match || !match[1].trim()) {
        return { abstract: null, found: false };
    }

    return {
        abstract: match[1].trim(),
        found:    true,
    };
}

export function extractMetadata(rawText: string, blobUrl: string): ExtractedMetadata {
    const lines = rawText
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean);

    const title = lines
        .slice(0, 10)
        .reduce((a, b) => (b.length > a.length ? b : a), '');

    const titleIndex = lines.indexOf(title);
    const authorLine = lines.find(l =>
        /^(by|submitted by|prepared by)/i.test(l)
    );

    let authors = 'Unknown';
    if (authorLine) {
        authors = authorLine.replace(/^(by|submitted by|prepared by)[:\s]*/i, '').trim();
    } else if (titleIndex >= 0) {
        authors = lines
            .slice(titleIndex + 1, titleIndex + 5)
            .filter(l => !l.match(/^\d{4}$/) && !l.match(/abstract/i))
            .join(', ');
    }

    const yearMatch = lines.slice(0, 15).join(' ').match(/\b(20\d{2})\b/);
    const publicationYear = yearMatch
        ? yearMatch[1]
        : new Date().getFullYear().toString();

    return { title, authors, publicationYear, url: blobUrl };
}