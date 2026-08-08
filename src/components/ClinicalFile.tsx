"use client";

import { useEffect, useMemo, useState } from "react";
import {
  collection, query, where, onSnapshot, orderBy, getDocs,
} from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { authedFetch } from "@/lib/authedFetch";
import MeetRecordingGuide from "@/components/MeetRecordingGuide";
import { formatAIReport } from "@/lib/sessionReportFormat";
import {
  FileText, ClipboardList, Loader2, Plus, X, Sparkles, Upload,
  Lock, CheckCircle, AlertCircle, ChevronDown, ChevronUp, ExternalLink,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────
export interface ClinicalAppointment {
  id: string;
  type: string;
  date: string;
  time: string;
  duration: number;
  status: string;
  meetLink?: string;
  clientId: string;
  hasSessionReport?: boolean;
}

interface SessionReport {
  appointmentId: string;
  transcript?: string;
  clinicalReport?: any;
  status?: string;
  generatedAt?: string;
  audioUsed?: boolean;
}

interface NoteLite {
  id: string;
  appointmentId?: string;
  title: string;
  content: string;
  sessionDate: string;
  sessionType: string;
}

interface AssessmentLite {
  id: string;
  title: string;
  status: string;
  assignedAt?: any;
  completedAt?: any;
  score?: number;
}

type TimelineItem =
  | { kind: "visit"; sortKey: string; appt: ClinicalAppointment; report?: SessionReport; note?: NoteLite }
  | { kind: "assessment"; sortKey: string; assessment: AssessmentLite };

// ── File visit modal ───────────────────────────────────────────────────────
function FileVisitModal({
  clientId,
  clientName,
  appointments,
  preselectApptId,
  onClose,
  onFiled,
}: {
  clientId: string;
  clientName: string;
  appointments: ClinicalAppointment[];
  preselectApptId?: string;
  onClose: () => void;
  onFiled: () => void;
}) {
  const { user } = useAuth();
  const [appointmentId, setAppointmentId] = useState(
    preselectApptId || appointments[0]?.id || "",
  );
  const [mode, setMode] = useState<"audio" | "text">("audio");
  const [file, setFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const fileable = appointments.filter(a =>
    ["approved", "completed", "pending"].includes(a.status),
  );

  async function handleSubmit() {
    if (!user || !appointmentId) {
      setError("Select a session to file against.");
      return;
    }
    if (mode === "audio" && !file) {
      setError("Choose an audio file from your Meet recording.");
      return;
    }
    if (mode === "text" && !transcript.trim()) {
      setError("Paste the Meet transcript first.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let storagePath = "";
      if (mode === "audio" && file) {
        const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 80);
        storagePath = `clinical/${user.uid}/${clientId}/${appointmentId}/${Date.now()}-${safeName}`;
        await uploadBytes(ref(storage, storagePath), file, {
          contentType: file.type || "audio/mpeg",
        });
      }

      let res: Response;
      if (mode === "audio" && file) {
        const fd = new FormData();
        fd.append("audio", file);
        fd.append("appointmentId", appointmentId);
        fd.append("storagePath", storagePath);
        fd.append("alsoNote", "true");
        res = await authedFetch("/api/ai/session-summary", { method: "POST", body: fd });
      } else {
        res = await authedFetch("/api/ai/session-summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transcript,
            appointmentId,
            alsoNote: true,
          }),
        });
      }

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Filing failed.");

      setPreview(formatAIReport(data.clinicalReport));
      setDone(true);
      onFiled();
    } catch (e: any) {
      setError(e.message ?? "Could not file this visit. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-12"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget && !loading) onClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden max-h-[88vh] flex flex-col"
        style={{ background: "#F6FAF0" }}
      >
        <div
          className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0"
          style={{ borderColor: "rgba(42,74,26,0.08)" }}
        >
          <div>
            <h3 className="font-semibold text-sm" style={{ color: "#2A4A1A" }}>
              {done ? "Visit filed" : "File session"}
            </h3>
            <p className="text-xs flex items-center gap-1 mt-0.5" style={{ color: "#8A9BA8" }}>
              <Lock size={10} /> Private clinical file · {clientName}
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={loading} className="p-2 rounded-lg hover:bg-black/5">
            <X size={18} style={{ color: "#4A5568" }} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {done ? (
            <div className="space-y-3">
              <div
                className="rounded-xl p-4 flex items-start gap-3"
                style={{ background: "rgba(141,198,63,0.1)", border: "1px solid rgba(141,198,63,0.25)" }}
              >
                <CheckCircle size={18} style={{ color: "#6BA028" }} className="flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold" style={{ color: "#2A4A1A" }}>
                    Saved to this client&apos;s clinical file
                  </p>
                  <p className="text-xs mt-1" style={{ color: "#8A9BA8" }}>
                    Transcript + AI draft note are filed under you only. Review the note in Notes anytime.
                  </p>
                </div>
              </div>
              {preview && (
                <pre
                  className="text-xs whitespace-pre-wrap rounded-xl p-4 max-h-64 overflow-y-auto"
                  style={{ background: "white", color: "#4A5568", boxShadow: "0 1px 3px rgba(42,74,26,0.06)" }}
                >
                  {preview}
                </pre>
              )}
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)" }}
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <MeetRecordingGuide compact />

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#8A9BA8" }}>
                  Session
                </label>
                <select
                  value={appointmentId}
                  onChange={e => setAppointmentId(e.target.value)}
                  className="mt-1.5 w-full px-3 py-2.5 rounded-xl text-sm border focus:outline-none"
                  style={{ borderColor: "rgba(42,74,26,0.15)", background: "white", color: "#22272B" }}
                >
                  {fileable.length === 0 && <option value="">No sessions available</option>}
                  {fileable.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.date} · {a.time} · {a.type}
                      {a.hasSessionReport ? " (has report)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(42,74,26,0.06)" }}>
                {([
                  { key: "audio", label: "Upload audio" },
                  { key: "text", label: "Paste transcript" },
                ] as const).map(t => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setMode(t.key)}
                    className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: mode === t.key ? "white" : "transparent",
                      color: mode === t.key ? "#2A4A1A" : "#8A9BA8",
                      boxShadow: mode === t.key ? "0 1px 3px rgba(42,74,26,0.1)" : "none",
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {mode === "audio" ? (
                <label
                  className="flex flex-col items-center justify-center gap-2 rounded-xl p-6 cursor-pointer border border-dashed"
                  style={{ borderColor: "rgba(42,74,26,0.2)", background: "white" }}
                >
                  <Upload size={22} style={{ color: "#8DC63F" }} />
                  <span className="text-sm font-medium" style={{ color: "#2A4A1A" }}>
                    {file ? file.name : "Choose audio from Meet recording"}
                  </span>
                  <span className="text-xs" style={{ color: "#8A9BA8" }}>
                    MP3, WAV, M4A, WEBM · max ~50 MB
                  </span>
                  <input
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={e => setFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              ) : (
                <textarea
                  value={transcript}
                  onChange={e => setTranscript(e.target.value)}
                  rows={8}
                  placeholder="Paste the Google Meet transcript here…"
                  className="w-full px-4 py-3 rounded-xl text-sm border focus:outline-none resize-none"
                  style={{ borderColor: "rgba(42,74,26,0.15)", background: "white", color: "#22272B" }}
                />
              )}

              {error && (
                <div
                  className="rounded-xl p-3 flex items-start gap-2 text-xs"
                  style={{ background: "rgba(247,148,29,0.08)", color: "#C4700A" }}
                >
                  <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading || !appointmentId}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)" }}
              >
                {loading
                  ? <><Loader2 size={15} className="animate-spin" /> Transcribing & filing…</>
                  : <><Sparkles size={15} /> Generate & file visit</>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Visit detail expand ────────────────────────────────────────────────────
function VisitCard({
  appt,
  report,
  note,
  onFile,
}: {
  appt: ClinicalAppointment;
  report?: SessionReport;
  note?: NoteLite;
  onFile: () => void;
}) {
  const [open, setOpen] = useState(false);
  const hasFile = !!(report || note);

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "white", boxShadow: "0 1px 3px rgba(42,74,26,0.06)" }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        <div
          className="w-10 h-10 rounded-xl flex flex-col items-center justify-center flex-shrink-0"
          style={{ background: "rgba(42,74,26,0.05)" }}
        >
          <span className="text-xs font-bold leading-none" style={{ color: "#2A4A1A" }}>
            {new Date(appt.date + "T12:00:00").toLocaleDateString("en-US", { month: "short" })}
          </span>
          <span className="text-sm font-bold leading-none" style={{ color: "#2A4A1A" }}>
            {new Date(appt.date + "T12:00:00").getDate()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: "#2A4A1A" }}>{appt.type}</p>
          <p className="text-xs" style={{ color: "#8A9BA8" }}>
            {appt.time} · {appt.duration} min
            {hasFile ? " · Filed" : " · No file yet"}
          </p>
        </div>
        {open ? <ChevronUp size={16} style={{ color: "#C4C4C4" }} /> : <ChevronDown size={16} style={{ color: "#C4C4C4" }} />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: "rgba(42,74,26,0.06)" }}>
          {appt.meetLink && (
            <a
              href={appt.meetLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium hover:underline mt-3"
              style={{ color: "#4285F4" }}
            >
              <ExternalLink size={11} /> Open Meet link
            </a>
          )}

          {report?.clinicalReport && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#8A9BA8" }}>
                Clinical note (AI-assisted)
              </p>
              <pre
                className="text-xs whitespace-pre-wrap rounded-lg p-3 max-h-48 overflow-y-auto"
                style={{ background: "rgba(42,74,26,0.03)", color: "#4A5568" }}
              >
                {formatAIReport(report.clinicalReport)}
              </pre>
            </div>
          )}

          {!report?.clinicalReport && note && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#8A9BA8" }}>
                Session note
              </p>
              <p className="text-xs font-medium mb-1" style={{ color: "#2A4A1A" }}>{note.title}</p>
              <pre
                className="text-xs whitespace-pre-wrap rounded-lg p-3 max-h-40 overflow-y-auto"
                style={{ background: "rgba(42,74,26,0.03)", color: "#4A5568" }}
              >
                {note.content}
              </pre>
            </div>
          )}

          {report?.transcript && (
            <details className="text-xs">
              <summary className="cursor-pointer font-semibold" style={{ color: "#6BA028" }}>
                View transcript
              </summary>
              <pre
                className="mt-2 whitespace-pre-wrap rounded-lg p-3 max-h-40 overflow-y-auto"
                style={{ background: "rgba(42,74,26,0.03)", color: "#4A5568" }}
              >
                {report.transcript}
              </pre>
            </details>
          )}

          <button
            type="button"
            onClick={onFile}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold"
            style={{ background: "rgba(42,74,26,0.06)", color: "#2A4A1A" }}
          >
            <Sparkles size={12} /> {hasFile ? "Update / re-file visit" : "File this visit"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main clinical file panel ───────────────────────────────────────────────
export default function ClinicalFile({
  clientId,
  clientName,
  appointments,
  initialApptId,
}: {
  clientId: string;
  clientName: string;
  appointments: ClinicalAppointment[];
  initialApptId?: string;
}) {
  const { user } = useAuth();
  const [reports, setReports] = useState<Record<string, SessionReport>>({});
  const [notes, setNotes] = useState<NoteLite[]>([]);
  const [assessments, setAssessments] = useState<AssessmentLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFile, setShowFile] = useState(!!initialApptId);
  const [fileApptId, setFileApptId] = useState<string | undefined>(initialApptId);

  useEffect(() => {
    if (!user || !clientId) return;
    setLoading(true);

    const unsubNotes = onSnapshot(
      query(
        collection(db, "notes"),
        where("doctorId", "==", user.uid),
        where("clientId", "==", clientId),
      ),
      snap => {
        setNotes(snap.docs.map(d => ({ id: d.id, ...d.data() } as NoteLite)));
      },
      () => setNotes([]),
    );

    const unsubReports = onSnapshot(
      query(
        collection(db, "sessionReports"),
        where("doctorId", "==", user.uid),
        where("clientId", "==", clientId),
      ),
      snap => {
        const map: Record<string, SessionReport> = {};
        snap.docs.forEach(d => {
          const data = d.data() as SessionReport;
          map[data.appointmentId || d.id] = data;
        });
        setReports(map);
        setLoading(false);
      },
      () => { setReports({}); setLoading(false); },
    );

    (async () => {
      try {
        const snap = await getDocs(
          query(
            collection(db, "assessments"),
            where("doctorId", "==", user.uid),
            orderBy("assignedAt", "desc"),
          ),
        );
        setAssessments(
          snap.docs
            .map(d => ({ id: d.id, ...d.data() } as AssessmentLite & { clientId?: string }))
            .filter(a => (a as any).clientId === clientId),
        );
      } catch {
        // Fallback without orderBy if index missing
        try {
          const snap = await getDocs(
            query(collection(db, "assessments"), where("doctorId", "==", user.uid)),
          );
          setAssessments(
            snap.docs
              .map(d => ({ id: d.id, ...d.data() } as AssessmentLite & { clientId?: string }))
              .filter(a => (a as any).clientId === clientId),
          );
        } catch {
          setAssessments([]);
        }
      }
    })();

    return () => { unsubNotes(); unsubReports(); };
  }, [user, clientId]);

  const timeline: TimelineItem[] = useMemo(() => {
    const items: TimelineItem[] = [];
    const notesByAppt = new Map<string, NoteLite>();
    notes.forEach(n => {
      if (n.appointmentId) notesByAppt.set(n.appointmentId, n);
    });

    appointments.forEach(appt => {
      items.push({
        kind: "visit",
        sortKey: `${appt.date}T${appt.time || "00:00"}`,
        appt,
        report: reports[appt.id],
        note: notesByAppt.get(appt.id),
      });
    });

    // Orphan notes (no appointment link) — still doctor-owned for this client
    notes
      .filter(n => !n.appointmentId)
      .forEach(n => {
        items.push({
          kind: "visit",
          sortKey: n.sessionDate || "1970-01-01",
          appt: {
            id: `note-${n.id}`,
            type: n.sessionType || "Note",
            date: n.sessionDate || "",
            time: "",
            duration: 0,
            status: "completed",
            clientId,
          },
          note: n,
        });
      });

    assessments.forEach(a => {
      const d = a.completedAt || a.assignedAt;
      let sortKey = "1970-01-01";
      if (d?.toDate) sortKey = d.toDate().toISOString();
      else if (typeof d === "string") sortKey = d;
      items.push({ kind: "assessment", sortKey, assessment: a });
    });

    return items.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  }, [appointments, reports, notes, assessments, clientId]);

  function openFile(apptId?: string) {
    setFileApptId(apptId);
    setShowFile(true);
  }

  return (
    <div className="space-y-4">
      <div
        className="rounded-xl p-3 flex items-start gap-2"
        style={{ background: "rgba(42,74,26,0.04)", border: "1px solid rgba(42,74,26,0.08)" }}
      >
        <Lock size={13} className="flex-shrink-0 mt-0.5" style={{ color: "#8A9BA8" }} />
        <p className="text-xs" style={{ color: "#8A9BA8" }}>
          Your private clinical cabinet for this client. Files stay with you even if they are later
          assigned to another therapist.
        </p>
      </div>

      <MeetRecordingGuide compact />

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#8A9BA8" }}>
          Visit timeline
        </p>
        <button
          type="button"
          onClick={() => openFile(appointments[0]?.id)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)" }}
        >
          <Plus size={12} /> File session
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 size={22} className="animate-spin" style={{ color: "#8DC63F" }} />
        </div>
      ) : timeline.length === 0 ? (
        <div className="rounded-xl p-8 text-center" style={{ background: "white" }}>
          <FileText size={22} className="mx-auto mb-2" style={{ color: "#C4C4C4" }} />
          <p className="text-sm" style={{ color: "#8A9BA8" }}>No visits or assessments yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {timeline.map(item => {
            if (item.kind === "assessment") {
              const a = item.assessment;
              return (
                <div
                  key={`a-${a.id}`}
                  className="rounded-xl p-4 flex items-center gap-3"
                  style={{ background: "white", boxShadow: "0 1px 3px rgba(42,74,26,0.06)" }}
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(141,198,63,0.12)" }}
                  >
                    <ClipboardList size={16} style={{ color: "#6BA028" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "#2A4A1A" }}>{a.title}</p>
                    <p className="text-xs capitalize" style={{ color: "#8A9BA8" }}>
                      Assessment · {a.status}
                      {a.score != null ? ` · score ${a.score}` : ""}
                    </p>
                  </div>
                </div>
              );
            }

            // Skip synthetic orphan-note cards that aren't real appointments for File action
            const isOrphan = item.appt.id.startsWith("note-");
            return (
              <VisitCard
                key={item.appt.id}
                appt={item.appt}
                report={item.report}
                note={item.note}
                onFile={() => {
                  if (isOrphan) openFile(undefined);
                  else openFile(item.appt.id);
                }}
              />
            );
          })}
        </div>
      )}

      {showFile && (
        <FileVisitModal
          clientId={clientId}
          clientName={clientName}
          appointments={appointments}
          preselectApptId={fileApptId}
          onClose={() => setShowFile(false)}
          onFiled={() => { /* live listeners refresh */ }}
        />
      )}
    </div>
  );
}
