/** Appointment payment state — independent of clinical status (pending/approved/…). */

export type PaymentStatus = "unpaid" | "paid" | "free" | "refunded";

export const PAYMENT_HOLD_MINUTES = 30;

export function holdExpiresAt(from = new Date()): string {
  return new Date(from.getTime() + PAYMENT_HOLD_MINUTES * 60 * 1000).toISOString();
}

export function isHoldExpired(expiresAt?: string | null, now = new Date()): boolean {
  if (!expiresAt) return false;
  const t = Date.parse(expiresAt);
  if (Number.isNaN(t)) return false;
  return t <= now.getTime();
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
