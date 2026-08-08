// src/app/api/calendar/freebusy/route.ts
// Returns which candidate slot labels conflict with the doctor's Google Calendar
// busy times for a given day. Designed to FAIL SAFE: any error returns an empty
// conflict list with connected:false, so the booking UI falls back to the
// platform's own availability (Layer 1) and never breaks.
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getDoctorAuth } from "@/lib/googleAuth";
import { requireAuth } from "@/lib/requireAuth";
import { expireUnpaidPaymentHolds } from "@/lib/expirePaymentHolds";

// Parse an ISO instant into { date:"YYYY-MM-DD", min } in a specific timezone.
function tzParts(iso: string, tz: string): { date: string; min: number } {
  const d = new Date(iso);
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(d).reduce((acc, x) => { acc[x.type] = x.value; return acc; }, {} as Record<string, string>);
  const hour = (p.hour === "24" ? "0" : p.hour);
  return { date: `${p.year}-${p.month}-${p.day}`, min: Number(hour) * 60 + Number(p.minute) };
}

// "9:00 AM" → minutes since midnight
function labelToMinutes(label: string): number {
  const m = label.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return -1;
  let h = Number(m[1]) % 12;
  if (/PM/i.test(m[3])) h += 12;
  return h * 60 + Number(m[2]);
}

export async function POST(req: NextRequest) {
  try {
    // Release abandoned unpaid holds so slots reopen promptly.
    try { await expireUnpaidPaymentHolds(); } catch { /* non-blocking */ }

    // Require a signed-in caller; fail safe (no conflicts) rather than erroring.
    const gate = await requireAuth(req);
    if (!gate.ok) return NextResponse.json({ connected: false, busy: [] });

    const { date, slots, duration, timezone, calendarId, doctorId } = await req.json();
    const tz  = timezone || "America/Barbados";
    const dur = Number(duration) || 60;
    const cal = calendarId || "primary";

    if (!date || !Array.isArray(slots) || slots.length === 0) {
      return NextResponse.json({ connected: true, busy: [] });
    }

    // Query a window wide enough to capture the doctor's local day in any timezone.
    const dayStartUtc = new Date(`${date}T00:00:00Z`).getTime();
    const timeMin = new Date(dayStartUtc - 24 * 3600 * 1000).toISOString();
    const timeMax = new Date(dayStartUtc + 48 * 3600 * 1000).toISOString();

    // Use THIS doctor's Google connection (falls back to the shared account).
    const calendar = google.calendar({ version: "v3", auth: await getDoctorAuth(doctorId) });
    const fb = await calendar.freebusy.query({
      requestBody: { timeMin, timeMax, timeZone: tz, items: [{ id: cal }] },
    });

    const busyRaw = fb.data.calendars?.[cal]?.busy ?? [];

    // Convert busy intervals to minute-ranges on the requested local date.
    const ranges: [number, number][] = [];
    for (const b of busyRaw) {
      if (!b.start || !b.end) continue;
      const s = tzParts(b.start, tz);
      const e = tzParts(b.end, tz);
      if (e.date < date || s.date > date) continue;          // no overlap with target day
      const startMin = s.date < date ? 0 : s.min;
      const endMin   = e.date > date ? 1440 : e.min;
      if (endMin > startMin) ranges.push([startMin, endMin]);
    }

    // A slot conflicts if [start, start+dur) overlaps any busy range.
    const conflicts = (slots as string[]).filter(label => {
      const ls = labelToMinutes(label);
      if (ls < 0) return false;
      const le = ls + dur;
      return ranges.some(([a, c]) => ls < c && le > a);
    });

    return NextResponse.json({ connected: true, busy: conflicts });
  } catch (err: any) {
    // Fail safe — never block booking because of a calendar error.
    console.error("[calendar/freebusy]", err?.message ?? err);
    return NextResponse.json({ connected: false, busy: [] });
  }
}
