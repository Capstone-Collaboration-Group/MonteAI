import type { FirebaseApp } from "firebase/app";
import { LiveAnnotationService } from "./liveAnnotationService";
import { mockAnnotationService } from "./mockAnnotationService";
import type { AnnotationService } from "./types";

export function createAnnotationService(
    app: FirebaseApp | null,
    useMock: boolean
): AnnotationService {
    return useMock ? mockAnnotationService : new LiveAnnotationService(app as FirebaseApp);
}

export type { AnnotationService } from "./types";
export { LiveAnnotationService } from "./liveAnnotationService";
export { mockAnnotationService } from "./mockAnnotationService";
