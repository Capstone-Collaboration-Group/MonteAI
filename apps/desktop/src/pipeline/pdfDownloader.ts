
import fs      from 'fs/promises';
import path    from 'path';
import os      from 'os';

export async function downloadPdfToTemp(
    blobUrl:  string,
    thesisId: string
): Promise<string> {
    // console.log('[DEBUG] downloadPdfToTemp received:', { blobUrl, thesisId });
    const response = await fetch(blobUrl);

    if (!response.ok) {
        throw new Error(`Failed to download PDF: ${response.status} ${response.statusText}`);
    }

    const buffer   = Buffer.from(await response.arrayBuffer());
    const tempPath = path.join(os.tmpdir(), `monteai_thesis_${thesisId}.pdf`);

    await fs.writeFile(tempPath, buffer);
    return tempPath;
}

export async function deleteTempPdf(filePath: string): Promise<void> {
    try {
        await fs.unlink(filePath);
    } catch {
        // Non-fatal — OS cleans up tmpdir eventually
    }
}