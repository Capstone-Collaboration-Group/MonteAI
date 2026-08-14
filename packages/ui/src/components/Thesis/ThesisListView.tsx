// packages/ui/src/components/Thesis/ThesisListView.tsx
import { useState } from "react";
import { LayoutGrid, List, MoreHorizontal } from "lucide-react";
import type { ThesisSummary, ThesisStatus } from "@monteai/types";
import { StatusBadge } from "./StatusBadge";
import { Dropdown } from "../common/Dropdown";
import { Button } from "../Button"; // <-- Imported your reusable Button

export type ThesisActionType = "approve" | "reject" | "revision";

interface ThesisAction {
  label: string;
  action: ThesisActionType;
  className: string;
}

const ACTIONS_BY_STATUS: Record<ThesisStatus, ThesisAction[]> = {
  pending: [
    { label: "Approve",          action: "approve",  className: "text-status-approved hover:bg-status-approved/10" },
    { label: "Request Revision", action: "revision", className: "text-amber-600 hover:bg-amber-600/10" },
    { label: "Reject",           action: "reject",   className: "text-error hover:bg-error/10" },
  ],
  revision: [
    { label: "Approve", action: "approve", className: "text-status-approved hover:bg-status-approved/10" },
    { label: "Reject",  action: "reject",  className: "text-error hover:bg-error/10" },
  ],
  approved: [
    { label: "Request Revision", action: "revision", className: "text-amber-600 hover:bg-amber-600/10" },
    { label: "Reject",           action: "reject",   className: "text-error hover:bg-error/10" },
  ],
  rejected: [
    { label: "Approve",          action: "approve",  className: "text-status-approved hover:bg-status-approved/10" },
    { label: "Request Revision", action: "revision", className: "text-amber-600 hover:bg-amber-600/10" },
  ],
  indexed: [
    { label: "Reject",           action: "reject",   className: "text-error hover:bg-error/10" },
    { label: "Request Revision", action: "revision", className: "text-amber-600 hover:bg-amber-600/10" },
  ],
};

interface ThesisListViewProps {
  theses: ThesisSummary[];
  onSelect?: (thesisId: string) => void;
  onAction?: (thesisId: string, action: ThesisActionType) => void;
  defaultView?: "list" | "grid";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function ActionMenu({
  thesis,
  onAction,
}: {
  thesis: ThesisSummary;
  onAction?: (thesisId: string, action: ThesisActionType) => void;
}) {
  const actions = ACTIONS_BY_STATUS[thesis.status.toLowerCase() as ThesisStatus] ?? [];
  
  if (actions.length === 0) return null;

  return (
    <Dropdown
      placement="bottom-right"
      trigger={
        // Replaced raw button with reusable Button (ghost variant)
        <Button
          variant="ghost"
          aria-label={`Actions for ${thesis.title}`}
          className="!p-1.5 text-on-surface-variant hover:bg-surface-container hover:text-primary"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      }
    >
      {actions.map(({ label, action, className }) => (
        <button
          key={action}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onAction?.(thesis.id, action);
          }}
          className={`w-full px-4 py-2 text-left text-sm font-medium transition-colors ${className}`}
        >
          {label}
        </button>
      ))}
    </Dropdown>
  );
}

export function ThesisListView({
  theses,
  onSelect,
  onAction,
  defaultView = "list",
}: ThesisListViewProps) {
  const [view, setView] = useState<"list" | "grid">(defaultView);

  return (
    <div className="rounded-2xl border border-outline-variant bg-surface">
      <div className="flex items-center justify-between border-b border-outline-variant px-6 py-5">
        <h3 className="font-serif text-lg font-semibold text-on-surface">
          Manuscript Registry
        </h3>
        
        <div className="flex items-center gap-1 rounded-lg bg-surface-container p-1">
          <Button
            variant="ghost"
            aria-label="Grid view"
            aria-pressed={view === "grid"}
            onClick={() => setView("grid")}
            className={`!rounded-md !p-1.5 ${
              view === "grid" 
                ? "bg-surface text-primary shadow-sm hover:bg-surface hover:text-primary" 
                : "text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            aria-label="List view"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
            className={`!rounded-md !p-1.5 ${
              view === "list" 
                ? "bg-surface text-primary shadow-sm hover:bg-surface hover:text-primary" 
                : "text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {view === "list" ? (
        <table className="w-full text-left">
          <thead>
            <tr className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              <th className="px-6 py-3 font-medium">Title</th>
              <th className="px-6 py-3 font-medium">Authors</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Date</th>
              <th className="px-6 py-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {theses.map((thesis) => (
              <tr
                key={thesis.id}
                className="cursor-pointer border-t border-outline-variant transition-colors hover:bg-surface-container-low"
                onClick={() => onSelect?.(thesis.id)}
              >
                <td className="px-6 py-4">
                  <p className="font-medium text-on-surface">{thesis.title}</p>
                  <p className="text-xs text-on-surface-variant">{thesis.institute}</p>
                </td>
                <td className="px-6 py-4 text-sm text-on-surface-variant">
                  {(thesis.authors ?? []).join(", ")}
                </td>
                <td className="px-6 py-4">
                  <StatusBadge status={thesis.status} />
                </td>
                <td className="px-6 py-4 text-sm text-on-surface-variant">
                  {formatDate(thesis.submittedDate)}
                </td>
                <td className="px-6 py-4 text-right">
                  <ActionMenu thesis={thesis} onAction={onAction} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
          {theses.map((thesis) => (
            <button
              key={thesis.id}
              type="button"
              onClick={() => onSelect?.(thesis.id)}
              className="flex flex-col gap-3 rounded-xl border border-outline-variant p-4 text-left transition-colors hover:border-primary hover:bg-surface-container-low/50"
            >
              <StatusBadge status={thesis.status} className="w-fit" />
              <p className="font-medium leading-snug text-on-surface">{thesis.title}</p>
              <p className="text-xs text-on-surface-variant">{thesis.institute}</p>
              <p className="mt-auto text-xs text-on-surface-variant">
                {formatDate(thesis.submittedDate)}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}