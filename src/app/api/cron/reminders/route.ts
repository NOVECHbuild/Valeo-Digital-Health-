// Daily job (Vercel Cron): session reminders + past no-show cleanup.
// Guarded by CRON_SECRET when set. Fail-safe per recipient.
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { processPastNoShows, sendSessionReminder } from "@/lib/sessionEmails";
import { todayCaribbean } from "@/lib/resolveDoctorEmail";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const today = todayCaribbean();
    const tomorrowDate = new Date();
    // Advance one calendar day in Barbados for "tomorrow"
    const parts = today.split("-").map(Number);
    const base = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    base.setUTCDate(base.getUTCDate() + 1);
    const tomorrow = base.toISOString().split("T")[0];

    const [todaySnap, tomorrowSnap] = await Promise.all([
      adminDb.collection("appointments")
        .where("status", "==", "approved")
        .where("date", "==", today)
        .get(),
      adminDb.collection("appointments")
        .where("status", "==", "approved")
        .where("date", "==", tomorrow)
        .get(),
    ]);

    let sent = 0, skipped = 0;

    for (const docSnap of todaySnap.docs) {
      const result = await sendSessionReminder(docSnap.id, docSnap.data(), "today");
      if (result === "sent") sent++; else skipped++;
    }
    for (const docSnap of tomorrowSnap.docs) {
      const result = await sendSessionReminder(docSnap.id, docSnap.data(), "tomorrow");
      if (result === "sent") sent++; else skipped++;
    }

    const noShows = await processPastNoShows();

    return NextResponse.json({
      ok: true,
      today,
      tomorrow,
      reminders: {
        total: todaySnap.size + tomorrowSnap.size,
        sent,
        skipped,
      },
      noShows,
    });
  } catch (err: any) {
    console.error("[cron/reminders]", err?.message ?? err);
    return NextResponse.json({ ok: false, error: err?.message ?? "error" }, { status: 500 });
  }
}
