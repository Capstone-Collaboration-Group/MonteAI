import { useState, useCallback } from "react";
import type { ThesisService } from "@monteai/api";
import type { CreateAnnotationDto, ResolveAnnotationDto } from "@monteai/types";
import {
  useThesisVersions,
  useAnnotations,
  useCreateAnnotation,
  useResolveAnnotation,
  useDeleteAnnotation,
  useGenerateProceedings,
  useThesis,
  useVersionFileUrl,
} from "@monteai/hooks";
import { ThesisPDFViewerLayout } from "../components/Thesis";


export type ViewerRole = "adviser" | "program_head" | "student";

interface ThesisPDFViewerProps {
  thesisId: string;
  thesisService: ThesisService;
  role?: ViewerRole;
  onBack?: () => void;
}

const ANNOTATOR_ROLES: ViewerRole[] = ["adviser", "program_head"];

export function ThesisPDFViewerPage({
  thesisId,
  thesisService,
  role = "student",
  onBack,
}: ThesisPDFViewerProps) {
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  const canAnnotate = ANNOTATOR_ROLES.includes(role);

  const { thesis } = useThesis(thesisService, thesisId);
 
  const { versions, latestVersion, isLoading: versionsLoading } = useThesisVersions(
    thesisService,
    thesisId
  );

  const activeVersionId = selectedVersionId ?? latestVersion?.id ?? null;
  const activeVersion = versions.find((v) => v.id === activeVersionId) ?? latestVersion;


  // Resolve the signed download URL for whichever version is active.
  // activeVersion.filePath is the raw blob path and isn't directly fetchable by the browser.
  const { fileUrl, isLoading: urlLoading } = useVersionFileUrl(
    thesisService,
    activeVersionId ?? ""
  );

  const { annotations, unresolvedCount, resolvedCount, isLoading: annotationsLoading } =
    useAnnotations(thesisService, thesisId, activeVersionId ?? "");

  const { mutate: createAnnotation, isPending: isCreating } =
    useCreateAnnotation(thesisService);
  const { mutate: resolveAnnotation, isPending: isResolving } =
    useResolveAnnotation(thesisService);
  const { mutate: deleteAnnotation } = useDeleteAnnotation(thesisService);
  const { mutate: generateProceedings, isPending: isGenerating } =
    useGenerateProceedings(thesisService);

  const handleAddAnnotation = useCallback(
    (dto: Omit<CreateAnnotationDto, "thesisVersionId">) => {
      if (!activeVersionId) return;
      createAnnotation({ thesisId, dto: { ...dto, thesisVersionId: activeVersionId } });
    },
    [thesisId, activeVersionId, createAnnotation]
  );

  const handleResolve = useCallback(
    (annotationId: string, dto: ResolveAnnotationDto) => {
      if (!activeVersionId) return;
      resolveAnnotation({ thesisId, versionId: activeVersionId, annotationId, dto });
    },
    [thesisId, activeVersionId, resolveAnnotation]
  );

  const handleDelete = useCallback(
    (annotationId: string) => {
      deleteAnnotation({ thesisId, annotationId });
    },
    [thesisId, deleteAnnotation]
  );

  const handleGenerateProceedings = useCallback(() => {
    generateProceedings(thesisId);
  }, [thesisId, generateProceedings]);

  return (
    <ThesisPDFViewerLayout
      thesis={thesis ?? null}
      role={role}
      versions={versions}
      activeVersion={activeVersion ?? null}
      fileUrl={fileUrl}
      annotations={annotations}
      unresolvedCount={unresolvedCount}
      resolvedCount={resolvedCount}
      isLoading={versionsLoading || annotationsLoading || urlLoading}
      isGenerating={isGenerating}
      isCreating={isCreating}
      isResolving={isResolving}
      canAnnotate={canAnnotate}
      onVersionChange={setSelectedVersionId}
      onAddAnnotation={handleAddAnnotation}
      onResolve={handleResolve}
      onDelete={handleDelete}
      onGenerateProceedings={handleGenerateProceedings}
      onBack={onBack}
    />
  );
}