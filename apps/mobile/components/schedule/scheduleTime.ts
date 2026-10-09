// apps/mobile/components/schedule/scheduleTime.ts
// Time-grid + date helpers shared by the day/week/month schedule views.
// Mirrors packages/ui/src/components/Schedule/scheduleTime.ts (web): the
// calendar grid runs 07:00–19:00 with 1px ≈ 1 minute (60px per hour).

export const GRID_START_MIN = 7 * 60;
export const GRID_END_MIN = 19 * 60;
export const GRID_HEIGHT_MIN = GRID_END_MIN - GRID_START_MIN;
export const HOUR_HEIGHT = 60;
export const TIME_COLUMN_WIDTH = 48;

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parses an API date string ("YYYY-MM-DD…") as a LOCAL date. Avoids the
 * UTC off-by-one day that `new Date("YYYY-MM-DD")` produces west of GMT.
 */
export function parseDateKey(dateLike: string): Date {
  const [y, m, d] = dateLike.slice(0, 10).split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Monday–Saturday week containing `date` (same window as the web calendar). */
export function getWeekDates(date: Date): Date[] {
  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() + diffToMonday);
  return Array.from({ length: 6 }, (_, i) =>
    new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i),
  );
}

export const HOUR_LABELS = Array.from({ length: 12 }, (_, i) => {
  const hour = 7 + i;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : hour;
  return `${displayHour} ${ampm}`;
});
