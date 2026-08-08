// Frequent job: release unpaid booking holds after 30 minutes.
// Guarded by CRON_SECRET when set.
import { NextRequest, NextResponse } from "next/server";
import { expireUnpaidPaymentHolds } from "@/lib/expirePaymentHolds";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await expireUnpaidPaymentHolds();
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    console.error("[cron/expire-holds]", err?.message ?? err);
    return NextResponse.json({ ok: false, error: err?.message ?? "error" }, { status: 500 });
  }
}
