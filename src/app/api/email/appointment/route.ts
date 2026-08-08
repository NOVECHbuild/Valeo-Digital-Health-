// src/app/api/email/appointment/route.ts
// Sends appointment lifecycle emails. Fail-safe: never throws back to the caller
// in a way that blocks the user action — the client fires these and ignores errors.
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { sendEmail, renderEmail, prefAllows, formatDoctorName, esc } from "@/lib/email";
import { requireAuth } from "@/lib/requireAuth";
import { rateLimit } from "@/lib/rateLimit";
import { sendPushToUser } from "@/lib/pushServer";
import { resolveDoctorEmail } from "@/lib/resolveDoctorEmail";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.valeoexperience.com";

function prettyDate(date: string): string {
  try {
    return new Date(date + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });
  } catch { return date; }
}

export async function POST(req: NextRequest) {
  try {
    const { appointmentId, event, cancelledBy } = await req.json();
    if (!appointmentId || !event) {
      return NextResponse.json({ error: "appointmentId and event required" }, { status: 400 });
    }

    const apptSnap = await adminDb.collection("appointments").doc(appointmentId).get();
    if (!apptSnap.exists) return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    const appt = apptSnap.data()!;

    // Only a participant on the appointment (or admin) may trigger its emails.
    const gate = await requireAuth(req);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
    if (gate.role !== "admin" && gate.uid !== appt.clientId && gate.uid !== appt.doctorId) {
      return NextResponse.json({ error: "Not authorized for this appointment." }, { status: 403 });
    }
    if (!rateLimit(`email:${gate.uid}`, 30, 60_000)) {
      return NextResponse.json({ ok: false, error: "Too many requests." }, { status: 429 });
    }

    const clientSnap = await adminDb.collection("users").doc(appt.clientId).get();
    const client     = clientSnap.data() ?? {};
    const clientEmail = client.email || appt.clientEmail;
    const clientFirst = (client.displayName || appt.clientName || "there").split(" ")[0];

    // Resolve doctor email: Firestore → Auth → DOCTOR_EMAIL (fixes silent skips)
    const doctorResolved = await resolveDoctorEmail(appt.doctorId);
    const doctorName = formatDoctorName(doctorResolved.displayName || appt.doctorName) || "your therapist";
    const doctorEmail = doctorResolved.email;
    if (!doctorEmail) {
      console.warn("[email/appointment] no doctor email", {
        appointmentId, doctorId: appt.doctorId, event,
      });
    }

    const when = `${prettyDate(appt.date)} at ${appt.time}`;
    const details = [
      { label: "Session", value: appt.type || "Therapy session" },
      { label: "Date & time", value: when },
      ...(appt.duration ? [{ label: "Duration", value: `${appt.duration} minutes` }] : []),
    ];
    const apptLink = `${APP_URL}/client/appointments`;
    const clientAllows = prefAllows(client.notifPrefs, "emailAppointments");
    const results: any[] = [];

    if (event === "requested") {
      // Client confirmation
      if (clientEmail && clientAllows) {
        results.push(await sendEmail({
          to: clientEmail,
          subject: "We received your session request — Valeo Experience",
          html: renderEmail({
            heading: "Request received",
            greeting: `Hi ${clientFirst},`,
            paragraphs: [
              `Thank you for booking with Valeo Experience. We've received your session request and ${esc(doctorName)} will review the time within about 12 hours.`,
              "Once they approve, you'll be asked to pay to confirm your session. Payment must be completed within 24 hours (and before the session starts).",
            ],
            details,
            cta: { label: "View my appointments", url: apptLink },
          }),
        }));
      }
      // Doctor alert (always notify staff)
      if (doctorEmail) {
        results.push(await sendEmail({
          to: doctorEmail,
          subject: `New session request — ${appt.clientName}`,
          html: renderEmail({
            heading: "New appointment request",
            paragraphs: [
              `${esc(appt.clientName)} has requested a session. Please approve or decline within 12 hours — the slot is held for you until then.`,
              "After you approve, the client will be asked to pay to confirm.",
            ],
            details,
            cta: { label: "Open schedule", url: `${APP_URL}/doctor/schedule` },
          }),
        }));
      }
    }

    else if (event === "approved") {
      const hasMeet = !!appt.meetLink;
      if (clientEmail && clientAllows) {
        results.push(await sendEmail({
          to: clientEmail,
          subject: "Your session is confirmed — Valeo Experience",
          html: renderEmail({
            heading: "Session confirmed",
            greeting: `Hi ${clientFirst},`,
            paragraphs: [
              `Good news — ${esc(doctorName)} has confirmed your session.`,
              hasMeet
                ? "Your Meet link is ready — use the button below to join at your appointment time."
                : "Your video link will be available in your appointments before the session.",
            ],
            details,
            cta: hasMeet ? { label: "Join Session", url: appt.meetLink } : { label: "View my appointments", url: apptLink },
          }),
        }));
      }
      if (doctorEmail) {
        results.push(await sendEmail({
          to: doctorEmail,
          subject: `Session confirmed — ${appt.clientName || "Client"}`,
          html: renderEmail({
            heading: "Session confirmed",
            paragraphs: [
              `You confirmed a session with ${esc(appt.clientName || "your client")}.`,
              hasMeet
                ? "The Meet link is ready for both of you."
                : "Manage the Meet link from your schedule if needed.",
            ],
            details,
            cta: { label: "Open schedule", url: `${APP_URL}/doctor/schedule` },
          }),
        }));
      }
      if (appt.clientId) {
        results.push(await sendPushToUser(appt.clientId, {
          title: "Session confirmed",
          body: `Your session on ${appt.date} at ${appt.time} is confirmed.`,
          url: apptLink,
          prefKey: "pushAppointments",
        }));
      }
    }

    else if (event === "cancelled") {
      const by = cancelledBy || appt.cancelledBy || "client";
      if (by === "client" && doctorEmail) {
        // Client cancelled → notify doctor
        results.push(await sendEmail({
          to: doctorEmail,
          subject: `Session cancelled — ${appt.clientName}`,
          html: renderEmail({
            heading: "A session was cancelled",
            paragraphs: [`${esc(appt.clientName)} has cancelled their session.`],
            details,
            cta: { label: "Open schedule", url: `${APP_URL}/doctor/schedule` },
          }),
        }));
        if (appt.doctorId) {
          results.push(await sendPushToUser(appt.doctorId, {
            title: "Session cancelled",
            body: "A client cancelled a session.",
            url: `${APP_URL}/doctor/schedule`,
            prefKey: "pushAppointments",
          }));
        }
      } else if (clientEmail && clientAllows) {
        // Doctor cancelled/rejected → notify client
        results.push(await sendEmail({
          to: clientEmail,
          subject: "Update on your session — Valeo Experience",
          html: renderEmail({
            heading: "Session cancelled",
            greeting: `Hi ${clientFirst},`,
            paragraphs: [
              "We're sorry — your session could not be confirmed and has been cancelled.",
              "Please book another time that works for you, and reach out if you have any questions.",
            ],
            details,
            cta: { label: "Book another session", url: apptLink },
          }),
        }));
        if (appt.clientId) {
          results.push(await sendPushToUser(appt.clientId, {
            title: "Session cancelled",
            body: "Your session was cancelled. Open Appointments to rebook.",
            url: apptLink,
            prefKey: "pushAppointments",
          }));
        }
      }
    }

    return NextResponse.json({ ok: true, results });
  } catch (err: any) {
    console.error("[email/appointment]", err?.message ?? err);
    return NextResponse.json({ ok: false, error: err?.message ?? "error" }, { status: 500 });
  }
}
