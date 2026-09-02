import type { SVGAttributes } from "react";

export interface SpinnerProps extends SVGAttributes<SVGSVGElement> {
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "primary" | "secondary" | "warning" | "danger" | "current";
  label?: string;
}

const sizes = {
  sm: "w-4 h-4 stroke-[3]",
  md: "w-6 h-6 stroke-[3]",
  lg: "w-8 h-8 stroke-[2.5]",
  xl: "w-12 h-12 stroke-[2]",
};
const variants = {
  primary: "text-primary-container dark:text-status-approved",
  secondary: "text-status-defense dark:text-status-defense",
  warning: "text-status-pending",
  danger: "text-status-critical dark:text-status-critical",
  current: "text-current",
};

export function Spinner({
  size = "md",
  variant = "primary",
  label = "Loading...",
  className = "",
  ...props
}: SpinnerProps) {
  return (
    <div
      role="status"
      className="inline-flex items-center justify-center gap-2"
    >
      <svg
        className={`animate-spin ${sizes[size]} ${variants[variant]} ${className}`}
        fill="none"
        viewBox="0 0 24 24"
        {...props}
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      {label && <span className="sr-only">{label}</span>}
    </div>
  );
}
