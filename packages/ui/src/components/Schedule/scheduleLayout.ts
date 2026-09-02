import type { ScheduleResponseDto } from "@monteai/types";

export interface LaidOutSchedule {
  schedule: ScheduleResponseDto;
  col: number;
  totalCols: number;
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Assigns each schedule a column index within overlapping clusters,
 * so same-day events that don't overlap in time can share full width,
 * and events that DO overlap sit side-by-side instead of stacking.
 */
export function layoutDaySchedules(schedules: ScheduleResponseDto[]): LaidOutSchedule[] {
  const sorted = [...schedules].sort(
    (a, b) => toMinutes(a.startTime) - toMinutes(b.startTime)
  );

  const result: LaidOutSchedule[] = [];
  let cluster: { schedule: ScheduleResponseDto; col: number }[] = [];
  let clusterEnd = -Infinity;

  const flushCluster = () => {
    if (cluster.length === 0) return;
    const totalCols = Math.max(...cluster.map((c) => c.col)) + 1;
    cluster.forEach((c) => result.push({ schedule: c.schedule, col: c.col, totalCols }));
    cluster = [];
  };

  const colEndTimes: number[] = [];

  for (const schedule of sorted) {
    const start = toMinutes(schedule.startTime);
    const end = toMinutes(schedule.endingTime);

    if (start >= clusterEnd) {
      flushCluster();
      colEndTimes.length = 0;
      clusterEnd = -Infinity;
    }

    let col = colEndTimes.findIndex((endTime) => endTime <= start);
    if (col === -1) {
      col = colEndTimes.length;
    }
    colEndTimes[col] = end;
    clusterEnd = Math.max(clusterEnd, end);

    cluster.push({ schedule, col });
  }
  flushCluster();

  return result;
}