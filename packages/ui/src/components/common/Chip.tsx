import type { HTMLAttributes, ReactNode } from "react";

export interface ChipProps extends HTMLAttributes<HTMLDivElement> {
  label: ReactNode;
  icon?: ReactNode;
  onClose?: () => void;
  selected?: boolean;
  disabled?: boolean;
  variant?: "primary" | "defense" | "pending" | "critical" | "default";
}

const variants = {
  default: "bg-surface-container-high text-on-surface hover:bg-surface-container-high/80",
  primary: "bg-[#0D7856]/15 text-[#0D7856] dark:bg-[#0D7856]/25 dark:text-[#5CC29A]",
  defense: "bg-[#008000]/15 text-[#008000] dark:bg-[#008000]/25 dark:text-[#4CAF50]",
  pending: "bg-[#FFFF00]/30 text-amber-950 dark:bg-[#FFFF00]/20 dark:text-yellow-300 font-semibold",
  critical: "bg-[#FF0000]/15 text-[#FF0000] dark:bg-[#FF0000]/25 dark:text-[#FF6B6B]",
};

export function Chip({ label, icon, onClose, selected = false, disabled = false, variant = "default", className = "", onClick, ...props }: ChipProps) {
  const activeClass = selected ? "bg-[#0D7856] text-white" : variants[variant];
  return (
    <div
      onClick={disabled ? undefined : onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full transition-all border border-transparent select-none ${activeClass} ${disabled ? "opacity-40 cursor-not-allowed" : onClick ? "cursor-pointer" : ""} ${className}`}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="truncate">{label}</span>
      {onClose && !disabled && (
        <button type="button" onClick={(e) => (e.stopPropagation(), onClose())} className="p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/15 transition-colors cursor-pointer shrink-0" aria-label="Remove">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      )}
    </div>
  );
}
