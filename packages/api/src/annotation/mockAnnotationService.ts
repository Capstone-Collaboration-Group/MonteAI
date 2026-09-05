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

// Seed one resolved comment on t1/v2-t1 so the viewer shows something in mock mode.
annotationsMap.set(annotationKey("t1", "v2-t1"), [
    {
        id: "mock-ann-1",
        thesisId: "t1",
        thesisVersionId: "v2-t1",
        reviewerId: "mock-reviewer",
        comment: "Please clarify the methodology in this section.",
        highlightedText: "The proposed framework was evaluated using…",
        positionJson: JSON.stringify({
            boundingRect: { x1: 100, y1: 200, x2: 400, y2: 220, width: 800, height: 1100, pageNumber: 1 },
            rects: [{ x1: 100, y1: 200, x2: 400, y2: 220, width: 800, height: 1100, pageNumber: 1 }],
            pageNumber: 1,
        }),
        pageNumber: 1,
        isResolved: true,
        resolvedAt: "2026-04-01T10:00:00.000Z",
        createdAt: "2026-04-01T09:00:00.000Z",
        resolverNote: "Addressed in the latest revision.",
    },
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
