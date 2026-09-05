import "firebase/firestore";
import { createAnnotationService } from "@monteai/api";
import { auth } from "./firebaseServices";

let _service: ReturnType<typeof createAnnotationService> | null = null;

export function getAnnotationService() {
    if (!_service) {
        _service = createAnnotationService(
            import.meta.env.VITE_USE_MOCK === "true" ? null : auth.app,
            import.meta.env.VITE_USE_MOCK === "true"
        );
    }
    return _service;
}
