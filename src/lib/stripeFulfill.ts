// Shared Stripe Checkout fulfillment — used by webhook + client confirm fallback.
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { notifySessionConfirmed } from "@/lib/sessionEmails";
import type Stripe from "stripe";

export async function appointmentIdsForPayment(
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

/** Mark payment completed and appointments approved/paid. Idempotent. */
export async function fulfillCheckout(session: Stripe.Checkout.Session): Promise<{
  ok: boolean;
  reason?: string;
  appointmentIds?: string[];
}> {
  const paymentId     = session.metadata?.paymentId;
  const appointmentId = session.metadata?.appointmentId || session.client_reference_id;

  if (!paymentId || !appointmentId) {
    console.error("[Stripe fulfill] Missing metadata on session", session.id);
    return { ok: false, reason: "missing_metadata" };
  }

  const paymentRef  = adminDb.collection("payments").doc(paymentId);
  const paymentSnap = await paymentRef.get();
  if (!paymentSnap.exists) {
    console.error("[Stripe fulfill] Payment not found:", paymentId);
    return { ok: false, reason: "payment_not_found" };
  }

  const existing = paymentSnap.data();
  const alreadyDone = existing?.status === "completed" || existing?.status === "success";

  const pi =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? "";

  if (!alreadyDone) {
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
  }

  const ids = await appointmentIdsForPayment(paymentId, appointmentId);
  for (const id of ids) {
    const apptSnap = await adminDb.collection("appointments").doc(id).get();
    const appt = apptSnap.data();
    if (!appt) continue;
    if (appt.paymentStatus === "paid" || appt.paymentStatus === "free") {
      // Still ensure status is approved if somehow stuck pending while paid
      if (appt.status === "pending") {
        await adminDb.collection("appointments").doc(id).update({
          status:    "approved",
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      continue;
    }
    await adminDb.collection("appointments").doc(id).update({
      status:        "approved",
      paymentStatus: "paid",
      paymentId,
      updatedAt:     FieldValue.serverTimestamp(),
    });
    try {
      await notifySessionConfirmed(id);
    } catch (err) {
      console.error("[Stripe fulfill] confirm notify error:", err);
    }
  }

  return { ok: true, appointmentIds: ids };
}

export async function markCheckoutFailed(
  session: Stripe.Checkout.Session,
  reason: string,
): Promise<void> {
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
