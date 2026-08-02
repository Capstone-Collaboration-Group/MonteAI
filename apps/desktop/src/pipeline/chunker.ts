export function chunkText(
    text:      string,
    chunkSize: number,
    overlap:   number
): string[] {
    const words  = text.split(/\s+/).filter(Boolean);
    const chunks: string[] = [];
    let start = 0;
    chunkSize = 512
    overlap = 50;

    while (start < words.length) {
        const chunk = words.slice(start, start + chunkSize).join(' ');
        chunks.push(chunk);
        if (start + chunkSize >= words.length) break;
        start += chunkSize - overlap;
    }

    return chunks;
}