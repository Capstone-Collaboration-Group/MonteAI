import type { ReactNode } from "react";

export interface ModalHeaderProps { children: ReactNode; onClose?: () => void; className?: string; }
export interface ModalBodyProps { children: ReactNode; className?: string; }
export interface ModalFooterProps { children: ReactNode; className?: string; }

export function ModalHeader({ children, onClose, className = "" }: ModalHeaderProps) {
  return (
    <div className={`px-6 py-4 border-b border-outline/10 flex items-center justify-between ${className}`}>
      <div className="text-lg font-semibold text-on-surface">{children}</div>
      {onClose && (
        <button onClick={onClose} type="button" aria-label="Close" className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      )}
    </div>
  );
}

export function ModalBody({ children, className = "" }: ModalBodyProps) {
  return <div className={`p-6 overflow-y-auto max-h-[70vh] flex-1 ${className}`}>{children}</div>;
}

export function ModalFooter({ children, className = "" }: ModalFooterProps) {
  return <div className={`px-6 py-4 border-t border-outline/10 bg-surface-container-low/50 flex items-center justify-end gap-3 ${className}`}>{children}</div>;
}
