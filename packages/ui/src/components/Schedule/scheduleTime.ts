// ─── Grid constants (shared by calendar layout + drag/resize gestures) ───────
// The time grid always runs from 07:00 to 19:00 (07:00 is the top, 19:00 bottom).

export const GRID_START_MIN = 7 * 60; // 07:00
export const GRID_END_MIN = 19 * 60; // 19:00
export const GRID_SNAP_MIN = 30; // drag/resize snaps to 30-minute steps
export const GRID_MIN_DURATION = 30; // smallest allowed schedule block

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export function clampMinutes(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function snapToGrid(value: number, snap = GRID_SNAP_MIN): number {
  return Math.round(value / snap) * snap;
}
