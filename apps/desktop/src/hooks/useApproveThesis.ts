import { useMutation, useQueryClient } from '@tanstack/react-query';
import { thesesKeys } from '@monteai/hooks';

interface ApproveThesisVars { 
    thesisId: string;
}

export function useApproveThesis() { 
    const queryClient = useQueryClient();

    return useMutation({ 
        mutationFn: ({ thesisId }: ApproveThesisVars) => 
            window.thesisApi.approveThesis(thesisId),

        onSuccess: (_data, variables) => { 
            queryClient.invalidateQueries({ queryKey: thesesKeys.all });
            queryClient.invalidateQueries({ queryKey: thesesKeys.detail(variables.thesisId)});
        },
    });
}