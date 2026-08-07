"use client";

import { useState, useEffect, useCallback } from "react";
import {
  collection, query, where, getDoc, doc,
  updateDoc, orderBy, serverTimestamp, onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { SYSTEM_TEMPLATES } from "@/lib/assessment-templates";
import {
  ClipboardList, CheckCircle, Clock, AlertCircle,
  Loader2, Send, Lock, X, ChevronRight,
  AlertTriangle, Eye,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────
type QuestionType = "text" | "textarea" | "scale" | "multiChoice" | "yesNo";

interface Question {
  id:       string;
  type:     QuestionType;
  label:    string;
  required: boolean;
  options?: string[];
  min?:     number;
  max?:     number;
}

interface AssessmentTemplate {
  id:          string;
  title:       string;
  description: string;
  questions:   Question[];
  createdBy:   string;
}

interface AssignedAssessment {
  id:            string;
  templateId:    string;
  templateTitle: string;
  clientId:      string;
  doctorId:      string;
  doctorName?:   string;
  status:        "pending" | "completed";
  responses:     Record<string, string | number>;
  assignedAt:    any;
  completedAt:   any;
  dueDate?:      string;
  isSystem?:     boolean;
  questions?:    Question[];
}

// ── Helpers ────────────────────────────────────────────────────────────────
// FIX 5: Unified timestamp helper — handles Firestore Timestamp, ISO strings, null
function toDate(ts: any): Date | null {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  if (typeof ts === "string") return new Date(ts);
  return null;
}

function fmtShortDate(ts: any): string {
  const d = toDate(ts);
  if (!d) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// S1: Is this assessment overdue?
function isOverdue(a: AssignedAssessment): boolean {
  if (a.status === "completed" || !a.dueDate) return false;
  return new Date(a.dueDate + "T23:59:59") < new Date();
}

// ── Toast ──────────────────────────────────────────────────────────────────
function Toast({ msg, type }: { msg: string; type: "success" | "error" }) {
  return (
    <div
      className="fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-lg text-sm font-medium max-w-sm"
      style={{ background: type === "success" ? "#2A4A1A" : "#F7941D", color: "white" }}
    >
      {type === "success" ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
      {msg}
    </div>
  );
}

// ── Scale input ────────────────────────────────────────────────────────────
// FIX 4 + S4: Correct type guard + keyboard navigation (arrow keys)
function ScaleInput({
  question, value, onChange, readOnly,
}: {
  question: Question;
  value: number | "";
  onChange: (v: number) => void;
  readOnly?: boolean;
}) {
  const min   = question.min ?? 1;
  const max   = question.max ?? 10;
  const steps = Array.from({ length: max - min + 1 }, (_, i) => i + min);

  function handleKey(e: React.KeyboardEvent) {
    if (readOnly) return;
    const cur = typeof value === "number" ? value : min - 1;
    if (e.key === "ArrowRight" && cur < max) onChange(cur + 1);
    if (e.key === "ArrowLeft"  && cur > min) onChange(cur - 1);
  }

  return (
    <div onKeyDown={handleKey} tabIndex={readOnly ? -1 : 0} className="outline-none">
      <div className="flex items-center gap-2 flex-wrap">
        {steps.map(n => (
          <button
            key={n}
            onClick={() => !readOnly && onChange(n)}
            disabled={readOnly}
            type="button"
            className="w-9 h-9 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: value === n ? "#2A4A1A" : "rgba(42,74,26,0.06)",
              color:      value === n ? "white"   : "#4A5568",
              cursor:     readOnly ? "default" : "pointer",
            }}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-xs" style={{ color: "#8A9BA8" }}>Not at all</span>
        <span className="text-xs" style={{ color: "#8A9BA8" }}>Extremely</span>
      </div>
      {!readOnly && (
        <p className="text-xs mt-1" style={{ color: "#C4C4C4" }}>
          Tip: use ← → arrow keys to select
        </p>
      )}
    </div>
  );
}

// ── Assessment modal (fill-in OR read-only view) ───────────────────────────
// S2: readOnly mode lets clients review their completed answers
// FIX 7: Escape key closes the modal
// FIX 10: "Save & Continue Later" persists partial responses to Firestore
function AssessmentModal({
  assessment, template, onSubmit, onSaveDraft, onClose, readOnly = false,
}: {
  assessment: AssignedAssessment;
  template:   AssessmentTemplate;
  onSubmit?:  (responses: Record<string, string | number>) => Promise<void>;
  onSaveDraft?: (responses: Record<string, string | number>) => Promise<void>;
  onClose:    () => void;
  readOnly?:  boolean;
}) {
  const [responses,  setResponses]  = useState<Record<string, string | number>>(assessment.responses ?? {});
  const [submitting, setSubmitting] = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // FIX 7: Escape key closes modal
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function setResponse(id: string, value: string | number) {
    setResponses(r => ({ ...r, [id]: value }));
  }

  async function handleSubmit() {
    if (!onSubmit) return;
    const missing = template.questions.filter(
      q => q.required && responses[q.id] === undefined && responses[q.id] !== 0 && responses[q.id] !== ""
    );
    if (missing.length > 0) {
      setError(`Please answer all required questions (${missing.length} remaining).`);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(responses);
      onClose();
    } catch {
      setError("Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // FIX 10: Save partial progress without submitting
  async function handleSaveDraft() {
    if (!onSaveDraft) return;
    setSaving(true);
    try {
      await onSaveDraft(responses);
      onClose();
    } catch {
      setError("Failed to save progress. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const answered = template.questions.filter(
    q => responses[q.id] !== undefined && responses[q.id] !== ""
  ).length;
  const total    = template.questions.length;
  const progress = total > 0 ? (answered / total) * 100 : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="w-full max-w-2xl rounded-3xl overflow-hidden max-h-[85vh] flex flex-col"
        style={{ background: "#F6FAF0" }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex-shrink-0">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3
                  className="text-xl font-semibold"
                  style={{ fontFamily: "var(--font-dm-serif)", color: "#2A4A1A" }}
                >
                  {template.title}
                </h3>
                {readOnly && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: "rgba(141,198,63,0.1)", color: "#6BA028" }}
                  >
                    Read-only
                  </span>
                )}
              </div>
              <p className="text-sm" style={{ color: "#8A9BA8" }}>
                {template.description}
              </p>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-black/5 flex-shrink-0">
              <X size={18} style={{ color: "#4A5568" }} />
            </button>
          </div>

          {/* Progress bar (hidden in read-only) */}
          {!readOnly && (
            <>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs" style={{ color: "#8A9BA8" }}>
                  {answered} of {total} answered
                </span>
                <span className="text-xs font-semibold" style={{ color: "#2A4A1A" }}>
                  {Math.round(progress)}%
                </span>
              </div>
              <div
                className="h-1.5 rounded-full overflow-hidden"
                style={{ background: "rgba(42,74,26,0.08)" }}
              >
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${progress}%`,
                    background: "linear-gradient(90deg, #2A4A1A, #8DC63F)",
                  }}
                />
              </div>
            </>
          )}
        </div>

        {/* Questions */}
        <div className="overflow-y-auto flex-1 px-6 pb-4 space-y-6">
          {error && (
            <div
              className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
              style={{ background: "rgba(247,148,29,0.08)", color: "#F7941D" }}
            >
              <AlertCircle size={14} />{error}
            </div>
          )}

          {template.questions.map((q, i) => (
            <div
              key={q.id}
              className="rounded-2xl p-5"
              style={{ background: "white", boxShadow: "0 1px 3px rgba(42,74,26,0.06)" }}
            >
              <p className="text-sm font-semibold mb-1" style={{ color: "#2A4A1A" }}>
                <span style={{ color: "#8A9BA8" }}>{i + 1}. </span>{q.label}
                {q.required && !readOnly && <span style={{ color: "#F7941D" }}> *</span>}
              </p>

              {q.type === "text" && (
                <input
                  type="text"
                  value={(responses[q.id] as string) ?? ""}
                  onChange={e => !readOnly && setResponse(q.id, e.target.value)}
                  readOnly={readOnly}
                  placeholder={readOnly ? "No answer" : "Your answer..."}
                  className="w-full px-3 py-2.5 rounded-xl text-sm border focus:outline-none mt-2"
                  style={{
                    borderColor: "rgba(42,74,26,0.15)",
                    background:  readOnly ? "rgba(42,74,26,0.02)" : "#FAFAFA",
                    color:       responses[q.id] ? "#22272B" : "#C4C4C4",
                  }}
                />
              )}

              {q.type === "textarea" && (
                <textarea
                  value={(responses[q.id] as string) ?? ""}
                  onChange={e => !readOnly && setResponse(q.id, e.target.value)}
                  readOnly={readOnly}
                  rows={3}
                  placeholder={readOnly ? "No answer" : "Your answer..."}
                  className="w-full px-3 py-2.5 rounded-xl text-sm border resize-none focus:outline-none mt-2"
                  style={{
                    borderColor: "rgba(42,74,26,0.15)",
                    background:  readOnly ? "rgba(42,74,26,0.02)" : "#FAFAFA",
                    color:       responses[q.id] ? "#22272B" : "#C4C4C4",
                  }}
                />
              )}

              {q.type === "scale" && (
                <div className="mt-3">
                  {/* FIX 6: Correct type — (value as number | undefined) ?? "" */}
                  <ScaleInput
                    question={q}
                    value={(responses[q.id] as number | undefined) ?? ""}
                    onChange={v => setResponse(q.id, v)}
                    readOnly={readOnly}
                  />
                </div>
              )}

              {q.type === "yesNo" && (
                <div className="flex gap-3 mt-3">
                  {["Yes", "No"].map(opt => (
                    <button
                      key={opt}
                      onClick={() => !readOnly && setResponse(q.id, opt)}
                      disabled={readOnly}
                      type="button"
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all"
                      style={{
                        borderColor: responses[q.id] === opt ? "#2A4A1A" : "rgba(42,74,26,0.12)",
                        background:  responses[q.id] === opt ? "rgba(42,74,26,0.06)" : "white",
                        color:       responses[q.id] === opt ? "#2A4A1A" : "#8A9BA8",
                        cursor:      readOnly ? "default" : "pointer",
                      }}
                    >
                      {responses[q.id] === opt && (
                        <CheckCircle size={12} className="inline mr-1.5" style={{ color: "#8DC63F" }} />
                      )}
                      {opt}
                    </button>
                  ))}
                </div>
              )}

              {q.type === "multiChoice" && q.options && (
                <div className="space-y-2 mt-3">
                  {q.options.map(opt => (
                    <button
                      key={opt}
                      onClick={() => !readOnly && setResponse(q.id, opt)}
                      disabled={readOnly}
                      type="button"
                      className="w-full text-left px-4 py-2.5 rounded-xl text-sm border-2 transition-all"
                      style={{
                        borderColor: responses[q.id] === opt ? "#2A4A1A" : "rgba(42,74,26,0.12)",
                        background:  responses[q.id] === opt ? "rgba(42,74,26,0.06)" : "white",
                        color:       responses[q.id] === opt ? "#2A4A1A" : "#4A5568",
                        cursor:      readOnly ? "default" : "pointer",
                      }}
                    >
                      {responses[q.id] === opt && (
                        <CheckCircle size={12} className="inline mr-2" style={{ color: "#8DC63F" }} />
                      )}
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 border-t flex-shrink-0 flex gap-3"
          style={{ borderColor: "rgba(42,74,26,0.08)" }}
        >
          {readOnly ? (
            // S2: Read-only footer — just a close button
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)" }}
            >
              Close
            </button>
          ) : (
            <>
              {/* FIX 10: Save & Continue Later now persists to Firestore */}
              <button
                onClick={handleSaveDraft}
                disabled={saving || submitting}
                className="flex-1 py-3 rounded-xl text-sm font-semibold border-2 disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ borderColor: "rgba(42,74,26,0.15)", color: "#2A4A1A" }}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                Save & Continue Later
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || saving}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)" }}
              >
                {submitting
                  ? <><Loader2 size={14} className="animate-spin" />Submitting…</>
                  : <><Send size={14} />Submit</>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Assessment card ────────────────────────────────────────────────────────
// S1: Overdue badge | S2: completed cards open in read-only mode
function AssessmentCard({
  assessment, onOpen,
}: {
  assessment: AssignedAssessment;
  onOpen: () => void;
}) {
  const done     = assessment.status === "completed";
  const overdue  = isOverdue(assessment); // S1

  return (
    <button
      onClick={onOpen}
      className="w-full text-left rounded-2xl p-5 transition-all hover:-translate-y-0.5"
      style={{ background: "white", boxShadow: "0 1px 4px rgba(42,74,26,0.07)" }}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: done
              ? "rgba(141,198,63,0.1)"
              : overdue
              ? "rgba(247,148,29,0.1)"
              : "rgba(247,148,29,0.1)",
          }}
        >
          {done ? (
            <CheckCircle size={20} style={{ color: "#8DC63F" }} />
          ) : overdue ? (
            <AlertTriangle size={20} style={{ color: "#F7941D" }} />
          ) : (
            <ClipboardList size={20} style={{ color: "#F7941D" }} />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold" style={{ color: "#2A4A1A" }}>
              {assessment.templateTitle}
            </p>
            {/* S2: Show eye icon for completed; chevron for pending */}
            {done
              ? <Eye size={15} className="flex-shrink-0 mt-0.5" style={{ color: "#C4C4C4" }} />
              : <ChevronRight size={16} className="flex-shrink-0" style={{ color: "#C4C4C4" }} />}
          </div>

          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            {/* Status badge */}
            <span
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium"
              style={{
                background: done
                  ? "rgba(141,198,63,0.1)"
                  : overdue
                  ? "rgba(247,148,29,0.08)"
                  : "rgba(247,148,29,0.1)",
                color: done ? "#6BA028" : overdue ? "#F7941D" : "#C4700A",
              }}
            >
              {done
                ? <><CheckCircle size={10} /> Completed</>
                : overdue
                ? <><AlertTriangle size={10} /> Overdue</>
                : <><Clock size={10} /> Pending</>}
            </span>

            {/* Due date */}
            {assessment.dueDate && !done && (
              <span className="text-xs" style={{ color: overdue ? "#F7941D" : "#8A9BA8" }}>
                {overdue ? "Was due" : "Due"}{" "}
                {new Date(assessment.dueDate + "T12:00:00").toLocaleDateString("en-US", {
                  month: "short", day: "numeric",
                })}
              </span>
            )}

            {/* Completed date — FIX 5: uses toDate helper */}
            {done && (
              <span className="text-xs" style={{ color: "#8A9BA8" }}>
                Completed {fmtShortDate(assessment.completedAt)}
              </span>
            )}
          </div>

          {/* Subtext */}
          <p className="text-xs mt-2" style={{ color: "#8A9BA8" }}>
            {done
              ? "Tap to view your responses"
              : overdue
              ? "Please complete this as soon as possible"
              : `Assigned by ${assessment.doctorName ?? "your therapist"} · Tap to begin`}
          </p>
        </div>
      </div>
    </button>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function ClientAssessmentsPage() {
  const { user } = useAuth();

  const [assessments, setAssessments] = useState<AssignedAssessment[]>([]);
  const [templates,   setTemplates]   = useState<Record<string, AssessmentTemplate>>({});
  const [loading,     setLoading]     = useState(true);
  const [fetchError,  setFetchError]  = useState<string | null>(null);   // FIX 3
  const [active,      setActive]      = useState<AssignedAssessment | null>(null);
  const [viewMode,    setViewMode]    = useState<"fill" | "view">("fill"); // S2
  const [toast,       setToast]       = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // FIX 1: Toast auto-dismiss via useEffect (not inline setTimeout)
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // FIX 2 + FIX 3 + FIX 9: Load templates via getDoc; use onSnapshot for live updates
  const loadTemplates = useCallback(async (loaded: AssignedAssessment[]) => {
    const tMap: Record<string, AssessmentTemplate> = {};

    // 1) Questions snapshotted onto the assignment (doctor assign path)
    for (const a of loaded) {
      if (a.questions?.length) {
        tMap[a.templateId] = {
          id:          a.templateId,
          title:       a.templateTitle || "Assessment",
          description: "",
          questions:   a.questions,
          createdBy:   a.isSystem ? "system" : a.doctorId,
        };
      }
    }

    // 2) Built-in clinical library (PHQ-9, GAD-7, …) — not in Firestore
    for (const a of loaded) {
      if (tMap[a.templateId]) continue;
      if (!a.isSystem && !SYSTEM_TEMPLATES.some(t => t.id === a.templateId)) continue;
      const st = SYSTEM_TEMPLATES.find(t => t.id === a.templateId);
      if (!st) continue;
      tMap[st.id] = {
        id:          st.id,
        title:       st.title,
        description: st.description,
        questions:   st.questions as Question[],
        createdBy:   "system",
      };
    }

    // 3) Custom templates from Firestore
    const customIds = [...new Set(
      loaded.map(a => a.templateId).filter(id => !tMap[id])
    )];
    if (customIds.length > 0) {
      try {
        const snaps = await Promise.all(
          customIds.map(id => getDoc(doc(db, "assessmentTemplates", id)))
        );
        snaps.forEach(s => {
          if (s.exists()) tMap[s.id] = { id: s.id, ...s.data() } as AssessmentTemplate;
        });
      } catch (err) {
        console.error("[Assessments] template load error:", err);
      }
    }

    setTemplates(tMap);
  }, []);

  useEffect(() => {
    if (!user) return;

    // FIX 9: onSnapshot keeps the list live — new assignments appear without a refresh
    // FIX 3: Full error handling
    const unsubscribe = onSnapshot(
      query(
        collection(db, "assessments"),
        where("clientId", "==", user.uid),
        orderBy("assignedAt", "desc"),
      ),
      async (snap) => {
        try {
          const loaded = snap.docs.map(d => ({ id: d.id, ...d.data() }) as AssignedAssessment);
          setAssessments(loaded);
          await loadTemplates(loaded);
        } catch (err) {
          console.error("[Assessments] snapshot error:", err);
          setFetchError("Could not load assessments. Please refresh.");
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        console.error("[Assessments] listener error:", err);
        setFetchError("Could not load assessments. Please refresh.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, loadTemplates]);

  // Submit completed assessment
  async function handleSubmit(responses: Record<string, string | number>) {
    if (!active || !user) return;
    await updateDoc(doc(db, "assessments", active.id), {
      responses,
      status:      "completed",
      completedAt: serverTimestamp(),
    });
    setAssessments(prev =>
      prev.map(a =>
        a.id === active.id
          ? { ...a, responses, status: "completed", completedAt: { toDate: () => new Date() } }
          : a
      )
    );
    setToast({ type: "success", msg: "Assessment submitted successfully." });
  }

  // FIX 10: Save partial draft without finalising
  async function handleSaveDraft(responses: Record<string, string | number>) {
    if (!active || !user) return;
    await updateDoc(doc(db, "assessments", active.id), {
      responses,
      // status stays "pending" — only submitted answers finalise it
    });
    setAssessments(prev =>
      prev.map(a => a.id === active.id ? { ...a, responses } : a)
    );
    setToast({ type: "success", msg: "Progress saved. You can continue later." });
  }

  // FIX 8: Guard with toast if template failed to load
  function openAssessment(a: AssignedAssessment, mode: "fill" | "view") {
    if (!templates[a.templateId]) {
      setToast({ type: "error", msg: "Could not load this assessment. Please refresh and try again." });
      return;
    }
    setViewMode(mode);
    setActive(a);
  }

  const pending   = assessments.filter(a => a.status === "pending");
  const completed = assessments.filter(a => a.status === "completed");

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* FIX 1: Toast driven by useEffect */}
      {toast && <Toast {...toast} />}

      {/* Header */}
      <div>
        <h2 className="text-2xl" style={{ fontFamily: "var(--font-dm-serif)", color: "#2A4A1A" }}>
          Assessments
        </h2>
        <p className="text-sm mt-0.5" style={{ color: "#8A9BA8" }}>
          Forms and questionnaires assigned by your therapist
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total",     value: assessments.length, accent: "#2A4A1A" },
          { label: "Pending",   value: pending.length,     accent: "#F7941D" },
          { label: "Completed", value: completed.length,   accent: "#8DC63F" },
        ].map(({ label, value, accent }) => (
          <div
            key={label}
            className="rounded-2xl p-4 text-center"
            style={{ background: "white", boxShadow: "0 1px 4px rgba(42,74,26,0.07)" }}
          >
            <p
              className="text-3xl font-semibold"
              style={{ fontFamily: "var(--font-dm-serif)", color: accent }}
            >
              {value}
            </p>
            <p className="text-xs mt-1" style={{ color: "#8A9BA8" }}>{label}</p>
          </div>
        ))}
      </div>

      {/* FIX 3: Error state */}
      {fetchError && (
        <div
          className="rounded-2xl p-5 flex items-start gap-3"
          style={{ background: "rgba(247,148,29,0.06)", border: "1px solid rgba(247,148,29,0.15)" }}
        >
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" style={{ color: "#F7941D" }} />
          <p className="text-sm" style={{ color: "#F7941D" }}>{fetchError}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={28} className="animate-spin" style={{ color: "#8DC63F" }} />
        </div>
      ) : assessments.length === 0 ? (
        <div
          className="rounded-2xl p-12 text-center"
          style={{ background: "white", boxShadow: "0 1px 4px rgba(42,74,26,0.07)" }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
            style={{ background: "rgba(141,198,63,0.08)" }}
          >
            <ClipboardList size={24} style={{ color: "#8DC63F" }} />
          </div>
          <p className="text-sm font-medium mb-1" style={{ color: "#2A4A1A" }}>
            No assessments yet
          </p>
          <p className="text-xs" style={{ color: "#8A9BA8" }}>
            Your therapist will assign assessments here when needed.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Pending */}
          {pending.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Clock size={14} style={{ color: "#F7941D" }} />
                <h3 className="text-sm font-semibold" style={{ color: "#2A4A1A" }}>
                  Needs Attention ({pending.length})
                </h3>
              </div>
              <div className="space-y-3">
                {pending.map(a => (
                  <AssessmentCard
                    key={a.id}
                    assessment={a}
                    onOpen={() => openAssessment(a, "fill")}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Completed */}
          {completed.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle size={14} style={{ color: "#8DC63F" }} />
                <h3 className="text-sm font-semibold" style={{ color: "#2A4A1A" }}>
                  Completed ({completed.length})
                </h3>
              </div>
              <div className="space-y-3">
                {/* S2: Completed cards open in read-only view mode */}
                {completed.map(a => (
                  <AssessmentCard
                    key={a.id}
                    assessment={a}
                    onOpen={() => openAssessment(a, "view")}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Privacy note */}
      <div
        className="rounded-xl p-4 flex items-start gap-3"
        style={{ background: "rgba(42,74,26,0.03)", border: "1px solid rgba(42,74,26,0.07)" }}
      >
        <Lock size={14} className="flex-shrink-0 mt-0.5" style={{ color: "#8A9BA8" }} />
        <p className="text-xs" style={{ color: "#8A9BA8" }}>
          Your responses are confidential and only visible to your therapist. They help personalise your care.
        </p>
      </div>

      {/* Modal — fill or read-only view */}
      {active && templates[active.templateId] && (
        <AssessmentModal
          assessment={active}
          template={templates[active.templateId]}
          onSubmit={viewMode === "fill" ? handleSubmit : undefined}
          onSaveDraft={viewMode === "fill" ? handleSaveDraft : undefined}
          onClose={() => setActive(null)}
          readOnly={viewMode === "view"}
        />
      )}
    </div>
  );
}
