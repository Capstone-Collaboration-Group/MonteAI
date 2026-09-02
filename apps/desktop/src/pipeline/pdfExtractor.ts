import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { pathToFileURL } from 'url';

const workerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).toString();

export async function extractText(filePath: string): Promise<string> {
    const pdf = await pdfjs.getDocument({
        url:            filePath,
        useWorkerFetch: false,
        useSystemFonts: true,
    }).promise;

    let fullText = '';
    const pagesToScan = Math.min(pdf.numPages, 5);

    for (let i = 1; i <= pagesToScan; i++) {
        const page    = await pdf.getPage(i);
        const content = await page.getTextContent();
        fullText += content.items
            .map(item => ('str' in item ? item.str : ''))
            .join(' ') + '\n';
    }

    return fullText;
}