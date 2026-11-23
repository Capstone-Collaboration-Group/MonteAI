import type { PanelRole } from "@monteai/types";
import { PANEL_ROLES } from "@monteai/types";

function typeColor(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("admin")) return "#dc2626";
  if (t.includes("program")) return "#9333ea";
  return "#2563eb";
}

/**
 * One assigned panelist: avatar, name, the defense-panel role recorded for
 * the proceedings, and the remove button. Shared by the schedule create and
 * edit modals so both record roles the same way.
 */
export function PanelistRoleRow({
  label,
  initials,
  type,
  panelRole,
  onRoleChange,
  onRemove,
}: {
  label: string;
  /** Defaults to the label's first two characters when omitted. */
  initials?: string;
  /** Institutional type (faculty / program-head / admin) — avatar colour only. */
  type: string;
  panelRole: PanelRole;
  onRoleChange: (role: PanelRole) => void;
  onRemove: () => void;
}) {
  return (
    <li className="flex items-center gap-2 rounded-lg border border-outline/20 bg-surface-container px-2.5 py-1.5">
      <span
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
        style={{ backgroundColor: typeColor(type) }}
      >
        {(initials ?? label.slice(0, 2)).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-on-surface">{label}</span>
      <label className="flex shrink-0 items-center gap-1.5">
        <span className="sr-only">Panel role for {label}</span>
        <select
          value={panelRole}
          onChange={(e) => onRoleChange(e.target.value as PanelRole)}
          className="rounded-md border border-outline/30 bg-surface px-2 py-1 text-xs text-on-surface shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          {PANEL_ROLES.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className="shrink-0 leading-none text-on-surface-variant transition-colors hover:text-error"
      >
        ×
      </button>
    </li>
  );
}
