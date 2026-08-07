import type { HTMLAttributes, ReactNode } from "react";

export interface DataTableColumn<Row> {
  key: string;
  label: string;
  render?: (row: Row) => ReactNode;
  sortable?: boolean;
}

interface DataTableProps<Row> extends HTMLAttributes<HTMLDivElement> {
  columns: DataTableColumn<Row>[];
  data: Row[];
  /** Derive a stable React key from each row. Falls back to row index if omitted. */
  rowKey?: (row: Row) => string | number;
  sortKey?: string;
  sortDir?: "asc" | "desc";
  onSort?: (key: string) => void;
  /**
   * When true, removes the outer border/rounded wrapper so the table
   * can sit flush inside a parent Card without double borders.
   */
  unstyled?: boolean;
}

export function DataTable<Row extends Record<string, unknown>>({
  columns,
  data,
  rowKey,
  sortKey,
  sortDir,
  onSort,
  unstyled = false,
  className = "",
  ...props
}: DataTableProps<Row>) {
  const table = (
    <table className="min-w-full text-left text-sm divide-y divide-outline/30">
      <thead className="bg-surface-container-low">
        <tr className="text-[11px] font-semibold uppercase tracking-wide text-outline">
          {columns.map((col) => (
            <th key={col.key} className="px-6 py-4 font-semibold">
              <button
                type="button"
                onClick={() => col.sortable && onSort?.(col.key)}
                className="inline-flex items-center gap-2 text-left"
                disabled={!col.sortable}
              >
                {col.label}
                {col.sortable && sortKey === col.key && (
                  <span>{sortDir === "asc" ? "↑" : "↓"}</span>
                )}
              </button>
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-outline/20 bg-surface">
        {data.map((row, index) => (
          <tr
            key={rowKey ? rowKey(row) : index}
            className="border-t border-outline-variant/40 bg-surface/70 hover:bg-surface-container-high transition-colors cursor-pointer"
          >
            {columns.map((col) => (
              <td key={col.key} className="px-6 py-4 align-middle text-on-surface-variant">
                {col.render ? col.render(row) : String(row[col.key] ?? "")}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );

  if (unstyled) {
    return (
      <div className={`overflow-x-auto ${className}`} {...props}>
        {table}
      </div>
    );
  }

  return (
    <div
      className={`overflow-hidden rounded-3xl border border-outline/30 bg-surface ${className}`}
      {...props}
    >
      <div className="overflow-x-auto">{table}</div>
    </div>
  );
}