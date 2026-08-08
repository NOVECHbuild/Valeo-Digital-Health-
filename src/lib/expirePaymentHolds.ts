import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { isHoldExpired } from "@/lib/paymentStatus";

/**
 * Release slots held by unpaid bookings past paymentHoldExpiresAt.
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
    // Legacy pending without paymentStatus: do not auto-cancel (doctor may still approve).
    if (paymentStatus !== "unpaid") continue;
    if (!isHoldExpired(data.paymentHoldExpiresAt ?? null, now)) continue;

    await adminDb.collection("appointments").doc(docSnap.id).update({
      status:          "cancelled",
      cancelledBy:     "system",
      cancelledReason: "payment_expired",
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
