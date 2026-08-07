// Shared Google Meet creation for appointments (Calendar API + hangoutsMeet).
// Used by /api/meet/create and the Stripe webhook (paid bookings auto-approve
// without the doctor clicking Approve — still need a Join link for the client).

import { google } from "googleapis";
import { adminDb } from "@/lib/firebase-admin";
import { getDoctorAuth } from "@/lib/googleAuth";

export type MeetCreateResult =
  | { ok: true; meetLink: string; calendarEventId: string }
  | { ok: false; error: string; status: number };

export async function createMeetForAppointment(
  appointmentId: string,
): Promise<MeetCreateResult> {
  const apptSnap = await adminDb.collection("appointments").doc(appointmentId).get();
  if (!apptSnap.exists) {
    return { ok: false, error: "Appointment not found", status: 404 };
  }
  const appt = apptSnap.data()!;

  // Idempotent — already has a link
  if (typeof appt.meetLink === "string" && appt.meetLink.length > 0) {
    return {
      ok: true,
      meetLink: appt.meetLink,
      calendarEventId: appt.calendarEventId ?? "",
    };
  }

  const clientSnap = await adminDb.collection("users").doc(appt.clientId).get();
  const client     = clientSnap.data();
  const doctorSnap = appt.doctorId
    ? await adminDb.collection("users").doc(appt.doctorId).get()
    : null;
  const doctor      = doctorSnap?.data();
  const doctorEmail = doctor?.email ?? process.env.DOCTOR_EMAIL;
  const doctorName  = appt.doctorName ?? doctor?.displayName ?? "Your therapist";

  const [timePart, meridiem] = String(appt.time || "").split(" ");
  let [hours, minutes]       = (timePart || "0:0").split(":").map(Number);
  if (meridiem === "PM" && hours !== 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours  = 0;

  const startDate = new Date(
    `${appt.date}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`,
  );
  if (Number.isNaN(startDate.getTime())) {
    return { ok: false, error: "Invalid appointment date/time", status: 400 };
  }
  const endDate = new Date(startDate.getTime() + (appt.duration || 50) * 60 * 1000);

  const auth     = await getDoctorAuth(appt.doctorId);
  const calendar = google.calendar({ version: "v3", auth });

  const event = {
    summary:     `${appt.type} — ${appt.clientName}`,
    description: `Valeo Experience session with ${appt.clientName}.\n\nSession type: ${appt.type}\nDuration: ${appt.duration} minutes${appt.notes ? `\n\nClient notes: ${appt.notes}` : ""}`,
    start: {
      dateTime: startDate.toISOString(),
      timeZone: "America/Port_of_Spain",
    },
    end: {
      dateTime: endDate.toISOString(),
      timeZone: "America/Port_of_Spain",
    },
    attendees: [
      ...(doctorEmail ? [{ email: doctorEmail, displayName: doctorName }] : []),
      ...(client?.email ? [{ email: client.email, displayName: appt.clientName }] : []),
    ],
    conferenceData: {
      createRequest: {
        requestId:             `valeo-${appointmentId}`,
        conferenceSolutionKey: { type: "hangoutsMeet" as const },
      },
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: "email" as const, minutes: 24 * 60 },
        { method: "popup" as const, minutes: 30 },
      ],
    },
  };

  const response = await calendar.events.insert({
    calendarId:            "primary",
    requestBody:           event,
    conferenceDataVersion: 1,
    sendUpdates:           "all",
  });

  const meetLink        = response.data.hangoutLink;
  const calendarEventId = response.data.id ?? "";

  if (!meetLink) {
    return { ok: false, error: "Meet link not generated", status: 500 };
  }

  await adminDb.collection("appointments").doc(appointmentId).update({
    meetLink,
    calendarEventId,
    meetCreatedAt: new Date().toISOString(),
  });

  return { ok: true, meetLink, calendarEventId };
}
