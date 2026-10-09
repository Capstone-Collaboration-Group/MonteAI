// apps/mobile/lib/annotationService.ts
//
// Firestore-backed annotations (reviewer comments) shared with the web and
// desktop viewers. Annotations are intentionally NOT stored in SQL — they live
// under `theses/{thesisId}/versions/{thesisVersionId}/annotations` in
// Firestore. In mock mode (`EXPO_PUBLIC_USE_MOCK`) an in-memory service with
// seeded data is used instead so the viewer works offline.

import { createAnnotationService } from '@monteai/api';
import { firebaseAuth } from './firebase';

const useMock =
  (process.env.EXPO_PUBLIC_USE_MOCK ?? (__DEV__ ? 'true' : 'false')) === 'true';

let _service: ReturnType<typeof createAnnotationService> | null = null;

export function getAnnotationService() {
  if (!_service) {
    _service = createAnnotationService(useMock ? null : firebaseAuth.app, useMock);
  }
  return _service;
}

export { useMock as usesMockAnnotations };
