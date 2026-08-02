// packages/ui/src/components/Thesis/ThesisListView.tsx
import { useState } from "react";
import { LayoutGrid, List, MoreHorizontal } from "lucide-react";
import type { ThesisSummary, ThesisStatus } from "@monteai/types";
import { StatusBadge } from "./StatusBadge";
import { Dropdown } from "../common/Dropdown";

export type ThesisActionType = "approve" | "reject" | "revision";

interface ThesisAction {
    label: string;
    action: ThesisActionType;
    className: string;
}

const ACTIONS_BY_STATUS: Record<ThesisStatus, ThesisAction[]> = {
    pending: [
        { label: "Approve",          action: "approve",  className: "text-green-700 hover:bg-green-50" },
        { label: "Request Revision", action: "revision", className: "text-yellow-700 hover:bg-yellow-50" },
        { label: "Reject",           action: "reject",   className: "text-red-700 hover:bg-red-50" },
    ],
    revision: [
        { label: "Approve", action: "approve", className: "text-green-700 hover:bg-green-50" },
        { label: "Reject",  action: "reject",  className: "text-red-700 hover:bg-red-50" },
    ],
    approved: [
        { label: "Request Revision", action: "revision", className: "text-yellow-700 hover:bg-yellow-50" },
        { label: "Reject",           action: "reject",   className: "text-red-700 hover:bg-red-50" },
    ],
    rejected: [
        { label: "Approve",          action: "approve",  className: "text-green-700 hover:bg-green-50" },
        { label: "Request Revision", action: "revision", className: "text-yellow-700 hover:bg-yellow-50" },
    ],
     indexed: [
        { label: "Reject",           action: "reject",   className: "text-red-700 hover:bg-red-50" },
        { label: "Request Revision", action: "revision", className: "text-yellow-700 hover:bg-yellow-50" },
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
                <button
                    type="button"
                    aria-label={`Actions for ${thesis.title}`}
                  
                    className="rounded-md p-1.5 text-[#8A9089] hover:bg-[#F3F1E9] hover:text-[#16342B]"
                >
                    <MoreHorizontal className="h-4 w-4" />
                </button>
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
        <div className="rounded-2xl border border-[#E4E0D4] bg-white">
            <div className="flex items-center justify-between border-b border-[#EDEAE0] px-6 py-5">
                <h3 className="font-serif text-lg font-semibold text-[#1F2A24]">
                    Manuscript Registry
                </h3>
                <div className="flex items-center gap-1 rounded-lg bg-[#F3F1E9] p-1">
                    <button
                        type="button"
                        aria-label="Grid view"
                        aria-pressed={view === "grid"}
                        onClick={() => setView("grid")}
                        className={`rounded-md p-1.5 transition-colors ${
                            view === "grid" ? "bg-white text-[#16342B] shadow-sm" : "text-[#8A9089]"
                        }`}
                    >
                        <LayoutGrid className="h-4 w-4" />
                    </button>
                    <button
                        type="button"
                        aria-label="List view"
                        aria-pressed={view === "list"}
                        onClick={() => setView("list")}
                        className={`rounded-md p-1.5 transition-colors ${
                            view === "list" ? "bg-white text-[#16342B] shadow-sm" : "text-[#8A9089]"
                        }`}
                    >
                        <List className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {view === "list" ? (
                <table className="w-full text-left">
                    <thead>
                        <tr className="text-xs font-semibold uppercase tracking-wide text-[#8A9089]">
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
                                className="cursor-pointer border-t border-[#EDEAE0] transition-colors hover:bg-[#FAF8F1]"
                                onClick={() => onSelect?.(thesis.id)}
                            >
                                <td className="px-6 py-4">
                                    <p className="font-medium text-[#16342B]">{thesis.title}</p>
                                    <p className="text-xs text-[#8A9089]">{thesis.institute}</p>
                                </td>
                                <td className="px-6 py-4 text-sm text-[#4A5750]">
                                    {(thesis.authors ?? []).join(", ")}
                                </td>
                                <td className="px-6 py-4">
                                    <StatusBadge status={thesis.status} />
                                </td>
                                <td className="px-6 py-4 text-sm text-[#4A5750]">
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
                            className="flex flex-col gap-3 rounded-xl border border-[#EDEAE0] p-4 text-left transition-colors hover:border-[#B8934C]"
                        >
                            <StatusBadge status={thesis.status} className="w-fit" />
                            <p className="font-medium leading-snug text-[#16342B]">{thesis.title}</p>
                            <p className="text-xs text-[#8A9089]">{thesis.institute}</p>
                            <p className="mt-auto text-xs text-[#8A9089]">
                                {formatDate(thesis.submittedDate)}
                            </p>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}