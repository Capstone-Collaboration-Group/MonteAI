
```TypeScript 
//packages/ui/src/components/ScheduleCalendar.tsx

// this page imported the components
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
    const rooms = new Set(schedules.map((s) => s.roomVenue).filter(Boolean));
    return Array.from(rooms).sort();
  }, [schedules]);

  // Filter schedules by selected room
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
     // .. INside code
    </div>
  );
}
```

```TypeScript
//packages/ui/src/pages
import { useSchedules } from "@monteai/hooks";
import type { ScheduleService } from "@monteai/api";
import { ScheduleCalendar } from "../components/Schedule";

interface SchedulePageProps { 
    scheduleService: ScheduleService;
    onCreateNew?: () => VideoDecoder;
}

export function SchedulePage({ scheduleService, onCreateNew }: SchedulePageProps) { 
    const { data: schedules = [], isLoading } = useSchedules(scheduleService);

    return <ScheduleCalendar schedules={schedules} isLoading={isLoading} onCreateNew={onCreateNew} />;
}  
```

```TypeScript
//apps/desktop/renderer/pages/Schedule.tsx
import { SchedulePage } from "@monteai/ui";
import { scheduleService } from "../lib/scheduleService";

export default function Schedule() {
  return <SchedulePage scheduleService={scheduleService} />;
}

```

```TypeScript 
// apps/desktop/renderer/lib/scheduleService
import { createApiClient, createScheduleService } from "@monteai/api";

const client = createApiClient({ baseURL: import.meta.env.VITE_API_BASE_URL });

export const scheduleService = createScheduleService(
  client,
  import.meta.env.VITE_USE_MOCK_SCHEDULE === "true"
);
```






