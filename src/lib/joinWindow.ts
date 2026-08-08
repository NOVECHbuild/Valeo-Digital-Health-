"use client";

import { useEffect, useState } from "react";
import { labelToMinutes } from "@/lib/availability";

/** Clients may join from this many minutes before session start. */
export const JOIN_EARLY_MINUTES = 30;

/**
 * Keep Join available after scheduled end — sessions run over, and Meet links
 * are sometimes created late after payment confirms.
 */
export const JOIN_LATE_GRACE_MINUTES = 90;

/** Barbados/AST — no DST; matches platform booking timezone default. */
const SESSION_TZ_OFFSET = "-04:00";

export type JoinPhase = "unavailable" | "too_early" | "open" | "ended";

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

export function joinPhase(opts: {
  date?: string | null;
  time?: string | null;
  duration?: number | null;
  meetLink?: string | null;
  status?: string | null;
  now?: Date | number;
}): JoinPhase {
  if (!opts.meetLink) return "unavailable";
  if (opts.status && !["approved", "pending"].includes(opts.status)) return "unavailable";

  const start = sessionStartAt(opts.date || "", opts.time || "");
  if (!start) return "unavailable";

  const durationMs = Math.max(1, opts.duration ?? 60) * 60 * 1000;
  const openAt = start.getTime() - JOIN_EARLY_MINUTES * 60 * 1000;
  const closeAt = start.getTime() + durationMs + JOIN_LATE_GRACE_MINUTES * 60 * 1000;
  const now = opts.now instanceof Date ? opts.now.getTime() : (opts.now ?? Date.now());

  if (now < openAt) return "too_early";
  if (now > closeAt) return "ended";
  return "open";
}

export function canJoinSession(opts: {
  date?: string | null;
  time?: string | null;
  duration?: number | null;
  meetLink?: string | null;
  status?: string | null;
  now?: Date | number;
}): boolean {
  return joinPhase(opts) === "open";
}

export function joinPhaseMessage(phase: JoinPhase): string | null {
  if (phase === "too_early") {
    return `Join opens ${JOIN_EARLY_MINUTES} minutes before your session.`;
  }
  if (phase === "ended") {
    return "This join window has closed. Contact your therapist if you still need to connect.";
  }
  if (phase === "unavailable") {
    return "Your video link will appear here once the session is ready.";
  }
  return null;
}

/** Live-updating join gate for client UI (rechecks every 15s). */
export function useCanJoinSession(appt: {
  date?: string | null;
  time?: string | null;
  duration?: number | null;
  meetLink?: string | null;
  status?: string | null;
} | null | undefined): boolean {
  return useJoinPhase(appt) === "open";
}

export function useJoinPhase(appt: {
  date?: string | null;
  time?: string | null;
  duration?: number | null;
  meetLink?: string | null;
  status?: string | null;
} | null | undefined): JoinPhase {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  if (!appt) return "unavailable";
  return joinPhase({ ...appt, now });
}
