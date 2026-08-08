/**
 * Shared payment status helpers for analytics / dashboards.
 * Stripe/WiPay write `completed`; older docs may use success/paid/manual.
 */
export function isRevenuePayment(status?: string | null): boolean {
  const s = (status || "").toLowerCase();
  return s === "completed" || s === "success" || s === "paid" || s === "manual";
}
