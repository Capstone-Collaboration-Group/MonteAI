// apps/desktop/src/renderer/hooks/useRejectThesis.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { thesesKeys } from '@monteai/hooks';
import { thesisService } from '../renderer/lib/thesisService';

export function useRejectThesis() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ thesisId }: { thesisId: string }) =>
            thesisService.updateThesisStatus(thesisId, 'Rejected'),

        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: thesesKeys.all });
            queryClient.invalidateQueries({ queryKey: thesesKeys.detail(variables.thesisId) });
        },
    });
}