import { Pin } from "lucide-react";
import type { ScheduleResponseDto } from "@monteai/types";
import { Avatar } from "../common/Avatar"; // Ensure this path matches your structure

interface DefenseCardProps {
  schedule: ScheduleResponseDto;
  isActive: boolean;
  onClick: () => void;
  col: number;
  totalCols: number;
}

function getInstituteTheme(institute?: string, isActive?: boolean) {
  const inst = (institute || "").toLowerCase();
  const baseLayout = "absolute rounded-md px-2.5 py-1.5 cursor-pointer transition-all overflow-hidden flex flex-col";

  const elevation = isActive
    ? "ring-2 ring-offset-1 ring-offset-surface z-20 shadow-md"
    : "border shadow-sm hover:z-10";

  // 1. ICS - Orange
  if (inst.includes("computing") || inst.includes("ics")) {
    return `${baseLayout} ${elevation} bg-orange-100 border-orange-200 text-orange-900 ${isActive ? 'ring-orange-400' : 'hover:bg-orange-200'
      }`;
  }

  // 2. ITE - Blue
  if (inst.includes("teaching") || inst.includes("education") || inst.includes("ite")) {
    return `${baseLayout} ${elevation} bg-blue-100 border-blue-200 text-blue-900 ${isActive ? 'ring-blue-400' : 'hover:bg-blue-200'
      }`;
  }

  // 3. IBE - Yellow
  if (inst.includes("business") || inst.includes("entrepreneurship") || inst.includes("ibe")) {
    return `${baseLayout} ${elevation} bg-yellow-100 border-yellow-200 text-yellow-900 ${isActive ? 'ring-yellow-400' : 'hover:bg-yellow-200'
      }`;
  }

  // 4. Default Fallback (Matches the sage green from your screenshot!)
  return `${baseLayout} ${elevation} bg-[#8AB3A3] border-[#7A9E90] text-[#1A2E24] ${isActive ? 'ring-[#1A2E24]' : 'hover:bg-[#7CA293]'
    }`;
}

export function DefenseCard({ schedule, isActive, onClick, col, totalCols }: DefenseCardProps) {
  const startHour = parseInt(schedule.startTime.split(":")[0]);
  const startMin = parseInt(schedule.startTime.split(":")[1]);
  const GAP_PX = 4;
  const topOffset = (startHour - 7) * 60 + startMin + 2;

  const endHour = parseInt(schedule.endingTime.split(":")[0]);
  const endMin = parseInt(schedule.endingTime.split(":")[1]);
  const duration = (endHour - startHour) * 60 + (endMin - startMin) - 2;

  const widthPct = 100 / totalCols;
  const leftPct = col * widthPct;
  const gapPx = 4;

  const instituteName = schedule.researchGroup?.institute;
  const themeClasses = getInstituteTheme(instituteName, isActive);

  return (
    <div
      className={themeClasses}
      style={{
        top: `${topOffset}px`,
        height: `${Math.max(48, duration)}px`,
        left: `calc(${leftPct}% + ${gapPx}px)`,
        width: `calc(${widthPct}% - ${gapPx * 2}px)`,
      }}
      onClick={onClick}
    >
      {/* 2. THE FIX: Group Title and Pin MUST share this flex row */}
      <div className="flex w-full items-start justify-between gap-2">
        <p className="font-semibold text-sm truncate">
          {schedule.researchGroup?.groupName || "Untitled Group"}
        </p>

        {/* The Pin sits on the right side of the SAME line */}
        {isActive && (
          <Pin className="h-3.5 w-3.5 shrink-0 opacity-80 mt-0.5" />
        )}
      </div>

      {/* Venue text sits right underneath */}
      <p className="text-xs opacity-80 truncate mt-0.5">
        {schedule.roomVenue}
      </p>

      {/* Avatars only render if duration is long enough */}
      {isActive && schedule.panelists && schedule.panelists.length > 0 && duration > 60 && (
        <div className="mt-auto flex -space-x-2 pt-2">
          {schedule.panelists.slice(0, 3).map((panelist) => (
            <div key={panelist.panelistId} className="ring-2 ring-white/40 rounded-full">
              <Avatar
                name={panelist.panelistId}
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