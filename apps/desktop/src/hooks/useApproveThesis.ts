// apps/desktop/src/hooks/useApproveThesis.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { thesesKeys } from '@monteai/hooks';
import { getAuthToken } from '../renderer/lib/apiClient';

interface ApproveThesisVars {
    thesisId: string;
    /**
     * Admin confirmed metadata-only indexing after the main process returned
     * SectionsNotDetected (no chapter headings in the PDF).
     */
    metadataOnly?: boolean;
}

export function useApproveThesis() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ thesisId, metadataOnly }: ApproveThesisVars) => {
            // The IPC handler runs in the main process, which has neither the
            // renderer's Vite env nor a Firebase session — send both along.
            // Token must come from getAuthToken(): TOTP-enabled accounts are
            // rejected server-side when a raw Firebase token is used.
            return window.thesisApi.approveThesis({
                thesisId,
                metadataOnly,
                baseURL: import.meta.env.VITE_API_BASE_URL,
                authToken: await getAuthToken(),
            });
        },

        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: thesesKeys.all });
            queryClient.invalidateQueries({ queryKey: thesesKeys.detail(variables.thesisId) });
        },
    });
}
