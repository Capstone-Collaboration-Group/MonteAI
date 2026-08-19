import type { HTMLAttributes } from "react";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "primary" | "defense" | "pending" | "critical" | "surface" | "outline";
  size?: "sm" | "md" | "lg";
  shape?: "pill" | "rounded";
  dot?: boolean;
}

  const variants = {
    primary: "bg-[#0D7856]/15 text-[#0D7856] dark:bg-[#0D7856]/25 dark:text-[#5CC29A] border-transparent",
    defense: "bg-primary-container/15 text-[#008000] dark:bg-primary-container/85 dark:text-on-primary border-transparent",
    pending: "bg-[#FFFF00]/30 text-amber-950 dark:bg-[#FFFF00]/20 dark:text-yellow-300 border-transparent font-semibold",
    critical: "bg-[#FF0000]/15 text-[#FF0000] dark:bg-[#FF0000]/25 dark:text-[#FF6B6B] border-transparent",
    surface: "bg-surface-container-high text-on-surface border-transparent",
    outline: "bg-transparent border-outline/30 text-on-surface",
  };

const dots = { primary: "bg-[#0D7856]", defense: "bg-on-primary", pending: "bg-[#FFFF00]", critical: "bg-[#FF0000]", surface: "bg-on-surface-variant", outline: "bg-on-surface-variant" };
const sizes = { sm: "px-2 py-0.5 text-xs gap-1.5", md: "px-2.5 py-1 text-xs gap-1.5", lg: "px-3 py-1.5 text-sm gap-2" };

export function Badge({ children, variant = "primary", size = "md", shape = "pill", dot = false, className = "", ...props }: BadgeProps) {
  return (
    <span className={`inline-flex items-center justify-center border font-medium transition-colors ${shape === "pill" ? "rounded-full" : "rounded-md"} ${variants[variant]} ${sizes[size]} ${className}`} {...props}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dots[variant]}`} />}
      {children}
    </span>
  );
}
