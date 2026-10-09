// apps/desktop/src/handlers/approveThesis.ts
//
// LOCAL INGESTION PIPELINE (Electron main process), triggered when an admin
// approves a thesis in the desktop panel:
//
//   1. Ask the API for a short-lived SAS download URL for the thesis PDF.
//   2. Download the PDF to a temp file.
//   3. Extract text from the first 5 pages (pdfjs-dist).
//   4. Isolate the ABSTRACT + metadata (title/authors/year) via regex heuristics.
//   5. Chunk the abstract (512 words, 50-word overlap).
//   6. POST the chunks to /thesis/ingest.
//
//   The SERVER then takes over (ThesisService.IngestAsync): it embeds the
//   chunks in batches (Azure OpenAI text-embedding-3-small), deletes any
//   previous vectors for the thesis, bulk-upserts to Pinecone, and marks the
//   thesis Indexed in Azure SQL. The server also overrides each chunk's URL
//   with the thesis' permanent blob path — the SAS link sent here would
//   expire within minutes and must never be stored in vector metadata.
//
//   Embedding is NOT done on the desktop.

import { ipcMain } from 'electron';
import { extractText } from '../pipeline/pdfExtractor';
import { isolateAbstract, extractMetadata } from '../pipeline/abstractIsolator';
import { chunkText } from '../pipeline/chunker';
import { downloadPdfToTemp, deleteTempPdf } from '../pipeline/pdfDownloader';
import { createApiClient, createThesisService } from "@monteai/api";
import https from "https";


const client = createApiClient({
    baseURL: process.env.VITE_API_BASE_URL ?? "https://localhost:7085/api/v1",
    ...(process.env.NODE_ENV === "development" && {
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    }),
});
const thesisService = createThesisService(client, false);

export function registerApproveThesisHandler() {
  ipcMain.handle('thesis:approve', async (_event, { thesisId }) => {
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

        const rawText = await extractText(tempPath);

        const { abstract } = isolateAbstract(rawText);
        if (!abstract) {
            throw new Error('ABSTRACT_NOT_FOUND');
        }

        const { title, authors, publicationYear } = extractMetadata(rawText, result.url);

        // The `url` below is only a fallback — the server replaces it with the
        // thesis' permanent blob path from Azure SQL before upserting.
        const chunks = chunkText(abstract, 512, 50).map((text, chunkIndex) => ({
            chunkIndex,
            text,
            title,
            authors,
            publicationYear,
            url: result.url,
            journal: undefined,
        }));

        return thesisService.ingestThesis({ thesisId, chunks });

    } finally {
        if (tempPath) await deleteTempPdf(tempPath);
    }
});
}
