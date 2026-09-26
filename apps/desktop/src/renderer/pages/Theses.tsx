// apps/desktop/src/renderer/pages/Theses.tsx
import { useState } from "react";
import { ThesisCatalogPage } from "@monteai/ui/pages";
import { ThesisUploadModal } from "@monteai/ui/components/Thesis";
import { useApproveThesis } from "@/hooks/useApproveThesis";
import { useRequestRevision } from "@/hooks/useRequestRevision";
import { useRejectThesis } from "@/hooks/useRejectThesis";
import { useSubmitThesis, useUserProfile } from "@monteai/hooks";
import { profileService } from "../lib/authServices";
import { thesisService } from "../lib/thesisService";
import { useNavigate } from "react-router-dom";
import type { ThesisActionType } from "@monteai/types";

function getUploadErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "response" in err) {
    const response = (err as { response?: { status?: number; data?: unknown } }).response;

    if (response?.status === 403) {
      return "You are not allowed to upload theses.";
    }

    const data = response?.data;
    if (typeof data === "string" && data.trim()) return data;

    if (data && typeof data === "object") {
      const message = (data as Record<string, unknown>).Message;
      if (typeof message === "string" && message.trim()) return message;
    }
  }
  return "Failed to upload thesis. Please try again.";
}

export default function Theses() {
  const navigate = useNavigate();
  const { profile } = useUserProfile(profileService);
  const { mutate: approve } = useApproveThesis();
  const { mutate: revision } = useRequestRevision();
  const { mutate: reject } = useRejectThesis();
  const { mutate: submitThesis, isPending: isUploading } = useSubmitThesis(thesisService);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  const handleThesisAction = (thesisId: string, action: ThesisActionType) => {
    if (action === "approve") approve({ thesisId });
    if (action === "reject") reject({ thesisId });
    if (action === "revision") revision({ thesisId });
  };

  const canUpload = profile?.role === "Admin";

  return (
    <>
      <ThesisCatalogPage
        thesisService={thesisService}
        allowedActions={["approve", "reject", "revision"]}
        canUpload={canUpload}
        onUploadThesis={() => {
          setUploadError(null);
          setUploadSuccess(null);
          setUploadOpen(true);
        }}
        onViewDetails={(thesisId) => navigate(`/thesis/view/${thesisId}`)}
        onThesisAction={handleThesisAction}
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
        onSubmit={({ title, abstract, file }) => {
          if (!profile) return;
          setUploadError(null);
          setUploadSuccess(null);
          submitThesis(
            { dto: { title, abstract, filePath: "", uploadedById: profile.id }, file },
            {
              onSuccess: () => {
                // Keep the modal open on the success confirmation view (Done closes it).
                setUploadError(null);
                setUploadSuccess(
                  "Thesis uploaded successfully. It now appears as Pending in the catalog — use Approve to index it."
                );
              },
              onError: (err) => setUploadError(getUploadErrorMessage(err)),
            },
          );
        }}
      />
    </>
  );
}
