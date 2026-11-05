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
 *
 * Comments carry an approval `status`: faculty/program-head comments are
 * created "pending" and only become visible to everyone (and printable in the
 * proceedings) after an Admin calls `approveAnnotation`.
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

    /**
     * Admin-only publication of a pending comment: stamps
     * `status: "approved"`, the approving uid and the timestamp so every
     * subscribed viewer (and the server-side proceedings reader) picks it up.
     */
    approveAnnotation(
        thesisId: string,
        thesisVersionId: string,
        annotationId: string
    ): Promise<void>;

    deleteAnnotation(
        thesisId: string,
        thesisVersionId: string,
        annotationId: string
    ): Promise<void>;
}
