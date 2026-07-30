import type { HTMLAttributes, CSSProperties } from "react";

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "text" | "circular" | "rectangular" | "card";
  width?: string | number;
  height?: string | number;
  animation?: "pulse" | "shimmer" | "none";
}

const variants = { text: "h-4 rounded-md w-full", circular: "rounded-full shrink-0", rectangular: "rounded-lg w-full", card: "rounded-xl w-full h-48" };
const animations = {
  pulse: "animate-pulse bg-surface-container-high dark:bg-surface-container-high/40",
  shimmer: "relative overflow-hidden bg-surface-container-high dark:bg-surface-container-high/40 before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-surface/50 before:to-transparent",
  none: "bg-surface-container-high dark:bg-surface-container-high/40",
};

export function Skeleton({ variant = "rectangular", width, height, animation = "pulse", className = "", style, ...props }: SkeletonProps) {
  const customStyle: CSSProperties = { ...(width !== undefined && { width }), ...(height !== undefined && { height }), ...style };
  return <div className={`${variants[variant]} ${animations[animation]} ${className}`} style={customStyle} aria-hidden="true" {...props} />;
}
