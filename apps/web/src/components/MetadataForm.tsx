import { useState } from "react";
import { Button, Card, Input } from "@monteai/ui";

export type ThesisMetadata = {
  title: string;
  abstract: string;
  program: string;
  institute: string;
  members: string;
};

interface MetadataFormProps {
  onNext: (data: ThesisMetadata) => void;
  initialData?: ThesisMetadata;
  program: string;
  institute: string;
  members: string;
}

export function MetadataForm({ onNext, initialData, program: groupProgram, institute: groupInstitute, members: groupMMembers }: MetadataFormProps) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [abstractText, setAbstractText] = useState(initialData?.abstract || "");
  const program = groupProgram;
  const institute = groupInstitute;
  const members = groupMMembers;
    const isFormValid =
    title.trim() &&
    abstractText.trim() &&
    program.trim() &&
    institute.trim() &&
    members.trim();

  const handleNext = () => {
  if (
    !title.trim() ||
    !abstractText.trim() ||
    !program.trim() ||
    !institute.trim() ||
    !members.trim()
  ) {
    return;
  }

  onNext({
    title,
    abstract: abstractText,
    program,
    institute,
    members,
  });
};

  return (
    <Card className="max-w-2xl mx-auto p-6">
      <h2 className="text-lg font-semibold text-primary mb-4">Metadata</h2>

      <div className="space-y-5">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-outline">
            Thesis Title
          </label>
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Enter thesis title"
            className="mt-1 bg-surface-container-low"
          />
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-outline">
            Thesis Abstract
          </label>
          <textarea
            value={abstractText}
            onChange={(event) => setAbstractText(event.target.value)}
            placeholder="Provide a concise summary of your research"
            className="mt-1 w-full min-h-[90px] resize-y rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 text-sm outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-outline">
              Program
            </label>
            <Input
              value={program}
              readOnly
              className="mt-1 bg-surface-container-low"
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-outline">
              Institute
            </label>
            <Input
              value={institute}
              readOnly
              className="mt-1 bg-surface-container-low"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-outline">
            Thesis Members
          </label>
          <Input
            value={members}
            readOnly
            className="mt-1 bg-surface-container-low"
          />
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <Button
            className="rounded-full"
            onClick={handleNext}
            disabled={!isFormValid}
            >
            Next
            </Button>
      </div>
    </Card>
  );
}