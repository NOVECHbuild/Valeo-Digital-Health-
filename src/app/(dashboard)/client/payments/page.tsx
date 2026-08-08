"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  collection, query, where, orderBy, onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import {
  CreditCard, CheckCircle, Clock, AlertCircle,
  XCircle, Download, ChevronDown, ChevronUp,
  Loader2, Receipt, DollarSign, Calendar,
  ArrowUpRight, Lock, AlertTriangle, RefreshCw,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────
type PaymentStatus = "pending" | "completed" | "failed" | "refunded" | "cancelled";

interface Payment {
  id:            string;
  clientId:      string;
  doctorId:      string;
  appointmentId: string;
  amount:        number;
  currency:      string;
  status:        PaymentStatus;
  sessionType:   string;
  sessionDate?:  string;
  reference?:    string;
  provider:      string;
  gateway?:      string;
  createdAt:     any;
  updatedAt:     any;
  receiptUrl?:   string;
}

// ── Helpers ────────────────────────────────────────────────────────────────
// FIX 2: Unified timestamp helper — handles Firestore Timestamp AND ISO strings
function toDate(ts: any): Date | null {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  if (typeof ts === "string") return new Date(ts);
  if (ts instanceof Date) return ts;
  return null;
}

function fmtDate(ts: any, opts?: Intl.DateTimeFormatOptions): string {
  const d = toDate(ts);
  if (!d) return "—";
  return d.toLocaleDateString("en-US", opts ?? {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}

function fmtCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency,
  }).format(amount);
}

// FIX 3: accent color → rgba map (hex alpha is not reliably supported cross-browser)
const ACCENT_RGBA: Record<string, string> = {
  "#2A4A1A": "rgba(42,74,26,0.1)",
  "#8DC63F": "rgba(141,198,63,0.12)",
  "#F7941D": "rgba(247,148,29,0.12)",
};

// ── Status config ──────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<PaymentStatus, {
  label: string; bg: string; color: string; Icon: any;
}> = {
  completed: { label: "Paid",       bg: "rgba(141,198,63,0.12)",  color: "#6BA028", Icon: CheckCircle  },
  pending:   { label: "Pending",    bg: "rgba(247,148,29,0.12)",  color: "#C4700A", Icon: Clock        },
  failed:    { label: "Failed",     bg: "rgba(247,148,29,0.12)",   color: "#F7941D", Icon: XCircle      },
  refunded:  { label: "Refunded",   bg: "rgba(138,155,168,0.12)", color: "#8A9BA8", Icon: ArrowUpRight  },
  cancelled: { label: "Cancelled",  bg: "rgba(138,155,168,0.12)", color: "#8A9BA8", Icon: XCircle      },
};

function StatusBadge({ status }: { status: PaymentStatus }) {
  const s = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: s.bg, color: s.color }}
    >
      <s.Icon size={10} />{s.label}
    </span>
  );
}

// ── Payment card ───────────────────────────────────────────────────────────
function PaymentCard({ payment }: { payment: Payment }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[payment.status] ?? STATUS_CONFIG.pending;

  // FIX 6: Prefer sessionDate for the card date label — it's what the client cares about.
  // Fall back to createdAt (payment date) if sessionDate is not set.
  const displayDate = payment.sessionDate
    ? new Date(payment.sessionDate + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "short", month: "short", day: "numeric", year: "numeric",
      })
    : fmtDate(payment.createdAt);

  // FIX 7: formattedAmount already includes the "$" symbol — don't show currency code separately
  const formattedAmount = fmtCurrency(payment.amount, payment.currency || "USD");

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all"
      style={{ background: "white", boxShadow: "0 1px 4px rgba(42,74,26,0.07)" }}
    >
      {/* Main row */}
      <div className="flex items-center gap-4 p-5">
        {/* Icon */}
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: cfg.bg }}
        >
          <Receipt size={18} style={{ color: cfg.color }} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold" style={{ color: "#2A4A1A" }}>
                {payment.sessionType || "Therapy Session"}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "#8A9BA8" }}>{displayDate}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p
                className="text-base font-bold"
                style={{
                  fontFamily: "var(--font-dm-serif)",
                  color: payment.status === "refunded" ? "#8A9BA8" : "#2A4A1A",
                  textDecoration: payment.status === "refunded" ? "line-through" : "none",
                }}
              >
                {formattedAmount}
              </p>
              {/* FIX 7: Only show currency code if it's NOT USD (i.e. non-obvious) */}
              {payment.currency && payment.currency !== "USD" && (
                <p className="text-xs mt-0.5" style={{ color: "#C4C4C4" }}>{payment.currency}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 mt-2">
            <StatusBadge status={payment.status} />
            {payment.reference && (
              <span className="text-xs font-mono" style={{ color: "#C4C4C4" }}>
                #{payment.reference.slice(-8).toUpperCase()}
              </span>
            )}
          </div>
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="p-1.5 rounded-lg hover:bg-black/5 flex-shrink-0"
          aria-label={expanded ? "Collapse details" : "Expand details"}
        >
          {expanded
            ? <ChevronUp  size={15} style={{ color: "#8A9BA8" }} />
            : <ChevronDown size={15} style={{ color: "#8A9BA8" }} />}
        </button>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-5 pb-5 pt-0 border-t" style={{ borderColor: "rgba(42,74,26,0.06)" }}>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[
              {
                label: "Payment Provider",
                value: payment.provider || payment.gateway || "Stripe",
              },
              {
                label: "Session Type",
                value: payment.sessionType || "—",
              },
              {
                label: "Session Date",
                value: payment.sessionDate
                  ? new Date(payment.sessionDate + "T12:00:00").toLocaleDateString("en-US", {
                      month: "long", day: "numeric", year: "numeric",
                    })
                  : "—",
              },
              {
                label: "Payment Date",
                value: fmtDate(payment.createdAt, { month: "long", day: "numeric", year: "numeric" }),
              },
              {
                label: "Transaction Ref",
                value: payment.reference || "—",
              },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl p-3" style={{ background: "rgba(42,74,26,0.02)" }}>
                <p className="text-xs" style={{ color: "#8A9BA8" }}>{label}</p>
                <p className="text-sm font-medium mt-0.5 truncate" style={{ color: "#2A4A1A" }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Completed — receipt link */}
          {payment.status === "completed" && (
            <div
              className="mt-3 flex items-center justify-between px-3 py-2.5 rounded-xl"
              style={{ background: "rgba(141,198,63,0.06)", border: "1px solid rgba(141,198,63,0.15)" }}
            >
              <div className="flex items-center gap-2">
                <CheckCircle size={13} style={{ color: "#6BA028" }} />
                <p className="text-xs font-medium" style={{ color: "#6BA028" }}>Payment confirmed</p>
              </div>
              {payment.receiptUrl && (
                <a
                  href={payment.receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs font-semibold"
                  style={{ color: "#2A4A1A" }}
                >
                  <Download size={11} /> Receipt
                </a>
              )}
            </div>
          )}

          {/* Failed — retry CTA (S1) */}
          {payment.status === "failed" && (
            <div
              className="mt-3 px-3 py-3 rounded-xl"
              style={{ background: "rgba(247,148,29,0.06)", border: "1px solid rgba(247,148,29,0.15)" }}
            >
              <div className="flex items-start gap-2 mb-3">
                <AlertCircle size={13} className="flex-shrink-0 mt-0.5" style={{ color: "#F7941D" }} />
                <p className="text-xs" style={{ color: "#F7941D" }}>
                  Payment was not processed. Please rebook your session to try again.
                </p>
              </div>
              {/* S1: Retry CTA */}
              <Link
                href="/client/appointments"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                style={{ background: "#F7941D" }}
              >
                <RefreshCw size={11} /> Rebook Session
              </Link>
            </div>
          )}

          {/* Pending — complete payment CTA (S2) */}
          {payment.status === "pending" && (
            <div
              className="mt-3 px-3 py-3 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              style={{ background: "rgba(247,148,29,0.06)", border: "1px solid rgba(247,148,29,0.2)" }}
            >
              <div className="flex items-center gap-2">
                <Clock size={13} style={{ color: "#C4700A" }} />
                <p className="text-xs font-medium" style={{ color: "#C4700A" }}>
                  Awaiting payment confirmation
                </p>
              </div>
              <Link
                href="/client/appointments"
                className="inline-flex items-center justify-center gap-1 text-xs font-semibold flex-shrink-0 min-h-[44px] px-3 rounded-lg"
                style={{ color: "#2A4A1A", background: "rgba(42,74,26,0.06)" }}
              >
                View Booking <ArrowUpRight size={11} />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function ClientPaymentsPage() {
  const { user } = useAuth();

  const [payments,   setPayments]   = useState<Payment[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);   // FIX 1
  const [filter,     setFilter]     = useState<"all" | PaymentStatus>("all");

  // FIX 1: try/catch + FIX 4: onSnapshot for live status updates
  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(
      query(
        collection(db, "payments"),
        where("clientId", "==", user.uid),
        orderBy("createdAt", "desc"),
      ),
      (snap) => {
        setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Payment));
        setLoading(false);
      },
      (err) => {
        console.error("[Payments]", err);
        setFetchError("Could not load payment history. Please refresh.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const filtered = payments.filter(p => filter === "all" || p.status === filter);

  // FIX 9: Only sum USD completed payments (platform base currency)
  const totalSpent = payments
    .filter(p => p.status === "completed" && (p.currency === "USD" || !p.currency))
    .reduce((sum, p) => sum + p.amount, 0);

  const totalSessions = payments.filter(p => p.status === "completed").length;
  const pendingCount  = payments.filter(p => p.status === "pending").length;

  // FIX 5: Only show tabs that have at least one record (except "All")
  // FIX 10: Include "cancelled" in the filter tabs
  const TAB_STATUSES: ("all" | PaymentStatus)[] = [
    "all", "completed", "pending", "failed", "refunded", "cancelled",
  ];
  const visibleTabs = TAB_STATUSES.filter(f => {
    if (f === "all") return true;
    return payments.some(p => p.status === f);
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Subtitle only — page name lives in the sticky header */}
      <p className="text-sm" style={{ color: "#8A9BA8" }}>
        Your billing history and transaction records
      </p>

      {/* Summary cards */}
      {/* FIX 3: Use ACCENT_RGBA map instead of string-concatenated hex alpha */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "Total Spent",   value: fmtCurrency(totalSpent), accent: "#2A4A1A", Icon: DollarSign },
          { label: "Sessions Paid", value: totalSessions,           accent: "#8DC63F", Icon: Calendar   },
          { label: "Pending",       value: pendingCount,            accent: "#F7941D", Icon: Clock      },
        ].map(({ label, value, accent, Icon }) => (
          <div
            key={label}
            className="rounded-2xl p-4 flex items-center gap-3"
            style={{ background: "white", boxShadow: "0 1px 4px rgba(42,74,26,0.07)" }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: ACCENT_RGBA[accent] ?? "rgba(42,74,26,0.08)" }}
            >
              <Icon size={16} style={{ color: accent }} />
            </div>
            <div>
              <p
                className="text-lg font-bold leading-none"
                style={{ fontFamily: "var(--font-dm-serif)", color: "#2A4A1A" }}
              >
                {value}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "#8A9BA8" }}>{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* FIX 1: Error state */}
      {fetchError && (
        <div
          className="rounded-2xl p-4 flex items-start gap-3"
          style={{ background: "rgba(247,148,29,0.06)", border: "1px solid rgba(247,148,29,0.15)" }}
        >
          <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" style={{ color: "#F7941D" }} />
          <p className="text-sm" style={{ color: "#F7941D" }}>{fetchError}</p>
        </div>
      )}

      {/* FIX 5+10: Filter tabs — hidden when count is 0, includes "cancelled" */}
      {!loading && payments.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap scroll-x-touch">
          {visibleTabs.map(f => {
            const count = f === "all" ? payments.length : payments.filter(p => p.status === f).length;
            const isActive = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-3 py-2.5 min-h-[44px] rounded-xl text-xs font-semibold capitalize transition-all"
                style={{
                  background: isActive ? "#2A4A1A" : "white",
                  color:      isActive ? "white"   : "#4A5568",
                  boxShadow:  isActive ? "none"    : "0 1px 3px rgba(42,74,26,0.07)",
                }}
              >
                {f === "all"
                  ? `All (${count})`
                  : `${f.charAt(0).toUpperCase() + f.slice(1)} (${count})`}
              </button>
            );
          })}
        </div>
      )}

      {/* Payment list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={28} className="animate-spin" style={{ color: "#8DC63F" }} />
        </div>
      ) : filtered.length === 0 ? (
        <div
          className="rounded-2xl p-12 text-center"
          style={{ background: "white", boxShadow: "0 1px 4px rgba(42,74,26,0.07)" }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
            style={{ background: "rgba(141,198,63,0.08)" }}
          >
            <CreditCard size={24} style={{ color: "#8DC63F" }} />
          </div>
          <p className="text-sm font-medium mb-1" style={{ color: "#2A4A1A" }}>
            {filter === "all" ? "No payments yet" : `No ${filter} payments`}
          </p>
          {/* S3: Explain the flow to first-time users */}
          <p className="text-xs mb-0" style={{ color: "#8A9BA8" }}>
            {filter === "all" ? (
              <>
                Payments appear here after you book a session.
                <br />
                <Link
                  href="/client/appointments"
                  className="underline mt-1 inline-block"
                  style={{ color: "#2A4A1A" }}
                >
                  Book your first session →
                </Link>
              </>
            ) : (
              "Try viewing all payments."
            )}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => <PaymentCard key={p.id} payment={p} />)}
        </div>
      )}

      {/* Security note */}
      <div
        className="rounded-xl p-4 flex items-start gap-3"
        style={{ background: "rgba(42,74,26,0.03)", border: "1px solid rgba(42,74,26,0.07)" }}
      >
        <Lock size={13} className="flex-shrink-0 mt-0.5" style={{ color: "#8A9BA8" }} />
        <p className="text-xs" style={{ color: "#8A9BA8" }}>
          Payments are processed securely by Stripe. Valeo does not store your card details.
          For billing questions, contact{" "}
          <a
            href="mailto:support@valeoexperience.com"
            style={{ color: "#2A4A1A" }}
          >
            support@valeoexperience.com
          </a>
        </p>
      </div>
    </div>
  );
}
