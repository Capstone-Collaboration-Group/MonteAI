import type { HTMLAttributes } from "react";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?:
    "primary" | "defense" | "pending" | "critical" | "surface" | "outline";
  size?: "sm" | "md" | "lg";
  shape?: "pill" | "rounded";
  dot?: boolean;
}

const variants = {
  primary:
    "bg-primary-container/15 text-primary-container dark:bg-primary-container/25 dark:text-status-approved border-transparent",
  defense:
    "bg-primary-container/15 text-status-defense dark:bg-primary-container/85 dark:text-on-primary border-transparent",
  pending:
    "bg-status-pending/30 text-amber-950 dark:bg-status-pending/20 dark:text-yellow-300 border-transparent font-semibold",
  critical:
    "bg-status-critical/15 text-status-critical dark:bg-status-critical/25 dark:text-status-critical border-transparent",
  surface: "bg-surface-container-high text-on-surface border-transparent",
  outline: "bg-transparent border-outline/30 text-on-surface",
};

const dots = {
  primary: "bg-primary-container",
  defense: "bg-on-primary",
  pending: "bg-status-pending",
  critical: "bg-status-critical",
  surface: "bg-on-surface-variant",
  outline: "bg-on-surface-variant",
};
const sizes = {
  sm: "px-2 py-0.5 text-xs gap-1.5",
  md: "px-2.5 py-1 text-xs gap-1.5",
  lg: "px-3 py-1.5 text-sm gap-2",
};

export function Badge({
  children,
  variant = "primary",
  size = "md",
  shape = "pill",
  dot = false,
  className = "",
  ...props
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center justify-center border font-medium transition-colors ${shape === "pill" ? "rounded-full" : "rounded-md"} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${dots[variant]}`}
        />
      )}
      {children}
    </span>
  );
}
