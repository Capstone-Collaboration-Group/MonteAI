import  { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ThesisService } from "@monteai/api";
import type { SubmitThesisDto, UpdateThesisDto } from "@monteai/types";

export const thesesKeys = { 
    all: ["theses"] as const,
    detail: (id:string) => ["theses", id] as const,
}

export function useTheses(thesisService: ThesisService) { 
    const query = useQuery({
        queryKey: thesesKeys.all,
        queryFn: () => thesisService.getTheses(),
    });

    // Return everything from the query, plus your custom properties
    return {
        ...query,
        theses: query.data ?? [], // Provide a fallback array
        featuredThesis: query.data && query.data.length > 0 ? query.data[0] : null 
        // Note: Change the featuredThesis logic if you rely on a specific flag (e.g., query.data.find(t => t.isFeatured))
    };
}
export function useSubmitThesis(thesisService: ThesisService) { 
    const queryClient = useQueryClient();
    return useMutation( { 
        mutationFn: (dto: SubmitThesisDto) => thesisService.submitThesis(dto),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: thesesKeys.all }),
    });
}
export function useUpdateThesis(thesisService: ThesisService) { 
    const queryClient = useQueryClient();
        return useMutation({
            mutationFn: ({ id, dto}: { id: string; dto: UpdateThesisDto }) => 
                thesisService.updateThesis(id, dto),
            onSuccess: () => queryClient.invalidateQueries({ queryKey: thesesKeys.all }),
        });
}

// I'll add update thesis status and delete here soon