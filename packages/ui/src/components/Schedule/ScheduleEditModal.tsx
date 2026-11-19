import { useMemo, useState } from "react";
import { Modal, ModalHeader } from "../common/Modal";
import { Button } from "../Button";
import type {
  ScheduleResponseDto,
  UpdateScheduleDto,
  PanelistCandidate,
  PanelistType,
  PanelRole,
} from "@monteai/types";
import {
  assignPanelRole,
  defaultPanelRole,
  getPanelistDisplayName,
} from "@monteai/types";
import { PanelistRoleRow } from "./PanelistRoleRow";

interface ScheduleEditModalProps {
  schedule: ScheduleResponseDto | null;
  isOpen: boolean;
  onClose: () => void;
  /** Rooms derived from the server schedule data. */
  rooms: string[];
  /** Candidate pool for adding/removing panelists. */
  panelistPool?: PanelistCandidate[];
  onConfirm: (dto: UpdateScheduleDto) => void;
}

/** Internal panelist row that always has a display label, even when the pool
 *  hasn't loaded yet or the entry isn't resolvable from the current pool. */
interface SelectedPanelist {
  id: string;
  label: string;
  type: string;
  /** Defense-panel role recorded for the proceedings. */
  panelRole: PanelRole;
}

/** Maps a stored role (incl. the old "Chairman"/"Member" fallback) onto a PanelRole. */
function fromStoredRole(role: string | null | undefined): PanelRole | null {
  const value = (role ?? "").trim().toLowerCase();
  if (value.includes("advis")) return "Capstone Adviser";
  if (value.includes("chair")) return "Panel Chairperson";
  if (value.includes("member")) return "Panel Member";
  return null;
}

function typeColor(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("admin")) return "#dc2626";
  if (t.includes("program")) return "#9333ea";
  return "#2563eb";
}

function hasValidRange(start: string, end: string): boolean {
  if (!start || !end) return false;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm) > 0;
}

function SectionLabel({ number, label }: { number: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
        {number}
      </span>
      <p className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
        {label}
      </p>
    </div>
  );
}

export function ScheduleEditModal({
  schedule,
  isOpen,
  onClose,
  rooms,
  panelistPool = [],
  onConfirm,
}: ScheduleEditModalProps) {
  const [defenseDate, setDefenseDate] = useState(schedule?.date ?? "");
  const [startTime, setStartTime] = useState(schedule?.startTime ?? "");
  const [endTime, setEndTime] = useState(schedule?.endingTime ?? "");
  const [venue, setVenue] = useState(schedule?.roomVenue ?? "");
  const [selected, setSelected] = useState<SelectedPanelist[]>(() => {
    if (!schedule) return [];
    const byId = new Map(panelistPool.map((p) => [p.id, p]));
    const stored = schedule.panelists.map((p) => fromStoredRole(p.role));
    // Legacy rows carry no role: fill the missing chair from the first row
    // that doesn't already sit as Capstone Adviser / Panel Member.
    let hasChair = stored.some((r) => r === "Panel Chairperson");
    return schedule.panelists.map((p, i) => {
      const candidate = byId.get(p.panelistId);
      let panelRole = stored[i];
      if (!panelRole && !hasChair) {
        hasChair = true;
        panelRole = "Panel Chairperson";
      }
      return {
        id: p.panelistId,
        label: candidate
          ? getPanelistDisplayName(candidate)
          : (p.panelistName || p.panelistId),
        type: candidate ? candidate.panelistType : p.panelistType,
        panelRole: panelRole ?? "Panel Member",
      };
    });
  });
  const [search, setSearch] = useState("");

  const roomOptions = useMemo(() => {
    const set = new Set<string>([...(rooms ?? [])]);
    if (schedule?.roomVenue) set.add(schedule.roomVenue);
    return Array.from(set).sort();
  }, [rooms, schedule]);

  const validRange = hasValidRange(startTime, endTime);
  const hasChair = selected.some((p) => p.panelRole === "Panel Chairperson");
  const canSave =
    !!defenseDate &&
    !!startTime &&
    !!endTime &&
    validRange &&
    !!venue &&
    selected.length >= 3 &&
    hasChair;

  const suggestions = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return panelistPool
      .filter(
        (p) =>
          !selected.some((x) => x.id === p.id) &&
          getPanelistDisplayName(p).toLowerCase().includes(q),
      )
      .map(
        (p): Omit<SelectedPanelist, "panelRole"> => ({
          id: p.id,
          label: getPanelistDisplayName(p),
          type: p.panelistType,
        }),
      );
  }, [search, selected, panelistPool]);

  function addPanelist(p: Omit<SelectedPanelist, "panelRole">) {
    // First pick becomes the Panel Chairperson; the rest Panel Members.
    setSelected((prev) => [...prev, { ...p, panelRole: defaultPanelRole(prev) }]);
    setSearch("");
  }

  // Chairperson and Adviser are exclusive — assignPanelRole clears the role
  // from whoever held it so the panel can never end up with two chairs.
  function handleRoleChange(id: string, role: PanelRole) {
    setSelected((prev) => assignPanelRole(prev, id, role));
  }

  function handleConfirm() {
    if (!schedule) return;

    const toServerPanelistType = (t: string): PanelistType => {
      const v = t.toLowerCase();
      if (v.includes("admin")) return "Admin";
      if (v.includes("program")) return "ProgramHead";
      return "Faculty";
    };

    const dto: UpdateScheduleDto = {
      date: defenseDate,
      startTime,
      endingTime: endTime,
      roomVenue: venue,
      panelists: selected.map((sel) => ({
        scheduleId: schedule.scheduleId,
        panelistId: sel.id,
        panelistType: toServerPanelistType(sel.type),
        // The proceedings read this back for Section II's Designation/Role.
        role: sel.panelRole,
      })),
    };
    onConfirm(dto);
  }

  const groupName = schedule?.researchGroup?.groupName ?? "Defense Schedule";

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" className="!max-w-4xl">
      <ModalHeader onClose={onClose}>
        <div className="min-w-0">
          <p className="text-base font-semibold leading-tight text-on-surface">
            Edit Defense Schedule
          </p>
          <p className="truncate text-xs font-normal text-on-surface-variant">
            {groupName}
          </p>
        </div>
      </ModalHeader>

      <div className="flex max-h-[70vh] min-h-0 flex-col overflow-y-auto p-4 sm:p-6">
        <div className="flex flex-col gap-7">
          {/* 1. Date & Time */}
          <section>
            <SectionLabel number={1} label="Date & Time" />
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:gap-4">
              <div className="min-w-0 flex-1">
                <label className="mb-1.5 block text-xs font-medium text-on-surface-variant">
                  Defense Date
                </label>
                <input
                  type="date"
                  value={defenseDate}
                  onChange={(e) => setDefenseDate(e.target.value)}
                  className="w-full rounded-lg border border-outline/30 bg-surface px-3 py-2.5 text-sm text-on-surface shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="min-w-0 flex-1">
                <label className="mb-1.5 block text-xs font-medium text-on-surface-variant">
                  Time Range
                </label>
                <div className="flex items-center gap-2 rounded-lg border border-outline/30 bg-surface px-3 py-2 shadow-sm focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[9px] font-semibold uppercase tracking-widest text-on-surface-variant">
                      Start
                    </span>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full bg-transparent text-sm text-on-surface focus:outline-none"
                    />
                  </div>
                  <svg className="h-4 w-4 shrink-0 text-on-surface-variant" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[9px] font-semibold uppercase tracking-widest text-on-surface-variant">
                      End
                    </span>
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full bg-transparent text-sm text-on-surface focus:outline-none"
                    />
                  </div>
                </div>
                {startTime && endTime && !validRange && (
                  <p className="mt-1.5 text-xs text-error">
                    End time must be after the start time.
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* 2. Room Venue */}
          <section>
            <SectionLabel number={2} label="Room Venue" />
            <div className="mt-4">
              <select
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                className="w-full appearance-none rounded-lg border border-outline/30 bg-surface px-3 py-2.5 pr-9 text-sm text-on-surface shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="" disabled>Select a venue…</option>
                {roomOptions.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          </section>

          {/* 3. Panelists */}
          <section>
            <div className="flex flex-wrap items-center justify-between gap-y-1">
              <SectionLabel number={3} label="Panelists" />
              <span className="text-xs text-on-surface-variant">
                Min 3 required
              </span>
            </div>

            <div className="relative mt-4">
              <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75M9 11a4 4 0 100-8 4 4 0 000 8z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search panelists to add…"
                className="w-full rounded-lg border border-outline/30 bg-surface py-2.5 pl-9 pr-3 text-sm text-on-surface shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              {suggestions.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-outline/20 bg-surface shadow-lg">
                  {suggestions.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => addPanelist(p)}
                        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-on-surface transition-colors hover:bg-surface-container"
                      >
                        <span
                          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                          style={{ backgroundColor: typeColor(p.type) }}
                        >
                          {p.label.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="flex-1 truncate">{p.label}</span>
                        <span className="shrink-0 rounded-full bg-surface-container px-2 py-0.5 text-[10px] font-medium capitalize text-on-surface-variant">
                          {p.type.replace("-", " ")}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {selected.length > 0 && (
              <ul className="mt-3 flex flex-col gap-2">
                {selected.map((p) => (
                  <PanelistRoleRow
                    key={p.id}
                    label={p.label}
                    type={p.type}
                    panelRole={p.panelRole}
                    onRoleChange={(role) => handleRoleChange(p.id, role)}
                    onRemove={() =>
                      setSelected((prev) => prev.filter((x) => x.id !== p.id))
                    }
                  />
                ))}
              </ul>
            )}
            {selected.length > 0 && !hasChair && (
              <p className="mt-2 text-xs text-error">
                Assign exactly one panelist as Panel Chairperson before saving.
              </p>
            )}
          </section>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-outline/10 bg-surface-container-low/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-end sm:gap-3 sm:px-6 sm:py-4">
        <Button
          variant="ghost"
          onClick={onClose}
          className="w-full border border-outline/30 shadow-sm sm:w-auto"
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleConfirm}
          disabled={!canSave}
          className="inline-flex w-full items-center justify-center gap-2 shadow-sm sm:w-auto"
        >
          Save Changes
        </Button>
      </div>
    </Modal>
  );
}
