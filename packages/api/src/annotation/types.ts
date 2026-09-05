import type {
    AnnotationResponseDto,
    CreateAnnotationDto,
    ResolveAnnotationDto,
} from "@monteai/types";

export type AnnotationListener = (annotations: AnnotationResponseDto[]) => void;
export type AnnotationErrorListener = (error: unknown) => void;

/**
 * Firestore-backed annotation store. Annotations are intentionally NOT
 * persisted through the REST API / SQL database — they live only under
 * `theses/{thesisId}/versions/{thesisVersionId}/annotations` in Firestore.
 */
export interface AnnotationService {
    /** One-shot read of every annotation for a thesis version. */
    getAnnotations(
        thesisId: string,
        thesisVersionId: string
    ): Promise<AnnotationResponseDto[]>;

    /**
     * Realtime subscription. The listener fires immediately with the current
     * documents, then again on every change. Returns an unsubscribe function.
     */
    subscribe(
        thesisId: string,
        thesisVersionId: string,
        onNext: AnnotationListener,
        onError?: AnnotationErrorListener
    ): () => void;

    createAnnotation(
        thesisId: string,
        thesisVersionId: string,
        input: Omit<CreateAnnotationDto, "thesisVersionId">
    ): Promise<AnnotationResponseDto>;

    resolveAnnotation(
        thesisId: string,
        thesisVersionId: string,
        annotationId: string,
        dto: ResolveAnnotationDto
    ): Promise<void>;

    deleteAnnotation(
        thesisId: string,
        thesisVersionId: string,
        annotationId: string
    ): Promise<void>;
}
