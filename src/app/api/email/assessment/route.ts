// src/app/api/email/assessment/route.ts
// Emails a client when an assessment is assigned to them. Fail-safe.
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { sendEmail, renderEmail, prefAllows } from "@/lib/email";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.valeoexperience.com";

export async function POST(req: NextRequest) {
  try {
    const { clientId, title, dueDate } = await req.json();
    if (!clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });

    const snap   = await adminDb.collection("users").doc(clientId).get();
    const client = snap.data() ?? {};
    const email  = client.email;
    const first  = (client.displayName || "there").split(" ")[0];

    if (!email || !prefAllows(client.notifPrefs, "emailAssessments")) {
      return NextResponse.json({ ok: true, skipped: true });
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
          `Dr. Miller has assigned you a new assessment${title ? `: <strong>${title}</strong>` : ""}.`,
          "Completing it helps Dr. Miller understand how you're doing and tailor your care.",
        ],
        details: due ? [{ label: "Please complete by", value: due }] : undefined,
        cta: { label: "Complete assessment", url: `${APP_URL}/client/assessments` },
      }),
    });

    return NextResponse.json({ ok: true, result });
  } catch (err: any) {
    console.error("[email/assessment]", err?.message ?? err);
    return NextResponse.json({ ok: false, error: err?.message ?? "error" });
  }
}
