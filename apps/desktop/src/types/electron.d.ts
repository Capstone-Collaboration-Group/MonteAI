// apps/desktop/src/types/electron.d.ts
import type { IngestFullThesisResponseDto } from '@monteai/types';

declare global {
    interface Window {
        thesisApi: {
            approveThesis(request: {
                thesisId: string;
                baseURL?: string;
                authToken?: string;
            }): Promise<IngestFullThesisResponseDto>;
        };
    }
}

export {};
