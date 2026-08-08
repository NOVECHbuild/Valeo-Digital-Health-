/** Appointment payment state — independent of clinical status (pending/approved/…). */

export type PaymentStatus = "unpaid" | "paid" | "free" | "refunded";

/** How long the doctor has to approve a new request (slot held). */
export const REVIEW_HOLD_HOURS = 12;

/** After doctor approves, how long the client has to pay (capped before session start). */
export const PAYMENT_HOLD_HOURS = 24;

/** @deprecated use REVIEW_HOLD_HOURS / PAYMENT_HOLD_HOURS — kept for old UI strings during migration */
export const PAYMENT_HOLD_MINUTES = PAYMENT_HOLD_HOURS * 60;

export function reviewHoldExpiresAt(from = new Date()): string {
  return new Date(from.getTime() + REVIEW_HOLD_HOURS * 60 * 60 * 1000).toISOString();
}

/**
 * Payment deadline after doctor approval: min(now + 24h, 1 minute before session start).
 * Always returns a time strictly after `from` when possible.
 */
export function paymentHoldExpiresAt(from: Date, sessionStart: Date | null): string {
  const by24h = from.getTime() + PAYMENT_HOLD_HOURS * 60 * 60 * 1000;
  let cap = by24h;
  if (sessionStart && !Number.isNaN(sessionStart.getTime())) {
    const beforeSession = sessionStart.getTime() - 60 * 1000;
    cap = Math.min(by24h, beforeSession);
  }
  // Ensure expiry is in the future (e.g. session very soon)
  const minFuture = from.getTime() + 5 * 60 * 1000;
  return new Date(Math.max(cap, minFuture)).toISOString();
}

/** @deprecated alias — prefer paymentHoldExpiresAt(from, sessionStart) */
export function holdExpiresAt(from = new Date()): string {
  return paymentHoldExpiresAt(from, null);
}

export function isHoldExpired(expiresAt?: string | null, now = new Date()): boolean {
  if (!expiresAt) return false;
  const t = Date.parse(expiresAt);
  if (Number.isNaN(t)) return false;
  return t <= now.getTime();
}

/** True once the doctor has accepted the requested time (client still may need to pay). */
export function isDoctorApproved(appt: { doctorApprovedAt?: unknown }): boolean {
  return appt.doctorApprovedAt != null && appt.doctorApprovedAt !== "";
}

/** Infer display status for older appointments that lack paymentStatus. */
export function resolvePaymentStatus(appt: {
  paymentStatus?: string | null;
  status?: string | null;
  amount?: number | null;
}): PaymentStatus | "unknown" {
  const ps = appt.paymentStatus;
  if (ps === "unpaid" || ps === "paid" || ps === "free" || ps === "refunded") return ps;
  if (typeof appt.amount === "number" && appt.amount === 0 && appt.status === "approved") return "free";
  if (appt.status === "approved" || appt.status === "completed") return "paid";
  if (appt.status === "pending") return "unpaid";
  return "unknown";
}

export const PAYMENT_BADGE: Record<
  PaymentStatus | "unknown",
  { label: string; bg: string; color: string }
> = {
  paid:    { label: "Paid",            bg: "rgba(141,198,63,0.14)", color: "#6BA028" },
  free:    { label: "Free",            bg: "rgba(42,74,26,0.08)",   color: "#2A4A1A" },
  unpaid:  { label: "Pay to confirm",  bg: "rgba(247,148,29,0.14)", color: "#C4700A" },
  refunded:{ label: "Refunded",        bg: "rgba(138,155,168,0.14)", color: "#8A9BA8" },
  unknown: { label: "—",               bg: "rgba(138,155,168,0.1)",  color: "#8A9BA8" },
};
