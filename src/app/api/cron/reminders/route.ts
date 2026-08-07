// Daily job (Vercel Cron): session reminders for today + tomorrow.
// Ensures Meet link exists, emails client + doctor with Join CTA.
// Guarded by CRON_SECRET when set. Fail-safe per recipient.
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { sendSessionReminder } from "@/lib/sessionEmails";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const today = new Date().toISOString().split("T")[0];
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];

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

    return NextResponse.json({
      ok: true,
      today,
      tomorrow,
      total: todaySnap.size + tomorrowSnap.size,
      sent,
      skipped,
    });
  } catch (err: any) {
    console.error("[cron/reminders]", err?.message ?? err);
    return NextResponse.json({ ok: false, error: err?.message ?? "error" }, { status: 500 });
  }
}
