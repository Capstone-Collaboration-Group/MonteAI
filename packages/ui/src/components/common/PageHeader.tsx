// packages/ui/src/components/common/PageHeader.tsx
import type { ReactNode } from "react";

interface PageHeaderProps {
  eyebrow: string;          // small label above the title e.g. "Announcements management"
  title: string;            // main heading e.g. "Overview"
  actions?: ReactNode;      // right side — search, buttons, anything
  className?: string;
}

export function PageHeader({ eyebrow, title, actions, className = "" }: PageHeaderProps) {
  return (
    <header
      className={`flex flex-col gap-4 rounded-2xl border border-outline-variant/60 bg-surface p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      <div>
        <p className="text-sm font-sans text-primary">{eyebrow}</p>
        <h2 className="text-2xl font-semibold text-on-surface">{title}</h2>
      </div>

      {actions && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {actions}
        </div>
      )}
    </header>
  );
}