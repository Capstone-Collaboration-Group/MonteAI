// packages/ui/src/components/Thesis/ThesisEditModal.tsx
//
// Admin-only modal for editing a thesis' core catalog details (title +
// abstract). Gating happens in the caller: ThesisCatalogPage only receives
// "edit" in allowedActions for Admin desktop sessions — this component only
// handles the form. The server re-indexes edited theses for MonteAI
// automatically (see ThesisService.UpdateDetailsAsync).
import { useState } from "react";
import { Modal, ModalHeader } from "../common/Modal";
import { Alert } from "../common/Alert";
import { Button } from "../Button";
import { Input } from "../Input";
import { Textarea } from "../common/Textarea";
import type { ThesisResponseDto } from "@monteai/types";

export interface ThesisEditInput {
    title: string;
    abstract: string;
}

interface ThesisEditModalProps {
    isOpen: boolean;
    /**
     * Thesis being edited — prefills the form. `abstract` must be the
     * resolved text (what GET /thesis/{id} returns), never the Firestore
     * document GUID.
     */
    thesis: ThesisResponseDto | null;
    onClose: () => void;
    onSubmit: (input: ThesisEditInput) => void;
    /** Disables the form and shows a progress state while the save runs. */
    submitting?: boolean;
    /** Server-side error surfaced inside the modal. */
    error?: string | null;
}

export function ThesisEditModal({ isOpen, thesis, ...props }: ThesisEditModalProps) {
    // Render nothing while closed so each open starts from the thesis' current
    // values (keying the form below resets state when a different row is edited).
    if (!isOpen || !thesis) return null;
    return <ThesisEditForm key={thesis.id} thesis={thesis} {...props} />;
}

function ThesisEditForm({
    thesis,
    onClose,
    onSubmit,
    submitting = false,
    error = null,
}: Omit<ThesisEditModalProps, "isOpen" | "thesis"> & { thesis: ThesisResponseDto }) {
    const [title, setTitle] = useState(thesis.title ?? "");
    const [abstract, setAbstract] = useState(thesis.abstract ?? "");

    const canSubmit = title.trim().length > 0 && abstract.trim().length > 0 && !submitting;

    const handleSubmit = () => {
        if (!canSubmit) return;
        onSubmit({ title: title.trim(), abstract: abstract.trim() });
    };

    return (
        <Modal isOpen onClose={onClose} size="lg">
            <ModalHeader onClose={onClose}>
                <div className="min-w-0">
                    <p className="text-base font-semibold leading-tight text-on-surface">
                        Edit thesis details
                    </p>
                    <p className="truncate text-xs font-normal text-on-surface-variant">
                        Updates the catalog entry — MonteAI's search index refreshes
                        automatically after saving.
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
                        rows={8}
                        helperText="Used by MonteAI's retrieval pipeline to answer research questions."
                        disabled={submitting}
                    />

                    {error && (
                        <Alert variant="error" title="Update failed" message={error} />
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
                    {submitting ? "Saving..." : "Save changes"}
                </Button>
            </div>
        </Modal>
    );
}
