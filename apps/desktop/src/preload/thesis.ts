import { contextBridge, ipcRenderer } from 'electron';
import type { IngestFullThesisResponseDto } from "@monteai/types";

// The main process has no renderer env and no Firebase session, so the
// renderer hands it the API base URL (from its Vite env) and a fresh ID
// token alongside the thesis id.
export interface ApproveThesisRequest {
    thesisId: string;
    baseURL?: string;
    authToken?: string;
}

contextBridge.exposeInMainWorld('thesisApi', {
    approveThesis: (
        request: ApproveThesisRequest,
    ): Promise<IngestFullThesisResponseDto> =>
        ipcRenderer.invoke('thesis:approve', request),
});
