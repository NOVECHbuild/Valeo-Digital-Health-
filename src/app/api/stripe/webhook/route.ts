// Stripe webhook — marks payments completed and appointments approved.
// Configure in Stripe Dashboard (Test):
//   URL: https://www.valeoexperience.com/api/stripe/webhook
//   Events: checkout.session.completed, checkout.session.async_payment_succeeded,
//           checkout.session.async_payment_failed, checkout.session.expired
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { getStripe } from "@/lib/stripe";
import { notifySessionConfirmed } from "@/lib/sessionEmails";
import type Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function appointmentIdsForPayment(
  paymentId: string,
  fallbackAppointmentId: string | null | undefined,
): Promise<string[]> {
  const paymentSnap = await adminDb.collection("payments").doc(paymentId).get();
  const data = paymentSnap.data();
  const fromSeries = data?.seriesAppointmentIds as string[] | undefined;
  if (Array.isArray(fromSeries) && fromSeries.length > 0) return fromSeries;
  if (fallbackAppointmentId) return [fallbackAppointmentId];
  return [];
}

async function fulfillCheckout(session: Stripe.Checkout.Session) {
  const paymentId     = session.metadata?.paymentId;
  const appointmentId = session.metadata?.appointmentId || session.client_reference_id;

  if (!paymentId || !appointmentId) {
    console.error("[Stripe webhook] Missing metadata on session", session.id);
    return;
  }

  const paymentRef  = adminDb.collection("payments").doc(paymentId);
  const paymentSnap = await paymentRef.get();
  if (!paymentSnap.exists) {
    console.error("[Stripe webhook] Payment not found:", paymentId);
    return;
  }

  const existing = paymentSnap.data();
  if (existing?.status === "completed" || existing?.status === "success") {
    return; // idempotent
  }

  const pi =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? "";

  await paymentRef.update({
    status:                  "completed",
    provider:                "stripe",
    gateway:                 "stripe",
    stripeCheckoutSessionId: session.id,
    stripePaymentIntentId:   pi,
    finalTotal:              (session.amount_total ?? 0) / 100,
    currency:                (session.currency || "usd").toUpperCase(),
    updatedAt:               FieldValue.serverTimestamp(),
  });

  const ids = await appointmentIdsForPayment(paymentId, appointmentId);
  for (const id of ids) {
    await adminDb.collection("appointments").doc(id).update({
      status:        "approved",
      paymentStatus: "paid",
      paymentId,
      updatedAt:     FieldValue.serverTimestamp(),
    });
    try {
      await notifySessionConfirmed(id);
    } catch (err) {
      console.error("[Stripe webhook] confirm notify error:", err);
    }
  }
}

async function markFailed(session: Stripe.Checkout.Session, reason: string) {
  const paymentId     = session.metadata?.paymentId;
  const appointmentId = session.metadata?.appointmentId || session.client_reference_id;
  if (!paymentId) return;

  const paymentSnap = await adminDb.collection("payments").doc(paymentId).get();
  if (paymentSnap.data()?.status === "completed" || paymentSnap.data()?.status === "success") {
    return;
  }

  await adminDb.collection("payments").doc(paymentId).update({
    status:        reason.includes("expired") ? "expired" : "failed",
    stripeMessage: reason,
    updatedAt:     FieldValue.serverTimestamp(),
  });

  const ids = await appointmentIdsForPayment(paymentId, appointmentId);
  const cancelledReason = reason.includes("expired") ? "payment_expired" : "payment_failed";
  for (const id of ids) {
    const apptSnap = await adminDb.collection("appointments").doc(id).get();
    const appt = apptSnap.data();
    if (!appt) continue;
    if (appt.paymentStatus === "paid" || appt.paymentStatus === "free") continue;
    if (appt.status === "approved" || appt.status === "completed") continue;
    await adminDb.collection("appointments").doc(id).update({
      status:          "cancelled",
      cancelledBy:     "system",
      cancelledReason,
      paymentStatus:   "unpaid",
      updatedAt:       FieldValue.serverTimestamp(),
    });
  }
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[Stripe webhook] STRIPE_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const body = await req.text();
  const sig  = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    console.error("[Stripe webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (
          session.payment_status === "paid" ||
          session.payment_status === "no_payment_required"
        ) {
          await fulfillCheckout(session);
        }
        break;
      }
      case "checkout.session.async_payment_succeeded": {
        await fulfillCheckout(event.data.object as Stripe.Checkout.Session);
        break;
      }
      case "checkout.session.async_payment_failed":
      case "checkout.session.expired": {
        await markFailed(
          event.data.object as Stripe.Checkout.Session,
          event.type
        );
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error("[Stripe webhook] Handler error:", err);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
