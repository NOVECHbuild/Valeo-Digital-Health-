// ════════════════════════════════════════════════════════════════════════════
//  Settlement math — NOVECH platform fee vs Valeo share (online payments only)
// ════════════════════════════════════════════════════════════════════════════

export interface SettlementPaymentLike {
  amount: number;
  status: string;
  source: string;
}

export interface SettlementPayoutLike {
  amount: number;
  status?: string;
}

export interface SettlementSummary {
  grossOnline: number;
  feePercent: number;
  platformFee: number;
  suggestedValeo: number;
  totalPaidOut: number;
  outstanding: number;
  minPayoutUsd: number;
  canPayout: boolean;
}

export function computeSettlement(
  payments: SettlementPaymentLike[],
  payouts: SettlementPayoutLike[],
  feePercent: number,
  minPayoutUsd: number,
): SettlementSummary {
  const pct = Math.max(0, Math.min(100, Number(feePercent) || 0));
  const min = Math.max(0, Number(minPayoutUsd) || 0);

  const grossOnline = payments
    .filter(p => p.source === "online" && p.status === "completed")
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const platformFee = round2(grossOnline * (pct / 100));
  const suggestedValeo = round2(grossOnline - platformFee);

  const totalPaidOut = payouts
    .filter(p => (p.status ?? "sent") === "sent")
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const outstanding = round2(Math.max(0, suggestedValeo - totalPaidOut));
  const canPayout = outstanding >= min && outstanding > 0;

  return {
    grossOnline: round2(grossOnline),
    feePercent: pct,
    platformFee,
    suggestedValeo,
    totalPaidOut: round2(totalPaidOut),
    outstanding,
    minPayoutUsd: min,
    canPayout,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
