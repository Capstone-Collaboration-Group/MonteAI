// apps/desktop/src/types/electron.d.ts
import type { IngestFullThesisResponseDto } from '@monteai/types';

declare global {
    interface Window {
        thesisApi: {
            /**
             * Runs the approve/reindex pipeline. Resolves with the ingestion
             * response, or `{ kind: 'SectionsNotDetected' }` when the PDF has
             * no chapter headings — the renderer must then confirm
             * metadata-only indexing and re-invoke with `metadataOnly: true`
             * (the short-circuit itself never touched the server).
             */
            approveThesis(request: {
                thesisId: string;
                baseURL?: string;
                authToken?: string;
                metadataOnly?: boolean;
            }): Promise<
                | IngestFullThesisResponseDto
                | { kind: 'SectionsNotDetected' }
            >;
        };
    }
}

export {};
