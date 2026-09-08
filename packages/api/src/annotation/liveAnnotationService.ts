import type { FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    getFirestore,
    onSnapshot,
    orderBy,
    query,
    updateDoc,
    type DocumentData,
    type Firestore,
    type QuerySnapshot,
} from "firebase/firestore";
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

const COLLECTION = "theses";

export class LiveAnnotationService implements AnnotationService {
    private readonly db: Firestore;
    private readonly auth: Auth;

    constructor(app: FirebaseApp) {
        this.db = getFirestore(app);
        this.auth = getAuth(app);
    }

    private annotationsCollection(thesisId: string, thesisVersionId: string) {
        return collection(
            this.db,
            COLLECTION,
            thesisId,
            "versions",
            thesisVersionId,
            "annotations"
        );
    }

    private annotationDoc(
        thesisId: string,
        thesisVersionId: string,
        annotationId: string
    ) {
        return doc(
            this.db,
            COLLECTION,
            thesisId,
            "versions",
            thesisVersionId,
            "annotations",
            annotationId
        );
    }

    private fromSnapshot(
        thesisId: string,
        thesisVersionId: string,
        snap: QuerySnapshot<DocumentData>
    ): AnnotationResponseDto[] {
        return snap.docs.map((d) => this.toDto(thesisId, thesisVersionId, d.id, d.data()));
    }

    private toDto(
        thesisId: string,
        thesisVersionId: string,
        id: string,
        data: DocumentData
    ): AnnotationResponseDto {
        return {
            id,
            thesisId,
            thesisVersionId,
            reviewerId: data.reviewerId ?? "",
            comment: data.comment ?? "",
            highlightedText: data.highlightedText ?? undefined,
            positionJson: data.positionJson ?? "{}",
            pageNumber: data.pageNumber ?? 1,
            isResolved: Boolean(data.isResolved),
            resolvedAt: data.resolvedAt ?? "",
            createdAt: data.createdAt ?? "",
            resolverNote: data.resolverNote ?? undefined,
        };
    }

    async getAnnotations(
        thesisId: string,
        thesisVersionId: string
    ): Promise<AnnotationResponseDto[]> {
        const snap = await getDocs(
            query(
                this.annotationsCollection(thesisId, thesisVersionId),
                orderBy("createdAt", "asc")
            )
        );
        return this.fromSnapshot(thesisId, thesisVersionId, snap);
    }

    subscribe(
        thesisId: string,
        thesisVersionId: string,
        onNext: AnnotationListener,
        onError?: AnnotationErrorListener
    ): () => void {
        return onSnapshot(
            query(
                this.annotationsCollection(thesisId, thesisVersionId),
                orderBy("createdAt", "asc")
            ),
            (snap) => onNext(this.fromSnapshot(thesisId, thesisVersionId, snap)),
            (err) => {
                if (onError) onError(err);
            }
        );
    }

    async createAnnotation(
        thesisId: string,
        thesisVersionId: string,
        input: Omit<CreateAnnotationDto, "thesisVersionId">
    ): Promise<AnnotationResponseDto> {
        const createdAt = new Date().toISOString();
        const reviewerId = this.auth.currentUser?.uid ?? "unknown";

        const ref = await addDoc(
            this.annotationsCollection(thesisId, thesisVersionId),
            {
                reviewerId,
                comment: input.comment,
                highlightedText: input.highlightedText ?? null,
                positionJson: input.positionJson,
                pageNumber: input.pageNumber,
                isResolved: false,
                resolvedAt: "",
                resolverNote: null,
                createdAt,
            }
        );

        return {
            id: ref.id,
            thesisId,
            thesisVersionId,
            reviewerId,
            comment: input.comment,
            highlightedText: input.highlightedText,
            positionJson: input.positionJson,
            pageNumber: input.pageNumber,
            isResolved: false,
            resolvedAt: "",
            createdAt,
            resolverNote: undefined,
        };
    }

    async resolveAnnotation(
        thesisId: string,
        thesisVersionId: string,
        annotationId: string,
        dto: ResolveAnnotationDto
    ): Promise<void> {
        await updateDoc(
            this.annotationDoc(thesisId, thesisVersionId, annotationId),
            {
                isResolved: dto.isResolved,
                resolverNote: dto.resolverNote ?? null,
                resolvedAt: dto.isResolved ? new Date().toISOString() : "",
            }
        );
    }

    async deleteAnnotation(
        thesisId: string,
        thesisVersionId: string,
        annotationId: string
    ): Promise<void> {
        await deleteDoc(this.annotationDoc(thesisId, thesisVersionId, annotationId));
    }
}
