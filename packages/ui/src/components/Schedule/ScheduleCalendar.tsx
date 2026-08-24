import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { ScheduleResponseDto } from "@monteai/types";
import { DefenseCard, getInstituteChipTheme } from "./DefenseCard";
import { ScheduleDetailPanel } from "./ScheduleDetailPanel";
import { layoutDaySchedules } from "./scheduleLayout";
import { PageLayout, Select } from "../common";
import { Button } from "../Button";

type ViewType = "day" | "week" | "month";

interface ScheduleCalendarProps {
  schedules: ScheduleResponseDto[];
  isLoading?: boolean;
  onCreateNew?: () => void;
}

const WEEKDAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export function ScheduleCalendar({ schedules, isLoading, onCreateNew }: ScheduleCalendarProps) {
  const [view, setView] = useState<ViewType>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleResponseDto | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<string>("");

  const availableRooms = useMemo(() => {
    const rooms = new Set(schedules.map((s) => s.roomVenue).filter(Boolean));
    return Array.from(rooms).sort();
  }, [schedules]);

  const filteredSchedules = useMemo(() => {
    if (!selectedRoom) return schedules;
    return schedules.filter((s) => s.roomVenue === selectedRoom);
  }, [schedules, selectedRoom]);

  const getSchedulesForDate = (date: Date) =>
    filteredSchedules.filter((s) => new Date(s.date).toDateString() === date.toDateString());

  const getWeekDates = (date: Date) => {
    const curr = new Date(date);
    const day = curr.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(curr);
    monday.setDate(curr.getDate() + diffToMonday);

    const week = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      week.push(d);
    }
    return week;
  };

  const weekDates = getWeekDates(new Date(currentDate));
  const weekRangeLabel = `${weekDates[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${weekDates[5].toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${weekDates[0].getFullYear()}`;

  const singleDayLabel = currentDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const monthLabel = currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const headerDateText = view === "day" ? singleDayLabel : view === "month" ? monthLabel : weekRangeLabel;

  const schedulesByDay = (dayIndex: number) => getSchedulesForDate(weekDates[dayIndex]);

  const monthGridWeeks = useMemo(() => {
    if (view !== "month") return [];

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const startOffset = firstOfMonth.getDay();

    const cells: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);

    const weeks: (Date | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  }, [view, currentDate]);

  const shiftWeek = (delta: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + delta * 7);
    setCurrentDate(newDate);
  };

  const shiftDay = (delta: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + delta);
    setCurrentDate(newDate);
  };

  const shiftMonth = (delta: number) => {
    const newDate = new Date(currentDate);
    newDate.setDate(1);
    newDate.setMonth(newDate.getMonth() + delta);
    setCurrentDate(newDate);
  };

  const goToPrevious = () => {
    if (view === "day") shiftDay(-1);
    else if (view === "month") shiftMonth(-1);
    else shiftWeek(-1);
  };

  const goToNext = () => {
    if (view === "day") shiftDay(1);
    else if (view === "month") shiftMonth(1);
    else shiftWeek(1);
  };

  const dayLabels = ["MON", "TUE", "WED", "THU", "FRI", "SAT"];

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
        <header className="flex items-center justify-between px-6 h-16 border-b border-outline-variant bg-surface relative z-50">           <div className="flex items-center gap-4">
            <h2 className="text-headline-sm font-headline-sm text-on-surface">Defense Schedule</h2>
            <div className="flex border border-outline-variant rounded-lg overflow-hidden">
              {(["day", "week", "month"] as ViewType[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-4 py-1.5 font-label-md text-label-md capitalize transition-colors ${view === v
                      ? "bg-primary text-white"
                      : "bg-surface-container-high text-on-surface hover:bg-surface-container"
                    }`}
                >
                  {v}
                </button>
              ))}
            </div>

            <div className="w-40 relative z-50">
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
              {headerDateText}
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
                onClick={goToPrevious}
                className="!p-1.5 !rounded-none"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>

              <Button
                variant="ghost"
                onClick={goToNext}
                className="!p-1.5 !rounded-none border-l border-outline-variant"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar relative">
          {isLoading ? (
            <p className="p-6 text-sm text-on-surface-variant">Loading schedule…</p>
          ) : view === "day" ? (
            <>
              <div className="grid grid-cols-[80px_1fr] border-b border-outline-variant sticky top-0 bg-surface z-20">
                <div className="p-4 border-r border-outline-variant flex items-center">
                  <p className="text-label-sm font-label-sm text-outline">Time</p>
                </div>
                <div className="flex items-center justify-center gap-3 p-4">
                  <button
                    onClick={() => shiftDay(-1)}
                    className="p-1 rounded hover:bg-surface-container-high transition-colors"
                    aria-label="Previous day"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <p className="text-headline-sm font-headline-sm text-on-surface">{singleDayLabel}</p>
                  <button
                    onClick={() => shiftDay(1)}
                    className="p-1 rounded hover:bg-surface-container-high transition-colors"
                    aria-label="Next day"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="relative">
                <div className="grid grid-cols-[80px_1fr]">
                  <div className="col-span-1 border-r border-outline-variant bg-surface z-10">
                    {hours.map((hour) => (
                      <div key={hour} className="time-row relative border-t border-outline-variant/40 first:border-t-0">
                        <span className="absolute top-1 right-2 text-xs font-medium text-on-surface-variant">
                          {hour}
                        </span>
                        <div className="absolute top-[30px] w-full border-t border-dashed border-outline-variant/30" />
                      </div>
                    ))}
                  </div>

                  <div className="relative" style={{ height: `${hours.length * 60}px` }}>
                    <div className="absolute inset-0 z-0 flex flex-col pointer-events-none">
                      {hours.map((_, i) => (
                        <div key={i} className="h-[60px] w-full border-t border-outline-variant/40 first:border-t-0 relative">
                          <div className="absolute top-[30px] w-full border-t border-dashed border-outline-variant/30" />
                        </div>
                      ))}
                    </div>

                    <div className="absolute inset-0 z-10">
                      {layoutDaySchedules(getSchedulesForDate(currentDate)).map(({ schedule, col, totalCols }) => (
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
                  </div>
                </div>
              </div>
            </>
          ) : view === "month" ? (
            <div className="p-4">
              <div className="flex items-center justify-center gap-3 py-3">
                <button
                  onClick={() => shiftMonth(-1)}
                  className="p-1 rounded hover:bg-surface-container-high transition-colors"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <p className="text-headline-sm font-headline-sm text-on-surface">{monthLabel}</p>
                <button
                  onClick={() => shiftMonth(1)}
                  className="p-1 rounded hover:bg-surface-container-high transition-colors"
                  aria-label="Next month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-7 border border-outline-variant rounded-t-lg overflow-hidden">
                {WEEKDAY_LABELS.map((label) => (
                  <div
                    key={label}
                    className="p-3 text-center border-r border-outline-variant last:border-r-0 bg-surface-container-high"
                  >
                    <p className="text-label-sm font-label-sm text-outline">{label}</p>
                  </div>
                ))}
              </div>

              <div className="border-l border-r border-b border-outline-variant rounded-b-lg overflow-hidden">
                {monthGridWeeks.map((week, weekIndex) => (
                  <div key={weekIndex} className="grid grid-cols-7">
                    {week.map((date, dayIndex) => {
                      const daySchedules = date ? getSchedulesForDate(date) : [];
                      const isToday = date ? date.toDateString() === new Date().toDateString() : false;
                      const hasSchedule = daySchedules.length > 0;

                      return (
                        <div
                          key={dayIndex}
                          onClick={() => {
                            if (!date) return;
                            if (!hasSchedule) {
                              setView("day");
                              setCurrentDate(date);
                            }
                          }}
                          className={`min-h-[100px] p-2 border-r border-t border-outline-variant last:border-r-0 ${
                            date ? "cursor-pointer hover:bg-surface-container-high" : "bg-surface-container-low/40"
                          }`}
                        >
                          {date && (
                            <>
                              <p
                                className={`text-label-md font-label-md mb-1 ${
                                  isToday ? "text-primary font-bold" : "text-on-surface"
                                }`}
                              >
                                {date.getDate()}
                              </p>

                              {hasSchedule && (
                                <div className="space-y-1">
                                  {daySchedules.slice(0, 3).map((schedule) => (
                                    <button
                                      key={schedule.scheduleId}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedSchedule(schedule);
                                      }}
                                      className={getInstituteChipTheme(
                                        schedule.researchGroup?.institute,
                                        selectedSchedule?.scheduleId === schedule.scheduleId
                                      )}
                                    >
                                      {schedule.researchGroup?.groupName && (
                                        <span className="block font-semibold truncate">
                                          {schedule.researchGroup.groupName}
                                        </span>
                                      )}
                                      {schedule.roomVenue && (
                                        <span className="block truncate opacity-80">
                                          {schedule.roomVenue}
                                        </span>
                                      )}
                                    </button>
                                  ))}

                                  {daySchedules.length > 3 && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setView("day");
                                        setCurrentDate(date);
                                      }}
                                      className="w-full text-left text-[11px] text-on-surface-variant px-2 hover:underline"
                                    >
                                      +{daySchedules.length - 3} more
                                    </button>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="schedule-grid border-b border-outline-variant sticky top-0 bg-surface z-20 text-center">
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

                  <div className="col-span-1 border-r border-outline-variant bg-surface z-10">
                    {hours.map((hour) => (
                      <div key={hour} className="time-row relative border-t border-outline-variant/40 first:border-t-0">
                        <span className="absolute top-1 right-2 text-xs font-medium text-on-surface-variant">
                          {hour}
                        </span>
                        <div className="absolute top-[30px] w-full border-t border-dashed border-outline-variant/30" />
                      </div>
                    ))}
                  </div>

                  <div className="col-span-6 relative" style={{ height: `${hours.length * 60}px` }}>
                    <div className="absolute inset-0 z-0 flex flex-col pointer-events-none">
                      {hours.map((_, i) => (
                        <div key={i} className="h-[60px] w-full border-t border-outline-variant/40 first:border-t-0 relative">
                          <div className="absolute top-[30px] w-full border-t border-dashed border-outline-variant/30" />
                        </div>
                      ))}
                    </div>

                    <div className="absolute inset-0 z-10 grid grid-cols-6 h-full">
                      {Array.from({ length: 6 }).map((_, dayIdx) => {
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
              </div>
            </>
          )}
        </div>
      </main>

      <ScheduleDetailPanel schedule={selectedSchedule} onClose={() => setSelectedSchedule(null)} />

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