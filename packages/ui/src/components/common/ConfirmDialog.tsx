import type { ReactNode } from "react";

type ConfirmVariant = "danger" | "success" | "warning";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  /** Disables both actions while an async request is in flight. */
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}

// Colours come straight from the design tokens in globals.css:
//   success → --secondary / --on-secondary (the native green)
//   danger  → --error / --on-error         (the native red)
//   warning → --status-pending             (amber)
const variantStyles: Record<ConfirmVariant, string> = {
  success: "bg-secondary text-on-secondary hover:bg-secondary/90",
  danger: "bg-error text-on-error hover:bg-error/90",
  warning: "bg-status-pending text-on-surface hover:bg-status-pending/90",
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  loading = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-surface px-6 py-5 shadow-2xl border border-outline/20"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-on-surface">{title}</h2>
        {description && (
          <p className="mt-2 text-sm text-on-surface-variant">{description}</p>
        )}
        {children && <div className="mt-4">{children}</div>}
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-outline/50 bg-surface px-4 py-2 text-sm text-on-surface-variant transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variantStyles[variant]}`}
          >
            {loading ? "Please wait..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
