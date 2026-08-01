import { useRef, useState } from "react";
import { Button, Card } from "@monteai/ui";
import { FileText, UploadCloud } from "lucide-react";

interface UploadThesisDocumentProps {
  initialFile?: File | null;
  onCancel: () => void;
  onNext: (file: File) => void;
}

const MAX_FILE_SIZE_MB = 25;

function formatFileSize(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadThesisDocument({ initialFile = null, onCancel, onNext }: UploadThesisDocumentProps) {
  const [file, setFile] = useState<File | null>(initialFile);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (selected: File | null) => {
    if (!selected) return;
    if (selected.type !== "application/pdf") {
      alert("Please upload a PDF file.");
      return;
    }
    if (selected.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      alert(`File must be under ${MAX_FILE_SIZE_MB}MB.`);
      return;
    }
    setFile(selected);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    handleFile(event.dataTransfer.files?.[0] ?? null);
  };

  const handleNext = () => {
    if (file) onNext(file);
  };

  return (
    <Card className="max-w-2xl mx-auto p-6">
      <h2 className="text-lg font-semibold text-primary">Upload Thesis Document</h2>
      <p className="text-sm text-on-surface-variant mt-1">
        Please provide the final version of your thesis in a digital format for archival and review.
      </p>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`mt-5 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center cursor-pointer transition-colors ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-outline-variant bg-surface-container-low"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
        />
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <UploadCloud className="h-6 w-6" />
        </div>
        <p className="text-sm font-semibold text-primary leading-tight">
          Drag &amp; Drop your thesis document
          <br />
          OR tap to browse files
        </p>
        <div className="flex gap-2">
          <span className="rounded-full border border-outline-variant px-3 py-1 text-[11px] font-semibold text-on-surface-variant">
            PDF
          </span>
          <span className="rounded-full border border-outline-variant px-3 py-1 text-[11px] font-semibold text-on-surface-variant">
            MAX {MAX_FILE_SIZE_MB}MB
          </span>
        </div>
      </div>

      {file && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-primary/40 px-4 py-3">
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
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="text-primary hover:opacity-70"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={() => setFile(null)}
              className="text-error hover:opacity-70"
            >
              Remove
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" className="rounded-full" onClick={onCancel}>
          Cancel
        </Button>
        <Button className="rounded-full" onClick={handleNext} disabled={!file}>
          Next
        </Button>
      </div>
    </Card>
  );
}