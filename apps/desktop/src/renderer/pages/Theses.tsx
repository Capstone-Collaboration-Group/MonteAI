// apps/desktop/src/renderer/pages/Theses.tsx
import { useState } from "react";
import { ThesisCatalogPage } from "@monteai/ui/pages";
import { ThesisUploadModal, ThesisEditModal, ThesisDeleteDialog } from "@monteai/ui/components/Thesis";
import { useApproveThesis } from "@/hooks/useApproveThesis";
import { useRequestRevision } from "@/hooks/useRequestRevision";
import { useRejectThesis } from "@/hooks/useRejectThesis";
import { useSubmitThesis, useUpdateThesis, useDeleteThesis, useUserProfile } from "@monteai/hooks";
import { profileService } from "../lib/authServices";
import { thesisService } from "../lib/thesisService";
import { useNavigate } from "react-router-dom";
import type { ThesisActionType, ThesisResponseDto } from "@monteai/types";

// Extracts a human-readable message from an axios error. Server messages
// (string bodies or { Message }) win; 403 and unknown failures fall back to
// the caller's copy so each action explains itself.
function getActionErrorMessage(err: unknown, forbiddenMessage: string, fallback: string): string {
  if (err && typeof err === "object" && "response" in err) {
    const response = (err as { response?: { status?: number; data?: unknown } }).response;

    if (response?.status === 403) return forbiddenMessage;

    const data = response?.data;
    if (typeof data === "string" && data.trim()) return data;

    if (data && typeof data === "object") {
      const message = (data as Record<string, unknown>).Message;
      if (typeof message === "string" && message.trim()) return message;
    }
  }
  return fallback;
}

export default function Theses() {
  const navigate = useNavigate();
  const { profile } = useUserProfile(profileService);
  const { mutate: approve } = useApproveThesis();
  const { mutate: revision } = useRequestRevision();
  const { mutate: reject } = useRejectThesis();
  const { mutate: submitThesis, isPending: isUploading } = useSubmitThesis(thesisService);
  const { mutate: updateThesis, isPending: isUpdating } = useUpdateThesis(thesisService);
  const { mutate: deleteThesis, isPending: isDeleting } = useDeleteThesis(thesisService);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // Full-CRUD modals — populated on demand from GET /thesis/{id} (the list
  // rows only carry summaries; the edit form needs the resolved abstract).
  const [editTarget, setEditTarget] = useState<ThesisResponseDto | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ThesisResponseDto | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ variant: "success" | "error"; message: string } | null>(null);

  const isAdmin = profile?.role === "Admin";

  // Full CRUD (edit/delete) is Admin-only; moderation stays as before.
  // Web/mobile never pass these actions, so the catalog is read-only there.
  const allowedActions: ThesisActionType[] = isAdmin
    ? ["approve", "reject", "revision", "edit", "delete"]
    : ["approve", "reject", "revision"];

  const handleThesisAction = async (thesisId: string, action: ThesisActionType) => {
    if (action === "approve") { approve({ thesisId }); return; }
    if (action === "reject") { reject({ thesisId }); return; }
    if (action === "revision") { revision({ thesisId }); return; }

    if (action === "edit" || action === "delete") {
      setNotice(null);
      try {
        const thesis = await thesisService.getThesis(thesisId);
        if (!thesis) throw new Error("not-found");
        if (action === "edit") {
          setEditError(null);
          setEditTarget(thesis);
        } else {
          setDeleteError(null);
          setDeleteTarget(thesis);
        }
      } catch {
        setNotice({
          variant: "error",
          message: "Could not load the thesis details. Please try again.",
        });
      }
    }
  };

  const canUpload = isAdmin;

  return (
    <>
      <ThesisCatalogPage
        thesisService={thesisService}
        allowedActions={allowedActions}
        canUpload={canUpload}
        onUploadThesis={() => {
          setUploadError(null);
          setUploadSuccess(null);
          setUploadOpen(true);
        }}
        onViewDetails={(thesisId) => navigate(`/thesis/view/${thesisId}`)}
        onThesisAction={handleThesisAction}
        notice={notice}
        onDismissNotice={() => setNotice(null)}
      />

      <ThesisUploadModal
        isOpen={uploadOpen}
        onClose={() => {
          if (isUploading) return;
          setUploadOpen(false);
          setUploadError(null);
          setUploadSuccess(null);
        }}
        submitting={isUploading}
        error={uploadError}
        success={uploadSuccess}
        onSubmit={({ title, abstract, file, authors, publicationYear }) => {
          if (!profile) return;
          setUploadError(null);
          setUploadSuccess(null);
          submitThesis(
            {
              dto: {
                title,
                abstract,
                filePath: "",
                uploadedById: profile.id,
                authors,
                publicationYear,
              },
              file,
            },
            {
              onSuccess: () => {
                // Keep the modal open on the success confirmation view (Done closes it).
                setUploadError(null);
                setUploadSuccess(
                  "Thesis uploaded and indexed automatically — it is now searchable by MonteAI (status: Indexed).",
                );
              },
              onError: (err) =>
                setUploadError(
                  getActionErrorMessage(
                    err,
                    "You are not allowed to upload theses.",
                    "Failed to upload thesis. Please try again.",
                  ),
                ),
            },
          );
        }}
      />

      <ThesisEditModal
        isOpen={!!editTarget}
        thesis={editTarget}
        submitting={isUpdating}
        error={editError}
        onClose={() => {
          if (isUpdating) return;
          setEditTarget(null);
          setEditError(null);
        }}
        onSubmit={({ title, abstract }) => {
          if (!editTarget) return;
          setEditError(null);
          updateThesis(
            { id: editTarget.id, dto: { title, abstract } },
            {
              onSuccess: () => {
                setEditTarget(null);
                setNotice({
                  variant: "success",
                  message: "Thesis details updated — MonteAI's search index refreshed automatically.",
                });
              },
              onError: (err) =>
                setEditError(
                  getActionErrorMessage(
                    err,
                    "You are not allowed to edit theses.",
                    "Failed to update thesis. Please try again.",
                  ),
                ),
            },
          );
        }}
      />

      <ThesisDeleteDialog
        isOpen={!!deleteTarget}
        thesisTitle={deleteTarget?.title}
        submitting={isDeleting}
        error={deleteError}
        onClose={() => {
          if (isDeleting) return;
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        onConfirm={() => {
          if (!deleteTarget) return;
          setDeleteError(null);
          deleteThesis(
            { id: deleteTarget.id },
            {
              onSuccess: (deleted) => {
                if (deleted === false) {
                  setDeleteError("The thesis could not be deleted — it may already be gone.");
                  return;
                }
                setDeleteTarget(null);
                setNotice({
                  variant: "success",
                  message: "Thesis deleted — record, document, and MonteAI index entries removed.",
                });
              },
              onError: (err) =>
                setDeleteError(
                  getActionErrorMessage(
                    err,
                    "You are not allowed to delete theses.",
                    "Failed to delete thesis. Please try again.",
                  ),
                ),
            },
          );
        }}
      />
    </>
  );
}
