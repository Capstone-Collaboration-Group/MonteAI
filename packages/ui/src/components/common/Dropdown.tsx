import { useState, useRef, useEffect, type ReactNode } from "react";

export interface DropdownProps {
  trigger: ReactNode;
  children: ReactNode;
  placement?: "bottom-left" | "bottom-right" | "top-left" | "top-right";
  className?: string;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const placements = {
  "bottom-left": "top-full left-0 mt-1 origin-top-left",
  "bottom-right": "top-full right-0 mt-1 origin-top-right",
  "top-left": "bottom-full left-0 mb-1 origin-bottom-left",
  "top-right": "bottom-full right-0 mb-1 origin-bottom-right",
};

export function Dropdown({ trigger, children, placement = "bottom-left", className = "", isOpen: ctrlOpen, onOpenChange }: DropdownProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const open = ctrlOpen ?? internalOpen;

  const toggle = () => {
    onOpenChange?.(!open);
    if (ctrlOpen === undefined) setInternalOpen(!open);
  };

  useEffect(() => {
    const clickOutside = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && (onOpenChange?.(false), ctrlOpen === undefined && setInternalOpen(false));
    if (open) document.addEventListener("mousedown", clickOutside);
    return () => document.removeEventListener("mousedown", clickOutside);
  }, [open, ctrlOpen, onOpenChange]);

  return (
    <div className="relative inline-block text-left" ref={ref}>
      <div onClick={toggle} className="inline-flex cursor-pointer">{trigger}</div>
      {open && <div className={`absolute z-40 min-w-48 py-1 bg-surface dark:bg-surface-container-low text-on-surface rounded-xl shadow-xl border border-outline/20 backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 ${placements[placement]} ${className}`}>{children}</div>}
    </div>
  );
}
