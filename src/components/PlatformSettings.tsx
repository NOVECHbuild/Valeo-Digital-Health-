"use client";

import { useState, useEffect } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import {
  SlidersHorizontal, DollarSign, Percent, Coins, Mail,
  Wrench, UserPlus, Check, Loader2, AlertCircle, CheckCircle, Info,
} from "lucide-react";

// ════════════════════════════════════════════════════════════════════════════
//  PlatformSettings
//  Admin-only platform-level configuration, stored in settings/platform.
//  Pricing / fee / currency / settlement fields for billing + Valeo payouts.
//  Maintenance mode + beta registration are stored now; enforcement wiring
//  (middleware / register page) is a separate, flagged follow-up.
// ════════════════════════════════════════════════════════════════════════════

interface PlatformConfig {
  defaultSessionPrice: number;
  platformFeePercent:  number;
  minPayoutUsd:        number;
  payoutReceiptEmail:  string;
  currency:            string;
  maintenanceMode:     boolean;
  betaRegistration:    boolean;
}

const DEFAULTS: PlatformConfig = {
  defaultSessionPrice: 75,
  platformFeePercent:  10,
  minPayoutUsd:        100,
  payoutReceiptEmail:  "",
  currency:            "USD",
  maintenanceMode:     false,
  betaRegistration:    true,
};

const CURRENCIES = ["USD", "BBD"];

export default function PlatformSettings() {
  const { user } = useAuth();
  const [cfg,     setCfg]     = useState<PlatformConfig>(DEFAULTS);
  const [initCfg, setInitCfg] = useState<PlatformConfig>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [status,  setStatus]  = useState<"idle"|"saving"|"success"|"error">("idle");
  const [toast,   setToast]   = useState<{ msg: string; type: "success"|"error" } | null>(null);

  function showToast(msg: string, type: "success"|"error" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "settings", "platform"));
        const data = snap.exists() ? { ...DEFAULTS, ...snap.data() } as PlatformConfig : DEFAULTS;
        setCfg(data);
        setInitCfg(data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const dirty = JSON.stringify(cfg) !== JSON.stringify(initCfg);

  async function handleSave() {
    setStatus("saving");
    try {
      await setDoc(
        doc(db, "settings", "platform"),
        {
          ...cfg,
          defaultSessionPrice: Number(cfg.defaultSessionPrice) || 0,
          platformFeePercent:  Number(cfg.platformFeePercent)  || 0,
          minPayoutUsd:        Number(cfg.minPayoutUsd)        || 0,
          payoutReceiptEmail:  String(cfg.payoutReceiptEmail || "").trim(),
          updatedAt:           serverTimestamp(),
          updatedBy:           user?.displayName ?? user?.email ?? "Admin",
        },
        { merge: true }
      );
      setInitCfg(cfg);
      setStatus("success");
      showToast("Platform settings saved.");
      setTimeout(() => setStatus("idle"), 3000);
    } catch {
      setStatus("error");
      showToast("Failed to save platform settings.", "error");
      setTimeout(() => setStatus("idle"), 4000);
    }
  }

  return (
    <div className="max-w-2xl mx-auto mb-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-lg text-sm font-medium"
          style={{ background: toast.type === "success" ? "#2A4A1A" : "#F7941D", color: "white" }}>
          {toast.type === "success" ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      <div className="rounded-2xl overflow-hidden"
        style={{ background: "white", boxShadow: "0 1px 4px rgba(42,74,26,0.07)" }}>
        <div style={{ height: "3px", background: "linear-gradient(90deg, #F7941D, #C4700A)" }} />
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <SlidersHorizontal size={18} style={{ color: "#F7941D" }} />
              <h2 className="text-base font-semibold" style={{ color: "#2A4A1A" }}>Platform Settings</h2>
            </div>
            {dirty && (
              <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
                style={{ background: "rgba(247,148,29,0.12)", color: "#C4700A" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                Unsaved changes
              </span>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={22} className="animate-spin" style={{ color: "#F7941D" }} />
            </div>
          ) : (
            <div className="space-y-5">
              {/* Pricing row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#8A9BA8" }}>
                    Default Session Price
                  </label>
                  <div className="relative">
                    <DollarSign size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "#8A9BA8" }} />
                    <input type="number" min={0} value={cfg.defaultSessionPrice}
                      onChange={e => setCfg(c => ({ ...c, defaultSessionPrice: e.target.value === "" ? 0 : Number(e.target.value) }))}
                      className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none"
                      style={{ background: "#F8F9FA", border: "1px solid rgba(42,74,26,0.1)", color: "#2A4A1A" }} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#8A9BA8" }}>
                    Currency
                  </label>
                  <div className="relative">
                    <Coins size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 z-10" style={{ color: "#8A9BA8" }} />
                    <select value={cfg.currency}
                      onChange={e => setCfg(c => ({ ...c, currency: e.target.value }))}
                      className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none appearance-none"
                      style={{ background: "#F8F9FA", border: "1px solid rgba(42,74,26,0.1)", color: "#2A4A1A" }}>
                      {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ borderTop: "1px solid rgba(42,74,26,0.06)" }} />

              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#8A9BA8" }}>
                Valeo settlement (NOVECH fee)
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#8A9BA8" }}>
                    NOVECH platform fee (%)
                  </label>
                  <div className="relative">
                    <Percent size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "#8A9BA8" }} />
                    <input type="number" min={0} max={100} value={cfg.platformFeePercent}
                      onChange={e => setCfg(c => ({ ...c, platformFeePercent: e.target.value === "" ? 0 : Number(e.target.value) }))}
                      className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none"
                      style={{ background: "#F8F9FA", border: "1px solid rgba(42,74,26,0.1)", color: "#2A4A1A" }} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#8A9BA8" }}>
                    Minimum payout (USD)
                  </label>
                  <div className="relative">
                    <DollarSign size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "#8A9BA8" }} />
                    <input type="number" min={0} value={cfg.minPayoutUsd}
                      onChange={e => setCfg(c => ({ ...c, minPayoutUsd: e.target.value === "" ? 0 : Number(e.target.value) }))}
                      className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none"
                      style={{ background: "#F8F9FA", border: "1px solid rgba(42,74,26,0.1)", color: "#2A4A1A" }} />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#8A9BA8" }}>
                  Valeo payout receipt email
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "#8A9BA8" }} />
                  <input type="email" value={cfg.payoutReceiptEmail}
                    onChange={e => setCfg(c => ({ ...c, payoutReceiptEmail: e.target.value }))}
                    placeholder="e.g. jozellemiller@gmail.com"
                    className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: "#F8F9FA", border: "1px solid rgba(42,74,26,0.1)", color: "#2A4A1A" }} />
                </div>
              </div>

              <p className="text-xs flex items-start gap-1.5" style={{ color: "#8A9BA8" }}>
                <Info size={12} style={{ marginTop: "1px", flexShrink: 0 }} />
                Fee % and minimum drive the Admin → Financials settlement panel. Receipt email is used when you record a Mercury payout to Valeo. Stripe is not auto-split yet — you transfer manually and log it.
              </p>

              <div style={{ borderTop: "1px solid rgba(42,74,26,0.06)" }} />

              {/* Toggles */}
              {([
                { key: "maintenanceMode", icon: Wrench,   label: "Maintenance Mode",     sub: "Not enforced yet — saved for a future lock-out. Toggle has no effect on the live site today." },
                { key: "betaRegistration", icon: UserPlus, label: "Beta Registration",   sub: "Not enforced yet — invite-only stays until public registration is wired to this flag." },
              ] as { key: "maintenanceMode" | "betaRegistration"; icon: any; label: string; sub: string }[]).map(({ key, icon: Icon, label, sub }) => (
                <div key={key} className="flex items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <Icon size={16} style={{ color: "#F7941D", marginTop: "2px" }} />
                    <div>
                      <p className="text-sm font-medium" style={{ color: "#2A4A1A" }}>
                        {label}{" "}
                        <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
                          style={{ background: "rgba(247,148,29,0.12)", color: "#C4700A" }}>
                          Not enforced yet
                        </span>
                      </p>
                      <p className="text-xs" style={{ color: "#8A9BA8" }}>{sub}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setCfg(c => ({ ...c, [key]: !c[key] }))}
                    className="relative flex-shrink-0 w-11 h-6 rounded-full transition-all"
                    style={{ background: cfg[key] ? "#F7941D" : "rgba(42,74,26,0.12)" }}>
                    <span className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all"
                      style={{ left: cfg[key] ? "24px" : "4px" }} />
                  </button>
                </div>
              ))}

              <button
                onClick={handleSave}
                disabled={status === "saving" || !dirty}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                style={{
                  background: status === "success" ? "rgba(141,198,63,0.1)" : "linear-gradient(135deg, #F7941D, #C4700A)",
                  color: status === "success" ? "#8DC63F" : "white",
                  cursor: (status === "saving" || !dirty) ? "not-allowed" : "pointer",
                }}>
                {status === "saving"  ? <><Loader2 size={14} className="animate-spin" />Saving…</>
               : status === "success" ? <><Check size={14} />Saved!</>
               : "Save Platform Settings"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
