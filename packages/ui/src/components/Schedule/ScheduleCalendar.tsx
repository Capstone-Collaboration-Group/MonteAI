import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ScheduleResponseDto } from "@monteai/types";
import { DefenseCard } from "./DefenseCard";
import { ScheduleDetailPanel } from "./ScheduleDetailPanel";
import { layoutDaySchedules } from "./scheduleLayout";

type ViewType = "day" | "week" | "month";

interface ScheduleCalendarProps {
  schedules: ScheduleResponseDto[];
  isLoading?: boolean;
  onCreateNew?: () => void;
}

export function ScheduleCalendar({ schedules, isLoading, onCreateNew }: ScheduleCalendarProps) {
  const [view, setView] = useState<ViewType>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleResponseDto | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<string>("");

  // Extract unique room venues for the filter dropdown
  const availableRooms = useMemo(() => {
    if (!Array.isArray(schedules)) return [];
    const rooms = new Set(schedules.map((s) => s.roomVenue).filter(Boolean));
    return Array.from(rooms).sort();
  }, [schedules]);

  // Filter schedules by selected room
  const filteredSchedules = useMemo(() => {
    if(!Array.isArray(schedules)) return [];
    if (!selectedRoom) return schedules;
    return schedules.filter((s) => s.roomVenue === selectedRoom);
  }, [schedules, selectedRoom]);

  const getWeekDates = (date: Date) => {
    const curr = new Date(date);
    const day = curr.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(curr);
    monday.setDate(curr.getDate() + diffToMonday);

    const week = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      week.push(d);
    }
    return week;
  };

  const weekDates = getWeekDates(new Date(currentDate));
  const dateRange = `${weekDates[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${weekDates[4].toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${weekDates[0].getFullYear()}`;

  const schedulesByDay = (dayIndex: number) => {
    const dayDate = weekDates[dayIndex];
    return filteredSchedules.filter((s) => new Date(s.date).toDateString() === dayDate.toDateString());
  };

  const shiftWeek = (delta: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + delta * 7);
    setCurrentDate(newDate);
  };

  const dayLabels = ["MON", "TUE", "WED", "THU", "FRI"];
  const hours = Array.from({ length: 9 }, (_, i) => {
    const hour = 8 + i;
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour > 12 ? hour - 12 : hour;
    return `${displayHour.toString().padStart(2, "0")}:00 ${ampm}`;
  });

  return (
    <div className="flex h-screen w-full bg-surface-white overflow-hidden">
      <main className="flex-1 flex flex-col">
        <header className="flex items-center justify-between px-6 h-16 border-b border-outline-variant">
          <div className="flex items-center gap-4">
            <h2 className="text-headline-sm font-headline-sm text-on-surface">Defense Schedule</h2>
            <div className="flex border border-outline-variant rounded-lg overflow-hidden">
              {(["day", "week", "month"] as ViewType[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-4 py-1.5 font-label-md text-label-md capitalize transition-colors ${
                    view === v
                      ? "bg-primary text-white"
                      : "bg-surface-container-high text-on-surface hover:bg-surface-container"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>

            {/* Room Filter */}
            <div className="relative">
              <select
                value={selectedRoom}
                onChange={(e) => setSelectedRoom(e.target.value)}
                className="appearance-none bg-surface-container-high border border-outline-variant rounded-lg pl-3 pr-8 py-1.5 text-label-md text-on-surface hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer transition-all"
              >
                <option value="">All Rooms</option>
                {availableRooms.map((room) => (
                  <option key={room} value={room}>
                    {room}
                  </option>
                ))}
              </select>
              <ChevronRight className="w-3.5 h-3.5 text-on-surface-variant absolute right-2.5 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-body-md font-body-md text-on-surface-variant">{dateRange}</span>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1.5 text-sm font-medium border border-outline-variant rounded-lg hover:bg-surface-container transition-colors"
            >
              Today
            </button>
            <div className="flex border border-outline-variant rounded-lg">
              <button onClick={() => shiftWeek(-1)} className="p-1.5 hover:bg-surface-container transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => shiftWeek(1)}
                className="p-1.5 border-l border-outline-variant hover:bg-surface-container transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar relative">
          {isLoading ? (
            <p className="p-6 text-sm text-on-surface-variant">Loading schedule…</p>
          ) : (
            <>
              <div className="schedule-grid border-b border-outline-variant sticky top-0 bg-surface-white z-10 text-center">
                <div className="p-4 border-r border-outline-variant" />
                {dayLabels.map((day, idx) => {
                  const date = weekDates[idx];
                  const isToday = date.toDateString() === new Date().toDateString();
                  return (
                    <div key={day} className="p-4 border-r border-outline-variant">
                      <p className={`text-label-sm font-label-sm ${isToday ? "text-primary" : "text-outline"}`}>
                        {day}
                      </p>
                      <p className={`text-headline-sm font-headline-sm ${isToday ? "text-primary" : ""}`}>
                        {date.getDate()}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="relative">
                <div className="schedule-grid">
                  <div className="col-span-1 border-r border-outline-variant">
                    {hours.map((hour) => (
                      <div key={hour} className="time-row flex items-center justify-center text-label-sm font-label-sm text-outline">
                        {hour}
                      </div>
                    ))}
                  </div>
                  <div className="col-span-5 grid grid-cols-5 h-[540px]">
                    {Array.from({ length: 5 }).map((_, dayIdx) => {
                      const laidOut = layoutDaySchedules(schedulesByDay(dayIdx));
                      return (
                        <div key={dayIdx} className="relative border-r border-outline-variant last:border-r-0">
                          {laidOut.map(({ schedule, col, totalCols }) => (
                            <DefenseCard
                              key={schedule.scheduleId}
                              schedule={schedule}
                              isActive={selectedSchedule?.scheduleId === schedule.scheduleId}
                              onClick={() => setSelectedSchedule(schedule)}
                              col={col}
                              totalCols={totalCols}
                            />
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      <ScheduleDetailPanel schedule={selectedSchedule} onClose={() => setSelectedSchedule(null)} />

      {onCreateNew && (
        <button
          onClick={onCreateNew}
          className="fixed bottom-8 right-8 w-14 h-14 bg-status-defense text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-transform z-50"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}
    </div>
  );
}