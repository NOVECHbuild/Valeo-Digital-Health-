import { labelToMinutes } from "@/lib/availability";

/** Barbados/AST — no DST; matches platform booking timezone default. */
const SESSION_TZ_OFFSET = "-04:00";

/**
 * Session start as a Date (UTC instant) from YYYY-MM-DD + "9:00 AM" label.
 * Safe for server and client.
 */
export function sessionStartAt(date: string, timeLabel: string): Date | null {
  if (!date || !timeLabel) return null;
  const mins = labelToMinutes(timeLabel);
  if (mins < 0) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const iso = `${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00${SESSION_TZ_OFFSET}`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}
