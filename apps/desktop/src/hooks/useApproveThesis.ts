// apps/desktop/src/hooks/useApproveThesis.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { thesesKeys } from '@monteai/hooks';
import { getAuthToken } from '../renderer/lib/apiClient';

interface ApproveThesisVars {
    thesisId: string;
}

export function useApproveThesis() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ thesisId }: ApproveThesisVars) => {
            // The IPC handler runs in the main process, which has neither the
            // renderer's Vite env nor a Firebase session — send both along.
            // Token must come from getAuthToken(): TOTP-enabled accounts are
            // rejected server-side when a raw Firebase token is used.
            return window.thesisApi.approveThesis({
                thesisId,
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
