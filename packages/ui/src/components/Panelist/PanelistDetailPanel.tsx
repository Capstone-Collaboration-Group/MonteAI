import { X, Building2, Clock, CalendarDays, MapPin, Users } from "lucide-react";
import type { PanelistResponseDto, ScheduleResponseDto } from "@monteai/types";
import { fullNameHelper } from "@monteai/utils";
import { Badge } from "../common";

interface PanelistDetailPanelProps {
  panelist: PanelistResponseDto | null;
  onClose: () => void;
  /** Lookup map of scheduleId -> full schedule, used to show room venue for each assignment */
  schedulesById?: Map<string, ScheduleResponseDto>;
}

export function PanelistDetailPanel({ panelist, onClose, schedulesById }: PanelistDetailPanelProps) {
  return (
    <aside
      className={`w-80 bg-white border-l border-outline-variant flex flex-col h-full transform transition-transform duration-300 ${
        panelist ? "translate-x-0" : "translate-x-full"
      } fixed top-0 right-0 z-50 shadow-2xl`}
    >
      {panelist && (
        <div className="p-6 overflow-y-auto h-full">

          {/* ── Header ──────────────────────────────────────────────────── */}
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-headline-sm font-headline-sm text-on-surface">
              Panelist Details
            </h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-surface-container rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* ── Identity card ────────────────────────────────────────────── */}
          <div className="mb-8 p-4 bg-surface-container-low rounded-xl border border-outline-variant">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center text-white">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-label-sm font-label-sm text-outline uppercase tracking-wider">
                  {panelist.panelistType}
                </p>
                <h4 className="font-bold text-on-surface">
                  {fullNameHelper(
                    panelist.firstName,
                    panelist.middleInitial,
                    panelist.lastName,
                    panelist.suffix
                  )}
                </h4>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-label-sm font-label-sm text-outline">Email</p>
                <p className="text-body-sm font-body-sm font-bold truncate">
                  {panelist.email}
                </p>
              </div>
              <div>
                <p className="text-label-sm font-label-sm text-outline">Role</p>
                <p className="text-body-sm font-body-sm font-bold truncate">
                  {panelist.role}
                </p>
              </div>
              {panelist.institute && (
                <div className="col-span-2">
                  <p className="text-label-sm font-label-sm text-outline">Institute</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Building2 className="w-3.5 h-3.5 text-outline shrink-0" />
                    <p className="text-body-sm font-body-sm font-bold truncate">
                      {panelist.institute}
                    </p>
                  </div>
                </div>
              )}
              {panelist.position && (
                <div className="col-span-2">
                  <p className="text-label-sm font-label-sm text-outline">Position</p>
                  <p className="text-body-sm font-body-sm font-bold truncate">
                    {panelist.position}
                  </p>
                </div>
              )}
            </div>

            {/* Status */}
            <div className="mt-4">
              <Badge
                variant={panelist.isAssigned ? "defense" : "critical"}
                dot
                size="sm"
              >
                {panelist.isAssigned
                  ? `Assigned (${panelist.assignments.length})`
                  : "Unassigned"}
              </Badge>
            </div>
          </div>

          {/* ── Assigned schedules ───────────────────────────────────────── */}
          <div>
            <p className="text-label-md font-label-md text-on-surface-variant mb-4 flex items-center justify-between">
              ASSIGNED DEFENSES
              <span className="px-2 py-0.5 bg-primary-fixed text-on-primary-fixed text-[10px] rounded">
                {panelist.assignments.length}{" "}
                {panelist.assignments.length === 1 ? "SCHEDULE" : "SCHEDULES"}
              </span>
            </p>

            {panelist.assignments.length === 0 ? (
              <p className="text-body-sm text-on-surface-variant">
                No defense schedules assigned.
              </p>
            ) : (
              <div className="space-y-3">
                {panelist.assignments.map((a) => {
                  // Resolve full schedule (room venue) via lookup — falls back
                  // gracefully if the schedule pool hasn't loaded yet.
                  const fullSchedule = schedulesById?.get(a.scheduleId);

                  return (
                    <div
                      key={a.scheduleId}
                      className="p-3 rounded-xl border border-outline-variant bg-surface-container-low hover:bg-surface-container transition-colors"
                    >
                      {/* Group name */}
                      <p className="text-body-sm font-bold text-on-surface mb-2">
                        {a.groupName}
                      </p>

                      {/* Date */}
                      <div className="flex items-center gap-2 text-on-surface-variant mb-1">
                        <CalendarDays className="w-3.5 h-3.5 shrink-0 text-primary" />
                        <p className="text-label-sm font-label-sm">
                          {new Date(a.date).toLocaleDateString("en-US", {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </p>
                      </div>

                      {/* Time */}
                      <div className="flex items-center gap-2 text-on-surface-variant mb-1">
                        <Clock className="w-3.5 h-3.5 shrink-0 text-primary" />
                        <p className="text-label-sm font-label-sm">
                          {a.startTime} – {a.endingTime}
                        </p>
                      </div>

                      {/* Room venue — resolved from schedulesById */}
                      {fullSchedule?.roomVenue && (
                        <div className="flex items-center gap-2 text-on-surface-variant">
                          <MapPin className="w-3.5 h-3.5 shrink-0 text-primary" />
                          <p className="text-label-sm font-label-sm">
                            {fullSchedule.roomVenue}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}