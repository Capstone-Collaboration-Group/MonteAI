import { contextBridge, ipcRenderer } from 'electron';
import type { IngestThesisResponseDto} from "@monteai/types";

contextBridge.exposeInMainWorld('thesisApi', { 
    approveThesis: (
        thesisId: string,
    ): Promise<IngestThesisResponseDto> => 
        ipcRenderer.invoke('thesis:approve', {thesisId }),
});