"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { CheckCircle, ChevronRight, Loader2, Heart, Shield, Calendar } from "lucide-react";

const GOALS = [
  "Manage stress & anxiety",
  "Improve relationships",
  "Work through grief or loss",
  "Build self-confidence",
  "Navigate life transitions",
  "Improve work-life balance",
  "Process trauma",
  "General mental wellness",
];

const REFERRAL_SOURCES = [
  "Google search",
  "Social media",
  "Friend or family",
  "Healthcare provider",
  "Workplace",
  "Other",
];

type StepData = {
  goals:        string[];
  preferredTime: string;
  referral:     string;
  emergencyName: string;
  emergencyPhone: string;
  agreeToTerms: boolean;
};

export default function OnboardingPage() {
  const router    = useRouter();
  const { user }  = useAuth();

  const [step, setStep]       = useState(1);
  const [saving, setSaving]   = useState(false);
  const [data, setData]       = useState<StepData>({
    goals:          [],
    preferredTime:  "",
    referral:       "",
    emergencyName:  "",
    emergencyPhone: "",
    agreeToTerms:   false,
  });

  const totalSteps = 4;
  const progress   = (step / totalSteps) * 100;

  function toggleGoal(goal: string) {
    setData(d => ({
      ...d,
      goals: d.goals.includes(goal)
        ? d.goals.filter(g => g !== goal)
        : [...d.goals, goal],
    }));
  }

  async function handleFinish() {
    if (!user) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        goals:          data.goals,
        preferredTime:  data.preferredTime,
        referral:       data.referral,
        emergencyContact: {
          name:  data.emergencyName,
          phone: data.emergencyPhone,
        },
        onboarded:  true,
        updatedAt:  serverTimestamp(),
      });
      router.push("/client");
    } catch (err) {
      console.error("Onboarding save error:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "#F6FAF0" }}>
      <div className="w-full max-w-lg">

        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: "#8A9BA8" }}>
              Step {step} of {totalSteps}
            </span>
            <span className="text-xs font-semibold" style={{ color: "#2A4A1A" }}>
              {Math.round(progress)}%
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(42,74,26,0.08)" }}>
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, background: "linear-gradient(90deg, #2A4A1A, #8DC63F)" }} />
          </div>
        </div>

        <div className="rounded-3xl p-8" style={{ background: "white", boxShadow: "0 4px 24px rgba(42,74,26,0.08)" }}>

          {/* ── Step 1 — Welcome ── */}
          {step === 1 && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
                style={{ background: "rgba(141,198,63,0.1)" }}>
                <Heart size={28} style={{ color: "#8DC63F" }} />
              </div>
              <h2 className="text-3xl mb-3"
                style={{ fontFamily: "var(--font-dm-serif)", color: "#2A4A1A" }}>
                Welcome to Valeo, {user?.displayName?.split(" ")[0]}
              </h2>
              <p className="text-sm mb-6 leading-relaxed" style={{ color: "#4A5568" }}>
                We want to make sure Dr. Miller can support you in the best way possible.
                This quick setup takes just 2 minutes.
              </p>
              <div className="space-y-3 mb-8 text-left">
                {[
                  { icon: Shield,   text: "Your answers are private and confidential" },
                  { icon: Heart,    text: "Personalises your experience with Dr. Miller" },
                  { icon: Calendar, text: "Helps match you to the right session type" },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-3 p-3 rounded-xl"
                    style={{ background: "rgba(42,74,26,0.03)" }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(141,198,63,0.1)" }}>
                      <Icon size={15} style={{ color: "#8DC63F" }} />
                    </div>
                    <p className="text-sm" style={{ color: "#4A5568" }}>{text}</p>
                  </div>
                ))}
              </div>
              <button onClick={() => setStep(2)}
                className="w-full py-3.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)" }}>
                Get Started <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* ── Step 2 — Goals ── */}
          {step === 2 && (
            <div>
              <h2 className="text-2xl mb-1" style={{ fontFamily: "var(--font-dm-serif)", color: "#2A4A1A" }}>
                What brings you here?
              </h2>
              <p className="text-sm mb-6" style={{ color: "#8A9BA8" }}>
                Select all that apply — you can update these any time.
              </p>
              <div className="grid grid-cols-2 gap-2 mb-6">
                {GOALS.map(goal => {
                  const selected = data.goals.includes(goal);
                  return (
                    <button key={goal} onClick={() => toggleGoal(goal)}
                      className="text-left p-3 rounded-xl border-2 text-xs font-medium transition-all"
                      style={{
                        borderColor: selected ? "#2A4A1A" : "rgba(42,74,26,0.1)",
                        background:  selected ? "rgba(42,74,26,0.05)" : "white",
                        color:       selected ? "#2A4A1A" : "#4A5568",
                      }}>
                      {selected && <CheckCircle size={11} className="inline mr-1" style={{ color: "#8DC63F" }} />}
                      {goal}
                    </button>
                  );
                })}
              </div>
              <div className="mb-4">
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2"
                  style={{ color: "#8A9BA8" }}>
                  Preferred session time
                </label>
                <select value={data.preferredTime}
                  onChange={e => setData(d => ({ ...d, preferredTime: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl text-sm border focus:outline-none"
                  style={{ borderColor: "rgba(42,74,26,0.15)", background: "white", color: "#22272B" }}>
                  <option value="">Select a preference</option>
                  <option value="morning">Morning (9am – 12pm)</option>
                  <option value="afternoon">Afternoon (12pm – 4pm)</option>
                  <option value="either">No preference</option>
                </select>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(1)}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold border-2"
                  style={{ borderColor: "rgba(42,74,26,0.15)", color: "#2A4A1A" }}>
                  Back
                </button>
                <button onClick={() => setStep(3)} disabled={data.goals.length === 0}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)" }}>
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3 — Emergency contact ── */}
          {step === 3 && (
            <div>
              <h2 className="text-2xl mb-1" style={{ fontFamily: "var(--font-dm-serif)", color: "#2A4A1A" }}>
                Emergency contact
              </h2>
              <p className="text-sm mb-6" style={{ color: "#8A9BA8" }}>
                Required for your safety. This information is kept strictly confidential.
              </p>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                    style={{ color: "#8A9BA8" }}>Contact Name</label>
                  <input type="text" value={data.emergencyName}
                    onChange={e => setData(d => ({ ...d, emergencyName: e.target.value }))}
                    placeholder="Full name"
                    className="w-full px-4 py-3 rounded-xl text-sm border focus:outline-none"
                    style={{ borderColor: "rgba(42,74,26,0.15)", background: "white" }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                    style={{ color: "#8A9BA8" }}>Phone Number</label>
                  <input type="tel" value={data.emergencyPhone}
                    onChange={e => setData(d => ({ ...d, emergencyPhone: e.target.value }))}
                    placeholder="+1 (868) 000-0000"
                    className="w-full px-4 py-3 rounded-xl text-sm border focus:outline-none"
                    style={{ borderColor: "rgba(42,74,26,0.15)", background: "white" }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                    style={{ color: "#8A9BA8" }}>How did you hear about us?</label>
                  <select value={data.referral}
                    onChange={e => setData(d => ({ ...d, referral: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl text-sm border focus:outline-none"
                    style={{ borderColor: "rgba(42,74,26,0.15)", background: "white", color: data.referral ? "#22272B" : "#8A9BA8" }}>
                    <option value="">Select one</option>
                    {REFERRAL_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(2)}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold border-2"
                  style={{ borderColor: "rgba(42,74,26,0.15)", color: "#2A4A1A" }}>
                  Back
                </button>
                <button onClick={() => setStep(4)}
                  disabled={!data.emergencyName || !data.emergencyPhone}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)" }}>
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* ── Step 4 — Confirm & finish ── */}
          {step === 4 && (
            <div>
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6"
                style={{ background: "rgba(141,198,63,0.1)" }}>
                <CheckCircle size={28} style={{ color: "#8DC63F" }} />
              </div>
              <h2 className="text-2xl mb-1 text-center"
                style={{ fontFamily: "var(--font-dm-serif)", color: "#2A4A1A" }}>
                You're all set!
              </h2>
              <p className="text-sm mb-6 text-center" style={{ color: "#8A9BA8" }}>
                Review your details and head to your dashboard.
              </p>

              {/* Summary */}
              <div className="rounded-2xl p-5 mb-6 space-y-3"
                style={{ background: "rgba(42,74,26,0.03)", border: "1px solid rgba(42,74,26,0.08)" }}>
                {[
                  { label: "Name",             value: user?.displayName },
                  { label: "Goals",            value: data.goals.length > 0 ? data.goals.join(", ") : "Not set" },
                  { label: "Preferred time",   value: data.preferredTime || "No preference" },
                  { label: "Emergency contact",value: data.emergencyName || "Not set" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-start justify-between gap-4 py-2 border-b last:border-0"
                    style={{ borderColor: "rgba(42,74,26,0.06)" }}>
                    <span className="text-xs flex-shrink-0" style={{ color: "#8A9BA8" }}>{label}</span>
                    <span className="text-xs text-right font-medium" style={{ color: "#2A4A1A" }}>{value}</span>
                  </div>
                ))}
              </div>

              {/* Terms */}
              <label className="flex items-start gap-3 mb-6 cursor-pointer">
                <input type="checkbox" checked={data.agreeToTerms}
                  onChange={e => setData(d => ({ ...d, agreeToTerms: e.target.checked }))}
                  className="mt-0.5 rounded" />
                <span className="text-xs" style={{ color: "#4A5568" }}>
                  I agree to the{" "}
                  <a href="/legal/privacy" className="underline" style={{ color: "#2A4A1A" }}>Privacy Policy</a>
                  {" "}and understand that my information will be kept confidential in line with professional ethical standards.
                </span>
              </label>

              <div className="flex gap-3">
                <button onClick={() => setStep(3)}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold border-2"
                  style={{ borderColor: "rgba(42,74,26,0.15)", color: "#2A4A1A" }}>
                  Back
                </button>
                <button onClick={handleFinish}
                  disabled={!data.agreeToTerms || saving}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40 flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)" }}>
                  {saving
                    ? <><Loader2 size={15} className="animate-spin" /> Saving...</>
                    : "Go to Dashboard"}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
