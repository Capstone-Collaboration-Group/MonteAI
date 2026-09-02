import  { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ThesisService } from "@monteai/api";
import type { SubmitThesisDto, UpdateThesisDto, IngestThesisDto,
    CreateAnnotationDto,
    ResolveAnnotationDto,
 } from "@monteai/types";


export const thesesKeys = { 
    all: ["theses"] as const,
    detail: (id:string) => ["theses", id] as const,

    versions: (thesisId: string) => ["theses", thesisId, "versions"] as const, 

    annotations: (thesisId: string, versionId: string) => 
    ["theses", thesisId, "versions", versionId, "annotations"] as const,
};

export function useTheses(thesisService: ThesisService) { 
    const query = useQuery({
        queryKey: thesesKeys.all,
        queryFn: () => thesisService.getTheses(),
        select: (data) => (Array.isArray(data) ? data : []),
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


export function useIngestThesis(thesisService: ThesisService) { 
    const queryClient = useQueryClient();
    return useMutation({ 
        mutationFn: (dto: IngestThesisDto) => thesisService.ingestThesis(dto),
        onSuccess: (_data, variables) => { 
            queryClient.invalidateQueries({ queryKey: thesesKeys.all });
            queryClient.invalidateQueries({ queryKey: thesesKeys.detail(variables.thesisId) });
        },
    });
}
export function useGetDownloadUrl(thesisService: ThesisService)  {
    return useMutation({
        mutationFn: (thesisId: string) => 
            thesisService.getDownloadUrl(thesisId),
    });
}

export function useThesisVersions(thesisService: ThesisService, thesisId: string)  { 
    const query = useQuery({ 
        queryKey: thesesKeys.versions(thesisId),
        queryFn: () => thesisService.getVersions(thesisId),
        enabled: !!thesisId,
        select: (data) => (Array.isArray(data) ? data : []),
    });
    return { 
        ...query,
        versions: query.data ?? [],
        latestVersion: query.data?.[query.data.length - 1] ?? null,
    };
}

export function useAnnotations(
    thesisService: ThesisService,
    thesisId: string,
    versionId: string
) { 
    const query = useQuery({ 
        queryKey: thesesKeys.annotations(thesisId, versionId),
        queryFn: () => thesisService.getAnnotations(thesisId, versionId),
        enabled: !!thesisId && !!versionId, 
        select: (data) => (Array.isArray(data) ? data : []),
    });

    return { 
        ...query,
        annotations: query.data ?? [],
        unresolvedCount: query.data?.filter((a) => !a.isResolved).length ?? 0,
        resolvedCount: query.data?.filter((a) => a.isResolved).length ?? 0,
    };
}

export function useCreateAnnotation(thesisService: ThesisService) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      thesisId,
      dto,
    }: {
      thesisId: string;
      dto: CreateAnnotationDto;
    }) => thesisService.createAnnotation(thesisId, dto),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: thesesKeys.annotations(variables.thesisId, variables.dto.thesisVersionId),
      });
    },
  });
}


export function useResolveAnnotation(thesisService: ThesisService) { 
    const queryClient = useQueryClient();

    return useMutation({ 
        mutationFn: ({ 
            thesisId, 
            annotationId,
            dto,
        }: { 
            thesisId: string;
            versionId: string;
            annotationId: string;
            dto: ResolveAnnotationDto;
        }) => thesisService.resolveAnnotation(thesisId, annotationId, dto),
        onSuccess: (_data, variables) => { 
            queryClient.invalidateQueries({
                queryKey: thesesKeys.annotations(variables.thesisId, variables.versionId),
            });
        },
    });
}

export function useDeleteAnnotation(thesisService: ThesisService) { 
    const queryClient = useQueryClient();

    return useMutation({ 
        mutationFn: ({ 
            thesisId,
            annotationId,
        }: { 
            thesisId: string;
            annotationId: string;
        }) => thesisService.deleteAnnotation(thesisId, annotationId),
        onSuccess: (_data, variables) => { 
            queryClient.invalidateQueries({ 
                queryKey: ["theses", variables.thesisId],
            });
        },
    });
}

export function useGenerateProceedings(thesisService: ThesisService) { 
    return useMutation({ 
        mutationFn: (thesisId: string) => thesisService.generateProceedings(thesisId), 
        onSuccess: (blob, thesisId) => { 
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `proceedings-${thesisId}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        },
    });
}

// fetching thesis timeline
export function useThesis(thesisService: ThesisService, thesisId: string) { 
    const query = useQuery({ 
        queryKey: thesesKeys.detail(thesisId),
        queryFn: () => thesisService.getThesis(thesisId),
        enabled: !!thesisId,
    });

    return {
        ...query,
        thesis: query.data ?? null,
    };
}


// useTheses.ts
export function useVersionFileUrl(thesisService: ThesisService, versionId: string) {
    const query = useQuery({
        queryKey: ["thesis-version-url", versionId],
        queryFn: () => {
            console.log("[useVersionFileUrl] fetching for", versionId);
            return thesisService.getVersionFile(versionId);
        },
        enabled: !!versionId,
        staleTime: 10 * 60 * 1000,
    });
    return { ...query, fileUrl: query.data?.url ?? null };
}
