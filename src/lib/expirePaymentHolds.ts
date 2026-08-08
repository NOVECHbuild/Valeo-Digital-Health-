import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { isDoctorApproved, isHoldExpired } from "@/lib/paymentStatus";

/**
 * Release slots held past review (12h) or payment (24h / before session) deadlines.
 * Safe to call often (freebusy, cron, initiate).
 */
export async function expireUnpaidPaymentHolds(): Promise<{ expired: number }> {
  const snap = await adminDb
    .collection("appointments")
    .where("status", "==", "pending")
    .get();

  const now = new Date();
  let expired = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const paymentStatus = data.paymentStatus as string | undefined;
    // Legacy pending without paymentStatus: do not auto-cancel.
    if (paymentStatus !== "unpaid") continue;

    const doctorOk = isDoctorApproved(data);
    let reason: "review_expired" | "payment_expired" | null = null;

    if (!doctorOk) {
      // Waiting on doctor — 12h review hold
      const reviewExp = data.reviewHoldExpiresAt ?? data.paymentHoldExpiresAt ?? null;
      if (isHoldExpired(reviewExp, now)) reason = "review_expired";
    } else {
      // Doctor approved — client must pay before paymentHoldExpiresAt
      if (isHoldExpired(data.paymentHoldExpiresAt ?? null, now)) reason = "payment_expired";
    }

    if (!reason) continue;

    await adminDb.collection("appointments").doc(docSnap.id).update({
      status:          "cancelled",
      cancelledBy:     "system",
      cancelledReason: reason,
      updatedAt:       FieldValue.serverTimestamp(),
    });

    const paymentId = data.paymentId as string | undefined;
    if (paymentId) {
      try {
        await adminDb.collection("payments").doc(paymentId).update({
          status:    "expired",
          updatedAt: FieldValue.serverTimestamp(),
        });
      } catch {
        /* payment doc may already be gone */
      }
    }
    expired++;
  }

  return { expired };
}
