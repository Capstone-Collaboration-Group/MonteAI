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
  AnnotationResponseDto,
  CreateAnnotationDto,
  ResolveAnnotationDto,
  ViewerRole,
} from "@monteai/types";
import {
  useThesisVersions,
  useAnnotationsLive,
  useCreateAnnotationLive,
  useApproveAnnotationLive,
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
import { toast } from "../components/toast";
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

// Viewer vocabulary → the profile role stamped on the comment. The stamp
// decides whether a comment is created "pending" (needs Admin approval) or
// already "approved" (Admin). "adviser" is never produced by toViewerRole;
// it's treated as a reviewer like faculty.
const VIEWER_ROLE_TO_PROFILE_ROLE: Record<ViewerRole, string> = {
  adviser: "Faculty",
  faculty: "Faculty",
  program_head: "ProgramHead",
  admin: "Admin",
  student: "Student",
};

function hasBlobErrorResponse(error: unknown): error is { response: { data: Blob } } {
  if (typeof error !== "object" || error === null || !("response" in error))
    return false;

  const response = error.response;
  return (
    typeof response === "object" &&
    response !== null &&
    "data" in response &&
    response.data instanceof Blob
  );
}

async function getProceedingsErrorMessage(
  error: unknown,
  fallback: string
): Promise<string> {
  if (!hasBlobErrorResponse(error))
    return getApiErrorMessage(error, fallback);

  const body = await error.response.data.text();
  if (!body.trim()) return fallback;

  try {
    const payload: unknown = JSON.parse(body);
    if (typeof payload === "object" && payload !== null) {
      const message =
        ("Message" in payload && payload.Message) ||
        ("message" in payload && payload.message);
      if (typeof message === "string" && message.trim()) return message.trim();
    }
  } catch {
    return body.trim();
  }

  return getApiErrorMessage(error, fallback);
}

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
  const { user } = useAuth();

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
    annotations: allAnnotations,
    isLoading: annotationsLoading,
  } = useAnnotationsLive(annotationService, thesisId, activeVersionId ?? "");

  // ── Approval gate ─────────────────────────────────────────────────────
  // Faculty / program-head comments are created "pending": only an Admin and
  // the comment's own author can see them until they're approved. Everyone
  // else (students included) sees approved comments only. The server-side
  // proceedings reader applies the same rule so pending comments never reach
  // the printed PDF.
  const currentUid = user?.uid ?? null;
  const canApprove = role === "admin";
  const annotations = allAnnotations.filter((annotation) => {
    if ((annotation.status ?? "approved") !== "pending") return true;
    if (canApprove) return true;
    return currentUid != null && annotation.reviewerId === currentUid;
  });
  const unresolvedCount = annotations.filter((a) => !a.isResolved).length;
  const resolvedCount = annotations.length - unresolvedCount;

  // ── Delete gate ───────────────────────────────────────────────────────
  // Students may only remove their own comments; anything authored by
  // faculty, a program head or an admin is theirs alone to delete. (Students
  // can't annotate at all today, so in practice a student never gets a
  // trash button.) Everyone else keeps the existing behaviour.
  const canDeleteAnnotation = useCallback(
    (annotation: AnnotationResponseDto) => {
      if (role !== "student") return true;
      return (
        annotation.authorRole === "Student" &&
        currentUid != null &&
        annotation.reviewerId === currentUid
      );
    },
    [role, currentUid]
  );

  const { mutate: createAnnotation, isPending: isCreating } =
    useCreateAnnotationLive(annotationService);
  const { mutate: approveAnnotation, isPending: isApproving } =
    useApproveAnnotationLive(annotationService);
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
        // Stamped on the document: Admin → approved, anyone else → pending.
        input: { ...dto, authorRole: VIEWER_ROLE_TO_PROFILE_ROLE[role] },
      });
    },
    [thesisId, activeVersionId, createAnnotation, role]
  );

  const handleApprove = useCallback(
    (annotationId: string) => {
      if (!activeVersionId) return;
      approveAnnotation(
        { thesisId, thesisVersionId: activeVersionId, annotationId },
        {
          onSuccess: () => toast.success("Comment approved and published."),
          onError: (error) =>
            toast.error(
              getApiErrorMessage(error, "Couldn't approve the comment.")
            ),
        }
      );
    },
    [thesisId, activeVersionId, approveAnnotation]
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
      // Defense in depth: the sidebar hides the trash button for comments a
      // student may not remove, but re-check here so a stale UI can't delete
      // a faculty / program-head / admin comment.
      const target = annotations.find((a) => a.id === annotationId);
      if (target && !canDeleteAnnotation(target)) {
        toast.error("You can only delete your own comments.");
        return;
      }
      deleteAnnotation({
        thesisId,
        thesisVersionId: activeVersionId,
        annotationId,
      });
    },
    [thesisId, activeVersionId, deleteAnnotation, annotations, canDeleteAnnotation]
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
    generateProceedings(thesisId, {
      onError: (error) => {
        const fallback = "Couldn't generate the proceedings.";
        void getProceedingsErrorMessage(error, fallback)
          .then((message) => toast.error(message))
          .catch(() => toast.error(fallback));
      },
    });
  }, [thesisId, generateProceedings]);

  const { data: panelistPool } = usePanelistPool(
    facultyService,
    programHeadService,
    adminService
  );
  const { mutateAsync: createSchedule } = useCreateSchedule(scheduleService);
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
      canApprove={canApprove}
      isApproving={isApproving}
      onApprove={handleApprove}
      canDeleteAnnotation={canDeleteAnnotation}
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
