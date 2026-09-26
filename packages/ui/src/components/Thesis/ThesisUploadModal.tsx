// packages/ui/src/components/Thesis/ThesisUploadModal.tsx
//
// Admin-only modal for uploading a thesis directly into the catalog
// (e.g. legacy hard-copy theses from previous years). The caller gates
// visibility with RBAC (`canUpload` on ThesisCatalog) — this component
// only handles the form.
import { useRef, useState } from "react";
import { FileText, UploadCloud } from "lucide-react";
import { Modal, ModalHeader } from "../common/Modal";
import { Alert } from "../common/Alert";
import { Button } from "../Button";
import { Input } from "../Input";
import { Textarea } from "../common/Textarea";

const MAX_FILE_SIZE_MB = 25;

export interface ThesisUploadInput {
    title: string;
    abstract: string;
    file: File;
}

interface ThesisUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (input: ThesisUploadInput) => void;
    /** Disables the submit button and shows a progress state while the upload runs. */
    submitting?: boolean;
    /** Server-side error (e.g. duplicate title conflict) surfaced inside the modal. */
    error?: string | null;
    /** Success message — when set, the modal switches to a confirmation view. */
    success?: string | null;
}

function formatFileSize(bytes: number) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ThesisUploadModal({ isOpen, ...props }: ThesisUploadModalProps) {
    // Render nothing while closed so the form state below starts fresh
    // on every open (the inner form unmounts when the modal closes).
    if (!isOpen) return null;
    return <ThesisUploadForm {...props} />;
}

function ThesisUploadForm({
    onClose,
    onSubmit,
    submitting = false,
    error = null,
    success = null,
}: Omit<ThesisUploadModalProps, "isOpen">) {
    const [title, setTitle] = useState("");
    const [abstract, setAbstract] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [fileError, setFileError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFile = (selected: File | null | undefined) => {
        if (!selected) return;
        if (selected.type !== "application/pdf") {
            setFileError("Please upload a PDF file.");
            return;
        }
        if (selected.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            setFileError(`File must be under ${MAX_FILE_SIZE_MB}MB.`);
            return;
        }
        setFileError(null);
        setFile(selected);
    };

    const canSubmit =
        title.trim().length > 0 &&
        abstract.trim().length > 0 &&
        file !== null &&
        !submitting;

    const handleSubmit = () => {
        if (!canSubmit || !file) return;
        onSubmit({ title: title.trim(), abstract: abstract.trim(), file });
    };

    // Confirmation view: the upload landed — show the success Alert and wait
    // for an explicit Done instead of silently closing the dialog.
    if (success) {
        return (
            <Modal isOpen onClose={onClose} size="md">
                <ModalHeader onClose={onClose}>
                    <div className="min-w-0">
                        <p className="text-base font-semibold leading-tight text-on-surface">
                            Upload Thesis
                        </p>
                    </div>
                </ModalHeader>
                <div className="p-6">
                    <Alert variant="success" title="Upload successful" message={success} />
                </div>
                <div className="flex justify-end border-t border-outline/10 bg-surface-container-low/50 px-4 py-3 sm:px-6 sm:py-4">
                    <Button variant="primary" onClick={onClose} className="sm:w-auto">
                        Done
                    </Button>
                </div>
            </Modal>
        );
    }

    return (
        <Modal isOpen onClose={onClose} size="lg">
            <ModalHeader onClose={onClose}>
                <div className="min-w-0">
                    <p className="text-base font-semibold leading-tight text-on-surface">
                        Upload Thesis
                    </p>
                    <p className="truncate text-xs font-normal text-on-surface-variant">
                        Add a thesis document to the catalog for review.
                    </p>
                </div>
            </ModalHeader>

            <div className="flex max-h-[70vh] min-h-0 flex-col overflow-y-auto p-6">
                <div className="flex flex-col gap-5">
                    <div className="flex flex-col gap-1.5">
                        <label className="block text-sm font-medium text-on-surface">
                            Title
                        </label>
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g. A Web-Based Research Repository for Colegio de Montalban"
                            maxLength={255}
                            disabled={submitting}
                        />
                    </div>

                    <Textarea
                        label="Abstract"
                        value={abstract}
                        onChange={(e) => setAbstract(e.target.value)}
                        placeholder="Paste or type the thesis abstract."
                        rows={6}
                        helperText="Used by MonteAI's retrieval pipeline when the thesis is approved and indexed."
                        disabled={submitting}
                    />

                    <div className="flex flex-col gap-1.5">
                        <span className="block text-sm font-medium text-on-surface">
                            Thesis document
                        </span>

                        <input
                            ref={inputRef}
                            type="file"
                            accept="application/pdf"
                            className="hidden"
                            onChange={(event) => {
                                handleFile(event.target.files?.[0] ?? null);
                                // Allow re-selecting the same file after a Remove.
                                event.target.value = "";
                            }}
                        />

                        {!file ? (
                            <div
                                onDragOver={(event) => {
                                    event.preventDefault();
                                    setIsDragging(true);
                                }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={(event) => {
                                    event.preventDefault();
                                    setIsDragging(false);
                                    handleFile(event.dataTransfer.files?.[0] ?? null);
                                }}
                                onClick={() => !submitting && inputRef.current?.click()}
                                className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 text-center cursor-pointer transition-colors ${
                                    isDragging
                                        ? "border-primary bg-primary/5"
                                        : "border-outline-variant bg-surface-container-low"
                                }`}
                            >
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                                    <UploadCloud className="h-5 w-5" />
                                </div>
                                <p className="text-sm font-semibold text-primary leading-tight">
                                    Drag &amp; drop the thesis document
                                    <br />
                                    or click to browse
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
                        ) : (
                            <div className="flex items-center justify-between rounded-xl border border-primary/40 px-4 py-3">
                                <div className="flex min-w-0 items-center gap-3">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-error/10 text-error">
                                        <FileText className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-on-surface">
                                            {file.name}
                                        </p>
                                        <p className="text-xs text-on-surface-variant">
                                            {formatFileSize(file.size)}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex shrink-0 gap-4 text-[11px] font-semibold uppercase tracking-wide">
                                    <button
                                        type="button"
                                        onClick={() => inputRef.current?.click()}
                                        disabled={submitting}
                                        className="text-primary hover:opacity-70 disabled:opacity-50"
                                    >
                                        Replace
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setFile(null);
                                            setFileError(null);
                                        }}
                                        disabled={submitting}
                                        className="text-error hover:opacity-70 disabled:opacity-50"
                                    >
                                        Remove
                                    </button>
                                </div>
                            </div>
                        )}

                        {fileError && <p className="text-xs text-error">{fileError}</p>}
                    </div>

                    {error && (
                        <Alert variant="error" title="Upload failed" message={error} />
                    )}
                </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-outline/10 bg-surface-container-low/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-end sm:gap-3 sm:px-6 sm:py-4">
                <Button
                    variant="ghost"
                    onClick={onClose}
                    disabled={submitting}
                    className="w-full border border-outline/30 shadow-sm sm:w-auto"
                >
                    Cancel
                </Button>
                <Button
                    variant="primary"
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    className="inline-flex w-full items-center justify-center gap-2 shadow-sm sm:w-auto"
                >
                    {submitting ? "Uploading..." : "Upload Thesis"}
                </Button>
            </div>
        </Modal>
    );
}
