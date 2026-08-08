"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, setDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import {
  CONSENT_VERSION, CONSENT_ACKS, allAccepted,
  type ConsentAccepted, type ConsentRecord,
} from "@/lib/consent";
import {
  Heart, Shield, Loader2, CheckCircle, Printer, ArrowRight, AlertCircle,
} from "lucide-react";

const EMPTY_ACCEPTED: ConsentAccepted = {
  privacy: false, terms: false, hipaaNotice: false, telehealth: false,
  sessionRecording: false, emergency: false,
};

function toDate(ts: any): Date | null {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  if (typeof ts === "string") return new Date(ts);
  return null;
}

function ConsentInner() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/client";

  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [existing, setExisting]   = useState<ConsentRecord | null>(null);
  const [printMode, setPrintMode] = useState(false);
  const [accepted, setAccepted]   = useState<ConsentAccepted>({ ...EMPTY_ACCEPTED });
  const [typedName, setTypedName] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "consents", user.uid));
        if (snap.exists()) {
          const data = { ...snap.data() } as ConsentRecord;
          setExisting(data);
          if (data.version === CONSENT_VERSION) {
            setAccepted(data.accepted);
            // Show prior signature for reference only — re-sign still requires typing
            setTypedName("");
          }
        }
        // Never auto-fill the signature field — client must type their name
      } catch (err) {
        console.error("[consent] load:", err);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const isCurrent = existing?.version === CONSENT_VERSION;

  function normalizeName(s: string) {
    return s.trim().toLowerCase().replace(/\s+/g, " ");
  }

  const accountName = (user?.displayName || "").trim();
  const typed = typedName.trim();
  const nameOk =
    typed.length >= 3 &&
    (!accountName || normalizeName(typed) === normalizeName(accountName));

  const canSign =
    allAccepted(accepted) &&
    nameOk &&
    !saving;

  async function handleSign() {
    if (!user || !canSign) return;
    if (!nameOk) {
      setError(
        accountName
          ? `Please type your full name exactly as on your account: ${accountName}`
          : "Please type your full legal name to sign.",
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let doctorId = "";
      try {
        const aSnap = await getDoc(doc(db, "assignments", user.uid));
        if (aSnap.exists()) doctorId = (aSnap.data() as any).doctorId || "";
        if (!doctorId) {
          const uSnap = await getDoc(doc(db, "users", user.uid));
          doctorId = (uSnap.data() as any)?.doctorId || "";
        }
      } catch { /* optional */ }

      const record: Omit<ConsentRecord, "signedAt"> & { signedAt: any } = {
        clientId:       user.uid,
        clientName:     user.displayName || typedName.trim(),
        typedSignature: typedName.trim(),
        version:        CONSENT_VERSION,
        accepted:       { ...accepted },
        signedAt:       serverTimestamp(),
        userAgent:      typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 300) : "",
        ...(doctorId ? { doctorId } : {}),
      };

      await setDoc(doc(db, "consents", user.uid), record, { merge: true });
      await updateDoc(doc(db, "users", user.uid), {
        consentSignedAt: serverTimestamp(),
        consentVersion:  CONSENT_VERSION,
        updatedAt:       serverTimestamp(),
      });

      setExisting({ ...record, signedAt: { toDate: () => new Date() } } as ConsentRecord);
      router.push(nextPath.startsWith("/") ? nextPath : "/client");
    } catch (err) {
      console.error("[consent] sign:", err);
      setError("Could not save your consent. Please try again.");
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F2F8EA" }}>
        <Loader2 size={28} className="animate-spin" style={{ color: "#8DC63F" }} />
      </div>
    );
  }

  if (printMode && existing && isCurrent) {
    const signed = toDate(existing.signedAt);
    return (
      <div className="min-h-screen p-8 max-w-2xl mx-auto bg-white print:p-6">
        <div className="mb-6 flex items-center justify-between print:hidden">
          <button type="button" onClick={() => setPrintMode(false)}
            className="text-sm font-semibold" style={{ color: "#2A4A1A" }}>
            ← Back
          </button>
          <button type="button" onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg,#2A4A1A,#3D6B24)" }}>
            <Printer size={14} /> Print
          </button>
        </div>
        <h1 className="text-2xl mb-2" style={{ fontFamily: "var(--font-dm-serif)", color: "#2A4A1A" }}>
          Telehealth Consent Record
        </h1>
        <p className="text-sm mb-6" style={{ color: "#8A9BA8" }}>
          Valeo Experience · Version {existing.version}
        </p>
        <div className="space-y-3 text-sm mb-8" style={{ color: "#4A5568" }}>
          <p><strong>Client:</strong> {existing.clientName}</p>
          <p><strong>Typed signature:</strong> {existing.typedSignature}</p>
          <p><strong>Signed:</strong> {signed ? signed.toLocaleString() : "—"}</p>
        </div>
        <ul className="space-y-2 text-sm mb-8" style={{ color: "#4A5568" }}>
          {CONSENT_ACKS.map(a => (
            <li key={a.key}>✓ {a.label}</li>
          ))}
        </ul>
        <p className="text-xs" style={{ color: "#C4C4C4" }}>
          This record acknowledges the platform policies linked at signing. It is not a substitute for
          independent legal advice.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(160deg, #F2F8EA 0%, #FAFCF7 50%, #fff 100%)" }}>
      <div className="px-6 py-5 flex items-center justify-between border-b"
        style={{ borderColor: "rgba(42,74,26,0.08)", background: "white" }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(141,198,63,0.15)" }}>
            <Heart size={16} style={{ color: "#8DC63F" }} />
          </div>
          <span className="font-semibold" style={{ fontFamily: "var(--font-dm-serif)", color: "#2A4A1A" }}>
            Valeo
          </span>
        </div>
        <Link href="/client" className="text-xs font-medium" style={{ color: "#8A9BA8" }}>
          Skip to dashboard
        </Link>
      </div>

      <div className="max-w-xl mx-auto px-5 py-8 space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Shield size={18} style={{ color: "#8DC63F" }} />
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#8A9BA8" }}>
              Required before booking
            </p>
          </div>
          <h1 className="text-2xl mb-2" style={{ fontFamily: "var(--font-dm-serif)", color: "#2A4A1A" }}>
            Telehealth consent
          </h1>
          <p className="text-sm" style={{ color: "#4A5568" }}>
            Please review and acknowledge the platform policies below. Full legal text lives on our
            linked pages — we do not replace professional legal advice.
          </p>
        </div>

        {isCurrent && existing && (
          <div className="rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3"
            style={{ background: "rgba(141,198,63,0.1)", border: "1px solid rgba(141,198,63,0.25)" }}>
            <div className="flex items-center gap-2">
              <CheckCircle size={18} style={{ color: "#6BA028" }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: "#2A4A1A" }}>Consent on file</p>
                <p className="text-xs" style={{ color: "#6BA028" }}>
                  Signed {toDate(existing.signedAt)?.toLocaleDateString() ?? "—"} · v{existing.version}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPrintMode(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
                style={{ background: "white", color: "#2A4A1A", border: "1px solid rgba(42,74,26,0.12)" }}>
                <Printer size={12} /> View / Print
              </button>
              <button type="button" onClick={() => router.push(nextPath.startsWith("/") ? nextPath : "/client")}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white"
                style={{ background: "linear-gradient(135deg,#2A4A1A,#3D6B24)" }}>
                Continue <ArrowRight size={12} />
              </button>
            </div>
          </div>
        )}

        <div className="rounded-2xl p-5 space-y-4"
          style={{ background: "white", boxShadow: "0 2px 12px rgba(42,74,26,0.06)" }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#8A9BA8" }}>
            Acknowledgments
          </p>
          {CONSENT_ACKS.map(ack => (
            <label key={ack.key} className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={accepted[ack.key]}
                disabled={isCurrent}
                onChange={e => setAccepted(a => ({ ...a, [ack.key]: e.target.checked }))}
                className="mt-1 rounded"
              />
              <span className="text-sm" style={{ color: "#4A5568" }}>
                {ack.label}{" "}
                {ack.link && (
                  <a href={ack.link.href} target="_blank" rel="noopener noreferrer"
                    className="underline font-medium" style={{ color: "#2A4A1A" }}>
                    {ack.link.text}
                  </a>
                )}
              </span>
            </label>
          ))}
        </div>

        {!isCurrent && (
          <div className="rounded-2xl p-5 space-y-3"
            style={{ background: "white", boxShadow: "0 2px 12px rgba(42,74,26,0.06)" }}>
            <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: "#8A9BA8" }}>
              Type your full legal name to sign
            </label>
            <input
              type="text"
              value={typedName}
              onChange={e => { setTypedName(e.target.value); setError(null); }}
              placeholder={accountName ? `Type: ${accountName}` : "Full legal name"}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="w-full px-4 py-3 rounded-xl text-sm border focus:outline-none min-h-[48px]"
              style={{ borderColor: "rgba(42,74,26,0.15)", background: "#FAFAFA", color: "#2A4A1A" }}
            />
            <p className="text-xs" style={{ color: "#8A9BA8" }}>
              {accountName
                ? <>You must type your name exactly as on your account (<strong style={{ color: "#2A4A1A" }}>{accountName}</strong>). It is not filled in for you.</>
                : <>Type your full legal name (at least 3 characters). The field is not filled in for you.</>}
              {" "}By clicking Sign, you create an electronic consent record for Valeo Experience
              (version {CONSENT_VERSION}).
            </p>
            {typed.length > 0 && accountName && !nameOk && (
              <p className="text-xs font-medium" style={{ color: "#F7941D" }}>
                Name does not match your account name yet.
              </p>
            )}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-sm px-3 py-2.5 rounded-xl"
            style={{ background: "rgba(247,148,29,0.1)", color: "#F7941D" }}>
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {!isCurrent && (
          <button type="button" onClick={handleSign} disabled={!canSign}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: "linear-gradient(135deg,#2A4A1A,#3D6B24)" }}>
            {saving
              ? <><Loader2 size={16} className="animate-spin" /> Saving…</>
              : <><Shield size={16} /> Sign &amp; continue</>}
          </button>
        )}
      </div>
    </div>
  );
}

export default function ConsentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F2F8EA" }}>
        <Loader2 size={28} className="animate-spin" style={{ color: "#8DC63F" }} />
      </div>
    }>
      <ConsentInner />
    </Suspense>
  );
}
