import { useState } from "react";
import { X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { MetadataForm, type ThesisMetadata } from "./MetadataForm";
import { UploadThesisDocument } from "./UploadThesisDocument";
import { ConfirmGroupInformation } from "./ConfirmGroupInformation";
import { useUserProfile } from "@monteai/hooks";
import { Alert, Button } from "@monteai/ui";
import { profileService } from "../lib/authService";
import { thesisService } from "../lib/thesisService";
import type { SubmitThesisDto } from "@monteai/types";

type Step = "metadata" | "upload" | "confirm";

function getSubmitErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "response" in err) {
    const response = (err as { response?: { status?: number; data?: unknown } })
      .response;
    if (response?.status === 403) {
      return "You are not allowed to perform this action.";
    }
    const data = response?.data;
    if (typeof data === "string" && data.trim()) {
      return data;
    }
    if (data && typeof data === "object") {
      const message = (data as Record<string, unknown>).Message;
      if (typeof message === "string" && message.trim()) {
        return message;
      }
    }
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return "Submission failed. Please try again.";
}

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
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
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

  const handleSubmit = async () => {
    if (!file || isSubmitting) {
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);
    try {
      if (mode === "revision") {
        if (!thesisId) {
          return;
        }

        const success = await thesisService.createThesisVersion(
          thesisId,
          file,
          "Revised Submission"
        );

        if (!success) {
          throw new Error("Failed to submit revised thesis.");
        }

        await queryClient.invalidateQueries({
          queryKey: ["theses", thesisId, "versions"],
        });

        onSubmitted?.();
        setSubmitSuccess("Your revised version was submitted successfully.");
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

      setSubmitSuccess(
        "Your thesis was submitted successfully and is now pending review."
      );
    } catch (err) {
      console.error("Submission error:", err);
      setSubmitError(getSubmitErrorMessage(err));
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
        {submitSuccess ? (
          <div className="flex flex-col items-center gap-5 p-8 text-center sm:p-10">
            <div className="w-full max-w-xl text-left">
              <Alert
                variant="success"
                title="Submission successful"
                message={submitSuccess}
              />
            </div>
            <Button variant="primary" className="rounded-full" onClick={onClose}>
              Done
            </Button>
          </div>
        ) : (
          <>
            {submitError && (
              <div className="px-6 pt-6 sm:px-8 sm:pt-8">
                <Alert
                  variant="error"
                  title="Submission failed"
                  message={submitError}
                />
              </div>
            )}
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
              <ConfirmGroupInformation
                metadata={metadata ?? undefined}
                file={file}
                mode={mode}
                onCancel={handleCancelFromConfirm}
                onReplaceFile={handleReplaceFile}
                onRemoveFile={handleRemoveFile}
                onSubmit={handleSubmit}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}