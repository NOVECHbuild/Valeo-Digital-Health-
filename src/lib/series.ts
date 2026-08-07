// Weekly appointment series helpers (v1 — soft-linked independent appointments).

import {
  availableSlotsForDate,
  labelToMinutes,
  overlapsAny,
  type AvailabilitySchedule,
} from "@/lib/availability";

export const SERIES_MIN = 2;
export const SERIES_MAX = 8;
export const SERIES_DEFAULT = 4;

export type SeriesSkipReason = "blocked" | "outside_hours" | "booked" | "calendar";

export type SeriesOccurrence = {
  date: string;
  time: string;
  available: boolean;
  reason?: SeriesSkipReason;
};

/** Expand start ISO date (YYYY-MM-DD) into weekly dates for `count` occurrences. */
export function expandWeeklyDates(startDate: string, count: number): string[] {
  const n = Math.max(1, Math.min(SERIES_MAX, Math.floor(count) || 1));
  const base = new Date(startDate + "T12:00:00");
  if (Number.isNaN(base.getTime())) return [];
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i * 7);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${day}`);
  }
  return out;
}

/** True if the doctor's schedule (or fallback slot list) offers this start time on `date`. */
export function isSlotOnSchedule(
  schedule: AvailabilitySchedule | null | undefined,
  date: string,
  time: string,
  duration: number,
  fallbackSlots: string[],
): boolean {
  if (!date || !time) return false;
  const slots = schedule
    ? availableSlotsForDate(schedule, date, duration)
    : fallbackSlots;
  return slots.includes(time);
}

/**
 * Synchronous schedule/booked check for one occurrence.
 * Calendar (Google freebusy) is layered separately by the caller.
 */
export function evaluateSeriesOccurrence(opts: {
  date: string;
  time: string;
  duration: number;
  schedule: AvailabilitySchedule | null | undefined;
  fallbackSlots: string[];
  bookedIntervals: { start: number; end: number }[];
}): SeriesOccurrence {
  const { date, time, duration, schedule, fallbackSlots, bookedIntervals } = opts;
  if (!isSlotOnSchedule(schedule, date, time, duration, fallbackSlots)) {
    const blocked = Array.isArray(schedule?.blockedDates) && schedule!.blockedDates.includes(date);
    return {
      date,
      time,
      available: false,
      reason: blocked ? "blocked" : "outside_hours",
    };
  }
  if (overlapsAny(labelToMinutes(time), duration, bookedIntervals)) {
    return { date, time, available: false, reason: "booked" };
  }
  return { date, time, available: true };
}

export function seriesChipLabel(index?: number, count?: number): string | null {
  if (!index || !count) return null;
  return `Series · ${index}/${count}`;
}
