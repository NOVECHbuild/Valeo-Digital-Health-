"use client";

import { useState, useEffect } from "react";
import {
  collection, query, where, getDocs, getDoc, addDoc, updateDoc,
  deleteDoc, doc, orderBy, serverTimestamp, onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { authedFetch } from "@/lib/authedFetch";
import { useAuth } from "@/context/AuthContext";
import {
  ClipboardList, Plus, Search, X, Loader2, Send,
  CheckCircle, AlertCircle, Clock, Trash2, Eye,
  FileText, Users, BookOpen, Lock, RefreshCw,
  RotateCcw, ChevronRight, TrendingUp,
} from "lucide-react";
import {
  SYSTEM_TEMPLATES, CATEGORY_COLORS, calculateScore, getPID5DomainScores,
  type SystemTemplate, type ScoredQuestion,
} from "@/lib/assessment-templates";

// ══════════════════════════════════════════════════════════════
//  TYPES
// ══════════════════════════════════════════════════════════════
type QuestionType = "text" | "textarea" | "scale" | "multiChoice" | "yesNo";
interface Question { id: string; type: QuestionType; label: string; required: boolean; options?: string[]; }
interface Template { id: string; title: string; description: string; questions: Question[]; createdBy: string; createdAt: any; }
interface Client   { uid: string; displayName: string; email: string; }
interface AssignedAssessment {
  id: string; templateId: string; templateTitle: string; isSystem?: boolean;
  clientId: string; clientName: string; doctorId: string;
  status: "pending" | "completed";
  responses: Record<string, string | number>;
  assignedAt: any; completedAt: any; dueDate?: string;
  questions?: Question[];
}

// ══════════════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════════════

/**
 * FIX: Handles both Firestore Timestamps AND ISO strings.
 * Original code called .toDate() directly — crashes on admin-created records.
 */
function toDate(ts: any): Date | null {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  if (ts instanceof Date) return ts;
  if (typeof ts === "string") return new Date(ts);
  return null;
}

function fmtDate(ts: any, opts?: Intl.DateTimeFormatOptions): string {
  const d = toDate(ts);
  if (!d) return "—";
  return d.toLocaleDateString("en-US", opts ?? { month: "short", day: "numeric", year: "numeric" });
}

function isDueOverdue(dueDate?: string): boolean {
  if (!dueDate) return false;
  return new Date(dueDate + "T23:59:59") < new Date();
}

// ══════════════════════════════════════════════════════════════
//  SCORE BAR
// ══════════════════════════════════════════════════════════════
function ScoreBar({ label, score, max, color }: { label: string; score: number; max: number; color: string }) {
  const pct = Math.min((score / max) * 100, 100);
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-xs" style={{ color: "#4A5568" }}>{label}</span>
        <span className="text-xs font-semibold" style={{ color: "#2A4A1A" }}>{score}/{max}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(42,74,26,0.06)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  SCORING PANEL
// ══════════════════════════════════════════════════════════════
function ScoringPanel({ assessment, template }: {
  assessment: AssignedAssessment; template: SystemTemplate;
}) {
  const score       = calculateScore(template.questions as any, assessment.responses);
  const range       = template.scoring.ranges.find(r => score >= r.min && score <= r.max);
  const isPID5      = template.id === "system_pid5";
  const domainScores = isPID5 ? getPID5DomainScores(assessment.responses) : null;

  return (
    <div className="rounded-2xl p-5 space-y-4"
      style={{ background: "rgba(42,74,26,0.02)", border: "1px solid rgba(42,74,26,0.08)" }}>
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#8A9BA8" }}>
        Scoring Summary
      </p>
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: range ? range.color + "15" : "rgba(42,74,26,0.06)" }}>
          <span className="text-2xl font-bold"
            style={{ fontFamily: "var(--font-dm-serif)", color: range?.color ?? "#2A4A1A" }}>
            {score}
          </span>
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: range?.color ?? "#2A4A1A" }}>
            {range?.label ?? "—"}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "#8A9BA8" }}>
            Score: {score} / {template.scoring.maxScore}
          </p>
        </div>
      </div>
      <ScoreBar label={template.shortName} score={score} max={template.scoring.maxScore} color={range?.color ?? "#8DC63F"} />
      {range && (
        <div className="rounded-xl px-4 py-3" style={{ background: range.color + "10" }}>
          <p className="text-xs leading-relaxed" style={{ color: "#4A5568" }}>{range.description}</p>
        </div>
      )}
      {isPID5 && domainScores && (
        <div className="space-y-2 pt-2 border-t" style={{ borderColor: "rgba(42,74,26,0.08)" }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#8A9BA8" }}>
            Domain Scores (0–3)
          </p>
          {Object.entries(domainScores).map(([domain, avg]) => (
            <div key={domain} className="flex items-center justify-between">
              <span className="text-xs" style={{ color: "#4A5568" }}>{domain}</span>
              <div className="flex items-center gap-2">
                <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(42,74,26,0.06)" }}>
                  <div className="h-full rounded-full"
                    style={{ width: `${(avg / 3) * 100}%`, background: avg > 2 ? "#F7941D" : avg > 1 ? "#F7941D" : "#8DC63F" }} />
                </div>
                <span className="text-xs font-semibold w-6 text-right" style={{ color: "#2A4A1A" }}>{avg}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      {template.scoring.notes && (
        <div className="flex items-start gap-2 pt-2 border-t" style={{ borderColor: "rgba(42,74,26,0.08)" }}>
          <Lock size={11} className="flex-shrink-0 mt-0.5" style={{ color: "#8A9BA8" }} />
          <p className="text-xs leading-relaxed whitespace-pre-line" style={{ color: "#8A9BA8" }}>
            {template.scoring.notes}
          </p>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  RESPONSE VIEWER MODAL
// ══════════════════════════════════════════════════════════════
function ResponseViewer({ assessment, customTemplate, systemTemplate, onClose }: {
  assessment: AssignedAssessment;
  customTemplate?: Template;
  systemTemplate?: SystemTemplate;
  onClose: () => void;
}) {
  const questions = systemTemplate?.questions ?? customTemplate?.questions ?? assessment.questions ?? [];
  const title     = systemTemplate?.title ?? customTemplate?.title ?? assessment.templateTitle;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-2xl rounded-3xl overflow-hidden max-h-[88vh] flex flex-col"
        style={{ background: "#F6FAF0" }}>

        <div className="flex items-center justify-between px-6 py-5 border-b flex-shrink-0"
          style={{ borderColor: "rgba(42,74,26,0.08)" }}>
          <div>
            <h3 className="font-semibold" style={{ color: "#2A4A1A" }}>{title}</h3>
            {/* FIX: completedAt handled with toDate() helper — no crash on ISO strings */}
            <p className="text-xs mt-0.5" style={{ color: "#8A9BA8" }}>
              {assessment.clientName} · Completed {fmtDate(assessment.completedAt)}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-black/5">
            <X size={18} style={{ color: "#4A5568" }} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          {systemTemplate && <ScoringPanel assessment={assessment} template={systemTemplate} />}
          {questions.map((q: any, i: number) => (
            <div key={q.id} className="rounded-2xl p-5"
              style={{ background: "white", boxShadow: "0 1px 3px rgba(42,74,26,0.06)" }}>
              <p className="text-xs font-semibold mb-1" style={{ color: "#8A9BA8" }}>Q{i + 1}</p>
              <p className="text-sm font-medium mb-3" style={{ color: "#2A4A1A" }}>{q.label}</p>
              <div className="px-4 py-3 rounded-xl" style={{ background: "rgba(42,74,26,0.03)" }}>
                <p className="text-sm" style={{ color: "#22272B" }}>
                  {assessment.responses[q.id] !== undefined
                    ? String(assessment.responses[q.id])
                    : <span style={{ color: "#C4C4C4" }}>No response</span>}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 border-t flex-shrink-0" style={{ borderColor: "rgba(42,74,26,0.08)" }}>
          <button onClick={onClose} className="w-full py-3 rounded-xl text-sm font-semibold border-2"
            style={{ borderColor: "rgba(42,74,26,0.15)", color: "#2A4A1A" }}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  INLINE CONFIRM DIALOG (replaces window.confirm)
// ══════════════════════════════════════════════════════════════
function ConfirmDialog({ message, onConfirm, onCancel }: {
  message: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-sm rounded-2xl p-6 space-y-4" style={{ background: "#F6FAF0" }}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(247,148,29,0.1)" }}>
            <AlertCircle size={18} style={{ color: "#F7941D" }} />
          </div>
          <p className="text-sm mt-2" style={{ color: "#2A4A1A" }}>{message}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-sm font-semibold border-2"
            style={{ borderColor: "rgba(42,74,26,0.15)", color: "#2A4A1A" }}>Cancel</button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: "#F7941D" }}>Delete</button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  TEMPLATE BUILDER MODAL
// ══════════════════════════════════════════════════════════════
function TemplateBuilder({ onSave, onClose, doctorId }: {
  onSave: (t: Omit<Template, "id" | "createdAt">) => Promise<void>;
  onClose: () => void;
  doctorId: string;
}) {
  const [title,       setTitle]       = useState("");
  const [description, setDescription] = useState("");
  const [questions,   setQuestions]   = useState<Question[]>([]);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  function addQ() {
    setQuestions(q => [...q, { id: `q_${Date.now()}`, type: "text", label: "", required: true }]);
  }
  function updateQ(id: string, u: Partial<Question>) {
    setQuestions(q => q.map(x => x.id === id ? { ...x, ...u } : x));
  }
  function removeQ(id: string) { setQuestions(q => q.filter(x => x.id !== id)); }

  async function handleSave() {
    if (!title.trim()) { setError("Add a title."); return; }
    if (questions.length === 0) { setError("Add at least one question."); return; }
    if (questions.some(q => !q.label.trim())) { setError("All questions need a label."); return; }
    setSaving(true);
    try {
      await onSave({ title: title.trim(), description: description.trim(), questions, createdBy: doctorId });
      onClose();
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-2xl rounded-3xl overflow-hidden max-h-[85vh] flex flex-col"
        style={{ background: "#F6FAF0" }}>
        <div className="flex items-center justify-between px-6 py-5 border-b flex-shrink-0"
          style={{ borderColor: "rgba(42,74,26,0.08)" }}>
          <h3 className="font-semibold" style={{ color: "#2A4A1A" }}>Build Custom Template</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-black/5">
            <X size={18} style={{ color: "#4A5568" }} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
              style={{ background: "rgba(247,148,29,0.08)", color: "#F7941D" }}>
              <AlertCircle size={14} />{error}
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: "#8A9BA8" }}>Title *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Initial Wellbeing Check"
              className="w-full px-3 py-2.5 rounded-xl text-sm border focus:outline-none"
              style={{ borderColor: "rgba(42,74,26,0.15)", background: "white" }} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: "#8A9BA8" }}>Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
              className="w-full px-3 py-2.5 rounded-xl text-sm border resize-none focus:outline-none"
              style={{ borderColor: "rgba(42,74,26,0.15)", background: "white" }} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: "#8A9BA8" }}>Questions ({questions.length})</label>
              <button onClick={addQ}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white"
                style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)" }}>
                <Plus size={12} />Add Question
              </button>
            </div>
            <div className="space-y-3">
              {questions.map((q, i) => (
                <div key={q.id} className="rounded-2xl p-4"
                  style={{ background: "white", boxShadow: "0 1px 3px rgba(42,74,26,0.06)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold" style={{ color: "#8A9BA8" }}>Q{i + 1}</span>
                    <button onClick={() => removeQ(q.id)} className="p-1 rounded hover:bg-red-50">
                      <Trash2 size={13} style={{ color: "#F7941D" }} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-xs mb-1" style={{ color: "#8A9BA8" }}>Type</label>
                      <select value={q.type} onChange={e => updateQ(q.id, { type: e.target.value as QuestionType })}
                        className="w-full px-3 py-2 rounded-xl text-xs border focus:outline-none"
                        style={{ borderColor: "rgba(42,74,26,0.15)", background: "#FAFAFA" }}>
                        <option value="text">Short Text</option>
                        <option value="textarea">Long Text</option>
                        <option value="scale">Scale (1–10)</option>
                        <option value="yesNo">Yes / No</option>
                        <option value="multiChoice">Multiple Choice</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: "#4A5568" }}>
                        <input type="checkbox" checked={q.required}
                          onChange={e => updateQ(q.id, { required: e.target.checked })} />Required
                      </label>
                    </div>
                  </div>
                  <input type="text" value={q.label} onChange={e => updateQ(q.id, { label: e.target.value })}
                    placeholder="Question label..."
                    className="w-full px-3 py-2 rounded-xl text-xs border focus:outline-none"
                    style={{ borderColor: "rgba(42,74,26,0.15)", background: "#FAFAFA" }} />
                  {q.type === "multiChoice" && (
                    <div className="mt-3">
                      <label className="block text-xs mb-1" style={{ color: "#8A9BA8" }}>Options (one per line)</label>
                      <textarea value={q.options?.join("\n") ?? ""}
                        onChange={e => updateQ(q.id, { options: e.target.value.split("\n").filter(Boolean) })}
                        rows={3} placeholder={"Option 1\nOption 2"}
                        className="w-full px-3 py-2 rounded-xl text-xs border resize-none focus:outline-none"
                        style={{ borderColor: "rgba(42,74,26,0.15)", background: "#FAFAFA" }} />
                    </div>
                  )}
                </div>
              ))}
              {questions.length === 0 && (
                <div className="py-8 text-center rounded-2xl"
                  style={{ background: "rgba(42,74,26,0.02)", border: "2px dashed rgba(42,74,26,0.1)" }}>
                  <p className="text-sm" style={{ color: "#8A9BA8" }}>No questions yet — click Add Question</p>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t flex-shrink-0"
          style={{ borderColor: "rgba(42,74,26,0.08)" }}>
          <button onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-semibold border-2"
            style={{ borderColor: "rgba(42,74,26,0.15)", color: "#2A4A1A" }}>Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)" }}>
            {saving ? <><Loader2 size={14} className="animate-spin" />Saving...</> : "Save Template"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  ASSIGN MODAL
// ══════════════════════════════════════════════════════════════
function AssignModal({ allTemplates, systemTemplates, clients, doctorId,
  defaultTemplateId, onAssign, onClose }: {
  allTemplates: Template[]; systemTemplates: SystemTemplate[];
  clients: Client[]; doctorId: string;
  defaultTemplateId?: string;  // FIX: pre-select from library card click
  onAssign: (templateId: string, clientId: string, dueDate: string, isSystem: boolean) => Promise<void>;
  onClose: () => void;
}) {
  const [templateId, setTemplateId] = useState(defaultTemplateId ?? "");
  const [clientId,   setClientId]   = useState("");
  const [dueDate,    setDueDate]    = useState("");
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const isSystemTemplate = systemTemplates.some(t => t.id === templateId);

  async function handleAssign() {
    if (!templateId || !clientId) { setError("Please select a template and client."); return; }
    setSaving(true);
    try {
      await onAssign(templateId, clientId, dueDate, isSystemTemplate);
      onClose();
    } catch {
      setError("Failed to assign. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-3xl overflow-hidden" style={{ background: "#F6FAF0" }}>
        <div className="flex items-center justify-between px-6 py-5 border-b"
          style={{ borderColor: "rgba(42,74,26,0.08)" }}>
          <h3 className="font-semibold" style={{ color: "#2A4A1A" }}>Assign Assessment</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-black/5">
            <X size={18} style={{ color: "#4A5568" }} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
              style={{ background: "rgba(247,148,29,0.08)", color: "#F7941D" }}>
              <AlertCircle size={14} />{error}
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: "#8A9BA8" }}>Template *</label>
            <select value={templateId} onChange={e => setTemplateId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm border focus:outline-none"
              style={{ borderColor: "rgba(42,74,26,0.15)", background: "white", color: templateId ? "#22272B" : "#8A9BA8" }}>
              <option value="">Select template</option>
              <optgroup label="── Clinical Library">
                {systemTemplates.map(t => (
                  <option key={t.id} value={t.id}>{t.shortName} — {t.title.split("(")[0].trim()}</option>
                ))}
              </optgroup>
              {allTemplates.length > 0 && (
                <optgroup label="── My Custom Templates">
                  {allTemplates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                </optgroup>
              )}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: "#8A9BA8" }}>Client *</label>
            <select value={clientId} onChange={e => setClientId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm border focus:outline-none"
              style={{ borderColor: "rgba(42,74,26,0.15)", background: "white", color: clientId ? "#22272B" : "#8A9BA8" }}>
              <option value="">Select client</option>
              {clients.map(c => <option key={c.uid} value={c.uid}>{c.displayName}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: "#8A9BA8" }}>Due Date (optional)</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm border focus:outline-none"
              style={{ borderColor: "rgba(42,74,26,0.15)", background: "white" }} />
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t" style={{ borderColor: "rgba(42,74,26,0.08)" }}>
          <button onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-semibold border-2"
            style={{ borderColor: "rgba(42,74,26,0.15)", color: "#2A4A1A" }}>Cancel</button>
          <button onClick={handleAssign} disabled={saving}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)" }}>
            {saving ? <><Loader2 size={14} className="animate-spin" />Sending...</> : <><Send size={14} />Assign</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  SCORE TRENDS (PHQ-9 / GAD-7)
// ══════════════════════════════════════════════════════════════
const TREND_IDS = ["system_phq9", "system_gad7"] as const;

function ScoreTrendsPanel({
  assessments, clients, onOpen,
}: {
  assessments: AssignedAssessment[];
  clients: Client[];
  onOpen: (a: AssignedAssessment) => void;
}) {
  const [clientId, setClientId] = useState("");
  const [instrument, setInstrument] = useState<(typeof TREND_IDS)[number]>("system_phq9");

  const template = SYSTEM_TEMPLATES.find(t => t.id === instrument)!;

  const clientsWithScores = clients.filter(c =>
    assessments.some(a =>
      a.clientId === c.uid &&
      a.status === "completed" &&
      TREND_IDS.includes(a.templateId as (typeof TREND_IDS)[number])
    )
  );

  useEffect(() => {
    if (clientId) return;
    if (clientsWithScores[0]) setClientId(clientsWithScores[0].uid);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once when data arrives
  }, [clientsWithScores.length, clientId]);

  const points = assessments
    .filter(a =>
      a.status === "completed" &&
      a.clientId === clientId &&
      a.templateId === instrument
    )
    .map(a => {
      const d = toDate(a.completedAt) ?? toDate(a.assignedAt);
      return {
        assessment: a,
        date: d,
        score: calculateScore(template.questions as any, a.responses ?? {}),
      };
    })
    .filter(p => p.date)
    .sort((a, b) => a.date!.getTime() - b.date!.getTime());

  const maxScore = template.scoring.maxScore;
  const latest = points.length ? points[points.length - 1] : null;
  const prev   = points.length > 1 ? points[points.length - 2] : null;
  const delta  = latest && prev ? latest.score - prev.score : null;
  const latestRange = latest
    ? template.scoring.ranges.find(r => latest.score >= r.min && latest.score <= r.max)
    : null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-3 flex items-start gap-2.5"
        style={{ background: "rgba(42,74,26,0.03)", border: "1px solid rgba(42,74,26,0.07)" }}>
        <TrendingUp size={13} className="flex-shrink-0 mt-0.5" style={{ color: "#8A9BA8" }} />
        <p className="text-xs" style={{ color: "#8A9BA8" }}>
          Track PHQ-9 and GAD-7 scores over time for each client. Clinical interpretation remains yours —
          trends help spot improvement or relapse between sessions.
        </p>
      </div>

      {clientsWithScores.length === 0 ? (
        <div className="rounded-2xl p-12 text-center"
          style={{ background: "white", boxShadow: "0 1px 4px rgba(42,74,26,0.07)" }}>
          <TrendingUp size={24} className="mx-auto mb-3" style={{ color: "#8DC63F" }} />
          <p className="text-sm font-medium mb-1" style={{ color: "#2A4A1A" }}>No scored assessments yet</p>
          <p className="text-xs" style={{ color: "#8A9BA8" }}>
            Assign PHQ-9 or GAD-7 and wait for a client to complete one — trends appear here.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-3">
            <select value={clientId} onChange={e => setClientId(e.target.value)}
              className="px-3 py-2.5 rounded-xl text-sm border focus:outline-none min-w-[200px]"
              style={{ borderColor: "rgba(42,74,26,0.12)", background: "white", color: "#2A4A1A" }}>
              {clientsWithScores.map(c => (
                <option key={c.uid} value={c.uid}>{c.displayName}</option>
              ))}
            </select>
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(42,74,26,0.06)" }}>
              {TREND_IDS.map(id => {
                const t = SYSTEM_TEMPLATES.find(x => x.id === id)!;
                return (
                  <button key={id} type="button" onClick={() => setInstrument(id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: instrument === id ? "white" : "transparent",
                      color: instrument === id ? "#2A4A1A" : "#8A9BA8",
                      boxShadow: instrument === id ? "0 1px 3px rgba(42,74,26,0.1)" : "none",
                    }}>
                    {t.shortName}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl p-5 space-y-5"
            style={{ background: "white", boxShadow: "0 1px 4px rgba(42,74,26,0.07)" }}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-semibold" style={{ color: "#2A4A1A" }}>{template.shortName} trend</p>
                <p className="text-xs mt-0.5" style={{ color: "#8A9BA8" }}>
                  {points.length} completed submission{points.length !== 1 ? "s" : ""}
                </p>
              </div>
              {latest && (
                <div className="text-right">
                  <p className="text-2xl font-semibold leading-none"
                    style={{ fontFamily: "var(--font-dm-serif)", color: latestRange?.color ?? "#2A4A1A" }}>
                    {latest.score}
                    <span className="text-sm font-normal" style={{ color: "#8A9BA8" }}> / {maxScore}</span>
                  </p>
                  <p className="text-xs mt-1" style={{ color: latestRange?.color ?? "#8A9BA8" }}>
                    {latestRange?.label ?? "Latest"}
                    {delta !== null && (
                      <span style={{ color: delta < 0 ? "#6BA028" : delta > 0 ? "#F7941D" : "#8A9BA8" }}>
                        {" "}· {delta > 0 ? "+" : ""}{delta} vs prior
                      </span>
                    )}
                  </p>
                </div>
              )}
            </div>

            {points.length === 0 ? (
              <p className="text-sm text-center py-8" style={{ color: "#C4C4C4" }}>
                No completed {template.shortName} for this client yet.
              </p>
            ) : (
              <div className="flex items-end gap-2 h-44 px-1">
                {points.map((p, i) => {
                  const barH = Math.max(12, Math.round((p.score / maxScore) * 140));
                  const range = template.scoring.ranges.find(r => p.score >= r.min && p.score <= r.max);
                  return (
                    <button
                      key={p.assessment.id}
                      type="button"
                      onClick={() => onOpen(p.assessment)}
                      className="flex-1 flex flex-col items-center justify-end gap-1.5 min-w-0 h-full group"
                      title={`${fmtDate(p.date)} · score ${p.score}`}
                    >
                      <span className="text-xs font-semibold" style={{ color: "#2A4A1A" }}>{p.score}</span>
                      <div className="w-full max-w-[48px] rounded-t-lg transition-all group-hover:opacity-90"
                        style={{
                          height: barH,
                          background: range?.color ?? "#8DC63F",
                          opacity: i === points.length - 1 ? 1 : 0.75,
                        }}
                      />
                      <span className="text-xs truncate w-full text-center" style={{ color: "#8A9BA8" }}>
                        {p.date!.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {points.length > 0 && (
              <div className="space-y-2 pt-2 border-t" style={{ borderColor: "rgba(42,74,26,0.06)" }}>
                {[...points].reverse().map(p => {
                  const range = template.scoring.ranges.find(r => p.score >= r.min && p.score <= r.max);
                  return (
                    <button key={p.assessment.id} type="button" onClick={() => onOpen(p.assessment)}
                      className="w-full flex items-center justify-between gap-3 py-2 px-2 rounded-xl hover:bg-black/[0.02] text-left">
                      <span className="text-xs" style={{ color: "#4A5568" }}>{fmtDate(p.date)}</span>
                      <span className="text-xs font-semibold" style={{ color: range?.color ?? "#2A4A1A" }}>
                        {p.score} · {range?.label ?? "—"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  MAIN PAGE
// ══════════════════════════════════════════════════════════════
type ResponseFilter = "all" | "pending" | "completed";

export default function DoctorAssessmentsPage() {
  const { user } = useAuth();
  const [templates,        setTemplates]        = useState<Template[]>([]);
  const [assessments,      setAssessments]      = useState<AssignedAssessment[]>([]);
  const [clients,          setClients]          = useState<Client[]>([]);
  const [loading,          setLoading]          = useState(true);
  const [tab,              setTab]              = useState<"responses" | "trends" | "library" | "custom">("responses");
  const [responseFilter,   setResponseFilter]   = useState<ResponseFilter>("all");
  const [search,           setSearch]           = useState("");
  const [showBuilder,      setShowBuilder]      = useState(false);
  const [showAssign,       setShowAssign]       = useState(false);
  const [assignTemplateId, setAssignTemplateId] = useState<string | undefined>(undefined);
  const [viewing,          setViewing]          = useState<AssignedAssessment | null>(null);
  const [confirmDelete,    setConfirmDelete]    = useState<{ id: string; label: string } | null>(null);
  const [toast,            setToast]            = useState<{ type: "success" | "error"; msg: string } | null>(null);

  function showToast(type: "success" | "error", msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }

  // ── Data loading ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    (async () => {
      // Load templates and client IDs in parallel
      const [tSnap, apptSnap] = await Promise.all([
        getDocs(query(collection(db, "assessmentTemplates"), where("createdBy", "==", user.uid), orderBy("createdAt", "desc"))),
        getDocs(query(collection(db, "appointments"), where("doctorId", "==", user.uid))),
      ]);
      setTemplates(tSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Template));

      // FIX: Fetch clients by doc ID, not by field query.
      // where("uid","==",x) returns empty because uid IS the doc ID, not a field.
      const clientIds = [...new Set(apptSnap.docs.map(d => (d.data() as any).clientId as string).filter(Boolean))];
      if (clientIds.length > 0) {
        const cDocs = await Promise.all(clientIds.map(uid => getDoc(doc(db, "users", uid))));
        const loaded: Client[] = [];
        cDocs.forEach(snap => { if (snap.exists()) loaded.push({ uid: snap.id, ...snap.data() } as Client); });
        loaded.sort((a, b) => a.displayName.localeCompare(b.displayName));
        setClients(loaded);
      }

      setLoading(false);
    })();
  }, [user]);

  // FIX: Use onSnapshot for assessments so the list updates live when a client
  // completes one — original used getDocs which required a manual page refresh.
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "assessments"), where("doctorId", "==", user.uid), orderBy("assignedAt", "desc"));
    const unsub = onSnapshot(q, snap => {
      setAssessments(snap.docs.map(d => ({ id: d.id, ...d.data() }) as AssignedAssessment));
    });
    return () => unsub();
  }, [user]);

  // ── Mutations ─────────────────────────────────────────────────────────────
  async function handleSaveTemplate(data: Omit<Template, "id" | "createdAt">) {
    const ref = await addDoc(collection(db, "assessmentTemplates"), { ...data, createdAt: serverTimestamp() });
    setTemplates(p => [{ id: ref.id, ...data, createdAt: { toDate: () => new Date() } }, ...p]);
    showToast("success", "Template created.");
  }

  async function handleAssign(templateId: string, clientId: string, dueDate: string, isSystem: boolean) {
    if (!user) return;
    const client = clients.find(c => c.uid === clientId);
    if (!client) return;

    let title = "";
    let questions: Question[] = [];
    if (isSystem) {
      const st = SYSTEM_TEMPLATES.find(t => t.id === templateId);
      if (!st) return;
      title = st.title; questions = st.questions as any;
    } else {
      const ct = templates.find(t => t.id === templateId);
      if (!ct) return;
      title = ct.title; questions = ct.questions;
    }

    await addDoc(collection(db, "assessments"), {
      templateId, templateTitle: title, isSystem,
      clientId, clientName: client.displayName, doctorId: user.uid,
      status: "pending", responses: {}, questions,
      assignedAt: serverTimestamp(), completedAt: null,
      ...(dueDate ? { dueDate } : {}),
    });
    // Notify the client by email (fire-and-forget — never block assignment)
    authedFetch("/api/email/assessment", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ clientId, title, dueDate: dueDate || "", doctorId: user.uid }),
    }).catch(() => {});
    // onSnapshot handles the state update automatically
    showToast("success", `Assigned to ${client.displayName}.`);
  }

  // FIX: Replaced window.confirm() with inline ConfirmDialog component.
  // window.confirm() is blocked in some browsers/PWA contexts and breaks UI consistency.
  async function handleDeleteAssessment(id: string) {
    await deleteDoc(doc(db, "assessments", id));
    setConfirmDelete(null);
    showToast("success", "Assessment recalled.");
  }

  async function handleDeleteTemplate(id: string) {
    await deleteDoc(doc(db, "assessmentTemplates", id));
    setTemplates(p => p.filter(t => t.id !== id));
    setConfirmDelete(null);
    showToast("success", "Template deleted.");
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function getSystemTemplate(a: AssignedAssessment) {
    return a.isSystem ? SYSTEM_TEMPLATES.find(t => t.id === a.templateId) : undefined;
  }
  function getCustomTemplate(a: AssignedAssessment) {
    return !a.isSystem ? templates.find(t => t.id === a.templateId) : undefined;
  }
  function openAssignFor(templateId?: string) {
    setAssignTemplateId(templateId);
    setShowAssign(true);
  }

  // ── Filtered lists ────────────────────────────────────────────────────────
  const searched = assessments.filter(a =>
    a.clientName.toLowerCase().includes(search.toLowerCase()) ||
    a.templateTitle.toLowerCase().includes(search.toLowerCase())
  );
  const displayed = responseFilter === "pending"   ? searched.filter(a => a.status === "pending")
                  : responseFilter === "completed" ? searched.filter(a => a.status === "completed")
                  : searched;

  const pendingCount   = assessments.filter(a => a.status === "pending").length;
  const completedCount = assessments.filter(a => a.status === "completed").length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-lg text-sm font-medium"
          style={{ background: toast.type === "success" ? "#2A4A1A" : "#F7941D", color: "white" }}>
          {toast.type === "success" ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Confirm dialog */}
      {confirmDelete && (
        <ConfirmDialog
          message={confirmDelete.label}
          onConfirm={() => {
            // Determine if it's an assessment or template deletion
            if (assessments.some(a => a.id === confirmDelete.id)) {
              handleDeleteAssessment(confirmDelete.id);
            } else {
              handleDeleteTemplate(confirmDelete.id);
            }
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl" style={{ fontFamily: "var(--font-dm-serif)", color: "#2A4A1A" }}>
            Assessments
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "#8A9BA8" }}>
            Clinical tools, custom forms, and client responses
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowBuilder(true)}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold border-2"
            style={{ borderColor: "rgba(42,74,26,0.15)", color: "#2A4A1A" }}>
            <FileText size={14} /> Custom
          </button>
          {/* FIX: disabled only when no clients — canAssign had dead `|| true` logic */}
          <button onClick={() => openAssignFor(undefined)} disabled={clients.length === 0}
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 hover:-translate-y-0.5 transition-all"
            style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)" }}
            title={clients.length === 0 ? "No clients yet — clients appear once they book a session" : ""}>
            <Send size={14} /> Assign
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Library",   value: SYSTEM_TEMPLATES.length, accent: "#2A4A1A", Icon: BookOpen },
          { label: "Assigned",  value: assessments.length,      accent: "#8DC63F", Icon: Users },
          { label: "Pending",   value: pendingCount,            accent: "#F7941D", Icon: Clock },
          { label: "Completed", value: completedCount,          accent: "#6BA028", Icon: CheckCircle },
        ].map(({ label, value, accent, Icon }) => (
          <div key={label} className="rounded-2xl p-4 flex items-center gap-3"
            style={{ background: "white", boxShadow: "0 1px 4px rgba(42,74,26,0.07)" }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: accent + "12" }}>
              <Icon size={15} style={{ color: accent }} />
            </div>
            <div>
              <p className="text-xl font-semibold leading-none"
                style={{ fontFamily: "var(--font-dm-serif)", color: "#2A4A1A" }}>{value}</p>
              <p className="text-xs mt-0.5" style={{ color: "#8A9BA8" }}>{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl w-fit flex-wrap" style={{ background: "rgba(42,74,26,0.06)" }}>
        {([
          { key: "responses", label: "Client Responses" },
          { key: "trends",    label: "Score Trends"     },
          { key: "library",   label: "Clinical Library" },
          { key: "custom",    label: "My Templates"     },
        ] as const).map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className="px-4 py-2 rounded-lg text-xs font-semibold transition-all relative"
            style={{
              background: tab === key ? "white"   : "transparent",
              color:      tab === key ? "#2A4A1A" : "#8A9BA8",
              boxShadow:  tab === key ? "0 1px 3px rgba(42,74,26,0.1)" : "none",
            }}>
            {label}
            {/* Live badge on responses tab */}
            {key === "responses" && pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-white"
                style={{ background: "#F7941D", fontSize: "9px", fontWeight: 700 }}>
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab content ───────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={28} className="animate-spin" style={{ color: "#8DC63F" }} />
        </div>

      ) : tab === "responses" ? (
        <div className="space-y-4">

          {/* Search + status filter */}
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "#8A9BA8" }} />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by client or assessment..."
                className="w-full pl-10 pr-10 py-2.5 rounded-xl text-sm border focus:outline-none"
                style={{ borderColor: "rgba(42,74,26,0.12)", background: "white" }} />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3.5 top-1/2 -translate-y-1/2">
                  <X size={13} style={{ color: "#8A9BA8" }} />
                </button>
              )}
            </div>
            {/* FIX: Status filter — original had no way to quickly view just pending or completed */}
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(42,74,26,0.06)" }}>
              {(["all", "pending", "completed"] as const).map(f => (
                <button key={f} onClick={() => setResponseFilter(f)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
                  style={{
                    background: responseFilter === f ? "white"   : "transparent",
                    color:      responseFilter === f ? "#2A4A1A" : "#8A9BA8",
                    boxShadow:  responseFilter === f ? "0 1px 3px rgba(42,74,26,0.1)" : "none",
                  }}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          {displayed.length === 0 ? (
            <div className="rounded-2xl p-12 text-center"
              style={{ background: "white", boxShadow: "0 1px 4px rgba(42,74,26,0.07)" }}>
              <ClipboardList size={24} className="mx-auto mb-3" style={{ color: "#8DC63F" }} />
              <p className="text-sm font-medium" style={{ color: "#2A4A1A" }}>
                {search ? "No results found" : responseFilter !== "all" ? `No ${responseFilter} assessments` : "No assessments assigned yet"}
              </p>
              <p className="text-xs mt-1" style={{ color: "#8A9BA8" }}>
                {search ? "Try a different name." : responseFilter !== "all" ? "Switch to All to see everything." : "Assign a clinical tool or custom form to a client."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {displayed.map(a => {
                const isOverdue  = a.status === "pending" && isDueOverdue(a.dueDate);
                const isPending  = a.status === "pending";
                const accentColor = isPending ? "#F7941D" : "#6BA028";
                const accentBg    = isPending ? "rgba(247,148,29,0.1)" : "rgba(141,198,63,0.1)";

                return (
                  <div key={a.id} className="rounded-xl p-4 flex items-center gap-4"
                    style={{ background: "white", boxShadow: "0 1px 3px rgba(42,74,26,0.06)" }}>
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                      style={{ background: accentBg, color: accentColor }}>
                      {a.clientName?.[0]?.toUpperCase() ?? "C"}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{ color: "#2A4A1A" }}>{a.templateTitle}</p>
                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        <span className="text-xs" style={{ color: "#8A9BA8" }}>{a.clientName}</span>
                        {/* FIX: completedAt/assignedAt date uses toDate() helper — no crash on ISO strings */}
                        {isPending ? (
                          a.dueDate && (
                            <span className="text-xs flex items-center gap-1"
                              style={{ color: isOverdue ? "#F7941D" : "#8A9BA8" }}>
                              <Clock size={10} />
                              {isOverdue ? "Overdue · " : "Due "}
                              {new Date(a.dueDate + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </span>
                          )
                        ) : (
                          <span className="text-xs" style={{ color: "#8A9BA8" }}>
                            · {fmtDate(a.completedAt, { month: "short", day: "numeric" })}
                          </span>
                        )}
                        {a.isSystem && (
                          <span className="px-1.5 py-0.5 rounded text-xs"
                            style={{ background: "rgba(42,74,26,0.06)", color: "#8A9BA8" }}>Clinical</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isPending ? (
                        <>
                          <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                            style={{ background: accentBg, color: accentColor }}>
                            Pending
                          </span>
                          {/* FIX: Pending assessments can now be recalled (deleted).
                              Original only showed a static badge with no action. */}
                          <button
                            onClick={() => setConfirmDelete({ id: a.id, label: `Recall this assessment sent to ${a.clientName}?` })}
                            className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                            title="Recall assessment">
                            <RotateCcw size={13} style={{ color: "#8A9BA8" }} />
                          </button>
                        </>
                      ) : (
                        <button onClick={() => setViewing(a)}
                          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
                          style={{ background: "rgba(42,74,26,0.06)", color: "#2A4A1A" }}>
                          <Eye size={12} /> View + Score
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      ) : tab === "trends" ? (
        <ScoreTrendsPanel
          assessments={assessments}
          clients={clients}
          onOpen={a => setViewing(a)}
        />

      ) : tab === "library" ? (
        /* ── Clinical Library ── */
        <div className="space-y-3">
          <div className="rounded-xl p-3 flex items-start gap-2.5"
            style={{ background: "rgba(42,74,26,0.03)", border: "1px solid rgba(42,74,26,0.07)" }}>
            <Lock size={13} className="flex-shrink-0 mt-0.5" style={{ color: "#8A9BA8" }} />
            <p className="text-xs" style={{ color: "#8A9BA8" }}>
              These are validated, publicly available clinical instruments. Scores are automatically
              calculated when the client submits.
            </p>
          </div>
          {SYSTEM_TEMPLATES.map(t => {
            const cat = CATEGORY_COLORS[t.category] ?? { bg: "rgba(42,74,26,0.06)", color: "#4A5568" };
            return (
              <div key={t.id} className="rounded-2xl p-5"
                style={{ background: "white", boxShadow: "0 1px 4px rgba(42,74,26,0.07)" }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-bold flex-shrink-0"
                      style={{ background: cat.bg, color: cat.color }}>{t.shortName}</span>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "#2A4A1A" }}>{t.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: "#8A9BA8" }}>{t.description}</p>
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: cat.bg, color: cat.color }}>{t.category}</span>
                        <span className="text-xs" style={{ color: "#C4C4C4" }}>
                          {t.questions.length} items · ~{t.estimatedMinutes} min
                        </span>
                        <span className="text-xs" style={{ color: "#C4C4C4" }}>
                          Score: 0–{t.scoring.maxScore}
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* FIX: Clicking Assign from a library card now pre-selects that template in the modal */}
                  <button
                    onClick={() => clients.length > 0 ? openAssignFor(t.id) : undefined}
                    disabled={clients.length === 0}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl text-white flex-shrink-0 disabled:opacity-40"
                    style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)" }}
                    title={clients.length === 0 ? "No clients yet" : `Assign ${t.shortName}`}>
                    <Send size={12} /> Assign
                  </button>
                </div>
                {/* Score range preview */}
                <div className="mt-4 grid grid-cols-2 gap-1.5">
                  {t.scoring.ranges.slice(0, 4).map(r => (
                    <div key={r.label} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
                      style={{ background: r.color + "0D" }}>
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: r.color }} />
                      <span className="text-xs truncate" style={{ color: r.color }}>{r.label} ({r.min}–{r.max})</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs mt-3" style={{ color: "#C4C4C4" }}>{t.reference}</p>
              </div>
            );
          })}
        </div>

      ) : (
        /* ── Custom Templates ── */
        <div className="space-y-3">
          {templates.length === 0 ? (
            <div className="rounded-2xl p-12 text-center"
              style={{ background: "white", boxShadow: "0 1px 4px rgba(42,74,26,0.07)" }}>
              <FileText size={24} className="mx-auto mb-3" style={{ color: "#8DC63F" }} />
              <p className="text-sm font-medium mb-1" style={{ color: "#2A4A1A" }}>No custom templates</p>
              <p className="text-xs mb-4" style={{ color: "#8A9BA8" }}>
                Build your own forms to supplement the clinical library.
              </p>
              <button onClick={() => setShowBuilder(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)" }}>
                <Plus size={14} /> Create Template
              </button>
            </div>
          ) : (
            templates.map(t => (
              <div key={t.id} className="rounded-2xl p-5"
                style={{ background: "white", boxShadow: "0 1px 4px rgba(42,74,26,0.07)" }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-semibold" style={{ color: "#2A4A1A" }}>{t.title}</p>
                    {t.description && (
                      <p className="text-xs mt-0.5" style={{ color: "#8A9BA8" }}>{t.description}</p>
                    )}
                    <p className="text-xs mt-2" style={{ color: "#C4C4C4" }}>
                      {t.questions.length} question{t.questions.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => openAssignFor(t.id)} disabled={clients.length === 0}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-40"
                      style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)" }}>
                      <Send size={12} /> Assign
                    </button>
                    <button
                      onClick={() => setConfirmDelete({ id: t.id, label: `Delete template "${t.title}"? This cannot be undone.` })}
                      className="p-1.5 rounded-lg hover:bg-red-50">
                      <Trash2 size={14} style={{ color: "#F7941D" }} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modals */}
      {showBuilder && (
        <TemplateBuilder
          doctorId={user?.uid ?? ""}
          onSave={handleSaveTemplate}
          onClose={() => setShowBuilder(false)}
        />
      )}
      {showAssign && (
        <AssignModal
          allTemplates={templates}
          systemTemplates={SYSTEM_TEMPLATES}
          clients={clients}
          doctorId={user?.uid ?? ""}
          defaultTemplateId={assignTemplateId}
          onAssign={handleAssign}
          onClose={() => { setShowAssign(false); setAssignTemplateId(undefined); }}
        />
      )}
      {viewing && (
        <ResponseViewer
          assessment={viewing}
          systemTemplate={getSystemTemplate(viewing)}
          customTemplate={getCustomTemplate(viewing)}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}
