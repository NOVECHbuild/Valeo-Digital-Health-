"use client";

import { useState, useEffect, useMemo } from "react";
import {
  collection, getDocs, addDoc, orderBy, query,
  doc, getDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import { authedFetch } from "@/lib/authedFetch";
import { computeSettlement } from "@/lib/settlement";
import {
  DollarSign, TrendingUp, TrendingDown,
  Search, X, Loader2, CheckCircle, Clock,
  XCircle, ArrowUpRight, Filter, Download,
  CreditCard, Plus, ChevronDown,
  FileText, User, Calendar, Receipt, Banknote,
  Globe, AlertCircle, Send, Mail,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────
type PaymentStatus = "pending" | "completed" | "failed" | "refunded" | "cancelled";
type PaymentSource = "online" | "manual";

interface Transaction {
  id:          string;
  source:      PaymentSource;
  clientId:    string;
  clientName:  string;
  clientEmail: string;
  amount:      number;
  currency:    string;
  status:      PaymentStatus;
  sessionType: string;
  method:      string;
  reference:   string;
  description: string;
  date:        string;
  createdAt:   any;
}

interface UserDoc { uid: string; displayName: string; email: string; role: string; }

interface Payout {
  id: string;
  amount: number;
  currency: string;
  periodLabel: string;
  reference: string;
  notes: string;
  status: "sent";
  feePercentApplied: number;
  receiptSent: boolean;
  receiptSkipped?: boolean;
  receiptError?: string | null;
  receiptTo?: string;
  recordedBy: string;
  createdAt: any;
}

interface PlatformSettlementCfg {
  platformFeePercent: number;
  minPayoutUsd: number;
  payoutReceiptEmail: string;
}

const PAYMENT_METHODS = ["Cash", "Bank Transfer", "Zelle", "PayPal", "Cheque", "Other"];
const SETTLEMENT_DEFAULTS: PlatformSettlementCfg = {
  platformFeePercent: 10,
  minPayoutUsd: 100,
  payoutReceiptEmail: "",
};

// ── Helpers ────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<PaymentStatus, { label: string; bg: string; color: string; Icon: any }> = {
  completed: { label: "Paid",      bg: "rgba(141,198,63,0.12)",  color: "#6BA028", Icon: CheckCircle  },
  pending:   { label: "Pending",   bg: "rgba(247,148,29,0.12)",  color: "#C4700A", Icon: Clock        },
  failed:    { label: "Failed",    bg: "rgba(247,148,29,0.12)",   color: "#F7941D", Icon: XCircle      },
  refunded:  { label: "Refunded",  bg: "rgba(138,155,168,0.12)", color: "#8A9BA8", Icon: ArrowUpRight },
  cancelled: { label: "Cancelled", bg: "rgba(138,155,168,0.12)", color: "#8A9BA8", Icon: XCircle      },
};

function StatusBadge({ status }: { status: PaymentStatus }) {
  const s = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const { Icon } = s;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: s.bg, color: s.color }}>
      <Icon size={10} />{s.label}
    </span>
  );
}

function SourceBadge({ source }: { source: PaymentSource }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium"
      style={{
        background: source === "manual" ? "rgba(247,148,29,0.1)" : "rgba(42,74,26,0.06)",
        color:      source === "manual" ? "#C4700A" : "#4A5568",
      }}>
      {source === "manual" ? <Banknote size={10} /> : <Globe size={10} />}
      {source === "manual" ? "Manual" : "Online"}
    </span>
  );
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}
function fmtFull(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}
function getDate(t: Transaction): Date | null {
  if (t.createdAt?.toDate) return t.createdAt.toDate();
  if (t.createdAt) return new Date(t.createdAt);
  return null;
}

// ── Monthly Chart ──────────────────────────────────────────────────────────
function RevenueChart({ transactions }: { transactions: Transaction[] }) {
  const months = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d     = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      const key   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-US", { month: "short" });
      const online = transactions
        .filter(t => { if (t.status !== "completed" || t.source !== "online") return false; const td = getDate(t); return td && `${td.getFullYear()}-${String(td.getMonth()+1).padStart(2,"0")}` === key; })
        .reduce((s, t) => s + t.amount, 0);
      const manual = transactions
        .filter(t => { if (t.status !== "completed" || t.source !== "manual") return false; const td = getDate(t); return td && `${td.getFullYear()}-${String(td.getMonth()+1).padStart(2,"0")}` === key; })
        .reduce((s, t) => s + t.amount, 0);
      return { label, online, manual, total: online + manual };
    });
  }, [transactions]);

  const max = Math.max(...months.map(m => m.total), 1);

  return (
    <div className="rounded-2xl p-5" style={{ background: "white", boxShadow: "0 1px 4px rgba(42,74,26,0.07)" }}>
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-sm font-semibold" style={{ color: "#2A4A1A" }}>Monthly Revenue</p>
          <p className="text-xs" style={{ color: "#8A9BA8" }}>Last 6 months — all completed payments</p>
        </div>
        <div className="flex items-center gap-4 text-xs" style={{ color: "#8A9BA8" }}>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#8DC63F" }} /> Online</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: "#F7941D" }} /> Manual</span>
        </div>
      </div>
      <div className="flex items-end gap-3 justify-between">
        {months.map(m => (
          <div key={m.label} className="flex-1 flex flex-col items-center gap-1">
            <p className="text-xs font-medium" style={{ color: "#8A9BA8" }}>{m.total > 0 ? fmt(m.total) : ""}</p>
            <div className="w-full flex flex-col rounded-t-lg overflow-hidden"
              style={{ height: "60px", background: "rgba(42,74,26,0.04)", justifyContent: "flex-end" }}>
              <div style={{ height: `${(m.total / max) * 100}%`, minHeight: m.total > 0 ? "4px" : "0", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                {m.manual > 0 && <div style={{ height: `${(m.manual / m.total) * 100}%`, background: "#F7941D", minHeight: "3px" }} />}
                {m.online > 0 && <div style={{ height: `${(m.online / m.total) * 100}%`, background: "linear-gradient(180deg, #8DC63F, #2A4A1A)", minHeight: "3px" }} />}
              </div>
            </div>
            <span className="text-xs" style={{ color: "#C4C4C4" }}>{m.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Manual Payment Drawer ──────────────────────────────────────────────────
function ManualPaymentDrawer({ clients, onClose, onSave }: {
  clients: UserDoc[];
  onClose: () => void;
  onSave: (tx: Transaction) => void;
}) {
  const { user } = useAuth();
  const [search,  setSearch]  = useState("");
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");
  const [form, setForm] = useState({
    clientId: "", clientName: "", clientEmail: "",
    amount: "", method: "Cash", description: "", reference: "",
    date: new Date().toISOString().slice(0, 10), sessionType: "",
  });

  const filteredClients = clients.filter(c =>
    c.displayName?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  function selectClient(c: UserDoc) {
    setForm(f => ({ ...f, clientId: c.uid, clientName: c.displayName, clientEmail: c.email }));
    setSearch(c.displayName);
  }

  async function handleSave() {
    setError("");
    if (!form.clientId)       return setError("Please select a client.");
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) return setError("Enter a valid amount.");
    if (!form.description.trim()) return setError("Description is required.");
    setSaving(true);
    try {
      const payload = {
        clientId: form.clientId, clientName: form.clientName, clientEmail: form.clientEmail,
        amount: Number(form.amount), currency: "USD", method: form.method,
        description: form.description.trim(), reference: form.reference.trim(),
        date: form.date, sessionType: form.sessionType.trim() || form.description.trim(),
        recordedBy: user?.displayName ?? "Admin", status: "completed",
        source: "manual", type: "manual", createdAt: serverTimestamp(),
      };
      const docRef = await addDoc(collection(db, "manualPayments"), payload);
      onSave({ id: docRef.id, ...payload, createdAt: new Date() } as unknown as Transaction);
      onClose();
    } catch { setError("Failed to save payment."); }
    finally { setSaving(false); }
  }

  const inputCls = "w-full px-4 py-3 rounded-xl text-sm outline-none";
  const inputStyle = { background: "#F8F9FA", border: "1px solid rgba(30,56,16,0.1)", color: "#1E3810" };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md h-full flex flex-col"
        style={{ background: "white", boxShadow: "-8px 0 32px rgba(0,0,0,0.15)" }}>
        <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: "rgba(30,56,16,0.08)" }}>
          <div>
            <h3 style={{ fontFamily: "var(--font-dm-serif)", fontSize: "20px", color: "#1E3810" }}>Record Manual Payment</h3>
            <p className="text-xs mt-0.5" style={{ color: "#8A9BA8" }}>Log a cash or offline payment</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-black/5"><X size={18} style={{ color: "#8A9BA8" }} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-medium"
              style={{ background: "rgba(247,148,29,0.08)", color: "#F7941D", border: "1px solid rgba(247,148,29,0.2)" }}>
              <AlertCircle size={13} /> {error}
            </div>
          )}
          {/* Client */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#8A9BA8" }}>Client *</p>
            <div className="relative">
              <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 z-10" style={{ color: "#8A9BA8" }} />
              <input type="text" value={search}
                onChange={e => { setSearch(e.target.value); setForm(f => ({ ...f, clientId: "", clientName: "", clientEmail: "" })); }}
                placeholder="Search by name or email..."
                className={inputCls} style={{ ...inputStyle, paddingLeft: "40px" }} />
              {search && !form.clientId && filteredClients.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-30 py-1"
                  style={{ background: "white", boxShadow: "0 4px 20px rgba(30,56,16,0.15)", maxHeight: "180px", overflowY: "auto" }}>
                  {filteredClients.map(c => (
                    <button key={c.uid} onClick={() => selectClient(c)} className="w-full text-left px-4 py-3 hover:bg-black/5">
                      <p className="text-sm font-medium" style={{ color: "#1E3810" }}>{c.displayName}</p>
                      <p className="text-xs" style={{ color: "#8A9BA8" }}>{c.email}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {form.clientId && (
              <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ background: "rgba(141,198,63,0.06)", border: "1px solid rgba(141,198,63,0.2)" }}>
                <CheckCircle size={13} style={{ color: "#8DC63F" }} />
                <span className="text-xs font-medium" style={{ color: "#6BA028" }}>{form.clientName}</span>
              </div>
            )}
          </div>
          {/* Amount + Method */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#8A9BA8" }}>Amount (USD) *</p>
              <div className="relative">
                <DollarSign size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "#8A9BA8" }} />
                <input type="number" min="0" step="0.01" value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00" className={inputCls} style={{ ...inputStyle, paddingLeft: "40px" }} />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#8A9BA8" }}>Method</p>
              <div className="relative">
                <select value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))}
                  className={inputCls} style={{ ...inputStyle, appearance: "none", paddingRight: "32px" }}>
                  {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#8A9BA8" }} />
              </div>
            </div>
          </div>
          {/* Session Type */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#8A9BA8" }}>Session Type</p>
            <input type="text" value={form.sessionType} onChange={e => setForm(f => ({ ...f, sessionType: e.target.value }))}
              placeholder="e.g. Individual Therapy" className={inputCls} style={inputStyle} />
          </div>
          {/* Description */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#8A9BA8" }}>Description *</p>
            <div className="relative">
              <FileText size={15} className="absolute left-3.5 top-3.5" style={{ color: "#8A9BA8" }} />
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={3} placeholder="e.g. Individual therapy session — March 8"
                className={inputCls + " resize-none"} style={{ ...inputStyle, paddingLeft: "40px" }} />
            </div>
          </div>
          {/* Reference + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#8A9BA8" }}>Reference #</p>
              <input type="text" value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                placeholder="INV-001" className={inputCls} style={inputStyle} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#8A9BA8" }}>Date</p>
              <div className="relative">
                <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#8A9BA8" }} />
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className={inputCls} style={{ ...inputStyle, paddingLeft: "36px" }} />
              </div>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t flex gap-3" style={{ borderColor: "rgba(30,56,16,0.08)" }}>
          <button onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-semibold"
            style={{ background: "rgba(30,56,16,0.05)", color: "#4A5568" }}>Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)", opacity: saving ? 0.7 : 1 }}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : <CreditCard size={15} />}
            {saving ? "Saving…" : "Record Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Record Valeo payout drawer ─────────────────────────────────────────────
function RecordPayoutDrawer({
  suggestedAmount,
  feePercent,
  receiptEmail,
  onClose,
  onSaved,
}: {
  suggestedAmount: number;
  feePercent: number;
  receiptEmail: string;
  onClose: () => void;
  onSaved: (p: Payout) => void;
}) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [sendReceipt, setSendReceipt] = useState(true);
  const [form, setForm] = useState({
    amount: suggestedAmount > 0 ? String(suggestedAmount) : "",
    periodLabel: new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    reference: "",
    notes: "",
  });

  async function handleSave() {
    setError("");
    const amount = Number(form.amount);
    if (!amount || amount <= 0) return setError("Enter a valid transfer amount.");
    if (!form.periodLabel.trim()) return setError("Period label is required (e.g. August 2026).");
    if (sendReceipt && !receiptEmail.includes("@")) {
      return setError("Set Valeo payout receipt email in Platform Settings first, or uncheck Send receipt.");
    }
    setSaving(true);
    try {
      const payload = {
        amount,
        currency: "USD",
        periodLabel: form.periodLabel.trim(),
        reference: form.reference.trim(),
        notes: form.notes.trim(),
        status: "sent" as const,
        feePercentApplied: feePercent,
        receiptSent: false,
        recordedBy: user?.displayName ?? user?.email ?? "Admin",
        createdAt: serverTimestamp(),
      };
      const docRef = await addDoc(collection(db, "payouts"), payload);
      let receiptSent = false;
      let receiptSkipped = false;
      let receiptError: string | null = null;
      let receiptTo = "";

      if (sendReceipt) {
        const res = await authedFetch("/api/email/payout-receipt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payoutId: docRef.id,
            amount,
            currency: "USD",
            periodLabel: payload.periodLabel,
            reference: payload.reference,
            notes: payload.notes,
            feePercentApplied: feePercent,
            sentAt: new Date().toISOString(),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          receiptError = data.error || "Receipt email failed";
        } else {
          receiptSent = !!data.ok && !data.skipped;
          receiptSkipped = !!data.skipped;
          receiptTo = data.to || receiptEmail;
        }
      }

      const saved: Payout = {
        id: docRef.id,
        ...payload,
        receiptSent,
        receiptSkipped,
        receiptError,
        receiptTo,
        createdAt: new Date(),
      };
      onSaved(saved);
      onClose();
    } catch {
      setError("Failed to record payout.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full px-4 py-3 rounded-xl text-sm outline-none";
  const inputStyle = { background: "#F8F9FA", border: "1px solid rgba(30,56,16,0.1)", color: "#1E3810" };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md h-full flex flex-col"
        style={{ background: "white", boxShadow: "-8px 0 32px rgba(0,0,0,0.15)" }}>
        <div className="flex items-center justify-between px-6 py-5 border-b" style={{ borderColor: "rgba(30,56,16,0.08)" }}>
          <div>
            <h3 style={{ fontFamily: "var(--font-dm-serif)", fontSize: "20px", color: "#1E3810" }}>Record Valeo payout</h3>
            <p className="text-xs mt-0.5" style={{ color: "#8A9BA8" }}>Log a Mercury transfer to Valeo Experience Ltd.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-black/5"><X size={18} style={{ color: "#8A9BA8" }} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-medium"
              style={{ background: "rgba(247,148,29,0.08)", color: "#F7941D", border: "1px solid rgba(247,148,29,0.2)" }}>
              <AlertCircle size={13} /> {error}
            </div>
          )}
          <p className="text-xs" style={{ color: "#8A9BA8" }}>
            Suggested Valeo share (before Stripe fees): <strong style={{ color: "#1E3810" }}>{fmtFull(suggestedAmount)}</strong>.
            Enter the amount you actually transferred from Mercury.
          </p>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#8A9BA8" }}>Amount (USD) *</p>
            <div className="relative">
              <DollarSign size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "#8A9BA8" }} />
              <input type="number" min="0" step="0.01" value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className={inputCls} style={{ ...inputStyle, paddingLeft: "40px" }} />
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#8A9BA8" }}>Period *</p>
            <input type="text" value={form.periodLabel}
              onChange={e => setForm(f => ({ ...f, periodLabel: e.target.value }))}
              placeholder="e.g. August 2026" className={inputCls} style={inputStyle} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#8A9BA8" }}>Bank / Mercury reference</p>
            <input type="text" value={form.reference}
              onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
              placeholder="Transfer ID or memo" className={inputCls} style={inputStyle} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#8A9BA8" }}>Notes</p>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3} placeholder="Optional note for the receipt" className={inputCls + " resize-none"} style={inputStyle} />
          </div>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={sendReceipt} onChange={e => setSendReceipt(e.target.checked)}
              className="mt-1" />
            <span className="text-sm" style={{ color: "#1E3810" }}>
              Send settlement receipt email
              <span className="block text-xs mt-0.5" style={{ color: "#8A9BA8" }}>
                {receiptEmail ? `To ${receiptEmail}` : "Set receipt email in Platform Settings first"}
              </span>
            </span>
          </label>
        </div>
        <div className="px-6 py-4 border-t flex gap-3" style={{ borderColor: "rgba(30,56,16,0.08)" }}>
          <button onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-semibold"
            style={{ background: "rgba(30,56,16,0.05)", color: "#4A5568" }}>Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)", opacity: saving ? 0.7 : 1 }}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            {saving ? "Saving…" : "Record payout"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── CSV Export ─────────────────────────────────────────────────────────────
function exportCSV(transactions: Transaction[]) {
  const headers = ["Date","Client","Email","Session Type","Description","Amount (USD)","Method","Source","Status","Reference"];
  const rows = transactions.map(t => {
    const d = getDate(t);
    return [d ? d.toLocaleDateString() : t.date ?? "", t.clientName, t.clientEmail,
      t.sessionType || "", t.description || "", t.amount.toFixed(2),
      t.method || "", t.source, t.status, t.reference || ""];
  });
  const csv = [headers, ...rows].map(r => r.map(String).map(v => `"${v.replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url;
  a.download = `valeo-financials-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function AdminFinancialsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [payouts,      setPayouts]      = useState<Payout[]>([]);
  const [settlementCfg, setSettlementCfg] = useState<PlatformSettlementCfg>(SETTLEMENT_DEFAULTS);
  const [clients,      setClients]      = useState<UserDoc[]>([]);
  const [users,        setUsers]        = useState<Record<string, UserDoc>>({});
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [filter,       setFilter]       = useState<"all" | PaymentStatus>("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | PaymentSource>("all");
  const [dateFrom,     setDateFrom]     = useState("");
  const [dateTo,       setDateTo]       = useState("");
  const [showFilters,  setShowFilters]  = useState(false);
  const [showDrawer,   setShowDrawer]   = useState(false);
  const [showPayoutDrawer, setShowPayoutDrawer] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [paySnap, manualSnap, userSnap, settingsSnap] = await Promise.all([
          getDocs(query(collection(db, "payments"),       orderBy("createdAt", "desc"))),
          getDocs(query(collection(db, "manualPayments"), orderBy("createdAt", "desc"))),
          getDocs(collection(db, "users")),
          getDoc(doc(db, "settings", "platform")),
        ]);

        if (settingsSnap.exists()) {
          const s = settingsSnap.data() as any;
          setSettlementCfg({
            platformFeePercent: Number(s.platformFeePercent) || SETTLEMENT_DEFAULTS.platformFeePercent,
            minPayoutUsd: Number(s.minPayoutUsd) || SETTLEMENT_DEFAULTS.minPayoutUsd,
            payoutReceiptEmail: String(s.payoutReceiptEmail || ""),
          });
        }

        try {
          const payoutSnap = await getDocs(query(collection(db, "payouts"), orderBy("createdAt", "desc")));
          setPayouts(payoutSnap.docs.map(d => {
            const data = d.data() as any;
            return {
              id: d.id,
              amount: data.amount ?? 0,
              currency: data.currency ?? "USD",
              periodLabel: data.periodLabel ?? "",
              reference: data.reference ?? "",
              notes: data.notes ?? "",
              status: "sent",
              feePercentApplied: data.feePercentApplied ?? 10,
              receiptSent: !!data.receiptSent,
              receiptSkipped: !!data.receiptSkipped,
              receiptError: data.receiptError ?? null,
              receiptTo: data.receiptTo ?? "",
              recordedBy: data.recordedBy ?? "Admin",
              createdAt: data.createdAt,
            } as Payout;
          }));
        } catch {
          setPayouts([]);
        }

        const userMap: Record<string, UserDoc> = {};
        userSnap.docs.forEach(d => { userMap[d.id] = { uid: d.id, ...d.data() } as UserDoc; });
        setUsers(userMap);
        setClients(userSnap.docs.map(d => ({ uid: d.id, ...d.data() } as UserDoc)).filter(u => u.role === "client"));

        const online: Transaction[] = paySnap.docs.map(d => {
          const data = d.data() as any;
          return {
            id: d.id, source: "online" as PaymentSource,
            clientId: data.clientId ?? "", clientName: userMap[data.clientId]?.displayName ?? data.clientName ?? "Unknown",
            clientEmail: userMap[data.clientId]?.email ?? "", amount: data.amount ?? 0, currency: data.currency ?? "USD",
            status: data.status ?? "pending", sessionType: data.sessionType ?? "", method: data.provider ?? data.gateway ?? "Stripe",
            reference: data.reference ?? "", description: data.sessionType ?? "", date: data.sessionDate ?? "",
            createdAt: data.createdAt,
          };
        });

        const manual: Transaction[] = manualSnap.docs.map(d => {
          const data = d.data() as any;
          return {
            id: d.id, source: "manual" as PaymentSource,
            clientId: data.clientId ?? "", clientName: data.clientName ?? userMap[data.clientId]?.displayName ?? "Unknown",
            clientEmail: data.clientEmail ?? userMap[data.clientId]?.email ?? "", amount: data.amount ?? 0, currency: data.currency ?? "USD",
            status: (data.status ?? "completed") as PaymentStatus, sessionType: data.sessionType ?? data.description ?? "",
            method: data.method ?? "Cash", reference: data.reference ?? "", description: data.description ?? "",
            date: data.date ?? "", createdAt: data.createdAt,
          };
        });

        const all = [...online, ...manual].sort((a, b) => {
          const da = getDate(a)?.getTime() ?? 0;
          const db2 = getDate(b)?.getTime() ?? 0;
          return db2 - da;
        });
        setTransactions(all);
      } finally { setLoading(false); }
    })();
  }, []);

  const completed     = transactions.filter(t => t.status === "completed");
  const revenue       = completed.reduce((s, t) => s + t.amount, 0);
  const manualRev     = completed.filter(t => t.source === "manual").reduce((s, t) => s + t.amount, 0);
  const onlineRev     = completed.filter(t => t.source === "online").reduce((s, t) => s + t.amount, 0);
  const pending       = transactions.filter(t => t.status === "pending").reduce((s, t) => s + t.amount, 0);

  const now   = new Date();
  const thisM = completed.filter(t => { const d = getDate(t); return d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).reduce((s, t) => s + t.amount, 0);
  const lastM = completed.filter(t => { const d = getDate(t); const lm = new Date(now.getFullYear(), now.getMonth()-1,1); return d && d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear(); }).reduce((s, t) => s + t.amount, 0);
  const growth = lastM > 0 ? Math.round(((thisM - lastM) / lastM) * 100) : null;

  const filtered = useMemo(() => transactions.filter(t => {
    const matchStatus = filter === "all" || t.status === filter;
    const matchSource = sourceFilter === "all" || t.source === sourceFilter;
    const matchSearch = !search || t.clientName.toLowerCase().includes(search.toLowerCase()) || t.sessionType.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase()) || t.reference.toLowerCase().includes(search.toLowerCase());
    const d = getDate(t);
    const matchFrom = !dateFrom || (d && d >= new Date(dateFrom));
    const matchTo   = !dateTo   || (d && d <= new Date(dateTo + "T23:59:59"));
    return matchStatus && matchSource && matchSearch && matchFrom && matchTo;
  }), [transactions, filter, sourceFilter, search, dateFrom, dateTo]);

  const filteredRevenue = filtered.filter(t => t.status === "completed").reduce((s, t) => s + t.amount, 0);
  const hasFilters = filter !== "all" || sourceFilter !== "all" || !!search || !!dateFrom || !!dateTo;

  const settlement = useMemo(
    () => computeSettlement(
      transactions,
      payouts,
      settlementCfg.platformFeePercent,
      settlementCfg.minPayoutUsd,
    ),
    [transactions, payouts, settlementCfg],
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {showDrawer && (
        <ManualPaymentDrawer clients={clients} onClose={() => setShowDrawer(false)}
          onSave={tx => setTransactions(prev => [tx, ...prev])} />
      )}
      {showPayoutDrawer && (
        <RecordPayoutDrawer
          suggestedAmount={settlement.outstanding}
          feePercent={settlement.feePercent}
          receiptEmail={settlementCfg.payoutReceiptEmail}
          onClose={() => setShowPayoutDrawer(false)}
          onSaved={p => setPayouts(prev => [p, ...prev])}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl" style={{ fontFamily: "var(--font-dm-serif)", color: "#1E3810" }}>Financials</h2>
          <p className="text-sm mt-0.5" style={{ color: "#8A9BA8" }}>Platform revenue, Valeo settlement, and billing overview</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => exportCSV(filtered)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border hover:-translate-y-0.5 transition-all"
            style={{ borderColor: "rgba(30,56,16,0.15)", color: "#1E3810", background: "white" }}>
            <Download size={14} /> Export CSV
          </button>
          <button onClick={() => setShowPayoutDrawer(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border hover:-translate-y-0.5 transition-all"
            style={{ borderColor: "rgba(247,148,29,0.4)", color: "#C4700A", background: "rgba(247,148,29,0.08)" }}>
            <Send size={14} /> Record Valeo payout
          </button>
          <button onClick={() => setShowDrawer(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:-translate-y-0.5 transition-all"
            style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)" }}>
            <Plus size={14} /> Record Payment
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Revenue",  value: fmt(revenue),   sub: `${fmt(thisM)} this month`, accent: "#2A4A1A", Icon: DollarSign, trend: growth },
          { label: "Pending",        value: fmt(pending),   sub: `${transactions.filter(t=>t.status==="pending").length} transactions`, accent: "#F7941D", Icon: Clock, trend: null },
          { label: "Online Revenue", value: fmt(onlineRev), sub: `${completed.filter(t=>t.source==="online").length} transactions`, accent: "#8DC63F", Icon: Globe,    trend: null },
          { label: "Manual Revenue", value: fmt(manualRev), sub: `${completed.filter(t=>t.source==="manual").length} transactions`, accent: "#C4700A", Icon: Banknote, trend: null },
        ].map(({ label, value, sub, accent, Icon, trend }) => (
          <div key={label} className="rounded-2xl p-5" style={{ background: "white", boxShadow: "0 1px 4px rgba(30,56,16,0.07)" }}>
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: accent + "12" }}>
                <Icon size={16} style={{ color: accent }} />
              </div>
              {trend !== null && (
                <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: trend >= 0 ? "#6BA028" : "#F7941D" }}>
                  {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{Math.abs(trend)}%
                </span>
              )}
            </div>
            <p className="text-2xl font-bold" style={{ fontFamily: "var(--font-dm-serif)", color: "#1E3810" }}>{value}</p>
            <p className="text-xs mt-0.5" style={{ color: "#8A9BA8" }}>{label}</p>
            <p className="text-xs mt-1" style={{ color: "#C4C4C4" }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* Valeo settlement */}
      <div className="rounded-2xl p-5 space-y-4" style={{ background: "white", boxShadow: "0 1px 4px rgba(30,56,16,0.07)" }}>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-semibold" style={{ color: "#2A4A1A" }}>Valeo settlement</p>
            <p className="text-xs mt-0.5" style={{ color: "#8A9BA8" }}>
              Online completed payments only · NOVECH fee {settlement.feePercent}% · Min transfer {fmtFull(settlement.minPayoutUsd)}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{
              background: settlement.canPayout ? "rgba(141,198,63,0.12)" : "rgba(247,148,29,0.12)",
              color: settlement.canPayout ? "#6BA028" : "#C4700A",
            }}>
            {settlement.canPayout ? "Ready to pay (≥ minimum)" : "Hold — under minimum or zero"}
          </span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { label: "Gross online", value: fmtFull(settlement.grossOnline) },
            { label: "NOVECH fee", value: fmtFull(settlement.platformFee) },
            { label: "Suggested Valeo", value: fmtFull(settlement.suggestedValeo) },
            { label: "Paid out", value: fmtFull(settlement.totalPaidOut) },
            { label: "Outstanding", value: fmtFull(settlement.outstanding) },
          ].map(row => (
            <div key={row.label} className="rounded-xl px-3 py-3" style={{ background: "rgba(42,74,26,0.04)" }}>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "#8A9BA8" }}>{row.label}</p>
              <p className="text-base font-bold" style={{ color: "#1E3810" }}>{row.value}</p>
            </div>
          ))}
        </div>
        <p className="text-xs flex items-start gap-1.5" style={{ color: "#8A9BA8" }}>
          <AlertCircle size={12} style={{ marginTop: 1, flexShrink: 0 }} />
          Suggested share is gross × (1 − fee%). Stripe fees are Valeo&apos;s and already reduce what lands in Mercury — enter the real transfer amount when you record a payout.
          {!settlementCfg.payoutReceiptEmail && " Set a receipt email in Platform Settings to email Valeo when you pay."}
        </p>

        {payouts.length > 0 && (
          <div className="pt-2" style={{ borderTop: "1px solid rgba(30,56,16,0.06)" }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#8A9BA8" }}>Payout history</p>
            <div className="space-y-2">
              {payouts.map(p => {
                const d = p.createdAt?.toDate ? p.createdAt.toDate() : (p.createdAt ? new Date(p.createdAt) : null);
                return (
                  <div key={p.id} className="flex items-center justify-between gap-3 flex-wrap px-3 py-2.5 rounded-xl"
                    style={{ background: "#FAFAFA" }}>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "#1E3810" }}>{fmtFull(p.amount)}
                        <span className="font-normal text-xs ml-2" style={{ color: "#8A9BA8" }}>{p.periodLabel || "—"}</span>
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "#8A9BA8" }}>
                        {d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                        {p.reference ? ` · Ref ${p.reference}` : ""}
                        {` · Fee snapshot ${p.feePercentApplied}%`}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full"
                      style={{
                        background: p.receiptSent ? "rgba(141,198,63,0.12)" : "rgba(138,155,168,0.12)",
                        color: p.receiptSent ? "#6BA028" : "#8A9BA8",
                      }}>
                      <Mail size={11} />
                      {p.receiptSent ? "Receipt sent" : p.receiptSkipped ? "Receipt skipped (no Resend)" : p.receiptError ? "Receipt failed" : "No receipt"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Chart */}
      <RevenueChart transactions={transactions} />

      {/* Search + Filters */}
      <div className="space-y-3">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "#8A9BA8" }} />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by client, session type, or reference..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border focus:outline-none"
              style={{ borderColor: "rgba(30,56,16,0.12)", background: "white" }} />
            {search && <button onClick={() => setSearch("")} className="absolute right-3.5 top-1/2 -translate-y-1/2"><X size={13} style={{ color: "#8A9BA8" }} /></button>}
          </div>
          <button onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all"
            style={{ borderColor: showFilters ? "#1E3810" : "rgba(30,56,16,0.12)", background: showFilters ? "rgba(30,56,16,0.04)" : "white", color: "#1E3810" }}>
            <Filter size={14} /> Filters {hasFilters && <span className="w-2 h-2 rounded-full" style={{ background: "#F7941D" }} />}
          </button>
        </div>
        {showFilters && (
          <div className="flex flex-wrap gap-4 p-4 rounded-2xl" style={{ background: "white", boxShadow: "0 1px 4px rgba(30,56,16,0.07)" }}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#8A9BA8" }}>Status</p>
              <div className="flex gap-2 flex-wrap">
                {(["all","completed","pending","failed","refunded"] as const).map(f => (
                  <button key={f} onClick={() => setFilter(f)} className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize"
                    style={{ background: filter === f ? "#1E3810" : "rgba(30,56,16,0.04)", color: filter === f ? "white" : "#4A5568" }}>{f}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#8A9BA8" }}>Source</p>
              <div className="flex gap-2">
                {(["all","online","manual"] as const).map(s => (
                  <button key={s} onClick={() => setSourceFilter(s)} className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize"
                    style={{ background: sourceFilter === s ? "#1E3810" : "rgba(30,56,16,0.04)", color: sourceFilter === s ? "white" : "#4A5568" }}>{s}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#8A9BA8" }}>Date From</p>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-xs border focus:outline-none"
                style={{ borderColor: "rgba(30,56,16,0.12)", background: "#FAFAFA" }} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#8A9BA8" }}>Date To</p>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-xs border focus:outline-none"
                style={{ borderColor: "rgba(30,56,16,0.12)", background: "#FAFAFA" }} />
            </div>
            {hasFilters && (
              <div className="flex items-end">
                <button onClick={() => { setSearch(""); setFilter("all"); setSourceFilter("all"); setDateFrom(""); setDateTo(""); }}
                  className="text-xs font-semibold hover:underline" style={{ color: "#F7941D" }}>Clear all</button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "white", boxShadow: "0 1px 4px rgba(30,56,16,0.07)" }}>
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin" style={{ color: "#8DC63F" }} /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Receipt size={24} className="mx-auto mb-3" style={{ color: "#C4C4C4" }} />
            <p className="text-sm font-medium" style={{ color: "#1E3810" }}>No transactions found</p>
            <p className="text-xs mt-1" style={{ color: "#8A9BA8" }}>Try adjusting your filters.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(30,56,16,0.07)" }}>
                    {[
                      { label: "Client",   cls: "" },
                      { label: "Session",  cls: "hidden sm:table-cell" },
                      { label: "Date",     cls: "hidden md:table-cell" },
                      { label: "Amount",   cls: "" },
                      { label: "Method",   cls: "hidden sm:table-cell" },
                      { label: "Status",   cls: "" },
                      { label: "",         cls: "" },
                    ].map(({ label, cls }, i) => (
                      <th key={i} className={`text-left py-3 px-4 first:px-5 last:px-3 text-xs font-semibold uppercase tracking-wider ${cls}`}
                        style={{ color: "#8A9BA8" }}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(t => {
                    const d = getDate(t);
                    return (
                      <tr key={t.id} className="border-b hover:bg-black/[0.015] transition-colors"
                        style={{ borderColor: "rgba(30,56,16,0.05)" }}>
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                              style={{ background: "rgba(42,74,26,0.07)", color: "#2A4A1A" }}>
                              {(t.clientName ?? "?")[0]?.toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium" style={{ color: "#1E3810" }}>{t.clientName}</p>
                              <p className="text-xs" style={{ color: "#C4C4C4" }}>{t.clientEmail}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 hidden sm:table-cell">
                          <p className="text-sm" style={{ color: "#4A5568" }}>{t.sessionType || t.description || "—"}</p>
                          {t.reference && <p className="text-xs font-mono mt-0.5" style={{ color: "#C4C4C4" }}>#{t.reference}</p>}
                        </td>
                        <td className="py-3.5 px-4 hidden md:table-cell">
                          <p className="text-sm" style={{ color: "#4A5568" }}>
                            {d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : t.date || "—"}
                          </p>
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="text-sm font-semibold"
                            style={{ color: t.status === "refunded" ? "#8A9BA8" : "#1E3810", textDecoration: t.status === "refunded" ? "line-through" : "none" }}>
                            {fmtFull(t.amount)}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 hidden sm:table-cell">
                          <div className="space-y-1">
                            <p className="text-xs" style={{ color: "#4A5568" }}>{t.method || "—"}</p>
                            <SourceBadge source={t.source} />
                          </div>
                        </td>
                        <td className="py-3.5 px-4"><StatusBadge status={t.status} /></td>
                        <td className="py-3.5 px-3" />
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3.5 border-t flex items-center justify-between flex-wrap gap-2"
              style={{ borderColor: "rgba(30,56,16,0.06)" }}>
              <p className="text-xs" style={{ color: "#8A9BA8" }}>
                {filtered.length} transaction{filtered.length !== 1 ? "s" : ""} {hasFilters ? "· filtered" : "· all time"}
              </p>
              <p className="text-sm font-semibold" style={{ color: "#1E3810" }}>
                Filtered revenue: <span style={{ color: "#6BA028" }}>{fmt(filteredRevenue)}</span>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
