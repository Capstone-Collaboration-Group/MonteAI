import { useState, useCallback } from "react";
import type {
  ThesisService,
  FacultyService,
  ProgramHeadService,
  AdminService,
  ScheduleService,
  AnnotationService,
} from "@monteai/api";
import type {
  CreateAnnotationDto,
  ResolveAnnotationDto,
  ViewerRole,
} from "@monteai/types";
import {
  useThesisVersions,
  useAnnotationsLive,
  useCreateAnnotationLive,
  useResolveAnnotationLive,
  useDeleteAnnotationLive,
  useGenerateProceedings,
  useThesis,
  useVersionFileUrl,
  usePanelistPool,
  useCreateSchedule,
  useAuth,
} from "@monteai/hooks";
import { ThesisPDFViewerLayout } from "../components/Thesis";

export type { ViewerRole } from "@monteai/types";

interface ThesisPDFViewerProps {
  thesisId: string;
  thesisService: ThesisService;
  /** Firestore-backed annotation store — annotations are never saved in the DB. */
  annotationService: AnnotationService;
  facultyService: FacultyService;
  programHeadService: ProgramHeadService;
  adminService: AdminService;
  scheduleService: ScheduleService;
  role?: ViewerRole;
  onBack?: () => void;
}

const ANNOTATOR_ROLES: ViewerRole[] = [
  "adviser",
  "faculty",
  "program_head",
  "admin",
];

export function ThesisPDFViewerPage({
  thesisId,
  thesisService,
  annotationService,
  facultyService,
  programHeadService,
  adminService,
  scheduleService,
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

  // Annotations are streamed live from Firestore for the active version.
  const {
    annotations,
    unresolvedCount,
    resolvedCount,
    isLoading: annotationsLoading,
  } = useAnnotationsLive(annotationService, thesisId, activeVersionId ?? "");

  const { mutate: createAnnotation, isPending: isCreating } =
    useCreateAnnotationLive(annotationService);
  const { mutate: resolveAnnotation, isPending: isResolving } =
    useResolveAnnotationLive(annotationService);
  const { mutate: deleteAnnotation } = useDeleteAnnotationLive(annotationService);
  const { mutate: generateProceedings, isPending: isGenerating } =
    useGenerateProceedings(thesisService);

  const handleAddAnnotation = useCallback(
    (dto: Omit<CreateAnnotationDto, "thesisVersionId">) => {
      if (!activeVersionId) return;
      createAnnotation({
        thesisId,
        thesisVersionId: activeVersionId,
        input: dto,
      });
    },
    [thesisId, activeVersionId, createAnnotation]
  );

  const handleResolve = useCallback(
    (annotationId: string, dto: ResolveAnnotationDto) => {
      if (!activeVersionId) return;
      resolveAnnotation({
        thesisId,
        thesisVersionId: activeVersionId,
        annotationId,
        dto,
      });
    },
    [thesisId, activeVersionId, resolveAnnotation]
  );

  const handleDelete = useCallback(
    (annotationId: string) => {
      if (!activeVersionId) return;
      deleteAnnotation({
        thesisId,
        thesisVersionId: activeVersionId,
        annotationId,
      });
    },
    [thesisId, activeVersionId, deleteAnnotation]
  );

  const handleGenerateProceedings = useCallback(() => {
    generateProceedings(thesisId);
  }, [thesisId, generateProceedings]);

  const { data: panelistPool } = usePanelistPool(
    facultyService,
    programHeadService,
    adminService
  );
  const { mutate: createSchedule } = useCreateSchedule(scheduleService);
  const { user } = useAuth();
  const scheduledBy = user?.displayName ?? user?.email ?? "";

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
      panelistPool={panelistPool ?? []}
      scheduledBy={scheduledBy}
      onConfirmSchedule={(payload) => {
        createSchedule(payload);
      }}
    />
  );
}
