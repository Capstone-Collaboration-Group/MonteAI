import { useEffect, type ReactNode } from "react";

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  position?: "left" | "right" | "top" | "bottom";
  size?: "sm" | "md" | "lg" | "xl" | "full";
  closeOnOverlayClick?: boolean;
  closeOnEsc?: boolean;
  className?: string;
}

const positions = {
  right: "top-0 right-0 h-full animate-in slide-in-from-right duration-300",
  left: "top-0 left-0 h-full animate-in slide-in-from-left duration-300",
  top: "top-0 left-0 w-full animate-in slide-in-from-top duration-300",
  bottom: "bottom-0 left-0 w-full animate-in slide-in-from-bottom duration-300",
};

const horizSizes = { sm: "max-w-xs w-full", md: "max-w-md w-full", lg: "max-w-lg w-full", xl: "max-w-2xl w-full", full: "w-screen" };
const vertSizes = { sm: "max-h-[30vh] h-full", md: "max-h-[50vh] h-full", lg: "max-h-[75vh] h-full", xl: "max-h-[90vh] h-full", full: "h-screen" };

export function Drawer({ isOpen, onClose, children, position = "right", size = "md", closeOnOverlayClick = true, closeOnEsc = true, className = "" }: DrawerProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => closeOnEsc && e.key === "Escape" && onClose();
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKey);
    };
  }, [isOpen, closeOnEsc, onClose]);

  if (!isOpen) return null;
  const isHoriz = position === "left" || position === "right";
  const sizeClass = isHoriz ? horizSizes[size] : vertSizes[size];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200" onClick={closeOnOverlayClick ? onClose : undefined} role="dialog" aria-modal="true">
      <div className={`fixed bg-surface dark:bg-surface-container-low text-on-surface shadow-2xl border-outline/20 flex flex-col overflow-hidden transition-all ${positions[position]} ${sizeClass} ${className}`} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export const Sheet = Drawer;
export type SheetProps = DrawerProps;
