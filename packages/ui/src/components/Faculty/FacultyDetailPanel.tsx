import { useState, type ReactNode } from "react";
import {
  Building2,
  CalendarClock,
  CalendarDays,
  GraduationCap,
  IdCard,
  Mail,
  UserRound,
  X,
} from "lucide-react";
import type {
  FacultyResponseDto,
  ProgramHeadResponseDto,
} from "@monteai/types";
import { formatDate, fullNameHelper } from "@monteai/utils";
import { Badge } from "../common";

// ─── Types ────────────────────────────────────────────────────────────────────

export type FacultyMemberDetail =
  | (FacultyResponseDto & { kind: "faculty" })
  | (ProgramHeadResponseDto & { kind: "program-head" });

interface FacultyDetailPanelProps {
  member: FacultyMemberDetail | null;
  onClose: () => void;
}

// ─── Small presentational helpers ────────────────────────────────────────────

interface FieldProps {
  label: string;
  children: ReactNode;
}

function Field({ label, children }: FieldProps) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-on-surface-variant">
        {label}
      </p>
      <p className="break-words text-sm font-semibold text-on-surface">
        {children}
      </p>
    </div>
  );
}

// ─── Detail slide-over (right → left) ────────────────────────────────────────

export function FacultyDetailPanel({
  member,
  onClose,
}: FacultyDetailPanelProps) {
  // Keep the last opened member around while the panel slides out so the
  // closing animation shows the content (mirrors PanelistDetailPanel, which
  // stays mounted and just toggles translate-x). Adjusted at render time so
  // no content flash occurs during the exit transition.
  const [visible, setVisible] = useState<FacultyMemberDetail | null>(member);
  const [prevMember, setPrevMember] = useState<FacultyMemberDetail | null>(
    member,
  );
  if (member !== prevMember) {
    setPrevMember(member);
    if (member) setVisible(member);
  }

  const isOpen = member !== null;
  const current = visible;
  const isProgramHead = current?.kind === "program-head";
  const fullName = current
    ? fullNameHelper(
        current.firstName,
        current.middleInitial,
        current.lastName,
        current.suffix,
      )
    : "";
  const isActive = current?.isActive !== false;

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-label={isProgramHead ? "Program Head Details" : "Faculty Details"}
      className={`fixed top-0 right-0 z-50 flex h-full w-80 flex-col bg-surface text-on-surface shadow-2xl border-l border-outline-variant transition-transform duration-300 ease-in-out ${
        isOpen ? "translate-x-0" : "translate-x-full"
      }`}
    >
      {current && (
        <div className="flex h-full flex-col overflow-y-auto p-6">
          {/* ── Header ──────────────────────────────────────────────────── */}
          <div className="mb-6 flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-on-surface">
              {isProgramHead ? "Program Head Details" : "Faculty Details"}
            </h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="cursor-pointer rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* ── Identity card ───────────────────────────────────────────── */}
          <div className="mb-8 rounded-xl border border-outline-variant bg-surface-container-low p-4">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary text-white">
                <UserRound className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  {isProgramHead ? "Program Head" : "Faculty Member"}
                </p>
                <h4 className="truncate font-bold text-on-surface">{fullName}</h4>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Email">
                <Mail className="mr-1.5 inline h-3.5 w-3.5 shrink-0 align-[-2px] text-outline" />
                {current.email}
              </Field>
              <Field label="Role">{current.role}</Field>
              <div className="col-span-2">
                <Field label="Institute">
                  <Building2 className="mr-1.5 inline h-3.5 w-3.5 shrink-0 align-[-2px] text-outline" />
                  {current.institute}
                </Field>
              </div>
              {isProgramHead && current.kind === "program-head" && (
                <div className="col-span-2">
                  <Field label="Program Handled">
                    <GraduationCap className="mr-1.5 inline h-3.5 w-3.5 shrink-0 align-[-2px] text-outline" />
                    {current.programHandled}
                  </Field>
                </div>
              )}
            </div>

            {/* Status */}
            <div className="mt-4">
              <Badge
                variant={isActive ? "defense" : "critical"}
                dot
                size="sm"
              >
                {isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>

          {/* ── Membership metadata ─────────────────────────────────────── */}
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            Membership
          </p>
          <div className="space-y-4">
            <Field label="Member Since">
              <CalendarDays className="mr-1.5 inline h-3.5 w-3.5 shrink-0 align-[-2px] text-outline" />
              {formatDate(current.createdAt)}
            </Field>
            <Field label="Last Updated">
              <CalendarClock className="mr-1.5 inline h-3.5 w-3.5 shrink-0 align-[-2px] text-outline" />
              {formatDate(current.updatedAt)}
            </Field>
            <Field label="Member ID">
              <IdCard className="mr-1.5 inline h-3.5 w-3.5 shrink-0 align-[-2px] text-outline" />
              <span className="font-mono text-xs">{current.id}</span>
            </Field>
          </div>
        </div>
      )}
    </aside>
  );
}
