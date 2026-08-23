import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { ScheduleResponseDto } from "@monteai/types";
import { DefenseCard } from "./DefenseCard";
import { ScheduleDetailPanel } from "./ScheduleDetailPanel";
import { layoutDaySchedules } from "./scheduleLayout";
import { PageLayout, Select } from "../common";
import { Button } from "../Button";
import { ScheduleCalendarSkeleton } from "./skeletons";

type ViewType = "day" | "week" | "month";

interface ScheduleCalendarProps {
  schedules: ScheduleResponseDto[];
  isLoading?: boolean;
  onCreateNew?: () => void;
}

export function ScheduleCalendar({
  schedules,
  isLoading,
  onCreateNew,
}: ScheduleCalendarProps) {
  if (isLoading) {
    return <ScheduleCalendarSkeleton />;
  }

  const [view, setView] = useState<ViewType>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedSchedule, setSelectedSchedule] =
    useState<ScheduleResponseDto | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<string>("");

  const availableRooms = useMemo(() => {
    const rooms = new Set(schedules.map((s) => s.roomVenue).filter(Boolean));
    return Array.from(rooms).sort();
  }, [schedules]);

  const filteredSchedules = useMemo(() => {
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
    return filteredSchedules.filter(
      (s) => new Date(s.date).toDateString() === dayDate.toDateString(),
    );
  };

  const shiftWeek = (delta: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + delta * 7);
    setCurrentDate(newDate);
  };

  const dayLabels = ["MON", "TUE", "WED", "THU", "FRI"];

  // 1. Updated Time Formatting to drop the ":00" and leading zeros
  const hours = Array.from({ length: 12 }, (_, i) => {
    const hour = 7 + i;
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour > 12 ? hour - 12 : hour;
    return `${displayHour} ${ampm}`;
  });

  const roomOptions = useMemo(() => {
    return [
      { label: "All Rooms", value: "" },
      ...availableRooms.map((room) => ({
        label: room,
        value: room,
      })),
    ];
  }, [availableRooms]);

  return (
    <PageLayout direction="row" className="w-full !bg-surface overflow-hidden">
      <main className="flex-1 flex flex-col">
        <header className="flex items-center justify-between px-6 h-16 border-b border-outline-variant bg-surface relative z-20">
          <div className="flex items-center gap-4">
            <h2 className="text-headline-sm font-headline-sm text-on-surface">
              Defense Schedule
            </h2>
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

            <div className="w-40">
              <Select
                options={roomOptions}
                value={selectedRoom}
                onChange={setSelectedRoom}
                className="bg-surface-container-high rounded-lg"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-body-md font-body-md text-on-surface-variant">
              {dateRange}
            </span>

            <Button
              variant="ghost"
              onClick={() => setCurrentDate(new Date())}
              className="!px-3 !py-1.5 text-sm border border-outline-variant"
            >
              Today
            </Button>

            <div className="flex border border-outline-variant rounded-lg overflow-hidden">
              <Button
                variant="ghost"
                onClick={() => shiftWeek(-1)}
                className="!p-1.5 !rounded-none"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>

              <Button
                variant="ghost"
                onClick={() => shiftWeek(1)}
                className="!p-1.5 !rounded-none border-l border-outline-variant"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar relative">
          {
            <>
              <div className="schedule-grid border-b border-outline-variant sticky top-0 bg-surface z-20 text-center">
                <div className="p-4 border-r border-outline-variant" />
                {dayLabels.map((day, idx) => {
                  const date = weekDates[idx];
                  const isToday =
                    date.toDateString() === new Date().toDateString();
                  return (
                    <div
                      key={day}
                      className="p-4 border-r border-outline-variant"
                    >
                      <p
                        className={`text-label-sm font-label-sm ${isToday ? "text-primary" : "text-outline"}`}
                      >
                        {day}
                      </p>
                      <p
                        className={`text-headline-sm font-headline-sm ${isToday ? "text-primary" : ""}`}
                      >
                        {date.getDate()}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="relative">
                <div className="schedule-grid">
                  {/* 2. TIME COLUMN: Outlook Style */}
                  <div className="col-span-1 border-r border-outline-variant bg-surface z-10">
                    {hours.map((hour) => (
                      <div
                        key={hour}
                        className="time-row relative border-t border-outline-variant/40 first:border-t-0"
                      >
                        {/* Text pinned to top-right under the solid line */}
                        <span className="absolute top-1 right-2 text-xs font-medium text-on-surface-variant">
                          {hour}
                        </span>
                        {/* Faint dashed line at the 30-minute mark */}
                        <div className="absolute top-[30px] w-full border-t border-dashed border-outline-variant/30" />
                      </div>
                    ))}
                  </div>

                  {/* 3. CALENDAR GRID: Includes Background Grid Lines */}
                  <div
                    className="col-span-5 relative"
                    style={{ height: `${hours.length * 60}px` }}
                  >
                    {/* Background lines spanning the whole grid */}
                    <div className="absolute inset-0 z-0 flex flex-col pointer-events-none">
                      {hours.map((_, i) => (
                        <div
                          key={i}
                          className="h-[60px] w-full border-t border-outline-variant/40 first:border-t-0 relative"
                        >
                          <div className="absolute top-[30px] w-full border-t border-dashed border-outline-variant/30" />
                        </div>
                      ))}
                    </div>

                    {/* Foreground Columns & Cards */}
                    <div className="absolute inset-0 z-10 grid grid-cols-5 h-full">
                      {Array.from({ length: 5 }).map((_, dayIdx) => {
                        const laidOut = layoutDaySchedules(
                          schedulesByDay(dayIdx),
                        );
                        return (
                          <div
                            key={dayIdx}
                            className="relative border-r border-outline-variant last:border-r-0"
                          >
                            {laidOut.map(({ schedule, col, totalCols }) => (
                              <DefenseCard
                                key={schedule.scheduleId}
                                schedule={schedule}
                                isActive={
                                  selectedSchedule?.scheduleId ===
                                  schedule.scheduleId
                                }
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
              </div>
            </>
          }
        </div>
      </main>

      <ScheduleDetailPanel
        schedule={selectedSchedule}
        onClose={() => setSelectedSchedule(null)}
      />

      {onCreateNew && (
        <Button
          onClick={onCreateNew}
          className="fixed bottom-8 right-8 z-50 flex h-14 w-14 items-center justify-center !p-0 !rounded-full !bg-status-defense text-white shadow-2xl !transition-all hover:scale-110"
        >
          <Plus className="h-8 w-8" strokeWidth={2} />
        </Button>
      )}
    </PageLayout>
  );
}
