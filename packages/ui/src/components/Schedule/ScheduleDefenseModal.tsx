import { useState, useMemo } from "react";
import { Modal, ModalHeader } from "../common/Modal";
import { Button } from "../Button";
import { ConfirmDialog } from "../common/ConfirmDialog";
import type { CreateScheduleDto, PanelistCandidate, PanelistType } from "@monteai/types";
import { getPanelistDisplayName, getPanelistInitials } from "@monteai/types";

interface ScheduleDefenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  thesis: {
    id: string;
    groupId: string;
    title: string;
    author: string;
    institute: string;
    section: string;
  };
  scheduledBy: string;
  panelistPool?: PanelistCandidate[]
  onConfirm: (data: CreateScheduleDto) => void;
}

const VENUES = [
  "Computer Lab 01",
  "Computer Lab 02",
  "Computer Lab 03",
  "Computer Lab 04",
  "Audio-Visual Room",
];

// Color keyed by panelistType — replaces the old per-object color field
const PANELIST_TYPE_COLORS: Record<PanelistCandidate["panelistType"], string> = {
  faculty:          "#2563eb",
  "program-head":   "#9333ea",
  admin:            "#dc2626",
};

function calcDuration(start: string, end: string): string | null {
  if (!start || !end) return null;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = eh * 60 + em - (sh * 60 + sm);
  if (mins <= 0) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m}m`;
}

// ── PanelistChip now accepts PanelistCandidate directly ───────────────────────
function PanelistChip({
  panelist,
  onRemove,
}: {
  panelist: PanelistCandidate;
  onRemove: () => void;
}) {
  const name     = getPanelistDisplayName(panelist);
  const initials = getPanelistInitials(panelist);
  const color    = PANELIST_TYPE_COLORS[panelist.panelistType];

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-outline/20 bg-surface-container px-2.5 py-1 text-sm text-on-surface">
      <span
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
        style={{ backgroundColor: color }}
      >
        {initials}
      </span>
      <span className="max-w-[140px] truncate sm:max-w-none">{name}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${name}`}
        className="ml-0.5 leading-none text-on-surface-variant transition-colors hover:text-error"
      >
        ×
      </button>
    </span>
  );
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

export function ScheduleDefenseModal({
  isOpen,
  onClose,
  thesis,
  scheduledBy,
  panelistPool = [],
  onConfirm,
}: ScheduleDefenseModalProps) {
  const [defenseDate, setDefenseDate]         = useState("");
  const [startTime, setStartTime]             = useState("");
  const [endTime, setEndTime]                 = useState("");
  const [selectedPanelists, setSelectedPanelists] = useState<PanelistCandidate[]>([]);
  const [search, setSearch]                   = useState("");
  const [venue, setVenue]                     = useState("");
  const [confirmOpen, setConfirmOpen]         = useState(false);
  const [pendingPayload, setPendingPayload]   = useState<CreateScheduleDto | null>(null);

  const duration   = useMemo(() => calcDuration(startTime, endTime), [startTime, endTime]);
  const canConfirm = defenseDate && startTime && endTime && selectedPanelists.length >= 3 && venue;

  const suggestions = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return panelistPool.filter(
      (p) =>
        !selectedPanelists.find((x) => x.id === p.id) &&
        getPanelistDisplayName(p).toLowerCase().includes(q),
    );
  }, [search, selectedPanelists, panelistPool]);

  // ── addPanelist now accepts PanelistCandidate, not old Panelist ──────────
  function addPanelist(p: PanelistCandidate) {
    setSelectedPanelists((prev) => [...prev, p]);
    setSearch("");
  }

  function handleConfirm() {
    const payload: CreateScheduleDto = {
      scheduledBy,
      groupId: thesis.groupId,
      date: defenseDate,
      startTime,
      endingTime: endTime,
      roomVenue: venue,
      panelists: selectedPanelists.map((p) => ({
        panelistId: p.id,
        panelistType: p.panelistType as PanelistType,
      })),
    };
    setPendingPayload(payload);
    setConfirmOpen(true);
  }

  function handleFinalConfirm() {
    if (!pendingPayload) return;
    console.log(`id is ${thesis.id}`);
    console.log(`groupId is ${thesis.groupId}`);
    onConfirm(pendingPayload);
    setConfirmOpen(false);
    setPendingPayload(null);
    onClose();
  }

  return (
    <>
    <Modal isOpen={isOpen} onClose={onClose} size="xl" className="!max-w-5xl">

      {/* ── Header ── */}
      <ModalHeader onClose={onClose}>
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="text-base font-semibold leading-tight text-on-surface">Schedule Defense</p>
            <p className="flex min-w-0 items-center gap-1 text-xs font-normal">
              <span className="truncate text-primary">{thesis.id}</span>
              <span className="shrink-0 text-on-surface-variant">|</span>
              <span className="truncate text-on-surface-variant">{thesis.author}</span>
            </p>
          </div>
        </div>
      </ModalHeader>

      {/* ── Body ── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden lg:flex-row">

        {/* ── Sidebar ── */}
        <aside className="
          flex shrink-0 flex-row flex-wrap items-start gap-x-8 gap-y-3
          overflow-hidden border-b border-outline/10 bg-surface-container-low/40
          p-4
          lg:w-48 lg:flex-col lg:gap-5 lg:border-b-0 lg:border-r lg:p-5
        ">
          <div className="min-w-0 max-w-full">
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
              Institute/Program
            </p>
            <p className="break-all text-sm font-semibold text-primary">
              {thesis.institute || <span className="italic text-on-surface-variant/50">—</span>}
            </p>
          </div>

          <div className="min-w-0 max-w-full">
            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant">
              Section/Leader
            </p>
            <p className="break-all text-sm font-semibold text-primary">
              {thesis.section || <span className="italic text-on-surface-variant/50">—</span>}
            </p>
          </div>

          <div className="mt-auto hidden lg:block">
            <div className="rounded-lg border border-outline/10 bg-surface p-3 text-xs leading-relaxed text-on-surface-variant">
              <span className="font-semibold text-on-surface">Min. 3 panelists</span>{" "}
              must be selected before confirming.
            </div>
          </div>
        </aside>

        {/* ── Form ── */}
        <div className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
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
                  {duration && (
                    <p className="mt-1.5 flex items-center gap-1 text-xs text-primary">
                      <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Duration: {duration}
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* 2. Panelist Selection */}
            <section>
              <div className="flex flex-wrap items-center justify-between gap-y-1">
                <SectionLabel number={2} label="Panelist Selection" />
                <span className="text-xs text-on-surface-variant">Min 3 required</span>
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
                  placeholder="Search by name…"
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
                            style={{ backgroundColor: PANELIST_TYPE_COLORS[p.panelistType] }}
                          >
                            {getPanelistInitials(p)}
                          </span>
                          <span className="flex-1 truncate">{getPanelistDisplayName(p)}</span>
                          {/* Role badge */}
                          <span className="shrink-0 rounded-full bg-surface-container px-2 py-0.5 text-[10px] font-medium capitalize text-on-surface-variant">
                            {p.panelistType.replace("-", " ")}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {selectedPanelists.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedPanelists.map((p) => (
                    <PanelistChip
                      key={p.id}
                      panelist={p}
                      onRemove={() =>
                        setSelectedPanelists((prev) => prev.filter((x) => x.id !== p.id))
                      }
                    />
                  ))}
                </div>
              )}
            </section>

            {/* 3. Room Venue */}
            <section>
              <SectionLabel number={3} label="Room Venue" />
              <div className="mt-4">
                <label className="mb-1.5 block text-xs font-medium text-on-surface-variant">
                  Location Detail
                </label>
                <div className="relative">
                  <select
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-outline/30 bg-surface px-3 py-2.5 pr-9 text-sm text-on-surface shadow-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="" disabled>Select a venue…</option>
                    {VENUES.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                  <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </section>

          </div>
        </div>
      </div>

      {/* ── Footer ── */}
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
          disabled={!canConfirm}
          className="inline-flex w-full items-center justify-center gap-2 shadow-sm sm:w-auto"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Confirm Schedule
        </Button>
      </div>

    </Modal>

      <ConfirmDialog
        open={confirmOpen}
        title="Confirm Schedule Creation"
        description={`You are about to schedule a defense for "${thesis.title}" by ${thesis.author}. Please review the details before confirming.`}
        confirmLabel="Create Schedule"
        cancelLabel="Go Back"
        onConfirm={handleFinalConfirm}
        onCancel={() => {
          setConfirmOpen(false);
          setPendingPayload(null);
        }}
      >
        {pendingPayload && (
          <div className="space-y-2 rounded-lg border border-outline/10 bg-surface-container-low p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Date</span>
              <span className="font-medium text-on-surface">{pendingPayload.date}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Time</span>
              <span className="font-medium text-on-surface">{pendingPayload.startTime} – {pendingPayload.endingTime}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Venue</span>
              <span className="font-medium text-on-surface">{pendingPayload.roomVenue}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-on-surface-variant">Panelists</span>
              <span className="font-medium text-on-surface">{pendingPayload.panelists.length} selected</span>
            </div>
          </div>
        )}
      </ConfirmDialog>
    </>
  );
}