// packages/ui/src/components/Button.tsx
import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  // Added "ghost" to the available variants
  variant?: "primary" | "secondary" | "danger" | "ghost"; 
}

const variants = {
  primary: "bg-primary hover:bg-primary-container text-on-primary",
  secondary: "bg-secondary hover:bg-secondary-container text-on-secondary",
  danger: "bg-error hover:opacity-90 text-on-error",
  // Added ghost variant using your semantic theme colors
  ghost: "bg-transparent hover:bg-surface-container text-on-surface-variant hover:text-primary", 
};

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return (
    <button
      className={`px-4 py-2 rounded-md font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
      {...props}
    />
  );
}