import { useState } from "react";
import { X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { MetadataForm, type ThesisMetadata } from "./MetadataForm";
import { UploadThesisDocument } from "./UploadThesisDocument";
import { ConfirmGroupInformation } from "./ConfirmGroupInformation";
import { useUserProfile } from "@monteai/hooks";
import { Textarea, toast } from "@monteai/ui";
import { getApiErrorMessage } from "@monteai/utils";
import { profileService } from "../lib/authService";
import { thesisService } from "../lib/thesisService";
import type { SubmitThesisDto } from "@monteai/types";

type Step = "metadata" | "upload" | "confirm";

interface ThesisSubmissionModalProps {
  open: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
  mode?: "initial" | "revision";
  thesisId?: string;
}

export function ThesisSubmissionModal({
  open,
  onClose,
  onSubmitted,
  mode = "initial",
  thesisId,
}: ThesisSubmissionModalProps) {
  const queryClient = useQueryClient();
  const { profile, isLoading, error } = useUserProfile(profileService);  

  const [step, setStep] = useState<Step>(mode === "revision" ? "upload" : "metadata");
  const [metadata, setMetadata] = useState<ThesisMetadata | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [revisionAbstract, setRevisionAbstract] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="rounded-xl bg-surface-container-low p-8 shadow-xl">
          Loading student profile...
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="rounded-xl bg-surface-container-low p-8 shadow-xl">
          Unable to load your student profile.
        </div>
      </div>
    );
  }



if (profile.role !== "Student") {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="rounded-xl bg-surface-container-low p-8 shadow-xl">
        Only students can submit a thesis.
      </div>
    </div>
  );
}

// Only 3rd/4th year students may submit (initial + revision) — the server
// rejects the request too; this just fails fast in the UI.
if (profile.yearLevel !== 3 && profile.yearLevel !== 4) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="rounded-xl bg-surface-container-low p-8 shadow-xl">
        Only 3rd and 4th year students may submit a manuscript.
      </div>
    </div>
  );
}



  const handleCancelFromUpload = () => {
    if (mode === "revision") {
        onClose();
        return;
    }

    setStep("metadata");
  };

  const handleCancelFromConfirm = () => {
    setStep("upload");
  };

  const handleMetadataNext = (data: ThesisMetadata) => {
    setMetadata(data);
    setStep("upload");
  };

  const handleUploadNext = (selectedFile: File) => {
    setFile(selectedFile);
    setStep("confirm");
  };

  const handleReplaceFile = () => {
    setStep("upload");
  };

  const handleRemoveFile = () => {
    setFile(null);
    setStep("upload");
  };

  // The modal stays mounted while closed — clear the wizard so the next
  // open starts fresh (metadata → upload → confirm, or upload for revision).
  const resetForm = () => {
    setStep(mode === "revision" ? "upload" : "metadata");
    setMetadata(null);
    setFile(null);
    setRevisionAbstract("");
  };

  const handleSubmit = async () => {
    if (!file || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === "revision") {
        if (!thesisId) {
          return;
        }

        const success = await thesisService.createThesisVersion(
          thesisId,
          file,
          "Revised Submission",
          revisionAbstract.trim() || undefined
        );

        if (!success) {
          throw new Error("Failed to submit revised thesis.");
        }

        // Prefix invalidation covers list, detail, versions, and the /submit
        // page's ["theses","my"] summary (the revision may carry a new abstract).
        await queryClient.invalidateQueries({ queryKey: ["theses"] });

        toast.success("Your revised version was submitted successfully.");
        onSubmitted?.();
        resetForm();
        onClose();
        return;
      }

      if (!metadata) {
        return;
      }

      const dto: SubmitThesisDto = {
        title: metadata.title,
        abstract: metadata.abstract,
        filePath: "",
        uploadedById: profile.id,
      };

      await thesisService.submitThesis(dto, file);

      // Refresh the list + the /submit page's ["theses","my"] summary so the
      // new submission appears the moment the modal closes.
      await queryClient.invalidateQueries({ queryKey: ["theses"] });

      toast.success(
        "Your thesis was submitted successfully and is now pending review."
      );
      onSubmitted?.();
      resetForm();
      onClose();
    } catch (err) {
      console.error("Submission error:", err);
      toast.error(
        getApiErrorMessage(
          err,
          mode === "revision"
            ? "Failed to submit revised thesis."
            : "Submission failed. Please try again."
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl bg-surface-container-low shadow-xl">
        <button
            type="button"
            onClick={onClose}
            className="absolute right-6 top-6 z-10 rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
            aria-label="Close thesis submission"
            >
            <X className="h-5 w-5" />
        </button>
        {step === "metadata" && (
          <MetadataForm
            onNext={handleMetadataNext}
            initialData={metadata || undefined}
            program={profile.researchGroup?.members
            .map((member) => member.program)
            .filter(Boolean)
            .join(", ") || profile.program}
            institute={profile.researchGroup?.institute || profile.institute}
            members={profile.researchGroup?.members
            .map((member) => member.name)
            .join(", ") || `${profile.firstName} ${profile.lastName}`}
            />
        )}

        {step === "upload" && (
          <UploadThesisDocument
            initialFile={file}
            onCancel={handleCancelFromUpload}
            onNext={handleUploadNext}
          />
        )}

        {step === "confirm" && file && (
          <>
            {mode === "revision" && (
              <div className="px-6 pt-6 sm:px-8 sm:pt-8">
                <Textarea
                  label="Revised Abstract (optional)"
                  helperText="Leave blank to keep the current abstract for this thesis."
                  rows={5}
                  value={revisionAbstract}
                  onChange={(e) => setRevisionAbstract(e.target.value)}
                  placeholder="Paste the updated abstract for this version…"
                />
              </div>
            )}
            <ConfirmGroupInformation
              metadata={metadata ?? undefined}
              file={file}
              mode={mode}
              onCancel={handleCancelFromConfirm}
              onReplaceFile={handleReplaceFile}
              onRemoveFile={handleRemoveFile}
              onSubmit={handleSubmit}
            />
          </>
        )}
      </div>
    </div>
  );
}