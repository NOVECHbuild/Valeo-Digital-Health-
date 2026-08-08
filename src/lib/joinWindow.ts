"use client";

import { useEffect, useState } from "react";
import { labelToMinutes } from "@/lib/availability";

/** Clients may join from this many minutes before session start. */
export const JOIN_EARLY_MINUTES = 30;

/** Barbados/AST — no DST; matches platform booking timezone default. */
const SESSION_TZ_OFFSET = "-04:00";

/**
 * Session start as a Date (UTC instant) from YYYY-MM-DD + "9:00 AM" label.
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

export function canJoinSession(opts: {
  date?: string | null;
  time?: string | null;
  duration?: number | null;
  now?: Date | number;
}): boolean {
  const start = sessionStartAt(opts.date || "", opts.time || "");
  if (!start) return false;
  const durationMs = Math.max(1, opts.duration ?? 60) * 60 * 1000;
  const openAt = start.getTime() - JOIN_EARLY_MINUTES * 60 * 1000;
  const closeAt = start.getTime() + durationMs;
  const now = opts.now instanceof Date ? opts.now.getTime() : (opts.now ?? Date.now());
  return now >= openAt && now <= closeAt;
}

/** Live-updating join gate for client UI (rechecks every 30s). */
export function useCanJoinSession(appt: {
  date?: string | null;
  time?: string | null;
  duration?: number | null;
  meetLink?: string | null;
  status?: string | null;
} | null | undefined): boolean {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  if (!appt?.meetLink) return false;
  if (appt.status && !["approved", "pending"].includes(appt.status)) return false;
  return canJoinSession({
    date: appt.date,
    time: appt.time,
    duration: appt.duration,
    now,
  });
}
