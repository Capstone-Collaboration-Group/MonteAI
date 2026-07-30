import type { ReactNode } from "react";

export interface DrawerHeaderProps { children: ReactNode; onClose?: () => void; className?: string; }
export interface DrawerBodyProps { children: ReactNode; className?: string; }
export interface DrawerFooterProps { children: ReactNode; className?: string; }

export function DrawerHeader({ children, onClose, className = "" }: DrawerHeaderProps) {
  return (
    <div className={`px-6 py-4 border-b border-outline/10 flex items-center justify-between ${className}`}>
      <div className="text-lg font-semibold text-on-surface">{children}</div>
      {onClose && (
        <button onClick={onClose} type="button" aria-label="Close" className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      )}
    </div>
  );
}

export function DrawerBody({ children, className = "" }: DrawerBodyProps) {
  return <div className={`p-6 overflow-y-auto flex-1 ${className}`}>{children}</div>;
}

export function DrawerFooter({ children, className = "" }: DrawerFooterProps) {
  return <div className={`px-6 py-4 border-t border-outline/10 bg-surface-container-low/50 flex items-center justify-end gap-3 ${className}`}>{children}</div>;
}

export const SheetHeader = DrawerHeader;
export const SheetBody = DrawerBody;
export const SheetFooter = DrawerFooter;
