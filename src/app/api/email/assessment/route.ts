// src/app/api/email/assessment/route.ts
// Emails a client when an assessment is assigned to them. Fail-safe.
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { sendEmail, renderEmail, prefAllows, formatDoctorName, esc } from "@/lib/email";
import { requireAuth } from "@/lib/requireAuth";
import { rateLimit } from "@/lib/rateLimit";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.valeoexperience.com";

export async function POST(req: NextRequest) {
  try {
    const { clientId, title, dueDate, doctorId } = await req.json();
    if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });

    // Only the assigning doctor (or admin) may send this.
    const gate = await requireAuth(req);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
    if (gate.role !== "admin" && gate.uid !== doctorId) {
      return NextResponse.json({ error: "Not authorized." }, { status: 403 });
    }
    if (!rateLimit(`email:${gate.uid}`, 30, 60_000)) {
      return NextResponse.json({ ok: false, error: "Too many requests." }, { status: 429 });
    }

    const snap   = await adminDb.collection("users").doc(clientId).get();
    const client = snap.data() ?? {};
    const email  = client.email;
    const first  = (client.displayName || "there").split(" ")[0];

    if (!email || !prefAllows(client.notifPrefs, "emailAssessments")) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    // Resolve the assigning doctor (multi-doctor aware)
    let doctorName = "Your therapist";
    if (doctorId) {
      const docSnap = await adminDb.collection("users").doc(doctorId).get();
      if (docSnap.exists) doctorName = formatDoctorName(docSnap.data()?.displayName);
    }

    let due = "";
    if (dueDate) {
      try { due = new Date(dueDate + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }); }
      catch { due = dueDate; }
    }

    const result = await sendEmail({
      to: email,
      subject: "A new assessment is waiting for you — Valeo Experience",
      html: renderEmail({
        heading: "New assessment assigned",
        greeting: `Hi ${first},`,
        paragraphs: [
          `${esc(doctorName)} has assigned you a new assessment${title ? `: <strong>${esc(title)}</strong>` : ""}.`,
          "Completing it helps your therapist understand how you're doing and tailor your care.",
        ],
        details: due ? [{ label: "Please complete by", value: due }] : undefined,
        cta: { label: "Complete assessment", url: `${APP_URL}/client/assessments` },
      }),
    });

    return NextResponse.json({ ok: true, result });
  } catch (err: any) {
    console.error("[email/assessment]", err?.message ?? err);
    return NextResponse.json({ ok: false, error: err?.message ?? "error" }, { status: 500 });
  }
}
