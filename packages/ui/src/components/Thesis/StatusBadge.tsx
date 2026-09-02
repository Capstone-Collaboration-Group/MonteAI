import type { ThesisStatus } from "@monteai/types";

interface StatusBadgeProps {
  status: ThesisStatus;
  className?: string;
}

const STATUS_CONFIG: Record<ThesisStatus, {
  bg: string;
  text: string;
  label: string;
}> = {
  approved: {
    bg: "bg-status-approved/15",
    text: "text-status-approved",
    label: "Approved",
  },
  pending: {
    bg: "bg-yellow-100",
    text: "text-yellow-700",
    label: "Pending",
  },
  rejected: {
    bg: "bg-error/10",
    text: "text-error",
    label: "Rejected",
  },
  revision: {
    bg: "bg-status-defense/10",
    text: "text-status-defense",
    label: "For Revision",
  },
  indexed:  { 
    bg: "bg-blue-100",
    text: "text-blue-700",
    label: "Indexed",
  }
};

const FALLBACK_CONFIG = STATUS_CONFIG["pending"];

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status] ?? FALLBACK_CONFIG;

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${cfg.bg} ${cfg.text} ${className}`}
    >
      {cfg.label}
    </span>
  );
}