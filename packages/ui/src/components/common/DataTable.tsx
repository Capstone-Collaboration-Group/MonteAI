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
  sortKey?: string;
  sortDir?: "asc" | "desc";
  onSort?: (key: string) => void;
}

export function DataTable<Row extends Record<string, unknown>>({
  columns,
  data,
  sortKey,
  sortDir,
  onSort,
  className = "",
  ...props
}: DataTableProps<Row>) {
  return (
    <div
      className={`overflow-hidden rounded-3xl border border-outline/30 bg-surface ${className}`}
      {...props}
    >
      <table className="min-w-full text-left text-sm divide-y divide-outline/30">
        <thead className="bg-surface-container-high">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className="px-4 py-3 font-semibold text-slate-600"
              >
                <button
                  type="button"
                  onClick={() => column.sortable && onSort?.(column.key)}
                  className="inline-flex items-center gap-2 text-left"
                >
                  {column.label}
                  {column.sortable && sortKey === column.key && (
                    <span>{sortDir === "asc" ? "↑" : "↓"}</span>
                  )}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-outline/20 bg-surface">
          {data.map((row, index) => (
            <tr key={index} className="hover:bg-surface-container-high/60">
              {columns.map((column) => (
                <td
                  key={column.key}
                  className="px-4 py-3 align-top text-slate-700"
                >
                  {column.render
                    ? column.render(row)
                    : String(row[column.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
