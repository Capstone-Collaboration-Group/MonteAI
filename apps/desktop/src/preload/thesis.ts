import { contextBridge, ipcRenderer } from 'electron';
import type { IngestFullThesisResponseDto } from "@monteai/types";

// The main process has no renderer env and no Firebase session, so the
// renderer hands it the API base URL (from its Vite env) and a fresh ID
// token alongside the thesis id.
export interface ApproveThesisRequest {
    thesisId: string;
    baseURL?: string;
    authToken?: string;
    /**
     * Set after the renderer's "no chapter headings detected" confirm
     * dialog: index metadata only, don't stage/chunk any full text.
     */
    metadataOnly?: boolean;
}

/**
 * The ingestion response, OR the pre-flight short-circuit that asks the
 * renderer to confirm metadata-only indexing — in which case no server call
 * happened yet and cancelling leaves the thesis untouched.
 */
export type ApproveThesisResult =
    | IngestFullThesisResponseDto
    | { kind: 'SectionsNotDetected' };

contextBridge.exposeInMainWorld('thesisApi', {
    approveThesis: (
        request: ApproveThesisRequest,
    ): Promise<ApproveThesisResult> =>
        ipcRenderer.invoke('thesis:approve', request),
});
