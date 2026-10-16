// apps/desktop/src/pipeline/pdfExtractor.ts
//
// Per-page text extraction for the ingestion pipeline. Returns one string per
// page so callers can:
//   - slice pages 1-2 for title-page metadata (title/authors/year), and
//   - join every page for full-text chunking (whole-thesis RAG).
//
// Safety cap: real theses run 20-150 pages. The cap guards against a malformed
// or pathological PDF fanning out into a huge extraction/embedding bill.

import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { pathToFileURL } from 'url';

const workerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).toString();

/** Hard cap on pages extracted per PDF — far beyond any real thesis. */
export const MAX_PAGES = 150;

/**
 * Extracts text from every page of a PDF (capped at MAX_PAGES).
 * @returns One string per extracted page, in page order.
 */
export async function extractPages(filePath: string): Promise<string[]> {
    const pdf = await pdfjs.getDocument({
        url:            filePath,
        useWorkerFetch: false,
        useSystemFonts: true,
    }).promise;

    const pagesToScan = Math.min(pdf.numPages, MAX_PAGES);
    const pages: string[] = [];

    for (let i = 1; i <= pagesToScan; i++) {
        const page    = await pdf.getPage(i);
        const content = await page.getTextContent();
        pages.push(content.items
            .map(item => ('str' in item ? item.str : ''))
            .join(' '));
    }

    return pages;
}
