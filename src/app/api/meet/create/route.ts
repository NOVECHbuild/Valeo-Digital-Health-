// src/app/api/meet/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { adminDb } from "@/lib/firebase-admin";
import { getDoctorAuth } from "@/lib/googleAuth";

export async function POST(req: NextRequest) {
  try {
    const { appointmentId } = await req.json();
    if (!appointmentId) {
      return NextResponse.json({ error: "appointmentId required" }, { status: 400 });
    }

    // Load appointment from Firestore
    const apptSnap = await adminDb.collection("appointments").doc(appointmentId).get();
    if (!apptSnap.exists) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }
    const appt = apptSnap.data()!;

    // Load client + doctor details
    const clientSnap = await adminDb.collection("users").doc(appt.clientId).get();
    const client     = clientSnap.data();
    const doctorSnap = appt.doctorId ? await adminDb.collection("users").doc(appt.doctorId).get() : null;
    const doctor     = doctorSnap?.data();
    const doctorEmail = doctor?.email ?? process.env.DOCTOR_EMAIL;
    const doctorName  = appt.doctorName ?? doctor?.displayName ?? "Your therapist";

    // Parse date/time → ISO datetime
    const [timePart, meridiem] = appt.time.split(" ");
    let [hours, minutes]       = timePart.split(":").map(Number);
    if (meridiem === "PM" && hours !== 12) hours += 12;
    if (meridiem === "AM" && hours === 12) hours  = 0;

    const startDate = new Date(
      `${appt.date}T${String(hours).padStart(2,"0")}:${String(minutes).padStart(2,"0")}:00`
    );
    const endDate = new Date(startDate.getTime() + appt.duration * 60 * 1000);

    // Build Google Calendar event — on THIS doctor's calendar (falls back to the
    // shared account if they haven't connected their own).
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
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: "email", minutes: 24 * 60 }, // 24h before
          { method: "popup", minutes: 30 },       // 30min before
        ],
      },
    };

    const response = await calendar.events.insert({
      calendarId:            "primary",
      requestBody:           event,
      conferenceDataVersion: 1,
      sendUpdates:           "all", // auto-emails all attendees
    });

    const meetLink      = response.data.hangoutLink;
    const calendarEventId = response.data.id;

    if (!meetLink) {
      return NextResponse.json({ error: "Meet link not generated" }, { status: 500 });
    }

    // Save Meet link back to the appointment document
    await adminDb.collection("appointments").doc(appointmentId).update({
      meetLink,
      calendarEventId,
      meetCreatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ meetLink, calendarEventId });

  } catch (err: any) {
    console.error("[meet/create]", err);
    return NextResponse.json({ error: err.message ?? "Internal error" }, { status: 500 });
  }
}
