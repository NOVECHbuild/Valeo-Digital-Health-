// Shared session confirmation + reminder emails (Resend). Fail-safe via sendEmail().

import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { sendEmail, renderEmail, prefAllows, formatDoctorName, esc } from "@/lib/email";
import { createMeetForAppointment } from "@/lib/meet";
import { sendPushToUser } from "@/lib/pushServer";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.valeoexperience.com";

function prettyDate(date: string): string {
  try {
    return new Date(date + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric",
    });
  } catch {
    return date;
  }
}

async function loadParty(appt: Record<string, any>) {
  const [clientSnap, doctorSnap] = await Promise.all([
    appt.clientId ? adminDb.collection("users").doc(appt.clientId).get() : Promise.resolve(null),
    appt.doctorId ? adminDb.collection("users").doc(appt.doctorId).get() : Promise.resolve(null),
  ]);
  const client = clientSnap?.data() ?? {};
  const doctor = doctorSnap?.data() ?? {};
  return {
    client,
    doctor,
    clientEmail: (client.email || appt.clientEmail || "") as string,
    doctorEmail: (doctor.email || "") as string,
    clientFirst: ((client.displayName || appt.clientName || "there") as string).split(" ")[0],
    doctorName:  formatDoctorName(doctor.displayName || appt.doctorName),
    clientName:  (client.displayName || appt.clientName || "Client") as string,
  };
}

/** Ensure Meet exists (best-effort), then email client that the session is confirmed. */
export async function notifySessionConfirmed(appointmentId: string): Promise<void> {
  try {
    await createMeetForAppointment(appointmentId);
  } catch (err) {
    console.error("[sessionEmails] meet on confirm:", err);
  }

  const snap = await adminDb.collection("appointments").doc(appointmentId).get();
  if (!snap.exists) return;
  const appt = snap.data()!;
  const party = await loadParty(appt);

  if (!party.clientEmail || !prefAllows(party.client.notifPrefs, "emailAppointments")) return;

  const hasMeet = !!appt.meetLink;
  await sendEmail({
    to: party.clientEmail,
    subject: "Your session is confirmed — Valeo Experience",
    html: renderEmail({
      heading: "Session confirmed",
      greeting: `Hi ${party.clientFirst},`,
      paragraphs: [
        `Good news — ${esc(party.doctorName)} has confirmed your session.`,
        hasMeet
          ? "Use the button below to join the video call at your appointment time."
          : "Your video link will appear in Appointments once Google Calendar is connected.",
      ],
      details: [
        { label: "Session", value: appt.type || "Therapy session" },
        { label: "When", value: `${prettyDate(appt.date)} at ${appt.time}` },
        { label: "With", value: party.doctorName },
      ],
      cta: hasMeet
        ? { label: "Join Session", url: appt.meetLink }
        : { label: "View my appointments", url: `${APP_URL}/client/appointments` },
    }),
  });
}

type ReminderKind = "tomorrow" | "today";

/**
 * Day-before / day-of reminders for one appointment.
 * Ensures Meet link, emails client + doctor, stamps reminder fields (idempotent).
 */
export async function sendSessionReminder(
  appointmentId: string,
  apptIn: Record<string, any>,
  kind: ReminderKind,
): Promise<"sent" | "skipped"> {
  const stampField = kind === "tomorrow" ? "reminderTomorrowSentAt" : "reminderTodaySentAt";
  if (apptIn[stampField]) return "skipped";

  try {
    await createMeetForAppointment(appointmentId);
  } catch { /* fail-safe */ }

  const snap = await adminDb.collection("appointments").doc(appointmentId).get();
  if (!snap.exists) return "skipped";
  const appt = snap.data()!;
  if (appt[stampField]) return "skipped";

  const party = await loadParty(appt);
  const when = `${prettyDate(appt.date)} at ${appt.time}`;
  const sessionLabel = appt.type || "Therapy session";
  const hasMeet = !!appt.meetLink;
  const joinCta = hasMeet
    ? { label: "Join Session", url: appt.meetLink as string }
    : null;

  const heading = kind === "tomorrow" ? "Your session is tomorrow" : "Your session is today";
  const subjectClient =
    kind === "tomorrow"
      ? "Reminder: your session is tomorrow — Valeo Experience"
      : "Reminder: your session is today — Valeo Experience";
  const subjectDoctor =
    kind === "tomorrow"
      ? `Reminder: session tomorrow with ${party.clientName}`
      : `Reminder: session today with ${party.clientName}`;

  let any = false;

  if (party.clientEmail && prefAllows(party.client.notifPrefs, "emailAppointments")) {
    const r = await sendEmail({
      to: party.clientEmail,
      subject: subjectClient,
      html: renderEmail({
        heading,
        greeting: `Hi ${party.clientFirst},`,
        paragraphs: [
          `This is a friendly reminder about your upcoming session with ${esc(party.doctorName)}.`,
          hasMeet
            ? "Join with the button below at your session time — the link is ready."
            : "Open your appointments in Valeo closer to the session for the video link.",
        ],
        details: [
          { label: "Session", value: sessionLabel },
          { label: "When", value: when },
        ],
        cta: joinCta ?? { label: "View my appointments", url: `${APP_URL}/client/appointments` },
      }),
    });
    if (r.ok) any = true;
  }

  if (party.doctorEmail && prefAllows(party.doctor.notifPrefs, "emailAppointments")) {
    const r = await sendEmail({
      to: party.doctorEmail,
      subject: subjectDoctor,
      html: renderEmail({
        heading: kind === "tomorrow" ? "Session tomorrow" : "Session today",
        greeting: `Hi ${(party.doctor.displayName || "Doctor").replace(/^Dr\.?\s*/i, "").split(" ")[0] || "Doctor"},`,
        paragraphs: [
          `Reminder: you have a session with ${esc(party.clientName)}.`,
          hasMeet
            ? "Your Meet link is ready — join from the button below or your dashboard."
            : "Create the Meet link from Schedule if it is not ready yet.",
        ],
        details: [
          { label: "Client", value: party.clientName },
          { label: "Session", value: sessionLabel },
          { label: "When", value: when },
        ],
        cta: joinCta ?? { label: "Open schedule", url: `${APP_URL}/doctor/schedule` },
      }),
    });
    if (r.ok) any = true;
  }

  // Web push reminders (non-PHI) — fail-safe alongside email
  const whenShort = `${appt.time || ""}`.trim();
  const pushBody =
    kind === "tomorrow"
      ? `Reminder: session tomorrow${whenShort ? ` at ${whenShort}` : ""}`
      : `Reminder: session today${whenShort ? ` at ${whenShort}` : ""}`;

  if (appt.clientId) {
    const pr = await sendPushToUser(appt.clientId, {
      title: "Session reminder",
      body: pushBody,
      url: `${APP_URL}/client/appointments`,
      prefKey: "pushReminders",
    });
    if (pr.ok && pr.sent) any = true;
  }
  if (appt.doctorId) {
    const pr = await sendPushToUser(appt.doctorId, {
      title: "Session reminder",
      body: `${pushBody} · ${party.clientName}`,
      url: `${APP_URL}/doctor/schedule`,
      prefKey: "pushReminders",
    });
    if (pr.ok && pr.sent) any = true;
  }

  await adminDb.collection("appointments").doc(appointmentId).update({
    [stampField]: FieldValue.serverTimestamp(),
  });

  return any ? "sent" : "skipped";
}
