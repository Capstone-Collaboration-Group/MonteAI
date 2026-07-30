import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface DropdownItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode;
  variant?: "default" | "danger" | "primary";
}

const variants = {
  default: "text-on-surface hover:bg-surface-container-high dark:hover:bg-surface-container-high/60",
  danger: "text-[#FF0000] dark:text-[#FF6B6B] hover:bg-[#FF0000]/10 dark:hover:bg-[#FF0000]/20",
  primary: "text-[#0D7856] dark:text-[#5CC29A] hover:bg-[#0D7856]/10 dark:hover:bg-[#0D7856]/20 font-medium",
};

export function DropdownItem({ children, icon, variant = "default", className = "", disabled = false, ...props }: DropdownItemProps) {
  return (
    <button type="button" disabled={disabled} className={`w-full px-4 py-2 text-sm text-left flex items-center gap-2.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${variants[variant]} ${className}`} {...props}>
      {icon && <span className="shrink-0 text-base">{icon}</span>}
      <span className="truncate">{children}</span>
    </button>
  );
}

export function DropdownHeader({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`px-4 py-1.5 text-xs font-semibold text-on-surface-variant uppercase tracking-wider ${className}`}>{children}</div>;
}

export function DropdownDivider() {
  return <div className="my-1 border-t border-outline/10" />;
}
