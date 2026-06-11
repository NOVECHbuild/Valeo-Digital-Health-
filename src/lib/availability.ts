// ════════════════════════════════════════════════════════════════════════════
//  Availability — shared types + slot generation
//  Used by the client booking page (to show real available times) and matches
//  the schedule the doctor saves in schedules/{doctorId}.
// ════════════════════════════════════════════════════════════════════════════

export type DayKey =
  | "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday";

export interface DaySchedule { enabled: boolean; slots: { start: string; end: string }[]; }

export interface AvailabilitySchedule {
  availability:    Record<DayKey, DaySchedule>;
  slotDuration:    number;
  bufferTime:      number;
  maxAdvanceDays:  number;
  timezone:        string;
  blockedDates:    string[];
  sessionPricing:  Record<string, number>;
  googleCalendarId?: string;
}

// JS Date.getDay() returns 0=Sunday … 6=Saturday — index this array with it.
export const DAY_KEYS: DayKey[] = [
  "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
];

// Format minutes-since-midnight as a 12-hour label, e.g. 540 → "9:00 AM".
export function minutesToLabel(tt: number): string {
  const hh = Math.floor(tt / 60), mm = tt % 60;
  const ap = hh >= 12 ? "PM" : "AM";
  const h12 = hh > 12 ? hh - 12 : hh === 0 ? 12 : hh;
  return `${h12}:${String(mm).padStart(2, "0")} ${ap}`;
}

// Parse a "9:00 AM" label back to minutes-since-midnight.
export function labelToMinutes(label: string): number {
  const m = label.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return 0;
  let h = Number(m[1]) % 12;
  const min = Number(m[2]);
  if (/PM/i.test(m[3])) h += 12;
  return h * 60 + min;
}

// Generate the START labels for a window, e.g. ("09:00","12:00",30,0) → ["9:00 AM","9:30 AM",…].
export function genStartSlots(start: string, end: string, dur: number, buf: number): string[] {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const s0 = sh * 60 + sm, e0 = eh * 60 + em, step = dur + buf;
  const out: string[] = [];
  for (let t = s0; t + dur <= e0; t += step) out.push(minutesToLabel(t));
  return out;
}

// All bookable start labels for a given ISO date (e.g. "2026-06-20"),
// honouring the day's enabled hours and blocked dates. Returns [] if unavailable.
export function availableSlotsForDate(avail: AvailabilitySchedule, dateStr: string): string[] {
  if (!avail || !dateStr) return [];
  if (Array.isArray(avail.blockedDates) && avail.blockedDates.includes(dateStr)) return [];

  // Use noon to avoid timezone date-shift when deriving the weekday.
  const weekday = new Date(dateStr + "T12:00:00").getDay();
  const dayKey  = DAY_KEYS[weekday];
  const day     = avail.availability?.[dayKey];
  if (!day || !day.enabled) return [];

  const dur = avail.slotDuration ?? 60;
  const buf = avail.bufferTime ?? 0;
  const labels = day.slots.flatMap(s => genStartSlots(s.start, s.end, dur, buf));
  // De-dupe while preserving order
  return Array.from(new Set(labels));
}
