import { ipcMain } from 'electron';
import { extractText } from '../pipeline/pdfExtractor';
import { isolateAbstract, extractMetadata } from '../pipeline/abstractIsolator';
import { chunkText } from '../pipeline/chunker';
import { thesisService } from '../renderer/lib/thesisService';
import { downloadPdfToTemp, deleteTempPdf } from '../pipeline/pdfDownloader';

export function registerApproveThesisHandler() { 
  // apps/desktop/src/handlers/approveThesis.ts
  ipcMain.handle('thesis:approve', async (_event, { thesisId, filePath }) => {

     console.log('[DEBUG] IPC received:', { thesisId, filePath });
    let tempPath: string | null = null;

    try {
      tempPath = await downloadPdfToTemp(filePath, thesisId);

      // --- THE FIX ---
      // We check if tempPath is null. If it is, we abort.
      // TypeScript now knows that tempPath MUST be a string after this check.
      if (!tempPath) {
        throw new Error('FAILED_TO_DOWNLOAD_PDF');
      }

      // No more TypeScript error here!
      const rawText = await extractText(tempPath);

      const { abstract } = isolateAbstract(rawText);

        if (!abstract) {
        throw new Error('ABSTRACT_NOT_FOUND');
        }

      // extractMetadata now returns all Chunk-compatible fields
      const { title, authors, publicationYear, url } = extractMetadata(rawText, filePath);

      const chunks = chunkText(abstract).map((text, chunkIndex) => ({
        chunkIndex,
        text,
        title,
        authors,    // "Dela Cruz, J., Santos, M. A., Reyes, K., Bautista, L."
        publicationYear,
        url,        // blob URL as source reference
        journal: undefined,
      }));

      return thesisService.ingestThesis({ thesisId, chunks });

    } finally {
      if (tempPath) await deleteTempPdf(tempPath);
    }
  });
}