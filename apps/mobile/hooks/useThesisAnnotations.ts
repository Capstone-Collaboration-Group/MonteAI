// apps/mobile/hooks/useThesisAnnotations.ts
//
// Realtime subscription to the Firestore-backed annotations of a thesis
// version. Mirrors the web `useAnnotationsLive` hook but without pulling in
// react-query (which the mobile app doesn't use). Every open viewer updates as
// soon as a reviewer adds / resolves / deletes a comment.

import { useEffect, useState } from 'react';
import type { AnnotationService } from '@monteai/api';
import type { AnnotationResponseDto } from '@monteai/types';

export function useThesisAnnotations(
  service: AnnotationService | null,
  thesisId: string,
  thesisVersionId: string,
) {
  const [annotations, setAnnotations] = useState<AnnotationResponseDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!service || !thesisId || !thesisVersionId) {
      setAnnotations([]);
      setIsLoading(false);
      return;
    }

    let active = true;
    setIsLoading(true);

    const unsubscribe = service.subscribe(
      thesisId,
      thesisVersionId,
      (next) => {
        if (!active) return;
        setAnnotations(next);
        setIsLoading(false);
      },
      () => {
        if (!active) return;
        setAnnotations([]);
        setIsLoading(false);
      },
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [service, thesisId, thesisVersionId]);

  const unresolvedCount = annotations.filter((a) => !a.isResolved).length;
  const resolvedCount = annotations.length - unresolvedCount;

  return { annotations, unresolvedCount, resolvedCount, isLoading };
}
