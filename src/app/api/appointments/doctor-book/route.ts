// Doctor-initiated session (urgent / same-day allowed).
// Bypasses client same-day + 12h review rules. Client still pays before confirm/Join.
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { requireAuth } from "@/lib/requireAuth";
import { minutesToLabel, priceForService, type AvailabilitySchedule } from "@/lib/availability";
import { paymentHoldExpiresAt } from "@/lib/paymentStatus";
import { sessionStartAt } from "@/lib/sessionTime";
import { notifySessionConfirmed, sendAwaitingPaymentEmails } from "@/lib/sessionEmails";
import { createMeetForAppointment } from "@/lib/meet";
import { formatDoctorName } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseTimeToLabel(time: string): string | null {
  const t = String(time || "").trim();
  if (!t) return null;
  // Already a platform label: "9:00 AM"
  if (/^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(t)) {
    const m = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)!;
    let h = Number(m[1]) % 12;
    if (/PM/i.test(m[3])) h += 12;
    return minutesToLabel(h * 60 + Number(m[2]));
  }
  // HTML time input: "09:30" or "9:30"
  const m24 = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m24) return null;
  const h = Number(m24[1]);
  const min = Number(m24[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return minutesToLabel(h * 60 + min);
}

export async function POST(req: NextRequest) {
  try {
    const gate = await requireAuth(req);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
    if (gate.role !== "doctor" && gate.role !== "admin") {
      return NextResponse.json({ error: "Only therapists can book for a client." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const clientId = typeof body.clientId === "string" ? body.clientId.trim() : "";
    const date = typeof body.date === "string" ? body.date.trim() : "";
    const type = typeof body.type === "string" ? body.type.trim() : "";
    const notes = typeof body.notes === "string" ? body.notes.trim() : "";
    const timeLabel = parseTimeToLabel(typeof body.time === "string" ? body.time : "");

    if (!clientId || !date || !timeLabel || !type) {
      return NextResponse.json(
        { error: "clientId, date, time, and session type are required." },
        { status: 400 },
      );
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Invalid date." }, { status: 400 });
    }

    const doctorId = gate.role === "admin" && typeof body.doctorId === "string" && body.doctorId
      ? body.doctorId
      : gate.uid;

    const [clientSnap, doctorSnap, assignSnap, schedSnap] = await Promise.all([
      adminDb.collection("users").doc(clientId).get(),
      adminDb.collection("users").doc(doctorId).get(),
      adminDb.collection("assignments").doc(clientId).get(),
      adminDb.collection("schedules").doc(doctorId).get(),
    ]);

    if (!clientSnap.exists) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }
    const client = clientSnap.data()!;
    if (client.role && client.role !== "client") {
      return NextResponse.json({ error: "Selected user is not a client." }, { status: 400 });
    }

    const assignedDoctorId =
      (assignSnap.exists ? (assignSnap.data()?.doctorId as string | undefined) : undefined) ||
      (client.doctorId as string | undefined) ||
      "";
    if (gate.role !== "admin" && assignedDoctorId && assignedDoctorId !== doctorId) {
      return NextResponse.json(
        { error: "This client is assigned to another therapist." },
        { status: 403 },
      );
    }
    if (gate.role !== "admin" && !assignedDoctorId) {
      // Allow if they've had a prior appointment with this doctor
      const prior = await adminDb.collection("appointments")
        .where("doctorId", "==", doctorId)
        .where("clientId", "==", clientId)
        .limit(1)
        .get();
      if (prior.empty) {
        return NextResponse.json(
          { error: "Client must be assigned to you before you can book for them." },
          { status: 403 },
        );
      }
    }

    const start = sessionStartAt(date, timeLabel);
    if (!start) {
      return NextResponse.json({ error: "Could not parse session time." }, { status: 400 });
    }
    if (start.getTime() < Date.now() - 60_000) {
      return NextResponse.json({ error: "Choose a time in the future." }, { status: 400 });
    }

    const sched = (schedSnap.data() || null) as AvailabilitySchedule | null;
    const svc = sched?.services?.find(s => s.name === type);
    const duration =
      typeof body.duration === "number" && body.duration > 0
        ? body.duration
        : (svc?.duration ?? 60);
    const amount =
      typeof body.amount === "number" && body.amount >= 0
        ? body.amount
        : (priceForService(sched, type) ?? svc?.price ?? 0);

    const doctorName = formatDoctorName(
      doctorSnap.data()?.displayName || "Your therapist",
    );
    const clientName = (client.displayName || client.email || "Client") as string;
    const clientEmail = (client.email || "") as string;
    const isFree = amount === 0;
    const payExpiry = paymentHoldExpiresAt(new Date(), start);

    const ref = await adminDb.collection("appointments").add({
      clientId,
      clientName,
      clientEmail,
      doctorId,
      doctorName,
      type,
      date,
      time: timeLabel,
      duration,
      amount,
      notes: notes || null,
      status: isFree ? "approved" : "pending",
      paymentStatus: isFree ? "free" : "unpaid",
      doctorApprovedAt: FieldValue.serverTimestamp(),
      paymentHoldExpiresAt: isFree ? null : payExpiry,
      initiatedBy: "doctor",
      urgent: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (isFree) {
      try { await createMeetForAppointment(ref.id); } catch (e) {
        console.error("[doctor-book] meet:", e);
      }
      try { await notifySessionConfirmed(ref.id); } catch (e) {
        console.error("[doctor-book] notify:", e);
      }
      return NextResponse.json({
        ok: true,
        free: true,
        appointmentId: ref.id,
      });
    }

    try {
      await sendAwaitingPaymentEmails(ref.id, { doctorInitiated: true });
    } catch (e) {
      console.error("[doctor-book] awaiting-payment email:", e);
    }

    return NextResponse.json({
      ok: true,
      appointmentId: ref.id,
      paymentHoldExpiresAt: payExpiry,
    });
  } catch (err) {
    console.error("[doctor-book]", err);
    return NextResponse.json({ error: "Could not create the session." }, { status: 500 });
  }
}
