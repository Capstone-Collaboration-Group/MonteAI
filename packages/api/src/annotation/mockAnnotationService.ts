import type {
    AnnotationResponseDto,
    CreateAnnotationDto,
    ResolveAnnotationDto,
} from "@monteai/types";
import type {
    AnnotationErrorListener,
    AnnotationListener,
    AnnotationService,
} from "./types";

function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function annotationKey(thesisId: string, thesisVersionId: string) {
    return `${thesisId}::${thesisVersionId}`;
}

const annotationsMap = new Map<string, AnnotationResponseDto[]>();
const listeners = new Map<string, Set<AnnotationListener>>();

// Seed a few comments on t1/v2-t1 (the mock thesis PDF) so the viewer shows a
// realistic mix of resolved and unresolved annotations across several pages.
// Each `positionJson` holds rects in unscaled PDF viewport coordinates
// (matching how the web viewer records selections) so both frontends can draw
// the highlight overlays at any zoom level.
function seedAnnotation(
    id: string,
    pageNumber: number,
    rect: { x: number; y: number; width: number; height: number },
    comment: string,
    highlightedText: string,
    options: {
        isResolved: boolean;
        resolverNote?: string;
        reviewerId?: string;
        createdAt: string;
    }
): AnnotationResponseDto {
    return {
        id,
        thesisId: "t1",
        thesisVersionId: "v2-t1",
        reviewerId: options.reviewerId ?? "mock-reviewer",
        comment,
        highlightedText,
        positionJson: JSON.stringify({ pageNumber, rects: [rect] }),
        pageNumber,
        isResolved: options.isResolved,
        resolvedAt: options.isResolved ? options.createdAt : "",
        createdAt: options.createdAt,
        resolverNote: options.resolverNote,
    };
}

annotationsMap.set(annotationKey("t1", "v2-t1"), [
    seedAnnotation(
        "mock-ann-1",
        3,
        { x: 72, y: 262, width: 468, height: 32 },
        "Please clarify the statement of the problem. It feels too broad.",
        "This study seeks to determine how a retrieval-augmented assistant can support thesis review and knowledge access.",
        { isResolved: true, resolverNote: "Narrowed the scope in the latest revision.", createdAt: "2026-04-01T09:00:00.000Z" }
    ),
    seedAnnotation(
        "mock-ann-2",
        3,
        { x: 72, y: 114, width: 320, height: 24 },
        "The title of this chapter should match the approved format.",
        "The Problem and its Background",
        { isResolved: false, createdAt: "2026-04-02T08:15:00.000Z" }
    ),
    seedAnnotation(
        "mock-ann-3",
        4,
        { x: 72, y: 182, width: 420, height: 24 },
        "Add at least two more local studies to this section.",
        "Prior work highlights the value of indexed, searchable collections for institutional research.",
        { isResolved: false, createdAt: "2026-04-03T14:30:00.000Z" }
    ),
    seedAnnotation(
        "mock-ann-4",
        5,
        { x: 72, y: 182, width: 430, height: 24 },
        "Describe the sampling procedure in more detail.",
        "The study employs an iterative development methodology.",
        { isResolved: false, createdAt: "2026-04-04T10:05:00.000Z" }
    ),
    seedAnnotation(
        "mock-ann-5",
        6,
        { x: 72, y: 168, width: 440, height: 24 },
        "Tie the results back to your objectives.",
        "The system achieved accurate retrieval across the corpus.",
        { isResolved: true, resolverNote: "Added a mapping table to the objectives.", createdAt: "2026-04-05T16:45:00.000Z" }
    ),
]);

function sortedCopy(items: AnnotationResponseDto[]) {
    return [...items].sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt)
    );
}

function emit(key: string) {
    const set = listeners.get(key);
    if (!set) return;
    const items = sortedCopy(annotationsMap.get(key) ?? []);
    set.forEach((listener) => listener(items));
}

function upsertIntoVersion(
    thesisId: string,
    thesisVersionId: string,
    annotation: AnnotationResponseDto
) {
    const key = annotationKey(thesisId, thesisVersionId);
    const existing = annotationsMap.get(key) ?? [];
    annotationsMap.set(key, [...existing, annotation]);
    emit(key);
}

export const mockAnnotationService: AnnotationService = {
    async getAnnotations(thesisId, thesisVersionId) {
        await delay(150);
        return sortedCopy(
            annotationsMap.get(annotationKey(thesisId, thesisVersionId)) ?? []
        );
    },

    subscribe(
        thesisId,
        thesisVersionId,
        onNext: AnnotationListener,
        _onError?: AnnotationErrorListener
    ) {
        const key = annotationKey(thesisId, thesisVersionId);
        let set = listeners.get(key);
        if (!set) {
            set = new Set();
            listeners.set(key, set);
        }

        // Fire immediately with the current documents (matches Firestore's
        // initial snapshot), then keep the listener for future writes.
        onNext(sortedCopy(annotationsMap.get(key) ?? []));
        set.add(onNext);

        return () => {
            set!.delete(onNext);
            if (set!.size === 0) listeners.delete(key);
        };
    },

    async createAnnotation(
        thesisId,
        thesisVersionId,
        input: Omit<CreateAnnotationDto, "thesisVersionId">
    ) {
        await delay(200);
        const createdAt = new Date().toISOString();
        const annotation: AnnotationResponseDto = {
            id: crypto.randomUUID(),
            thesisId,
            thesisVersionId,
            reviewerId: "mock-reviewer",
            comment: input.comment,
            highlightedText: input.highlightedText,
            positionJson: input.positionJson,
            pageNumber: input.pageNumber,
            isResolved: false,
            resolvedAt: "",
            createdAt,
        };
        upsertIntoVersion(thesisId, thesisVersionId, annotation);
        return annotation;
    },

    async resolveAnnotation(
        thesisId,
        thesisVersionId,
        annotationId,
        dto: ResolveAnnotationDto
    ) {
        await delay(200);
        const key = annotationKey(thesisId, thesisVersionId);
        const items = annotationsMap.get(key) ?? [];
        const idx = items.findIndex((a) => a.id === annotationId);
        if (idx === -1) return;

        const updated = [...items];
        updated[idx] = {
            ...updated[idx],
            isResolved: dto.isResolved,
            resolverNote: dto.resolverNote,
            resolvedAt: dto.isResolved ? new Date().toISOString() : "",
        };
        annotationsMap.set(key, updated);
        emit(key);
    },

    async deleteAnnotation(thesisId, thesisVersionId, annotationId) {
        await delay(200);
        const key = annotationKey(thesisId, thesisVersionId);
        const items = annotationsMap.get(key) ?? [];
        const filtered = items.filter((a) => a.id !== annotationId);
        if (filtered.length === items.length) return;

        annotationsMap.set(key, filtered);
        emit(key);
    },
};
