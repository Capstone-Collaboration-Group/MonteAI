// packages/ui/src/components/Thesis/ThesisDeleteDialog.tsx
//
// Confirmation dialog for the destructive catalog Delete action. The server
// cascade is permanent (SQL rows + versions + blobs + Pinecone vectors +
// Firestore abstract/annotations — see ThesisService.DeleteAsync), so the
// copy is deliberately explicit. RBAC gating happens in the caller: desktop
// passes "delete" in allowedActions for Admin sessions only.
import { Modal, ModalHeader } from "../common/Modal";
import { Alert } from "../common/Alert";
import { Button } from "../Button";

interface ThesisDeleteDialogProps {
    isOpen: boolean;
    /** Shown in the confirmation copy so the admin knows which row dies. */
    thesisTitle?: string;
    onClose: () => void;
    onConfirm: () => void;
    submitting?: boolean;
    error?: string | null;
}

export function ThesisDeleteDialog({
    isOpen,
    thesisTitle,
    onClose,
    onConfirm,
    submitting = false,
    error = null,
}: ThesisDeleteDialogProps) {
    if (!isOpen) return null;

    return (
        <Modal isOpen onClose={onClose} size="md" closeOnOverlayClick={!submitting}>
            <ModalHeader onClose={onClose}>
                <div className="min-w-0">
                    <p className="text-base font-semibold leading-tight text-on-surface">
                        Delete thesis
                    </p>
                    <p className="truncate text-xs font-normal text-on-surface-variant">
                        This action cannot be undone.
                    </p>
                </div>
            </ModalHeader>

            <div className="flex flex-col gap-4 p-6">
                <Alert
                    variant="warning"
                    title="Permanently delete this thesis?"
                    message="The thesis record, its uploaded PDF, its version history, and its entries in MonteAI's search index will all be removed. MonteAI will stop citing it immediately."
                />
                {thesisTitle && (
                    <p className="rounded-xl border border-outline-variant bg-surface-container-low px-4 py-3 text-sm font-medium text-on-surface">
                        {thesisTitle}
                    </p>
                )}
                {error && (
                    <Alert variant="error" title="Delete failed" message={error} />
                )}
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
                    variant="danger"
                    onClick={onConfirm}
                    disabled={submitting}
                    className="inline-flex w-full items-center justify-center gap-2 shadow-sm sm:w-auto"
                >
                    {submitting ? "Deleting..." : "Delete thesis"}
                </Button>
            </div>
        </Modal>
    );
}
