// apps/desktop/src/types/electron.d.ts
import type { IngestThesisResponseDto } from '@monteai/types';

declare global {
    interface Window {
        thesisApi: {
            approveThesis(thesisId: string, fileUrl: string): Promise<IngestThesisResponseDto>;
        };
    }
}

export {};