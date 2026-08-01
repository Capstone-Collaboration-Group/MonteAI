import { useState } from "react";
import { MetadataForm, type ThesisMetadata } from "../components/MetadataForm";
import { UploadThesisDocument } from "../components/UploadThesisDocument";
import { ConfirmGroupInformation } from "../components/ConfirmGroupInformation";

type Step = "metadata" | "upload" | "confirm";

export default function SubmitThesis() {
  const [step, setStep] = useState<Step>("metadata");
  const [metadata, setMetadata] = useState<ThesisMetadata | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const handleCancelFromUpload = () => {
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

  const handleSubmit = () => {
    console.log("Submitting thesis:", { metadata, file });
    // TODO: send metadata + file to the backend once the endpoint is ready
  };

  return (
    <div className="min-h-screen bg-surface-container-low/60 p-6 lg:p-8">
      {step === "metadata" && (
        <MetadataForm onNext={handleMetadataNext} initialData={metadata || undefined} />
      )}

      {step === "upload" && (
        <UploadThesisDocument
          initialFile={file}
          onCancel={handleCancelFromUpload}
          onNext={handleUploadNext}
        />
      )}

      {step === "confirm" && metadata && file && (
        <ConfirmGroupInformation
          metadata={metadata}
          file={file}
          onCancel={handleCancelFromConfirm}
          onReplaceFile={handleReplaceFile}
          onRemoveFile={handleRemoveFile}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}