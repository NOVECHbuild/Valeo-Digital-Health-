// ════════════════════════════════════════════════════════════════════════════
//  Availability — shared types + slot generation
//  Used by the client booking page (to show real available times) and matches
//  the schedule the doctor saves in schedules/{doctorId}.
// ════════════════════════════════════════════════════════════════════════════

export type DayKey =
  | "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday";

export interface DaySchedule { enabled: boolean; slots: { start: string; end: string }[]; }

// A service a doctor offers. Doctors manage these in Schedule → Services.
export interface Service {
  id:          string;
  name:        string;
  duration:    number;   // minutes
  price:       number;   // in platform currency (USD shown to clients)
  description?: string;
  active:      boolean;
}

export interface AvailabilitySchedule {
  availability:    Record<DayKey, DaySchedule>;
  slotDuration:    number;
  bufferTime:      number;
  maxAdvanceDays:  number;
  timezone:        string;
  blockedDates:    string[];
  sessionPricing:  Record<string, number>;   // legacy — kept for back-compat
  services?:       Service[];
  googleCalendarId?: string;
}

// The original platform service menu — used to seed a doctor's first list and as
// the fallback when a doctor hasn't defined any services yet.
export const DEFAULT_SERVICES: Service[] = [
  { id: "individual",   name: "Individual Therapy", duration: 60, price: 150, description: "One-on-one therapy session",         active: true },
  { id: "couples",      name: "Couples Therapy",    duration: 90, price: 200, description: "Therapy for couples",                active: true },
  { id: "coaching",     name: "Life Coaching",      duration: 60, price: 120, description: "Goal-focused coaching session",      active: true },
  { id: "workplace",    name: "Workplace Wellness", duration: 60, price: 180, description: "Workplace mental health support",    active: true },
  { id: "consultation", name: "Free Consultation",  duration: 15, price: 0,   description: "Initial 15-minute consultation",     active: true },
];

// Seed the default list, applying any prices the doctor already saved (legacy
// sessionPricing). Used when a doctor has no services array yet.
function seededDefaults(schedule?: AvailabilitySchedule | null): Service[] {
  return DEFAULT_SERVICES.map(s => ({
    ...s,
    price: schedule?.sessionPricing?.[s.name] ?? s.price,
  }));
}

// Services a CLIENT can book: the doctor's own active services, else the defaults.
export function bookableServices(schedule?: AvailabilitySchedule | null): Service[] {
  if (schedule?.services && schedule.services.length > 0) {
    return schedule.services.filter(s => s.active !== false);
  }
  return seededDefaults(schedule);
}

// Full list (incl. inactive) for the doctor's manager — seeded if empty.
export function servicesForEditing(schedule?: AvailabilitySchedule | null): Service[] {
  if (schedule?.services && schedule.services.length > 0) return schedule.services;
  return seededDefaults(schedule);
}

// Resolve a service's price by name (server-authoritative pricing lookup).
export function priceForService(schedule: AvailabilitySchedule | null | undefined, name: string): number | undefined {
  const svc = schedule?.services?.find(s => s.name === name);
  if (svc && typeof svc.price === "number") return svc.price;
  return schedule?.sessionPricing?.[name];
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

/** True when a schedules/{id} doc has real weekly hours (not Google-only stub). */
export function isUsableSchedule(data: unknown): data is AvailabilitySchedule {
  if (!data || typeof data !== "object") return false;
  const avail = (data as AvailabilitySchedule).availability;
  if (!avail || typeof avail !== "object") return false;
  return DAY_KEYS.some((k) => {
    const day = avail[k];
    return !!day?.enabled && Array.isArray(day.slots) && day.slots.length > 0;
  });
}

/**
 * Whether a calendar day can be selected for booking.
 * When `schedule` is null, falls back to Mon–Fri (legacy).
 */
export function isDateBookable(
  schedule: AvailabilitySchedule | null | undefined,
  dateStr: string,
  today?: Date,
): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr + "T12:00:00");
  if (Number.isNaN(d.getTime())) return false;

  const start = today ? new Date(today) : new Date();
  start.setHours(0, 0, 0, 0);
  if (d < start) return false;

  if (!schedule || !isUsableSchedule(schedule)) {
    const day = d.getDay();
    return day !== 0 && day !== 6;
  }

  if (Array.isArray(schedule.blockedDates) && schedule.blockedDates.includes(dateStr)) {
    return false;
  }

  const max = Number(schedule.maxAdvanceDays);
  if (Number.isFinite(max) && max > 0) {
    const latest = new Date(start);
    latest.setDate(latest.getDate() + max);
    if (d > latest) return false;
  }

  const dayKey = DAY_KEYS[d.getDay()];
  const day = schedule.availability?.[dayKey];
  return !!day?.enabled && Array.isArray(day.slots) && day.slots.length > 0;
}

// All bookable start labels for a given ISO date (e.g. "2026-06-20"),
// honouring the day's enabled hours and blocked dates. Returns [] if unavailable.
// `serviceDuration` (minutes) ensures a slot is only offered if the chosen
// service actually fits before the working window closes; slots are still
// spaced by the doctor's slotDuration + buffer.
export function availableSlotsForDate(
  avail: AvailabilitySchedule,
  dateStr: string,
  serviceDuration?: number,
): string[] {
  if (!avail || !dateStr) return [];
  if (Array.isArray(avail.blockedDates) && avail.blockedDates.includes(dateStr)) return [];

  // Use noon to avoid timezone date-shift when deriving the weekday.
  const weekday = new Date(dateStr + "T12:00:00").getDay();
  const dayKey  = DAY_KEYS[weekday];
  const day     = avail.availability?.[dayKey];
  if (!day || !day.enabled) return [];

  const slotDur = avail.slotDuration ?? 60;
  const buf     = avail.bufferTime ?? 0;
  const fitDur  = serviceDuration ?? slotDur;   // the service must fit before window end
  const step    = slotDur + buf;

  const labels: string[] = [];
  for (const s of day.slots) {
    const [sh, sm] = s.start.split(":").map(Number);
    const [eh, em] = s.end.split(":").map(Number);
    const s0 = sh * 60 + sm, e0 = eh * 60 + em;
    for (let t = s0; t + fitDur <= e0; t += step) labels.push(minutesToLabel(t));
  }
  return Array.from(new Set(labels));
}

// True if [startMin, startMin+dur) overlaps any of the given minute-intervals.
export function overlapsAny(startMin: number, dur: number, intervals: { start: number; end: number }[]): boolean {
  const end = startMin + dur;
  return intervals.some(iv => startMin < iv.end && end > iv.start);
}
