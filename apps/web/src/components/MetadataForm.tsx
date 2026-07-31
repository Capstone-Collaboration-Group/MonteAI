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
}

export function MetadataForm({ onNext, initialData }: MetadataFormProps) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [abstractText, setAbstractText] = useState(initialData?.abstract || "");
  const [program, setProgram] = useState(initialData?.program || "");
  const [institute, setInstitute] = useState(initialData?.institute || "");
  const [members, setMembers] = useState(initialData?.members || "");

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
              onChange={(event) => setProgram(event.target.value)}
              placeholder="Enter your program"
              className="mt-1 bg-surface-container-low"
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-outline">
              Institute
            </label>
            <Input
              value={institute}
              onChange={(event) => setInstitute(event.target.value)}
              placeholder="Enter your institute"
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
            onChange={(event) => setMembers(event.target.value)}
            placeholder="Enter your group members (use commas to separate each member)"
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