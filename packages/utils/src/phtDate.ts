// Timeline timestamps arrive in two shapes: server UTC instants carry a "Z"
// offset, while defense-schedule wall times (Schedule.Date + StartTime) arrive
// offset-less and mean Philippine time. Both are normalized to Manila so the
// timeline shows the real time zone regardless of the viewer's machine.

const PHT = "Asia/Manila";

function parsePht(iso: string): Date {
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(iso);
  return new Date(hasZone ? iso : `${iso}+08:00`);
}

/** "October 20, 2026" in Philippine time. Returns "" for invalid input. */
export function formatPhtDate(iso: string): string {
  const d = parsePht(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: PHT,
  });
}

/** "11:11 AM PHT" — the short zone name makes the displayed zone explicit. */
export function formatPhtTime(iso: string): string {
  const d = parsePht(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: PHT,
    timeZoneName: "short",
  });
}
