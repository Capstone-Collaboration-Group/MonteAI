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
  // apps/desktop/src/handlers/approveThesis.ts
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

        const { title, authors, publicationYear, url } = extractMetadata(rawText, result.url);

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