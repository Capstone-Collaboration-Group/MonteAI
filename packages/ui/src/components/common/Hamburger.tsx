// packages/ui/src/components/common/HamburgerButton.tsx
import type { ButtonHTMLAttributes } from "react";

interface HamburgerButton extends ButtonHTMLAttributes<HTMLButtonElement> {
  isOpen: boolean;
  onToggle: () => void;
  size?: "sm" | "md" | "lg";
  label?: string;
}

const SIZE_CONFIG = {
  sm: { button: "h-6 w-6", bar: "h-px w-3.5", gap: "gap-[3px]" },
  md: { button: "h-8 w-8", bar: "h-px w-4.5", gap: "gap-[4px]" },
  lg: { button: "h-10 w-10", bar: "h-[1.5px] w-6", gap: "gap-[5px]" },
};

export function HamburgerButton({
  isOpen,
  onToggle,
  size = "md",
  label,
  className = "",
  ...props
}: HamburgerButton) {
  const { button, bar, gap } = SIZE_CONFIG[size];

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isOpen ? "Close panel" : "Open panel"}
      aria-expanded={isOpen}
      className={`group relative flex shrink-0 flex-col items-center justify-center rounded-md transition-colors hover:bg-surface-container-low ${button} ${className}`}
      {...props}
    >
      <div className={`flex flex-col items-center ${gap}`}>
        {/* Top bar */}
        <span
          className={`block rounded-full bg-on-surface-variant transition-all duration-300 group-hover:bg-primary ${bar} ${
            isOpen ? "translate-y-[7px] rotate-45" : ""
          }`}
        />
        {/* Middle bar */}
        <span
          className={`block rounded-full bg-on-surface-variant transition-all duration-300 group-hover:bg-primary ${bar} ${
            isOpen ? "opacity-0 scale-x-0" : ""
          }`}
        />
        {/* Bottom bar */}
        <span
          className={`block rounded-full bg-on-surface-variant transition-all duration-300 group-hover:bg-primary ${bar} ${
            isOpen ? "-translate-y-[7px] -rotate-45" : ""
          }`}
        />
      </div>

      {/* Optional label below */}
      {label && (
        <span className="mt-1 text-[10px] font-medium text-outline group-hover:text-primary">
          {label}
        </span>
      )}
    </button>
  );
}
