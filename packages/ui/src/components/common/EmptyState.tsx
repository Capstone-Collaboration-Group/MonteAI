import type { ReactNode } from "react";

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, secondaryAction, className = "" }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center p-8 rounded-2xl bg-surface-container-low/40 border border-dashed border-outline/30 ${className}`}>
      <div className="mb-4 p-4 rounded-full bg-surface-container-high/60 text-[#0D7856] dark:text-[#5CC29A]">
        {icon || <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>}
      </div>
      <h3 className="text-lg font-semibold text-on-surface mb-1">{title}</h3>
      {description && <p className="text-sm text-on-surface-variant max-w-sm mb-6 leading-relaxed">{description}</p>}
      {(action || secondaryAction) && <div className="flex items-center gap-3">{secondaryAction}{action}</div>}
    </div>
  );
}
