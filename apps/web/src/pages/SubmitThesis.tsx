import { useState } from "react";
import { ThesisSubmissionModal } from "../components/ThesisSubmissionModal";

export default function SubmitThesis() {
  const [open, setOpen] = useState(true);

  return (
    <div className="min-h-screen bg-surface-container-low/60">
      <ThesisSubmissionModal
        open={open}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}