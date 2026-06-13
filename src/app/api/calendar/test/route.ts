// src/app/api/calendar/test/route.ts
// Verifies a doctor's Google Calendar connection (their own token if connected,
// otherwise the shared account). Used by the doctor's "Connect" panel.
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getDoctorAuth, doctorHasOwnCalendar } from "@/lib/googleAuth";
import { requireAuth } from "@/lib/requireAuth";

export async function GET(req: NextRequest) {
  const doctorId = req.nextUrl.searchParams.get("doctorId") ?? undefined;
  try {
    const gate = await requireAuth(req);
    if (!gate.ok) return NextResponse.json({ ok: false, connected: false, error: gate.error }, { status: gate.status });
    if (gate.role !== "admin" && gate.uid !== doctorId) {
      return NextResponse.json({ ok: false, connected: false, error: "Not authorized." }, { status: 403 });
    }
    const hasOwn = await doctorHasOwnCalendar(doctorId);
    if (!hasOwn && !process.env.GOOGLE_REFRESH_TOKEN) {
      return NextResponse.json(
        { ok: false, connected: false, error: "Google Calendar is not connected yet." },
        { status: 200 }
      );
    }
    const calendar = google.calendar({ version: "v3", auth: await getDoctorAuth(doctorId) });
    const res = await calendar.calendarList.list({ maxResults: 1 });
    const primary = res.data.items?.[0]?.summary ?? res.data.items?.[0]?.id ?? "primary";
    return NextResponse.json({ ok: true, connected: true, calendar: primary, own: hasOwn });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, connected: false, error: err?.message ?? "Could not reach Google Calendar." },
      { status: 200 }
    );
  }
}
