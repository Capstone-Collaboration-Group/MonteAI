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
  useDeleteThesisVersion,
} from "@monteai/hooks";
import { getApiErrorMessage } from "@monteai/utils";
import { toast } from "../components/Toaster";
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
  /** Signed-in student holds the "Leader" position in their own group. */
  isGroupLeader?: boolean;
  /** The user's research-group id — must match thesis.groupId for ownership. */
  currentGroupId?: string | null;
  onBack?: () => void;
  onSubmitRevision?: () => void;
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
  isGroupLeader = false,
  currentGroupId = null,
  onBack,
  onSubmitRevision,
}: ThesisPDFViewerProps) {
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

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

  const { mutate: deleteVersion, isPending: isDeletingVersion } =
    useDeleteThesisVersion(thesisService);

  // Owner-only delete: the signed-in student must be the leader of THIS
  // thesis's research group (thesis.groupId === the user's group) — leaders of
  // other groups and reviewers never see the button. Also latest-only; the
  // server re-checks both (403 / 400).
  const canDeleteVersion =
    role === "student" &&
    isGroupLeader &&
    !!thesis?.groupId &&
    currentGroupId != null &&
    thesis.groupId === currentGroupId &&
    !!activeVersion &&
    !!latestVersion &&
    activeVersion.id === latestVersion.id;

  const handleRequestDelete = useCallback(() => setDeleteDialogOpen(true), []);

  const handleDeleteVersion = useCallback(() => {
    if (!activeVersionId) return;
    const wasLastVersion = versions.length <= 1;
    setDeleteDialogOpen(false);

    deleteVersion(
      { thesisId, versionId: activeVersionId },
      {
        onSuccess: () => {
          // Reset so the selector falls back to whatever version is now latest
          // (null after the last-version cascade).
          setSelectedVersionId(null);
          toast.success(
            wasLastVersion ? "Thesis deleted." : "Version deleted."
          );
          if (wasLastVersion) onBack?.();
        },
        onError: (err) =>
          toast.error(getApiErrorMessage(err, "Couldn't delete the version.")),
      }
    );
  }, [activeVersionId, versions.length, deleteVersion, thesisId, onBack]);

  const handleGenerateProceedings = useCallback(() => {
    generateProceedings(thesisId);
  }, [thesisId, generateProceedings]);

  const { data: panelistPool } = usePanelistPool(
    facultyService,
    programHeadService,
    adminService
  );
  const { mutateAsync: createSchedule } = useCreateSchedule(scheduleService);
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
      canDeleteVersion={canDeleteVersion}
      deleteDialogOpen={deleteDialogOpen}
      isDeletingVersion={isDeletingVersion}
      onRequestDelete={handleRequestDelete}
      onDeleteVersion={handleDeleteVersion}
      onCancelDelete={() => setDeleteDialogOpen(false)}
      onVersionChange={setSelectedVersionId}
      onAddAnnotation={handleAddAnnotation}
      onResolve={handleResolve}
      onDelete={handleDelete}
      onGenerateProceedings={handleGenerateProceedings}
      onBack={onBack}
      onSubmitRevision={onSubmitRevision}
      panelistPool={panelistPool ?? []}
      scheduledBy={scheduledBy}
      onConfirmSchedule={(payload) => createSchedule(payload)}
    />
  );
}
