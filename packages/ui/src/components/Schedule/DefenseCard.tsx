import type { PointerEvent as ReactPointerEvent } from "react";
import { Pin } from "lucide-react";
import type { ScheduleResponseDto } from "@monteai/types";
import { Avatar } from "../common/Avatar";
import { getInstituteTheme } from "./scheduleThemes";

export type DefenseCardDragAction = "move" | "resize-start" | "resize-end";

interface DefenseCardProps {
  schedule: ScheduleResponseDto;
  isActive: boolean;
  onClick: () => void;
  col: number;
  totalCols: number;
  /** When true, renders drag/resize affordances (admin-only). */
  canEdit?: boolean;
  /** Fires on pointer down with the gesture kind (calendar owns the drag). */
  onDragStart?: (
    event: ReactPointerEvent,
    action: DefenseCardDragAction,
  ) => void;
}

export function DefenseCard({
  schedule,
  isActive,
  onClick,
  col,
  totalCols,
  canEdit = false,
  onDragStart,
}: DefenseCardProps) {
  const startHour = parseInt(schedule.startTime.split(":")[0]);
  const startMin = parseInt(schedule.startTime.split(":")[1]);
  const topOffset = (startHour - 7) * 60 + startMin + 2;

  const endHour = parseInt(schedule.endingTime.split(":")[0]);
  const endMin = parseInt(schedule.endingTime.split(":")[1]);
  const duration = (endHour - startHour) * 60 + (endMin - startMin) - 2;

  const widthPct = 100 / totalCols;
  const leftPct = col * widthPct;
  const gapPx = 4;

  const instituteName = schedule.researchGroup?.institute;
  const themeClasses = getInstituteTheme(instituteName, isActive);

  const editable = canEdit && !!onDragStart;
  const dragClasses = editable
    ? "cursor-grab active:cursor-grabbing select-none touch-none"
    : "";

  const handleResizeStart = (
    e: ReactPointerEvent,
    action: "resize-start" | "resize-end",
  ) => {
    if (!editable) return;
    e.preventDefault();
    e.stopPropagation();
    onDragStart!(e, action);
  };

  return (
    <div
      className={`${themeClasses} ${dragClasses}`}
      style={{
        top: `${topOffset}px`,
        height: `${Math.max(48, duration)}px`,
        left: `calc(${leftPct}% + ${gapPx}px)`,
        width: `calc(${widthPct}% - ${gapPx * 2}px)`,
      }}
      onClick={onClick}
      onPointerDown={(e) => {
        if (!editable) return;
        e.stopPropagation();
        onDragStart!(e, "move");
      }}
    >
      {editable && (
        <>
          {/* Top edge — compress/expand the start time */}
          <div
            className="absolute -top-1.5 left-0 right-0 z-10 h-3 cursor-ns-resize touch-none"
            onPointerDown={(e) => handleResizeStart(e, "resize-start")}
            onClick={(e) => e.stopPropagation()}
          />
          {/* Bottom edge — expand/compress the ending time */}
          <div
            className="absolute -bottom-1.5 left-0 right-0 z-10 h-3 cursor-ns-resize touch-none"
            onPointerDown={(e) => handleResizeStart(e, "resize-end")}
            onClick={(e) => e.stopPropagation()}
          />
        </>
      )}

      <div className="flex w-full items-start justify-between gap-2">
        <p className="font-semibold text-sm truncate">
          {schedule.researchGroup?.groupName || "Untitled Group"}
        </p>

        {isActive && <Pin className="h-3.5 w-3.5 shrink-0 opacity-80 mt-0.5" />}
      </div>

      <p className="text-xs opacity-80 truncate mt-0.5">{schedule.roomVenue}</p>

      {isActive &&
        schedule.panelists &&
        schedule.panelists.length > 0 &&
        duration > 60 && (
          <div className="mt-auto flex -space-x-2 pt-2">
            {schedule.panelists.slice(0, 3).map((panelist) => (
              <div
                key={panelist.panelistId}
                className="ring-2 ring-white/40 rounded-full"
              >
                <Avatar
                  name={panelist.panelistName || panelist.panelistId}
                  size="sm"
                  shape="circle"
                />
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
