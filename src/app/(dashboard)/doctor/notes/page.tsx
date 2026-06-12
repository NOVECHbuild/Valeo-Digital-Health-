"use client";

import { useState, useEffect, Suspense } from "react";
import {
  collection, query, where, getDocs, getDoc, addDoc, updateDoc,
  deleteDoc, doc, orderBy, serverTimestamp,
} from "firebase/firestore";
import { bookableServices } from "@/lib/availability";
import { useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import type { Appointment } from "@/hooks/useAppointments";
import {
  FileText, Plus, Search, X, Loader2, Save,
  Edit3, Trash2, ChevronDown, CheckCircle,
  AlertCircle, Lock, Calendar, User,
  Sparkles, Upload, FileAudio, AlertTriangle, Link2,
} from "lucide-react";

// ── AI report formatter ─────────────────────────────────────────────────────
// Turns the Gemini clinical report JSON into a readable SOAP note body.
function formatAIReport(r: any): string {
  const soap = r?.soap ?? {};
  const out: string[] = [];
  if (r?.sessionSummary) out.push(`SUMMARY\n${r.sessionSummary}`);
  out.push(`SUBJECTIVE\n${soap.subjective || "—"}`);
  out.push(`OBJECTIVE\n${soap.objective || "—"}`);
  out.push(`ASSESSMENT\n${soap.assessment || "—"}`);
  out.push(`PLAN\n${soap.plan || "—"}`);
  if (Array.isArray(r?.keyThemes) && r.keyThemes.length)
    out.push(`KEY THEMES\n${r.keyThemes.join(", ")}`);
  if (Array.isArray(r?.recommendedInterventions) && r.recommendedInterventions.length)
    out.push(`RECOMMENDED INTERVENTIONS\n${r.recommendedInterventions.join(", ")}`);
  if (r?.nextSessionFocus) out.push(`NEXT SESSION FOCUS\n${r.nextSessionFocus}`);
  const rf = r?.riskFlags ?? {};
  const risks: string[] = [];
  if (rf.selfHarm)         risks.push("self-harm");
  if (rf.suicidalIdeation) risks.push("suicidal ideation");
  if (rf.harmToOthers)     risks.push("harm to others");
  if (rf.substanceUse)     risks.push("substance use");
  if (risks.length)
    out.push(`⚠ RISK FLAGS: ${risks.join(", ")}${rf.details ? ` — ${rf.details}` : ""}`);
  return out.join("\n\n");
}

// Returns true if the report contains any active risk flag.
function reportHasRisk(r: any): boolean {
  const rf = r?.riskFlags ?? {};
  return !!(rf.selfHarm || rf.suicidalIdeation || rf.harmToOthers || rf.substanceUse);
}

interface Client { uid: string; displayName: string; email: string; }
interface Note {
  id: string; clientId: string; clientName: string; doctorId: string;
  title: string; content: string; sessionDate: string; sessionType: string;
  tags: string[]; createdAt: any; updatedAt: any;
  // Optional link to a specific appointment/session (P2)
  appointmentId?: string; appointmentTime?: string;
}

const SESSION_TYPES = ["Individual Therapy","Couples Therapy","Life Coaching","Workplace Wellness","Free Consultation"];
const NOTE_TAGS = ["Progress","Concern","Follow-up","Milestone","Crisis","Homework","Assessment","General"];

const TAG_COLORS: Record<string,{bg:string;color:string}> = {
  Progress:    { bg:"rgba(141,198,63,0.12)",  color:"#6BA028" },
  Concern:     { bg:"rgba(247,148,29,0.12)",   color:"#F7941D" },
  "Follow-up": { bg:"rgba(247,148,29,0.12)",  color:"#C4700A" },
  Milestone:   { bg:"rgba(42,74,26,0.1)",     color:"#2A4A1A" },
  Crisis:      { bg:"rgba(247,148,29,0.18)",   color:"#C0392B" },
  Homework:    { bg:"rgba(142,68,173,0.1)",   color:"#8E44AD" },
  Assessment:  { bg:"rgba(52,152,219,0.12)",  color:"#2980B9" },
  General:     { bg:"rgba(138,155,168,0.12)", color:"#8A9BA8" },
};

function TagChip({ tag }: { tag: string }) {
  const s = TAG_COLORS[tag] ?? { bg:"rgba(42,74,26,0.06)", color:"#4A5568" };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background:s.bg, color:s.color }}>{tag}</span>
  );
}

function NoteEditor({ note, clients, appointments, sessionTypes, doctorId, onSave, onClose }: {
  note: Partial<Note>|null; clients: Client[]; appointments: Appointment[]; sessionTypes: string[]; doctorId: string;
  onSave: (n: Omit<Note,"id"|"createdAt"|"updatedAt">) => Promise<void>;
  onClose: () => void;
}) {
  const isEdit = !!(note as Note)?.id;
  const [clientId,      setClientId]      = useState(note?.clientId    ?? "");
  const [title,         setTitle]         = useState(note?.title       ?? "");
  const [content,       setContent]       = useState(note?.content     ?? "");
  const [sessionDate,   setSessionDate]   = useState(note?.sessionDate ?? new Date().toISOString().split("T")[0]);
  const [sessionType,   setSessionType]   = useState(note?.sessionType ?? "");
  const [appointmentId, setAppointmentId] = useState(note?.appointmentId ?? "");
  const [tags,          setTags]          = useState<string[]>(note?.tags ?? []);
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState<string|null>(null);

  // Appointments belonging to the selected client, newest first
  const clientAppointments = appointments
    .filter(a => a.clientId === clientId)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  // When linking a session, pull the appointment's date + type onto the note
  function linkAppointment(id: string) {
    setAppointmentId(id);
    const appt = appointments.find(a => a.id === id);
    if (appt) {
      if (appt.date) setSessionDate(appt.date);
      if (appt.type) setSessionType(appt.type);
    }
  }

  // ── AI Assist state ──────────────────────────────────────────────────────
  const [aiOpen,       setAiOpen]       = useState(false);
  const [aiMode,       setAiMode]       = useState<"text"|"audio">("text");
  const [aiTranscript, setAiTranscript] = useState("");
  const [aiFile,       setAiFile]       = useState<File|null>(null);
  const [aiLoading,    setAiLoading]    = useState(false);
  const [aiError,      setAiError]      = useState<string|null>(null);
  const [aiDone,       setAiDone]       = useState(false);

  const selectedClient = clients.find(c => c.uid === clientId);
  const toggleTag = (t: string) => setTags(prev => prev.includes(t) ? prev.filter(x=>x!==t) : [...prev,t]);

  // ── Call the AI session-summary endpoint in preview mode ──────────────────
  async function handleGenerateAI() {
    setAiError(null);
    if (aiMode === "text" && !aiTranscript.trim()) {
      setAiError("Paste a session transcript first."); return;
    }
    if (aiMode === "audio" && !aiFile) {
      setAiError("Choose an audio file first."); return;
    }
    setAiLoading(true);
    try {
      let res: Response;
      if (aiMode === "audio" && aiFile) {
        const fd = new FormData();
        fd.append("audio", aiFile);
        fd.append("preview", "true");
        res = await fetch("/api/ai/session-summary", { method: "POST", body: fd });
      } else {
        res = await fetch("/api/ai/session-summary", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ transcript: aiTranscript, preview: true }),
        });
      }
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "AI generation failed.");
      }

      const report    = data.clinicalReport;
      const formatted = formatAIReport(report);

      // Append to existing content (never overwrite the doctor's own writing)
      setContent(prev => prev.trim() ? `${prev.trim()}\n\n${formatted}` : formatted);

      // Suggest tags: risk → Crisis + Concern, otherwise Progress
      if (reportHasRisk(report)) {
        setTags(prev => Array.from(new Set([...prev, "Crisis", "Concern"])));
      } else {
        setTags(prev => prev.includes("Progress") ? prev : [...prev, "Progress"]);
      }

      // Suggest a title if the doctor hasn't written one
      if (!title.trim() && report?.sessionSummary) {
        setTitle(report.sessionSummary.split(/[.!?]/)[0].slice(0, 60));
      }

      setAiDone(true);
      setAiOpen(false);
    } catch (e: any) {
      setAiError(e.message ?? "AI generation failed. Please try again.");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSave() {
    if (!clientId||!title.trim()||!content.trim()||!sessionDate||!sessionType) {
      setError("Please fill in all required fields."); return;
    }
    setSaving(true);
    try {
      const linkedAppt = appointments.find(a => a.id === appointmentId);
      await onSave({ clientId, clientName: selectedClient?.displayName??"", doctorId,
        title:title.trim(), content:content.trim(), sessionDate, sessionType, tags,
        appointmentId: appointmentId || "", appointmentTime: linkedAppt?.time ?? "" });
      onClose();
    } catch { setError("Failed to save. Please try again."); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16"
      style={{ background:"rgba(0,0,0,0.5)", backdropFilter:"blur(4px)" }}>
      <div className="w-full max-w-2xl rounded-3xl overflow-hidden max-h-[80vh] flex flex-col"
        style={{ background:"#F6FAF0" }}>
        <div className="flex items-center justify-between px-6 py-5 border-b flex-shrink-0"
          style={{ borderColor:"rgba(42,74,26,0.08)" }}>
          <div>
            <h3 className="font-semibold text-sm" style={{ color:"#2A4A1A" }}>
              {isEdit ? "Edit Session Note" : "New Session Note"}
            </h3>
            <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color:"#8A9BA8" }}>
              <Lock size={10} /> Private — only visible to you
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-black/5">
            <X size={18} style={{ color:"#4A5568" }} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
              style={{ background:"rgba(247,148,29,0.08)", color:"#F7941D" }}>
              <AlertCircle size={14} />{error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color:"#8A9BA8" }}>Client *</label>
              <select value={clientId} onChange={e=>{ setClientId(e.target.value); setAppointmentId(""); }}
                className="w-full px-3 py-2.5 rounded-xl text-sm border focus:outline-none"
                style={{ borderColor:"rgba(42,74,26,0.15)", background:"white", color:clientId?"#22272B":"#8A9BA8" }}>
                <option value="">Select client</option>
                {clients.map(c=><option key={c.uid} value={c.uid}>{c.displayName}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color:"#8A9BA8" }}>Session Type *</label>
              <select value={sessionType} onChange={e=>setSessionType(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm border focus:outline-none"
                style={{ borderColor:"rgba(42,74,26,0.15)", background:"white", color:sessionType?"#22272B":"#8A9BA8" }}>
                <option value="">Select type</option>
                {sessionTypes.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Link to a specific appointment/session (optional) */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1.5" style={{ color:"#8A9BA8" }}>
              <Link2 size={11}/> Link to Session <span style={{ color:"#C4C4C4" }}>(optional)</span>
            </label>
            <select value={appointmentId} onChange={e=>linkAppointment(e.target.value)} disabled={!clientId}
              className="w-full px-3 py-2.5 rounded-xl text-sm border focus:outline-none disabled:opacity-50"
              style={{ borderColor:"rgba(42,74,26,0.15)", background:"white", color:appointmentId?"#22272B":"#8A9BA8" }}>
              <option value="">{clientId ? "— No specific session —" : "Select a client first"}</option>
              {clientAppointments.map(a=>(
                <option key={a.id} value={a.id}>
                  {new Date(a.date+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})} · {a.time} · {a.type} ({a.status})
                </option>
              ))}
            </select>
            {appointmentId && (
              <p className="text-xs mt-1 flex items-center gap-1" style={{ color:"#6BA028" }}>
                <CheckCircle size={10}/> This note is linked to the selected session.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color:"#8A9BA8" }}>Session Date *</label>
              <input type="date" value={sessionDate} onChange={e=>setSessionDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm border focus:outline-none"
                style={{ borderColor:"rgba(42,74,26,0.15)", background:"white" }} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color:"#8A9BA8" }}>Note Title *</label>
              <input type="text" value={title} onChange={e=>setTitle(e.target.value)}
                placeholder="e.g. Session 3 — Anxiety management"
                className="w-full px-3 py-2.5 rounded-xl text-sm border focus:outline-none"
                style={{ borderColor:"rgba(42,74,26,0.15)", background:"white" }} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color:"#8A9BA8" }}>Tags</label>
            <div className="flex flex-wrap gap-2">
              {NOTE_TAGS.map(tag=>{
                const sel = tags.includes(tag);
                return (
                  <button key={tag} onClick={()=>toggleTag(tag)}
                    className="px-3 py-1 rounded-full text-xs font-medium border-2 transition-all"
                    style={{ borderColor:sel?"#2A4A1A":"rgba(42,74,26,0.12)", background:sel?"rgba(42,74,26,0.06)":"white", color:sel?"#2A4A1A":"#8A9BA8" }}>
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color:"#8A9BA8" }}>Session Notes *</label>
              <button type="button" onClick={()=>{ setAiOpen(o=>!o); setAiError(null); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{ background: aiOpen ? "rgba(247,148,29,0.12)" : "rgba(141,198,63,0.12)", color: aiOpen ? "#C4700A" : "#6BA028" }}>
                <Sparkles size={13}/> {aiOpen ? "Close AI Assist" : "Generate with AI"}
              </button>
            </div>

            {/* ── AI Assist panel ── */}
            {aiOpen && (
              <div className="rounded-xl border mb-3 overflow-hidden"
                style={{ borderColor:"rgba(141,198,63,0.3)", background:"rgba(141,198,63,0.04)" }}>
                <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor:"rgba(141,198,63,0.2)" }}>
                  <Sparkles size={14} style={{ color:"#6BA028" }}/>
                  <p className="text-xs font-semibold" style={{ color:"#2A4A1A" }}>AI Session Summary</p>
                  <span className="text-xs" style={{ color:"#8A9BA8" }}>· Draft only — review before saving</span>
                </div>

                {/* Mode toggle */}
                <div className="flex gap-2 px-4 pt-3">
                  {([["text","Paste transcript"],["audio","Upload audio"]] as const).map(([m,lbl])=>(
                    <button key={m} type="button" onClick={()=>{ setAiMode(m); setAiError(null); }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
                      style={{ borderColor: aiMode===m ? "#6BA028" : "rgba(42,74,26,0.12)",
                        background: aiMode===m ? "rgba(141,198,63,0.12)" : "white",
                        color: aiMode===m ? "#2A4A1A" : "#8A9BA8" }}>
                      {lbl}
                    </button>
                  ))}
                </div>

                <div className="p-4">
                  {aiMode === "text" ? (
                    <textarea value={aiTranscript} onChange={e=>setAiTranscript(e.target.value)} rows={5}
                      placeholder={"Paste the session transcript here.\nFor example:\nTHERAPIST: How have you been since last week?\nCLIENT: ..."}
                      className="w-full px-3 py-2.5 rounded-lg text-sm border resize-none focus:outline-none leading-relaxed"
                      style={{ borderColor:"rgba(42,74,26,0.15)", background:"white" }}/>
                  ) : (
                    <label className="flex items-center gap-3 px-4 py-4 rounded-lg border-2 border-dashed cursor-pointer"
                      style={{ borderColor:"rgba(42,74,26,0.18)", background:"white" }}>
                      <Upload size={18} style={{ color:"#6BA028" }}/>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color:"#2A4A1A" }}>
                          {aiFile ? aiFile.name : "Choose a session recording"}
                        </p>
                        <p className="text-xs" style={{ color:"#8A9BA8" }}>MP3, WAV, M4A, OGG or WebM</p>
                      </div>
                      <FileAudio size={16} style={{ color:"#8A9BA8" }}/>
                      <input type="file" accept="audio/*" className="hidden"
                        onChange={e=>setAiFile(e.target.files?.[0] ?? null)}/>
                    </label>
                  )}

                  {aiError && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs mt-3"
                      style={{ background:"rgba(247,148,29,0.1)", color:"#C4700A" }}>
                      <AlertTriangle size={13}/>{aiError}
                    </div>
                  )}

                  <button type="button" onClick={handleGenerateAI} disabled={aiLoading}
                    className="w-full mt-3 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-60 flex items-center justify-center gap-2"
                    style={{ background:"linear-gradient(135deg, #6BA028, #2A4A1A)" }}>
                    {aiLoading
                      ? <><Loader2 size={14} className="animate-spin"/>Analysing session…</>
                      : <><Sparkles size={14}/>Generate SOAP Note</>}
                  </button>
                  <p className="text-xs mt-2 text-center" style={{ color:"#8A9BA8" }}>
                    AI output is added below your notes. Always review for accuracy before saving.
                  </p>
                </div>
              </div>
            )}

            {aiDone && !aiOpen && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs mb-2"
                style={{ background:"rgba(141,198,63,0.12)", color:"#6BA028" }}>
                <CheckCircle size={13}/> AI summary added below. Review and edit before saving.
              </div>
            )}

            <textarea value={content} onChange={e=>setContent(e.target.value)} rows={8}
              placeholder="Document session observations, progress, interventions, and plans..."
              className="w-full px-4 py-3 rounded-xl text-sm border resize-none focus:outline-none leading-relaxed"
              style={{ borderColor:"rgba(42,74,26,0.15)", background:"white" }} />
            <p className="text-xs mt-1 text-right" style={{ color:"#C4C4C4" }}>{content.length} characters</p>
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t flex-shrink-0"
          style={{ borderColor:"rgba(42,74,26,0.08)" }}>
          <button onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm font-semibold border-2"
            style={{ borderColor:"rgba(42,74,26,0.15)", color:"#2A4A1A" }}>Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ background:"linear-gradient(135deg, #2A4A1A, #3D6B24)" }}>
            {saving ? <><Loader2 size={14} className="animate-spin"/>Saving...</> : <><Save size={14}/>Save Note</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function NoteCard({ note, onEdit, onDelete }: { note:Note; onEdit:()=>void; onDelete:()=>void }) {
  const [expanded, setExpanded] = useState(false);
  const preview = note.content.slice(0,180);
  const hasMore = note.content.length > 180;

  return (
    <div className="rounded-2xl p-5" style={{ background:"white", boxShadow:"0 1px 4px rgba(42,74,26,0.07)" }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold"
            style={{ background:"rgba(42,74,26,0.06)", color:"#2A4A1A" }}>
            {note.clientName?.[0]?.toUpperCase()??"C"}
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color:"#2A4A1A" }}>{note.title}</p>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="flex items-center gap-1 text-xs" style={{ color:"#8A9BA8" }}>
                <User size={10}/>{note.clientName}
              </span>
              <span className="flex items-center gap-1 text-xs" style={{ color:"#8A9BA8" }}>
                <Calendar size={10}/>
                {new Date(note.sessionDate+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
              </span>
              {note.appointmentId && (
                <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background:"rgba(141,198,63,0.12)", color:"#6BA028" }}>
                  <Link2 size={10}/> Linked session
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-black/5" style={{ color:"#8A9BA8" }}>
            <Edit3 size={14}/>
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-50" style={{ color:"#8A9BA8" }}>
            <Trash2 size={14}/>
          </button>
        </div>
      </div>

      <span className="text-xs px-2.5 py-1 rounded-lg font-medium mb-3 inline-block"
        style={{ background:"rgba(42,74,26,0.05)", color:"#4A5568" }}>
        {note.sessionType}
      </span>

      {note.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {note.tags.map(t=><TagChip key={t} tag={t}/>)}
        </div>
      )}

      <div className="rounded-xl p-4" style={{ background:"rgba(42,74,26,0.02)" }}>
        <p className="text-sm leading-relaxed" style={{ color:"#4A5568", whiteSpace:"pre-wrap" }}>
          {expanded ? note.content : preview}{!expanded && hasMore && "..."}
        </p>
        {hasMore && (
          <button onClick={()=>setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs font-medium mt-2" style={{ color:"#2A4A1A" }}>
            {expanded?"Show less":"Read more"}
            <ChevronDown size={12} style={{ transform:expanded?"rotate(180deg)":"none", transition:"transform 0.2s" }}/>
          </button>
        )}
      </div>

      <div className="flex items-center justify-between mt-3">
        <span className="flex items-center gap-1 text-xs" style={{ color:"#C4C4C4" }}>
          <Lock size={10}/> Private note
        </span>
        <span className="text-xs" style={{ color:"#C4C4C4" }}>
          {note.updatedAt?.toDate ? `Updated ${note.updatedAt.toDate().toLocaleDateString("en-US",{month:"short",day:"numeric"})}` : ""}
        </span>
      </div>
    </div>
  );
}

function NotesPageInner() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [notes,        setNotes]        = useState<Note[]>([]);
  const [clients,      setClients]      = useState<Client[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [filterClient, setFilterClient] = useState("all");
  const [editNote,     setEditNote]     = useState<Partial<Note>|null|false>(false);
  const [deleting,     setDeleting]     = useState<string|null>(null);
  const [toast,        setToast]        = useState<{type:"success"|"error";msg:string}|null>(null);
  const [prefilled,    setPrefilled]    = useState(false);
  const [sessionTypes, setSessionTypes] = useState<string[]>(SESSION_TYPES);

  function showToast(type:"success"|"error", msg:string) {
    setToast({type,msg}); setTimeout(()=>setToast(null),4000);
  }

  useEffect(()=>{
    if(!user) return;
    (async()=>{
      const notesSnap = await getDocs(query(collection(db,"notes"),where("doctorId","==",user.uid),orderBy("createdAt","desc")));
      setNotes(notesSnap.docs.map(d=>({id:d.id,...d.data()}) as Note));

      const apptSnap = await getDocs(query(collection(db,"appointments"),where("doctorId","==",user.uid)));
      setAppointments(apptSnap.docs.map(d=>({id:d.id,...d.data()}) as Appointment));
      const clientIds = [...new Set(apptSnap.docs.map(d=>(d.data() as any).clientId as string))];

      // Session-type options from the doctor's own services (fallback to defaults)
      try {
        const schedSnap = await getDoc(doc(db,"schedules",user.uid));
        const sched = schedSnap.exists() ? (schedSnap.data() as any) : null;
        const names = bookableServices(sched).map(s=>s.name);
        if (names.length) setSessionTypes(names);
      } catch { /* keep default list */ }

      if(clientIds.length > 0) {
        const clientDocs = await Promise.all(clientIds.map(uid=>getDocs(query(collection(db,"users"),where("uid","==",uid)))));
        const loaded: Client[] = [];
        clientDocs.forEach(snap=>snap.docs.forEach(d=>loaded.push({uid:d.id,...d.data()} as Client)));
        loaded.sort((a,b)=>a.displayName.localeCompare(b.displayName));
        setClients(loaded);
      }
      setLoading(false);
    })();
  },[user]);

  // ── Deep-link from the schedule page: ?appointmentId=… opens a pre-linked note
  useEffect(()=>{
    if (prefilled) return;
    const apptId = searchParams.get("appointmentId");
    if (!apptId || appointments.length === 0) return;
    const appt = appointments.find(a => a.id === apptId);
    if (appt) {
      setEditNote({
        clientId:      appt.clientId,
        clientName:    appt.clientName,
        sessionType:   appt.type,
        sessionDate:   appt.date,
        appointmentId: appt.id,
      });
    }
    setPrefilled(true);
  },[appointments, searchParams, prefilled]);

  async function handleSave(data: Omit<Note,"id"|"createdAt"|"updatedAt">) {
    if(!user) return;
    const editing = editNote && (editNote as Note).id;
    if(editing) {
      const id = (editNote as Note).id;
      await updateDoc(doc(db,"notes",id),{...data,updatedAt:serverTimestamp()});
      setNotes(p=>p.map(n=>n.id===id?{...n,...data,updatedAt:{toDate:()=>new Date()}}:n));
      showToast("success","Note updated.");
    } else {
      const ref = await addDoc(collection(db,"notes"),{...data,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
      setNotes(p=>[{id:ref.id,...data,createdAt:{toDate:()=>new Date()},updatedAt:{toDate:()=>new Date()}},...p]);
      showToast("success","Note saved.");
    }
  }

  async function handleDelete(id:string) {
    if(!confirm("Delete this note? This cannot be undone.")) return;
    setDeleting(id);
    try {
      await deleteDoc(doc(db,"notes",id));
      setNotes(p=>p.filter(n=>n.id!==id));
      showToast("success","Note deleted.");
    } catch { showToast("error","Failed to delete."); }
    finally { setDeleting(null); }
  }

  const filtered = notes.filter(n=>
    (filterClient==="all"||n.clientId===filterClient) &&
    (n.title.toLowerCase().includes(search.toLowerCase())||
     n.clientName.toLowerCase().includes(search.toLowerCase())||
     n.content.toLowerCase().includes(search.toLowerCase()))
  );

  const thisMonth = notes.filter(n=>{
    if(!n.createdAt?.toDate) return false;
    const d=n.createdAt.toDate(), now=new Date();
    return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();
  }).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-lg text-sm font-medium"
          style={{ background:toast.type==="success"?"#2A4A1A":"#F7941D", color:"white" }}>
          {toast.type==="success"?<CheckCircle size={16}/>:<AlertCircle size={16}/>}{toast.msg}
        </div>
      )}

      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl" style={{ fontFamily:"var(--font-dm-serif)", color:"#2A4A1A" }}>Session Notes</h2>
          <p className="text-sm mt-0.5 flex items-center gap-1.5" style={{ color:"#8A9BA8" }}>
            <Lock size={12}/> Private and confidential — only visible to you
          </p>
        </div>
        <button onClick={()=>setEditNote({})}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:-translate-y-0.5 transition-all"
          style={{ background:"linear-gradient(135deg, #2A4A1A, #3D6B24)" }}>
          <Plus size={15}/> New Note
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label:"Total Notes", value:notes.length,                               accent:"#2A4A1A" },
          { label:"Clients",     value:new Set(notes.map(n=>n.clientId)).size,     accent:"#8DC63F" },
          { label:"This Month",  value:thisMonth,                                  accent:"#F7941D" },
        ].map(({label,value,accent})=>(
          <div key={label} className="rounded-2xl p-4 flex items-center gap-3"
            style={{ background:"white", boxShadow:"0 1px 4px rgba(42,74,26,0.07)" }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background:accent+"12" }}>
              <FileText size={16} style={{ color:accent }}/>
            </div>
            <div>
              <p className="text-2xl font-semibold leading-none"
                style={{ fontFamily:"var(--font-dm-serif)", color:"#2A4A1A" }}>{value}</p>
              <p className="text-xs mt-0.5" style={{ color:"#8A9BA8" }}>{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color:"#8A9BA8" }}/>
          <input type="text" value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Search notes..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border focus:outline-none"
            style={{ borderColor:"rgba(42,74,26,0.12)", background:"white" }}/>
          {search && <button onClick={()=>setSearch("")} className="absolute right-3.5 top-1/2 -translate-y-1/2"><X size={13} style={{ color:"#8A9BA8" }}/></button>}
        </div>
        <select value={filterClient} onChange={e=>setFilterClient(e.target.value)}
          className="px-4 py-2.5 rounded-xl text-sm border focus:outline-none"
          style={{ borderColor:"rgba(42,74,26,0.12)", background:"white", color:"#22272B" }}>
          <option value="all">All Clients</option>
          {clients.map(c=><option key={c.uid} value={c.uid}>{c.displayName}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={28} className="animate-spin" style={{ color:"#8DC63F" }}/>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background:"white", boxShadow:"0 1px 4px rgba(42,74,26,0.07)" }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background:"rgba(141,198,63,0.08)" }}>
            <FileText size={24} style={{ color:"#8DC63F" }}/>
          </div>
          <p className="text-sm font-medium mb-1" style={{ color:"#2A4A1A" }}>
            {search?"No notes found":"No session notes yet"}
          </p>
          <p className="text-xs mb-4" style={{ color:"#8A9BA8" }}>
            {search?"Try different search terms.":"Create your first note after a session."}
          </p>
          {!search && (
            <button onClick={()=>setEditNote({})}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background:"linear-gradient(135deg, #2A4A1A, #3D6B24)" }}>
              <Plus size={14}/> New Note
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(note=>(
            <div key={note.id} style={{ opacity:deleting===note.id?0.5:1, transition:"opacity 0.2s" }}>
              <NoteCard note={note} onEdit={()=>setEditNote(note)} onDelete={()=>handleDelete(note.id)}/>
            </div>
          ))}
        </div>
      )}

      {editNote !== false && (
        <NoteEditor note={editNote} clients={clients} appointments={appointments} sessionTypes={sessionTypes} doctorId={user?.uid??""} onSave={handleSave} onClose={()=>setEditNote(false)}/>
      )}
    </div>
  );
}

// useSearchParams() must be wrapped in a Suspense boundary (Next.js App Router)
export default function DoctorNotesPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-24">
        <Loader2 size={28} className="animate-spin" style={{ color:"#8DC63F" }}/>
      </div>
    }>
      <NotesPageInner/>
    </Suspense>
  );
}
