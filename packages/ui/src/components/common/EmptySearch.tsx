import type { ReactNode } from "react";

interface EmptySearchProps {
  title?: string;
  message?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptySearch({
  title = "No results found",
  message = "We couldn’t find any matching theses or users. Try a different search term.",
  icon,
  action,
}: EmptySearchProps) {
  return (
    <div className="rounded-3xl border border-dashed border-outline/40 bg-surface-container-low p-10 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-container-high text-slate-700">
        {icon || <span className="text-2xl">🔍</span>}
      </div>
      <h3 className="text-lg font-semibold text-on-surface">{title}</h3>
      <p className="mt-2 text-sm text-on-surface-variant">{message}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
