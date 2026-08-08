// Settlement receipt email when NOVECH records a Mercury payout to Valeo.
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { sendEmail, renderEmail, esc } from "@/lib/email";
import { requireAdmin } from "@/lib/requireAuth";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });
    if (!rateLimit(`email-payout:${gate.uid}`, 20, 60_000)) {
      return NextResponse.json({ ok: false, error: "Too many requests." }, { status: 429 });
    }

    const body = await req.json();
    const {
      payoutId,
      amount,
      currency = "USD",
      periodLabel = "",
      reference = "",
      notes = "",
      feePercentApplied,
      sentAt,
    } = body ?? {};

    if (!payoutId || amount == null || Number(amount) <= 0) {
      return NextResponse.json({ error: "payoutId and a positive amount are required." }, { status: 400 });
    }

    const settingsSnap = await adminDb.collection("settings").doc("platform").get();
    const settings = settingsSnap.data() ?? {};
    const to = String(settings.payoutReceiptEmail || "").trim();
    if (!to || !to.includes("@")) {
      return NextResponse.json({
        error: "Set Valeo payout receipt email in Admin → Platform Settings first.",
      }, { status: 400 });
    }

    const money = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: String(currency || "USD"),
    }).format(Number(amount));

    const feePct = feePercentApplied != null ? Number(feePercentApplied) : Number(settings.platformFeePercent) || 10;
    const when = sentAt
      ? new Date(sentAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
      : new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    const details = [
      { label: "Amount transferred", value: money },
      { label: "Period", value: periodLabel || "—" },
      { label: "Reference", value: reference || "—" },
      { label: "Transfer date", value: when },
      { label: "NOVECH fee rate (snapshot)", value: `${feePct}%` },
    ];

    const result = await sendEmail({
      to,
      subject: `Settlement receipt — ${money} to Valeo Experience Ltd.`,
      html: renderEmail({
        heading: "Settlement receipt",
        greeting: "Hello,",
        paragraphs: [
          `This confirms a settlement transfer from NOVECH LLC (Barbados) to <strong>Valeo Experience Ltd.</strong> for session payments collected through the Valeo Experience platform.`,
          notes
            ? `Note from NOVECH: ${esc(notes)}`
            : "Stripe processing fees are borne by Valeo and are reflected in the net amount available for transfer.",
        ],
        details,
        footerNote: "This is a settlement receipt for your records. It is not a tax invoice. Contact info@novech.io if you have questions about this transfer.",
      }),
    });

    await adminDb.collection("payouts").doc(payoutId).set({
      receiptSent: !!result.ok && !result.skipped,
      receiptSkipped: !!result.skipped,
      receiptError: result.error || null,
      receiptTo: to,
      receiptAt: new Date().toISOString(),
    }, { merge: true });

    if (result.skipped) {
      return NextResponse.json({ ok: true, skipped: true, to });
    }
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error || "Send failed", to }, { status: 502 });
    }
    return NextResponse.json({ ok: true, to });
  } catch (err: any) {
    console.error("[payout-receipt]", err?.message ?? err);
    return NextResponse.json({ error: "Failed to send receipt." }, { status: 500 });
  }
}
