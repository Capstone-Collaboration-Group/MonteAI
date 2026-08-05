import type { HTMLAttributes } from "react";

type ThesisLifecycleStatus =
  "Pending" | "UnderReview" | "Approved" | "Indexed" | "Rejected";

const pillStyles: Record<
  ThesisLifecycleStatus,
  { bg: string; text: string; label: string }
> = {
  Pending: { bg: "bg-yellow-200", text: "text-yellow-900", label: "Pending" },
  UnderReview: {
    bg: "bg-sky-200",
    text: "text-sky-900",
    label: "Under Review",
  },
  Approved: {
    bg: "bg-emerald-200",
    text: "text-emerald-900",
    label: "Approved",
  },
  Indexed: { bg: "bg-blue-200", text: "text-blue-900", label: "Indexed" },
  Rejected: { bg: "bg-red-200", text: "text-red-900", label: "Rejected" },
};

interface StatusPillProps extends HTMLAttributes<HTMLSpanElement> {
  status: ThesisLifecycleStatus;
}

export function StatusPill({
  status,
  className = "",
  ...props
}: StatusPillProps) {
  const config = pillStyles[status];

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium shadow-sm ${config.bg} ${config.text} ${className}`}
      {...props}
    >
      {config.label}
    </span>
  );
}
