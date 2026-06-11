// src/app/onboarding/intake/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { INTAKE_QUESTIONS, type IntakeResponses } from "@/lib/matching";
import { ArrowRight, ArrowLeft, CheckCircle, Loader2, Heart } from "lucide-react";

const EMPTY: IntakeResponses = {
  presentingConcerns: [],
  sessionType:        "",
  therapyGoals:       [],
  previousTherapy:    "",
  urgency:            "",
  preferredGender:    "",
  preferredLanguage:  "",
  preferredApproach:  [],
  ageGroup:           "adult",
};

export default function IntakePage() {
  const { user }   = useAuth();
  const router     = useRouter();
  const [step,     setStep]     = useState(0);
  const [answers,  setAnswers]  = useState<IntakeResponses>(EMPTY);
  const [saving,   setSaving]   = useState(false);

  const q       = INTAKE_QUESTIONS[step];
  const total   = INTAKE_QUESTIONS.length;
  const progress = ((step) / total) * 100;

  function getValue(qId: string, optionIndex: number): string {
    const q = INTAKE_QUESTIONS.find(q => q.id === qId);
    return (q as any)?.values?.[optionIndex] ?? q?.options[optionIndex] ?? "";
  }

  function toggleMulti(field: keyof IntakeResponses, value: string, max?: number) {
    setAnswers(prev => {
      const arr     = (prev[field] as string[]);
      const exists  = arr.includes(value);
      if (exists) return { ...prev, [field]: arr.filter(v => v !== value) };
      if (max && arr.length >= max) return prev;
      return { ...prev, [field]: [...arr, value] };
    });
  }

  function setSingle(field: keyof IntakeResponses, value: string) {
    setAnswers(prev => ({ ...prev, [field]: value }));
  }

  function isAnswered(): boolean {
    const val = answers[q.id as keyof IntakeResponses];
    if (Array.isArray(val)) return val.length > 0;
    return !!val;
  }

  async function handleFinish() {
    if (!user) return;
    setSaving(true);
    try {
      // Save intake to Firestore
      await setDoc(doc(db, "intakes", user.uid), {
        ...answers,
        userId:    user.uid,
        createdAt: serverTimestamp(),
        status:    "pending_match",
      });
      // Navigate to match page
      router.push("/onboarding/match");
    } catch (err) {
      console.error(err);
      setSaving(false);
    }
  }

  function handleNext() {
    if (step < total - 1) setStep(s => s + 1);
    else handleFinish();
  }

  const currentAnswer = answers[q.id as keyof IntakeResponses];
  const isMulti       = q.type === "multiselect";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "linear-gradient(135deg, #2A4A1A 0%, #3D6B24 100%)" }}>

      {/* Top bar */}
      <div className="px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(141,198,63,0.2)" }}>
            <Heart size={16} style={{ color: "#8DC63F" }} />
          </div>
          <span className="text-white font-semibold" style={{ fontFamily: "var(--font-dm-serif)" }}>
            Valeo
          </span>
        </div>
        <span className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
          {step + 1} of {total}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mx-6 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.1)" }}>
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${progress}%`, background: "#8DC63F" }} />
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-xl">

          {/* Question */}
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-widest mb-3"
              style={{ color: "rgba(141,198,63,0.8)" }}>
              Question {step + 1}
            </p>
            <h2 className="text-2xl text-white mb-2"
              style={{ fontFamily: "var(--font-dm-serif)", lineHeight: "1.3" }}>
              {q.question}
            </h2>
            {q.subtext && (
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>{q.subtext}</p>
            )}
          </div>

          {/* Options */}
          <div className={`grid gap-3 ${q.options.length > 6 ? "grid-cols-2" : "grid-cols-1"}`}>
            {q.options.map((option, i) => {
              const value    = getValue(q.id, i);
              const selected = isMulti
                ? (currentAnswer as string[]).includes(value)
                : currentAnswer === value;

              return (
                <button key={option}
                  onClick={() => isMulti
                    ? toggleMulti(q.id as keyof IntakeResponses, value, (q as any).max)
                    : setSingle(q.id as keyof IntakeResponses, value)}
                  className="flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-all duration-150 hover:-translate-y-0.5"
                  style={{
                    background: selected
                      ? "rgba(141,198,63,0.2)"
                      : "rgba(255,255,255,0.06)",
                    border: `2px solid ${selected ? "#8DC63F" : "rgba(255,255,255,0.1)"}`,
                  }}>
                  <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center border-2 transition-all"
                    style={{
                      borderColor: selected ? "#8DC63F" : "rgba(255,255,255,0.3)",
                      background:  selected ? "#8DC63F" : "transparent",
                    }}>
                    {selected && <CheckCircle size={12} style={{ color: "#2A4A1A" }} />}
                  </div>
                  <span className="text-sm font-medium"
                    style={{ color: selected ? "white" : "rgba(255,255,255,0.8)" }}>
                    {option}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8">
            <button onClick={() => setStep(s => s - 1)} disabled={step === 0}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-30 transition-all"
              style={{ color: "rgba(255,255,255,0.7)", background: "rgba(255,255,255,0.08)" }}>
              <ArrowLeft size={16} /> Back
            </button>

            <button onClick={handleNext}
              disabled={!isAnswered() || saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 transition-all hover:-translate-y-0.5"
              style={{ background: "#8DC63F", color: "#2A4A1A" }}>
              {saving ? (
                <><Loader2 size={15} className="animate-spin" /> Finding your match...</>
              ) : step === total - 1 ? (
                <>Find My Match <CheckCircle size={15} /></>
              ) : (
                <>Continue <ArrowRight size={15} /></>
              )}
            </button>
          </div>

          {/* Skip option */}
          {step > 0 && !isAnswered() && (
            <div className="text-center mt-4">
              <button onClick={handleNext}
                className="text-xs underline"
                style={{ color: "rgba(255,255,255,0.35)" }}>
                Skip this question
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
