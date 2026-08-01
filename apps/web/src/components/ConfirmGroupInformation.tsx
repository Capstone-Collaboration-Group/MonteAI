import { Button, Card } from "@monteai/ui";
import { FileText } from "lucide-react";
import type { ThesisMetadata } from "./MetadataForm";

interface ConfirmGroupInformationProps {
  metadata: ThesisMetadata;
  file: File;
  onCancel: () => void;
  onReplaceFile: () => void;
  onRemoveFile: () => void;
  onSubmit: () => void;
}

function formatFileSize(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ConfirmGroupInformation({
  metadata,
  file,
  onCancel,
  onReplaceFile,
  onRemoveFile,
  onSubmit,
}: ConfirmGroupInformationProps) {
  const members = metadata.members
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-4">
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-primary">Confirm Group Information</h2>
        <p className="text-sm text-on-surface-variant mt-1">
          Review the details of your research group before final submission.
        </p>

        <div className="mt-6 space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-outline">Thesis Title</p>
            <p className="text-sm font-semibold text-on-surface">{metadata.title || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-outline">Program</p>
            <p className="text-sm font-semibold text-on-surface">{metadata.program || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-outline">Institute</p>
            <p className="text-sm font-semibold text-on-surface">{metadata.institute || "—"}</p>
          </div>
        </div>

        <div className="mt-6">
          <p className="text-sm font-semibold text-primary">Thesis Members ({members.length})</p>
          <ul className="mt-2 space-y-1">
            {members.length > 0 ? (
              members.map((name) => (
                <li key={name} className="text-sm text-on-surface">
                  {name}
                </li>
              ))
            ) : (
              <li className="text-sm text-on-surface-variant">No members listed</li>
            )}
          </ul>
        </div>

        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-outline mb-2">Attached File</p>
          <div className="flex items-center justify-between rounded-xl border border-primary/40 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-error/10 text-error">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-on-surface">{file.name}</p>
                <p className="text-xs text-on-surface-variant">{formatFileSize(file.size)}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-[11px] font-semibold uppercase tracking-wide">
              <button type="button" onClick={onReplaceFile} className="text-primary hover:opacity-70">
                Replace
              </button>
              <button type="button" onClick={onRemoveFile} className="text-error hover:opacity-70">
                Remove
              </button>
            </div>
          </div>
        </div>
      </Card>

      <div className="rounded-xl bg-amber-100 border border-amber-200 px-5 py-4">
        <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Final Review Required</p>
        <p className="text-sm text-amber-800 mt-1">
          Please ensure all information above is accurate. Once submitted, you will not be able to modify
          the group composition without administrative approval.
        </p>
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="secondary" className="rounded-full" onClick={onCancel}>
          Cancel
        </Button>
        <Button className="rounded-full" onClick={onSubmit}>
          Submit
        </Button>
      </div>
    </div>
  );
}