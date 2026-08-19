import { useSchedules } from "@monteai/hooks";
import type { ScheduleService } from "@monteai/api";
import {
  ScheduleCalendar,
  ScheduleCalendarSkeleton,
} from "../components/Schedule";

interface SchedulePageProps {
  scheduleService: ScheduleService;
  onCreateNew?: () => VideoDecoder;
}

export function SchedulePage({
  scheduleService,
  onCreateNew,
}: SchedulePageProps) {
  const { data: schedules = [], isLoading } = useSchedules(scheduleService);

  if (isLoading) {
    return <ScheduleCalendarSkeleton />;
  }

  return (
    <ScheduleCalendar
      schedules={schedules}
      isLoading={isLoading}
      onCreateNew={onCreateNew}
    />
  );
}
