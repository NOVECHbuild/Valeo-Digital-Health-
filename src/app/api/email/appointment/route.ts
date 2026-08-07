// src/app/api/email/appointment/route.ts
// Sends appointment lifecycle emails. Fail-safe: never throws back to the caller
// in a way that blocks the user action — the client fires these and ignores errors.
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { sendEmail, renderEmail, prefAllows, formatDoctorName, esc } from "@/lib/email";
import { requireAuth } from "@/lib/requireAuth";
import { rateLimit } from "@/lib/rateLimit";

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

    // Resolve the appointment's actual doctor (multi-doctor aware), with env fallback.
    let doctorName = "your therapist";
    let doctorEmail = process.env.DOCTOR_EMAIL;
    if (appt.doctorId) {
      const docSnap = await adminDb.collection("users").doc(appt.doctorId).get();
      const docData = docSnap.data();
      if (docData) {
        doctorName  = formatDoctorName(docData.displayName);
        doctorEmail = docData.email || doctorEmail;
      }
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
              `Thank you for booking with Valeo Experience. We've received your session request and ${esc(doctorName)} will review and confirm it shortly.`,
              "You'll get another email as soon as it's confirmed.",
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
            paragraphs: [`${esc(appt.clientName)} has requested a session. Please review it in your schedule.`],
            details,
            cta: { label: "Open schedule", url: `${APP_URL}/doctor/schedule` },
          }),
        }));
      }
    }

    else if (event === "approved") {
      if (clientEmail && clientAllows) {
        const hasMeet = !!appt.meetLink;
        results.push(await sendEmail({
          to: clientEmail,
          subject: "Your session is confirmed — Valeo Experience",
          html: renderEmail({
            heading: "Session confirmed",
            greeting: `Hi ${clientFirst},`,
            paragraphs: [
              `Good news — ${esc(doctorName)} has confirmed your session.`,
              hasMeet
                ? "Use the button below to join the video call at your appointment time."
                : "Your video link will be available in your appointments before the session.",
            ],
            details,
            cta: hasMeet ? { label: "Join Google Meet", url: appt.meetLink } : { label: "View my appointments", url: apptLink },
          }),
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
      }
    }

    return NextResponse.json({ ok: true, results });
  } catch (err: any) {
    console.error("[email/appointment]", err?.message ?? err);
    return NextResponse.json({ ok: false, error: err?.message ?? "error" }, { status: 500 });
  }
}
