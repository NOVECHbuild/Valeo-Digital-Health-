// src/app/api/meet/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAuth } from "@/lib/requireAuth";
import { createMeetForAppointment } from "@/lib/meet";

export async function POST(req: NextRequest) {
  try {
    const { appointmentId } = await req.json();
    if (!appointmentId) {
      return NextResponse.json({ error: "appointmentId required" }, { status: 400 });
    }

    const apptSnap = await adminDb.collection("appointments").doc(appointmentId).get();
    if (!apptSnap.exists) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }
    const appt = apptSnap.data()!;

    // Only the appointment's doctor (or admin) may create its Meet link.
    const gate = await requireAuth(req);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
    if (gate.role !== "admin" && gate.uid !== appt.doctorId) {
      return NextResponse.json({ error: "Not authorized for this appointment." }, { status: 403 });
    }

    const result = await createMeetForAppointment(appointmentId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      meetLink:        result.meetLink,
      calendarEventId: result.calendarEventId,
    });
  } catch (err: any) {
    console.error("[meet/create]", err);
    const msg = err?.message ?? "Internal error";
    const status = err?.code === "GOOGLE_NOT_CONNECTED" || err?.status === 503 ? 503 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
