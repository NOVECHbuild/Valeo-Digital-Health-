import { labelToMinutes } from "@/lib/availability";

/** Barbados/AST — no DST; platform default when no offset is provided. */
export const SESSION_TZ_OFFSET_MINUTES = 240; // UTC-4 → getTimezoneOffset()-style minutes

/**
 * Session start as a UTC Date from YYYY-MM-DD + "9:00 AM" label.
 *
 * `timezoneOffsetMinutes` uses the same sign as `Date#getTimezoneOffset()`:
 * minutes to add to local wall time to get UTC (e.g. AST/EDT = 240).
 */
export function sessionStartAt(
  date: string,
  timeLabel: string,
  timezoneOffsetMinutes: number = SESSION_TZ_OFFSET_MINUTES,
): Date | null {
  if (!date || !timeLabel) return null;
  const mins = labelToMinutes(timeLabel);
  if (mins < 0) return null;

  const parts = date.split("-").map(Number);
  if (parts.length !== 3 || parts.some(n => !Number.isFinite(n))) return null;
  const [y, mo, d] = parts;
  const h = Math.floor(mins / 60);
  const m = mins % 60;

  const offset = Number.isFinite(timezoneOffsetMinutes)
    ? timezoneOffsetMinutes
    : SESSION_TZ_OFFSET_MINUTES;

  // Treat h:m as wall-clock in the given offset, then convert to UTC.
  const utcMs = Date.UTC(y, mo - 1, d, h, m, 0) + offset * 60_000;
  const out = new Date(utcMs);
  return Number.isNaN(out.getTime()) ? null : out;
}
