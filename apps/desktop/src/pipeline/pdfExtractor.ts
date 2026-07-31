// apps/desktop/src/pipeline/pdfExtractor.ts
// @ts-ignore — .mjs module, types resolved via pdf.d.mts
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

pdfjs.GlobalWorkerOptions.workerSrc = '';

export async function extractText(filePath: string): Promise<string> {
    const pdf = await pdfjs.getDocument({
        url:             filePath,
        useWorkerFetch:  false,
        useSystemFonts:  true,
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