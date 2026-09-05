import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { AnnotationService } from "@monteai/api";
import type {
    AnnotationResponseDto,
    CreateAnnotationDto,
    ResolveAnnotationDto,
} from "@monteai/types";

/**
 * Realtime subscription to the Firestore-backed annotations of a thesis version.
 * Fires the Firestore onSnapshot listener, so every open viewer updates as soon
 * as someone else adds / resolves / deletes an annotation.
 */
export function useAnnotationsLive(
    service: AnnotationService | null,
    thesisId: string,
    thesisVersionId: string
) {
    const subKey = `${thesisId}/${thesisVersionId}`;

    const [snapshot, setSnapshot] = useState<{
        key: string | null;
        annotations: AnnotationResponseDto[];
        error?: unknown;
    }>({ key: null, annotations: [] });

    useEffect(() => {
        if (!service || !thesisId || !thesisVersionId) return;

        return service.subscribe(
            thesisId,
            thesisVersionId,
            (next) =>
                setSnapshot({ key: subKey, annotations: next }),
            (err) =>
                setSnapshot({ key: subKey, annotations: [], error: err })
        );
    }, [service, thesisId, thesisVersionId, subKey]);

    const ready = snapshot.key === subKey;
    const annotations = ready ? snapshot.annotations : [];
    const unresolvedCount = annotations.filter((a) => !a.isResolved).length;
    const resolvedCount = annotations.length - unresolvedCount;

    return {
        annotations,
        unresolvedCount,
        resolvedCount,
        isLoading: !ready,
        error: snapshot.error,
    };
}

export function useCreateAnnotationLive(service: AnnotationService) {
    return useMutation({
        mutationFn: ({
            thesisId,
            thesisVersionId,
            input,
        }: {
            thesisId: string;
            thesisVersionId: string;
            input: Omit<CreateAnnotationDto, "thesisVersionId">;
        }) => service.createAnnotation(thesisId, thesisVersionId, input),
    });
}

export function useResolveAnnotationLive(service: AnnotationService) {
    return useMutation({
        mutationFn: ({
            thesisId,
            thesisVersionId,
            annotationId,
            dto,
        }: {
            thesisId: string;
            thesisVersionId: string;
            annotationId: string;
            dto: ResolveAnnotationDto;
        }) => service.resolveAnnotation(thesisId, thesisVersionId, annotationId, dto),
    });
}

export function useDeleteAnnotationLive(service: AnnotationService) {
    return useMutation({
        mutationFn: ({
            thesisId,
            thesisVersionId,
            annotationId,
        }: {
            thesisId: string;
            thesisVersionId: string;
            annotationId: string;
        }) => service.deleteAnnotation(thesisId, thesisVersionId, annotationId),
    });
}
