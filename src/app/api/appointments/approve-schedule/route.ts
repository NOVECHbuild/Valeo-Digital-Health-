// Doctor accepts the requested date/time. Client must then pay (unless free).
// Does NOT mark the appointment clinically "approved" until payment succeeds.
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { requireAuth } from "@/lib/requireAuth";
import { paymentHoldExpiresAt } from "@/lib/paymentStatus";
import { sessionStartAt } from "@/lib/sessionTime";
import { notifySessionConfirmed } from "@/lib/sessionEmails";
import { createMeetForAppointment } from "@/lib/meet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const gate = await requireAuth(req);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { appointmentId } = await req.json().catch(() => ({}));
    if (!appointmentId || typeof appointmentId !== "string") {
      return NextResponse.json({ error: "appointmentId required" }, { status: 400 });
    }

    const ref = adminDb.collection("appointments").doc(appointmentId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    const appt = snap.data()!;

    if (gate.role !== "admin" && gate.uid !== appt.doctorId) {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }
    if (appt.status === "cancelled" || appt.status === "rejected") {
      return NextResponse.json({ error: "This booking is no longer available." }, { status: 409 });
    }
    if (appt.paymentStatus === "paid" || appt.paymentStatus === "free" || appt.status === "approved") {
      return NextResponse.json({ ok: true, alreadyConfirmed: true });
    }
    if (appt.doctorApprovedAt) {
      return NextResponse.json({
        ok: true,
        alreadyApproved: true,
        paymentHoldExpiresAt: appt.paymentHoldExpiresAt ?? null,
      });
    }

    const amount = typeof appt.amount === "number" ? appt.amount : null;
    const isFree = amount === 0;

    if (isFree) {
      await ref.update({
        doctorApprovedAt:      FieldValue.serverTimestamp(),
        status:                "approved",
        paymentStatus:         "free",
        reviewHoldExpiresAt:   FieldValue.delete(),
        paymentHoldExpiresAt:  FieldValue.delete(),
        updatedAt:             FieldValue.serverTimestamp(),
      });
      try { await createMeetForAppointment(appointmentId); } catch (e) {
        console.error("[approve-schedule] meet:", e);
      }
      try { await notifySessionConfirmed(appointmentId); } catch (e) {
        console.error("[approve-schedule] notify:", e);
      }
      return NextResponse.json({ ok: true, free: true });
    }

    const start = sessionStartAt(String(appt.date || ""), String(appt.time || ""));
    const payExpiry = paymentHoldExpiresAt(new Date(), start);

    await ref.update({
      doctorApprovedAt:     FieldValue.serverTimestamp(),
      paymentStatus:        "unpaid",
      paymentHoldExpiresAt: payExpiry,
      reviewHoldExpiresAt:  FieldValue.delete(),
      updatedAt:            FieldValue.serverTimestamp(),
    });

    try {
      const { sendAwaitingPaymentEmails } = await import("@/lib/sessionEmails");
      await sendAwaitingPaymentEmails(appointmentId);
    } catch (e) {
      console.error("[approve-schedule] awaiting-payment email:", e);
    }

    return NextResponse.json({
      ok: true,
      paymentHoldExpiresAt: payExpiry,
    });
  } catch (err) {
    console.error("[approve-schedule]", err);
    return NextResponse.json({ error: "Could not approve schedule." }, { status: 500 });
  }
}
