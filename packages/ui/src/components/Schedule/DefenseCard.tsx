import type { ScheduleResponseDto } from "@monteai/types";

interface DefenseCardProps {
  schedule: ScheduleResponseDto;
  isActive: boolean;
  onClick: () => void;
  col: number;
  totalCols: number;
}

const randomColors = [
  { bg: "bg-secondary-fixed", text: "text-on-secondary" },
  { bg: "bg-tertiary-fixed", text: "text-on-tertiary" },
  { bg: "bg-primary-fixed", text: "text-on-primary-fixed" },
];

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

export function DefenseCard({ schedule, isActive, onClick, col, totalCols }: DefenseCardProps) {
  const startHour = parseInt(schedule.startTime.split(":")[0]);
  const startMin = parseInt(schedule.startTime.split(":")[1]);
  const GAP_PX = 4;
  const topOffset = (startHour - 8) * 60 + startMin + 2;

  const endHour = parseInt(schedule.endingTime.split(":")[0]);
  const endMin = parseInt(schedule.endingTime.split(":")[1]);
  const duration = (endHour - startHour) * 60 + (endMin - startMin) - 2;

  const widthPct = 100 / totalCols;
  const leftPct = col * widthPct;
  const gapPx = 4;

  return (
    <div
      className={`absolute rounded-sm p-3 cursor-pointer transition-all shadow-sm overflow-hidden ${
        isActive
          ? "bg-status-approved/70 text-white ring-2 ring-primary-container/40 z-20 shadow-lg"
          : "bg-primary/50 text-slate-900 ring-0 border border-white/15 shadow-sm"
      }`}
      style={{
        top: `${topOffset}px`,
        height: `${Math.max(48, duration)}px`,
        left: `calc(${leftPct}% + ${gapPx}px)`,
        width: `calc(${widthPct}% - ${gapPx * 2}px)`,
      }}
      onClick={onClick}
    >
      <div className={isActive ? "flex justify-between items-start mb-1" : "mb-1"}>
        
        {isActive && <span className="material-symbols-outlined text-sm text-slate-700">push_pin</span>}
      </div>
      <p className={`font-bold ${isActive ? "text-md" : "text-sm"} truncate`}>
        {schedule.researchGroup?.groupName || "Untitled"}
      </p>
      <p className={`${isActive ? "text-xs mt-1" : "text-[10px]"} truncate`}>{schedule.roomVenue}</p>
      {isActive && schedule.panelists.length > 0 && (
        <div className="mt-2 flex -space-x-2">
          {schedule.panelists.slice(0, 3).map((panelist, idx) => {
            const color = randomColors[idx % randomColors.length];
            return (
              <div
                key={panelist.panelistId}
                className={`w-6 h-6 rounded-full border border-white ${color.bg} text-[8px] flex items-center justify-center font-bold ${color.text}`}
              >
                {getInitials(panelist.panelistId)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}