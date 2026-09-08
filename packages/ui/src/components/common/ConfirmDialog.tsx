import type { ReactNode } from "react";

type ConfirmVariant = "danger" | "success" | "warning";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}

const variantStyles: Record<ConfirmVariant, string> = {
  danger: "bg-error text-on-error hover:bg-error/90",
  success: "bg-status-approved text-white hover:bg-status-approved/90",
  warning: "bg-status-pending text-on-surface hover:bg-status-pending/90",
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-surface px-6 py-5 shadow-2xl border border-outline/20">
        <h2 className="text-lg font-semibold text-on-surface">{title}</h2>
        {description && (
          <p className="mt-2 text-sm text-on-surface-variant">{description}</p>
        )}
        {children && <div className="mt-4">{children}</div>}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-outline/50 bg-surface px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container-high"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${variantStyles[variant]}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
