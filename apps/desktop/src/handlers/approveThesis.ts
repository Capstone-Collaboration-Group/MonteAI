// apps/desktop/src/handlers/approveThesis.ts
//
// LOCAL INGESTION PIPELINE (Electron main process), triggered when an admin
// approves a thesis in the desktop panel:
//
//   1. Ask the API for a short-lived SAS download URL for the thesis PDF.
//   2. Download the PDF to a temp file.
//   3. Extract text from EVERY page (pdfjs-dist, capped at MAX_PAGES).
//   4. Isolate title-page metadata (title/authors/year) from pages 1-2.
//   5. POST the FULL extracted text + metadata to /thesis/ingest/full.
//
//   The server then takes over (see ThesisService.IngestAsync / IngestFullAsync):
//     - synchronously upserts ONE metadata vector so the thesis is citable
//       immediately, stages the text, and returns 202 Queued;
//     - a background worker chunks/embeds the body and marks the thesis
//       Indexed — concurrent approvals never block each other.
//
//   The server overrides each chunk's URL with the thesis' permanent blob
//   path — the SAS link sent here would expire within minutes and must never
//   be stored in vector metadata. Embedding is NOT done on the desktop.
//
// AUTH/URL: the renderer passes its own Vite-resolved API base URL and a
// fresh Firebase ID token with every request. The main process must NOT
// read process.env.VITE_* (Vite never injects renderer env there) and has
// no Firebase session of its own — both come over IPC.

import { ipcMain } from 'electron';
import { extractPages } from '../pipeline/pdfExtractor';
import { extractMetadata } from '../pipeline/abstractIsolator';
import { downloadPdfToTemp, deleteTempPdf } from '../pipeline/pdfDownloader';
import { createApiClient, createThesisService } from "@monteai/api";
import https from "https";

interface ApproveThesisRequest {
    thesisId: string;
    baseURL?: string;
    authToken?: string;
}

const FALLBACK_BASE_URL = "http://localhost:5084/api/v1";

export function registerApproveThesisHandler() {
  ipcMain.handle('thesis:approve', async (_event, { thesisId, baseURL, authToken }: ApproveThesisRequest) => {
    if (!thesisId) throw new Error('MISSING_THESIS_ID');

    const client = createApiClient({
        baseURL: baseURL || process.env.VITE_API_BASE_URL || FALLBACK_BASE_URL,
        getAuthToken: () => authToken,
        ...(process.env.NODE_ENV === "development" && {
            httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        }),
    });
    const thesisService = createThesisService(client, false);

    let tempPath: string | null = null;

    try {
        // Get authenticated SAS URL from your backend
        const result = await thesisService.getDownloadUrl(thesisId);

        if (!result) {
            throw new Error('FAILED_TO_GET_DOWNLOAD_URL');
        }

        // Download using the SAS URL (has credentials, won't 409)
        tempPath = await downloadPdfToTemp(result.url, thesisId);

        if (!tempPath) {
            throw new Error('FAILED_TO_DOWNLOAD_PDF');
        }

        const pages = await extractPages(tempPath);
        if (pages.length === 0) {
            throw new Error('PDF_TEXT_EXTRACTION_FAILED');
        }

        // Title-page metadata lives on pages 1-2; the rest is body text.
        const metadataSource = pages.slice(0, 2).join('\n');
        const { title, authors, publicationYear } = extractMetadata(metadataSource, result.url);

        const fullText = pages.join('\n');

        // The server embeds + upserts asynchronously (202 Queued once the
        // metadata vector is live) — no chunking happens on the desktop.
        return thesisService.ingestFullThesis({
            thesisId,
            fullText,
            title,
            authors,
            publicationYear,
        });

    } finally {
        if (tempPath) await deleteTempPdf(tempPath);
    }
});
}
