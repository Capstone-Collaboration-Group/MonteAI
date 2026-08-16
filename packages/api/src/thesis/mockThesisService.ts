// packages/api/src/mockThesisService.ts
import type { ThesisService } from "./types";
import type {
    ThesisResponseDto,
    UpdateThesisDto,
    SubmitThesisDto,
    IngestThesisDto,
    IngestThesisResponseDto,
    CreateAnnotationDto,
    ResolveAnnotationDto,
    ThesisVersion,
    AnnotationResponseDto,
} from "@monteai/types";

function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
const TEST_PDF = "https://arxiv.org/pdf/1708.08021";


console.log("mockThesisService loaded — Initialized with seed data");

// ── Theses ────────────────────────────────────────────────────────────────────

function buildTheses(): ThesisResponseDto[] {
    return [
        {
            id: "t1",
            title: "Assessing Cloud-based Platforms for Self-Paced Skill Enhancement",
            status: "Published",
            authors: ["Charles Balaguer", "Angelica Buenaagua", "John Christian Joyo", "Reca Mae Montebon"],
            submittedAt: "2026-05-20T10:00:00.000Z",
            reviewedAt:  "2026-06-06T13:00:00.000Z",
            approvedAt:  "2026-06-15T15:00:00.000Z",
            indexedAt:   "2026-06-15T15:00:00.000Z",
            rejectedAt:  "",
            updatedAt:   "2026-06-15T15:00:00.000Z",
            filePath: TEST_PDF,
            uploadedById: "CharlesID",
            abstract: "Abstract Ngani",
            institute: "Institute of Computing Studies",
            pineconeStatus: "Indexed",
        },
        {
            id: "t2",
            title: "AI-Driven Phishing & Social Engineering Detection",
            status: "Under Review",
            authors: ["Liyo Wang", "Jazon Williams Chang", "Jake Laurence Galgo"],
            submittedAt: "2026-05-24T11:00:00.000Z",
            reviewedAt:  "2026-06-06T13:00:00.000Z",
            approvedAt:  "",
            indexedAt:   "",
            rejectedAt:  "",
            updatedAt:   "2026-06-06T13:00:00.000Z",
            filePath: TEST_PDF,
            uploadedById: "LiyoID",
            abstract: "Abstract Ngani",
            institute: "Institute of Computing Studies",
            pineconeStatus: "None",
        },
    ];
}

const thesesMap = new Map<string, ThesisResponseDto>();
buildTheses().forEach((t) => thesesMap.set(t.id, t));


// mockThesisService.ts

function buildVersions(): Map<string, ThesisVersion[]> {
    const map = new Map<string, ThesisVersion[]>();

    map.set("t1", [
        {
            id: "v1-t1",
            thesisId: "t1",
            versionNumber: 1,
            filePath: TEST_PDF,
            uploadedById: "CharlesID",
            uploadedAt: "2023-01-15T00:00:00.000Z",
            changeNote: "Initial submission",
        },
        {
            id: "v2-t1",
            thesisId: "t1",
            versionNumber: 2,
            filePath: TEST_PDF,
            uploadedById: "CharlesID",
            uploadedAt: "2023-03-20T00:00:00.000Z",
            changeNote: "Revised Chapter 3",
        },
    ]);

    map.set("t2", [
        {
            id: "v1-t2",
            thesisId: "t2",
            versionNumber: 1,
            filePath: TEST_PDF,
            uploadedById: "LiyoID",
            uploadedAt: "2023-06-10T00:00:00.000Z",
            changeNote: "Initial submission",
        },
    ]);

    return map;
}

const versionsMap = buildVersions();

// ── Annotations ───────────────────────────────────────────────────────────────
//
// Key: `${thesisId}::${versionId}` → AnnotationResponseDto[]
// Seeded with one example annotation on t1/v2-t1 so the sidebar
// renders something on first load.

const annotationsMap = new Map<string, AnnotationResponseDto[]>();

annotationsMap.set("t1::v2-t1", [
    {
        id: "ann-1",
        thesisId: "t1",
        thesisVersionId: "v2-t1",
        reviewerId: "reviewer-1",
        comment: "Please clarify the methodology in this section.",
        highlightedText: "The proposed framework was evaluated using…",
        positionJson: JSON.stringify({
            boundingRect: { x1: 100, y1: 200, x2: 400, y2: 220, width: 800, height: 1100, pageNumber: 1 },
            rects: [{ x1: 100, y1: 200, x2: 400, y2: 220, width: 800, height: 1100, pageNumber: 1 }],
            pageNumber: 1,
        }),
        pageNumber: 1,
        isResolved: true,
        resolvedAt: "",
        createdAt: "2023-04-01T10:00:00.000Z",
    },
]);

function annotationKey(thesisId: string, versionId: string) {
    return `${thesisId}::${versionId}`;
}

// ── Service ───────────────────────────────────────────────────────────────────

export const mockThesisService: ThesisService = {

    // Theses
    async getThesis(thesisId) {
        await delay(150);
        return thesesMap.get(thesisId) ?? null;
    },

    async getTheses() {
        await delay(300);
        return Array.from(thesesMap.values());
    },

    async submitThesis(dto: SubmitThesisDto) {
        await delay(300);
        const id = crypto.randomUUID();
        const newThesis = {
            id,
            ...dto,
            status: "Pending",
            authors: [],
            institute: "",
            pineconeStatus: "None",
            approvedAt: "",
            indexedAt: "",
            rejectedAt: "",
            reviewedAt: "",
            updatedAt: new Date().toISOString(),
            submittedAt: new Date().toISOString(),
        } as ThesisResponseDto;
        thesesMap.set(id, newThesis);
        return newThesis;
    },

    async ingestThesis(dto: IngestThesisDto) {
        await delay(300);
        const existing = thesesMap.get(dto.thesisId);
        if (!existing) {
            return { thesisId: dto.thesisId, vectorCount: 0, status: "Failed" } as IngestThesisResponseDto;
        }
        thesesMap.set(dto.thesisId, {
            ...existing,
            pineconeStatus: "Indexed",
            indexedAt: new Date().toISOString(),
        });
        return { thesisId: dto.thesisId, vectorCount: dto.chunks.length, status: "Indexed" } as IngestThesisResponseDto;
    },

    async updateThesis(thesisId, dto: UpdateThesisDto) {
        await delay(300);
        const existing = thesesMap.get(thesisId);
        if (!existing) return false;
        thesesMap.set(thesisId, { ...existing, ...dto });
        return true;
    },

    async getDownloadUrl(thesisId) {
        await delay(300);
        const existing = thesesMap.get(thesisId);
        if (!existing) return null;
        return { url: existing.filePath };
    },

    async updateThesisStatus(thesisId, status) {
        await delay(300);
        const existing = thesesMap.get(thesisId);
        if (!existing) return false;
        thesesMap.set(thesisId, { ...existing, status } as ThesisResponseDto);
        return true;
    },

    async deleteThesis(thesisId) {
        await delay(300);
        return thesesMap.delete(thesisId);
    },

    // Versions
    async getVersions(thesisId) {
        await delay(150);
         console.log("[mock] getVersions called with:", thesisId);
        console.log("[mock] versionsMap keys:", Array.from(versionsMap.keys()));
        console.log("[mock] result:", versionsMap.get(thesisId));
        return versionsMap.get(thesisId) ?? [];
    },

    async getVersionFile(thesisId, versionId) {
        await delay(150);
        const versions = versionsMap.get(thesisId) ?? [];
        const version = versions.find((v) => v.id === versionId);
        // Return the parent thesis DTO with the version's filePath spliced in
        // (matches what LiveThesisService returns from the real endpoint)
        const thesis = thesesMap.get(thesisId);
        if (!thesis || !version) return null as unknown as ThesisResponseDto;
        return { ...thesis, filePath: version.filePath };
    },

    // Annotations
    async getAnnotations(thesisId, versionId) {
        await delay(150);
        return annotationsMap.get(annotationKey(thesisId, versionId)) ?? [];
    },

    async createAnnotation(thesisId, dto: CreateAnnotationDto) {
        await delay(200);
        const key = annotationKey(thesisId, dto.thesisVersionId);
        const existing = annotationsMap.get(key) ?? [];
        const newAnnotation: AnnotationResponseDto = {
            id: crypto.randomUUID(),
            thesisId,
            thesisVersionId: dto.thesisVersionId,
            reviewerId: "mock-reviewer",
            comment: dto.comment,
            highlightedText: dto.highlightedText,
            positionJson: dto.positionJson,
            pageNumber: dto.pageNumber,
            isResolved: false,
            resolvedAt: "",
            createdAt: new Date().toISOString(),
        };
        annotationsMap.set(key, [...existing, newAnnotation]);
        return true;
    },

    async resolveAnnotation(thesisId, annotationId, dto: ResolveAnnotationDto) {
        await delay(200);
        // Search across all version keys for this thesis
        for (const [key, annotations] of annotationsMap.entries()) {
            if (!key.startsWith(`${thesisId}::`)) continue;
            const idx = annotations.findIndex((a) => a.id === annotationId);
            if (idx === -1) continue;
            const updated = [...annotations];
            updated[idx] = {
                ...updated[idx],
                isResolved: dto.isResolved,
                resolverNote: dto.resolverNote,
                resolvedAt: dto.isResolved ? new Date().toISOString() : "",
            };
            annotationsMap.set(key, updated);
            return true;
        }
        return false;
    },

    async deleteAnnotation(thesisId, annotationId) {
        await delay(200);
        for (const [key, annotations] of annotationsMap.entries()) {
            if (!key.startsWith(`${thesisId}::`)) continue;
            const filtered = annotations.filter((a) => a.id !== annotationId);
            if (filtered.length !== annotations.length) {
                annotationsMap.set(key, filtered);
                return true;
            }
        }
        return false;
    },

    async generateProceedings(thesisId) {
        await delay(300);
        return new Blob([`Mock Proceedings for thesis ${thesisId}`], {
            type: "application/pdf",
        });
    },
};