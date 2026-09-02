import type { HTMLAttributes } from "react";

interface PaginationProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  currentPage: number;
  totalPages: number;
  onChange: (page: number) => void;
}

export function Pagination({
  currentPage,
  totalPages,
  onChange,
  className = "",
  ...props
}: PaginationProps) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-2 rounded-2xl bg-surface py-3 px-2 shadow-sm ${className}`}
      {...props}
    >
      <button
        type="button"
        disabled={currentPage <= 1}
        onClick={() => onChange(currentPage - 1)}
        className="rounded-lg border border-outline/20 px-3 py-2 text-sm text-slate-600 disabled:opacity-50"
      >
        Prev
      </button>
      {pages.map((page) => (
        <button
          key={page}
          type="button"
          onClick={() => onChange(page)}
          className={`rounded-lg px-3 py-2 text-sm ${page === currentPage ? "bg-slate-900 text-white" : "bg-surface-container-high text-slate-700 hover:bg-surface-container-high/80"}`}
        >
          {page}
        </button>
      ))}
      <button
        type="button"
        disabled={currentPage >= totalPages}
        onClick={() => onChange(currentPage + 1)}
        className="rounded-lg border border-outline/20 px-3 py-2 text-sm text-slate-600 disabled:opacity-50"
      >
        Next
      </button>
    </div>
  );
}
