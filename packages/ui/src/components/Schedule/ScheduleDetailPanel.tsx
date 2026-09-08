import { useState } from "react";
import { X, MapPin, Clock, Users, Pencil, Trash2 } from "lucide-react";
import type { ScheduleResponseDto } from "@monteai/types";
import { ConfirmDialog } from "../common/ConfirmDialog";

interface ScheduleDetailPanelProps {
  schedule: ScheduleResponseDto | null;
  onClose: () => void;
  /** Show the admin-only "Edit" action. */
  canEdit?: boolean;
  /** Fires when the admin clicks Edit for the shown schedule. */
  onEdit?: (schedule: ScheduleResponseDto) => void;
  /** Show the admin-only "Delete" action. */
  canDelete?: boolean;
  /** Fires when the admin confirms deletion of the shown schedule. */
  onDelete?: (schedule: ScheduleResponseDto) => void;
}

export function ScheduleDetailPanel({
  schedule,
  onClose,
  canEdit = false,
  onEdit,
  canDelete = false,
  onDelete,
}: ScheduleDetailPanelProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  function handleConfirmDelete() {
    if (schedule && onDelete) {
      onDelete(schedule);
    }
    setConfirmOpen(false);
  }

  return (
    <>
      <aside
        className={`w-80 bg-white border-l border-outline-variant flex flex-col h-full transform transition-transform duration-300 ${
          schedule ? "translate-x-0" : "translate-x-full"
        } fixed top-0 right-0 z-50 shadow-2xl`}
      >
        {schedule && (
          <div className="p-6 overflow-y-auto h-full">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-headline-sm font-headline-sm text-on-surface">Defense Details</h3>
              <div className="flex items-center gap-1">
                {canEdit && onEdit && (
                  <button
                    onClick={() => onEdit(schedule)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline-variant text-label-md font-label-md text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
                    aria-label="Edit schedule"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit
                  </button>
                )}
                <button onClick={onClose} className="p-2 hover:bg-surface-container rounded-full transition-colors" aria-label="Close">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {schedule.researchGroup && (
              <div className="mb-8 p-4 bg-background-subtle rounded-xl border border-outline-variant">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center text-white">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-label-sm font-label-sm text-outline uppercase tracking-wider">
                      Group Identity
                    </p>
                    <h4 className="font-bold text-on-surface">{schedule.researchGroup.groupName}</h4>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-label-sm font-label-sm text-outline">Research Title</p>
                    <p className="text-body-sm font-body-sm font-bold truncate">
                      {schedule.researchGroup.researchTitle}
                    </p>
                  </div>
                  <div>
                    <p className="text-label-sm font-label-sm text-outline">Group Leader ID</p>
                    <p className="text-body-sm font-body-sm font-bold truncate">
                      {schedule.researchGroup.leaderId}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-4">
                <Clock className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-label-sm font-label-sm text-outline">Defense Date</p>
                  <p className="text-body-md font-body-md font-bold">
                    {new Date(schedule.date).toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <Clock className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-label-sm font-label-sm text-outline">Time Slot</p>
                  <p className="text-body-md font-body-md font-bold">
                    {schedule.startTime} - {schedule.endingTime}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <MapPin className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-label-sm font-label-sm text-outline">Defense Venue</p>
                  <p className="text-body-md font-body-md font-bold">{schedule.roomVenue}</p>
                </div>
              </div>
            </div>

            <div className="mb-8">
              <p className="text-label-md font-label-md text-on-surface-variant mb-4 flex items-center justify-between">
                ASSIGNED PANELISTS
                <span className="px-2 py-0.5 bg-primary-fixed text-on-primary-fixed text-[10px] rounded">
                  {schedule.panelists.length} MEMBERS
                </span>
              </p>
              <div className="space-y-3">
                {schedule.panelists.length > 0 ? (
                  schedule.panelists.map((panelist) => (
                    <div
                      key={panelist.panelistId}
                      className="flex items-center justify-between p-2 hover:bg-surface-container rounded-lg transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-secondary-fixed text-xs flex items-center justify-center font-bold text-on-secondary">
                          {panelist.panelistId.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-body-sm font-body-sm">{panelist.panelistId}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-body-sm text-on-surface-variant">No panelists assigned</p>
                )}
              </div>
            </div>

            {canDelete && onDelete && (
              <div className="mt-auto pt-4 border-t border-outline-variant">
                <button
                  onClick={() => setConfirmOpen(true)}
                  className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg border border-error/30 text-error hover:bg-error/5 transition-colors text-sm font-medium"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Schedule
                </button>
              </div>
            )}
          </div>
        )}
      </aside>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete Schedule"
        description="Are you sure you want to delete this defense schedule? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
