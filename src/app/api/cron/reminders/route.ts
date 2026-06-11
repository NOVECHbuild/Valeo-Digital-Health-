// src/app/api/cron/reminders/route.ts
// Daily job (Vercel Cron): emails clients a reminder for sessions happening
// "tomorrow". Guarded by CRON_SECRET when set. Fail-safe per recipient.
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { sendEmail, renderEmail, prefAllows, formatDoctorName } from "@/lib/email";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.valeoexperience.com";

function prettyDate(date: string): string {
  try {
    return new Date(date + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric",
    });
  } catch { return date; }
}

export async function GET(req: NextRequest) {
  // Auth: when CRON_SECRET is set, require it (Vercel Cron sends it automatically).
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    // "Tomorrow" as a YYYY-MM-DD string
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const snap = await adminDb.collection("appointments")
      .where("status", "==", "approved")
      .where("date", "==", tomorrow)
      .get();

    let sent = 0, skipped = 0;
    for (const docSnap of snap.docs) {
      const appt = docSnap.data();
      const clientSnap = await adminDb.collection("users").doc(appt.clientId).get();
      const client = clientSnap.data() ?? {};
      const email  = client.email || appt.clientEmail;
      const first  = (client.displayName || appt.clientName || "there").split(" ")[0];

      if (!email || !prefAllows(client.notifPrefs, "emailAppointments")) { skipped++; continue; }

      // Resolve the appointment's doctor (multi-doctor aware)
      let doctorName = "your therapist";
      if (appt.doctorId) {
        const dSnap = await adminDb.collection("users").doc(appt.doctorId).get();
        if (dSnap.exists) doctorName = formatDoctorName(dSnap.data()?.displayName);
      }

      const r = await sendEmail({
        to: email,
        subject: "Reminder: your session is tomorrow — Valeo Experience",
        html: renderEmail({
          heading: "Your session is tomorrow",
          greeting: `Hi ${first},`,
          paragraphs: [
            `This is a friendly reminder about your upcoming session with ${doctorName}.`,
            appt.meetLink ? "You can join the video call using the button below at your session time." : "Your video link will be available in your appointments.",
          ],
          details: [
            { label: "Session", value: appt.type || "Therapy session" },
            { label: "When", value: `${prettyDate(appt.date)} at ${appt.time}` },
          ],
          cta: appt.meetLink ? { label: "Join Google Meet", url: appt.meetLink } : { label: "View my appointments", url: `${APP_URL}/client/appointments` },
        }),
      });
      if (r.ok) sent++; else skipped++;
    }

    return NextResponse.json({ ok: true, date: tomorrow, total: snap.size, sent, skipped });
  } catch (err: any) {
    console.error("[cron/reminders]", err?.message ?? err);
    return NextResponse.json({ ok: false, error: err?.message ?? "error" }, { status: 500 });
  }
}
