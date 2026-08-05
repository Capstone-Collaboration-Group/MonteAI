import type { HTMLAttributes } from "react";

type ThesisLifecycleStatus =
  "Pending" | "UnderReview" | "Approved" | "Indexed" | "Rejected";

const statusStyles: Record<
  ThesisLifecycleStatus,
  { bg: string; text: string; label: string }
> = {
  Pending: { bg: "bg-yellow-100", text: "text-yellow-800", label: "Pending" },
  UnderReview: {
    bg: "bg-sky-100",
    text: "text-sky-800",
    label: "Under Review",
  },
  Approved: {
    bg: "bg-emerald-100",
    text: "text-emerald-800",
    label: "Approved",
  },
  Indexed: { bg: "bg-blue-100", text: "text-blue-800", label: "Indexed" },
  Rejected: { bg: "bg-red-100", text: "text-red-800", label: "Rejected" },
};

interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  status: ThesisLifecycleStatus;
}

export function StatusBadge({
  status,
  className = "",
  ...props
}: StatusBadgeProps) {
  const config = statusStyles[status];

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${config.bg} ${config.text} ${className}`}
      {...props}
    >
      {config.label}
    </span>
  );
}
