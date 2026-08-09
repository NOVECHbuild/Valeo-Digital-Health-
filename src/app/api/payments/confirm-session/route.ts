// Client-side fallback when Stripe webhook is delayed/misconfigured.
// Verifies the Checkout Session with Stripe, then fulfills payment + appointment.
// Auth is preferred but NOT required: after Stripe redirect Firebase auth is often
// not restored yet. A completed Checkout Session id is sufficient proof of payment.
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/requireAuth";
import { getStripe } from "@/lib/stripe";
import { fulfillCheckout } from "@/lib/stripeFulfill";
import { adminDb } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId.trim() : "";
    if (!sessionId.startsWith("cs_")) {
      return NextResponse.json({ error: "Missing checkout session id." }, { status: 400 });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json({ error: "Payment gateway not configured" }, { status: 503 });
    }

    const session = await getStripe().checkout.sessions.retrieve(sessionId);

    // Optional auth check when a signed-in user is present
    const gate = await requireAuth(req);
    if (gate.ok && gate.role !== "admin") {
      const clientId = session.metadata?.clientId;
      if (clientId && gate.uid !== clientId) {
        return NextResponse.json({ error: "Not authorized for this payment." }, { status: 403 });
      }
      if (!clientId) {
        const paymentId = session.metadata?.paymentId;
        if (!paymentId) {
          return NextResponse.json({ error: "Not authorized for this payment." }, { status: 403 });
        }
        const paySnap = await adminDb.collection("payments").doc(paymentId).get();
        if (!paySnap.exists || paySnap.data()?.clientId !== gate.uid) {
          return NextResponse.json({ error: "Not authorized for this payment." }, { status: 403 });
        }
      }
    }

    if (session.status !== "complete") {
      return NextResponse.json({
        ok: false,
        status: session.status,
        paymentStatus: session.payment_status,
      });
    }
    if (
      session.payment_status !== "paid" &&
      session.payment_status !== "no_payment_required"
    ) {
      return NextResponse.json({
        ok: false,
        status: session.status,
        paymentStatus: session.payment_status,
      });
    }

    const result = await fulfillCheckout(session);
    if (!result.ok) {
      return NextResponse.json({ error: result.reason || "Fulfillment failed" }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      appointmentIds: result.appointmentIds ?? [],
    });
  } catch (err) {
    console.error("[confirm-session]", err);
    return NextResponse.json({ error: "Could not confirm payment." }, { status: 500 });
  }
}
