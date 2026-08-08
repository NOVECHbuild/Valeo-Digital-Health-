// src/app/(dashboard)/client/my-doctor/page.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link"; // FIX 8 — Next.js Link, not raw <a>
import {
  doc, getDoc, updateDoc, serverTimestamp,
  collection, query, where, getDocs, orderBy, limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import type { DoctorProfile } from "@/lib/matching";
import {
  Globe, Clock, Users, CheckCircle, AlertCircle,
  MessageCircle, Calendar, RefreshCw, Loader2, ChevronRight,
  Heart, Award, ExternalLink, AlertTriangle, UserX,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────
interface Assignment {
  clientId:           string;
  doctorId:           string;
  doctorName:         string;
  matchPercent:       number;
  assignedAt:         any;
  assignedBy:         string;
  status:             "active" | "inactive";
  switchRequested:    boolean;
  switchReason?:      string;
  switchRequestedAt?: any;
}

interface UpcomingSession {
  id:        string;
  date:      string;
  time:      string;
  type:      string;
  meetLink?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function toDate(ts: any): Date | null {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  if (typeof ts === "string") return new Date(ts);
  return null;
}

function fmtMonthYear(ts: any): string {
  const d = toDate(ts);
  if (!d) return "";
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function fmtSessionTime(date: string, time: string): string {
  try {
    return (
      new Date(date + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric",
      }) + " at " + time
    );
  } catch {
    return `${date} at ${time}`;
  }
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

// ── Main page ──────────────────────────────────────────────────────────────
export default function MyDoctorPage() {
  const { user } = useAuth();

  const [assignment,    setAssignment]    = useState<Assignment | null>(null);
  const [doctor,        setDoctor]        = useState<DoctorProfile | null>(null);
  const [nextSession,   setNextSession]   = useState<UpcomingSession | null>(null); // S1
  const [loading,       setLoading]       = useState(true);
  const [fetchError,    setFetchError]    = useState<string | null>(null);           // FIX 7
  const [doctorMissing, setDoctorMissing] = useState(false);                        // S3
  const [showSwitch,    setShowSwitch]    = useState(false);
  const [reason,        setReason]        = useState("");
  const [submitting,    setSubmitting]    = useState(false);
  const [toast,         setToast]         = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // FIX 7: Full try/catch around the data fetch
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        // 1. Assignment doc
        const assignSnap = await getDoc(doc(db, "assignments", user.uid));
        if (!assignSnap.exists()) { setLoading(false); return; }
        const assign = assignSnap.data() as Assignment;
        setAssignment(assign);

        // Merge `doctors/{uid}` (clinical) + `users/{uid}` (auth). Load independently
        // so a missing/denied doctors doc does not blank the whole page.
        let doctorData: Record<string, unknown> = {};
        let userData: Record<string, unknown> = {};
        try {
          const userSnap = await getDoc(doc(db, "users", assign.doctorId));
          if (userSnap.exists()) userData = userSnap.data() as Record<string, unknown>;
        } catch (err) {
          console.error("[MyDoctorPage] users read failed", err);
        }
        try {
          const doctorSnap = await getDoc(doc(db, "doctors", assign.doctorId));
          if (doctorSnap.exists()) doctorData = doctorSnap.data() as Record<string, unknown>;
        } catch (err) {
          console.error("[MyDoctorPage] doctors read failed", err);
        }

        if (!Object.keys(userData).length && !Object.keys(doctorData).length) {
          // Fall back to assignment denormalized name so the page still renders
          if (assign.doctorName) {
            setDoctor({
              uid: assign.doctorId,
              displayName: assign.doctorName.replace(/^Dr\.?\s*/i, "").trim() || assign.doctorName,
            } as DoctorProfile);
          } else {
            setDoctorMissing(true);
            setLoading(false);
            return;
          }
        } else {
          // doctors doc wins on overlap — authoritative clinical profile
          setDoctor({ uid: assign.doctorId, ...userData, ...doctorData } as DoctorProfile);
        }

        // Next session is best-effort (composite index / query may fail)
        try {
          const todayStr = new Date().toISOString().split("T")[0];
          const apptSnap = await getDocs(
            query(
              collection(db, "appointments"),
              where("clientId", "==", user.uid),
              where("doctorId", "==", assign.doctorId),
              where("status",   "in", ["pending", "approved"]),
              orderBy("date", "asc"),
              limit(1),
            )
          );
          if (!apptSnap.empty) {
            const a = apptSnap.docs[0].data() as any;
            if (a.date >= todayStr) {
              setNextSession({
                id:       apptSnap.docs[0].id,
                date:     a.date,
                time:     a.time,
                type:     a.type,
                meetLink: a.meetLink,
              });
            }
          }
        } catch (err) {
          console.warn("[MyDoctorPage] next-session query skipped", err);
        }
      } catch (err: any) {
        console.error("[MyDoctorPage]", err);
        setFetchError("Could not load your therapist profile. Please refresh the page.");
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  async function handleSwitchRequest() {
    if (!user || !reason.trim()) return;
    setSubmitting(true);
    try {
      await updateDoc(doc(db, "assignments", user.uid), {
        switchRequested:   true,
        switchReason:      reason.trim(),
        switchRequestedAt: serverTimestamp(),
      });
      // FIX 13: Drive UI from Firestore flag — remove local `submitted` state
      setAssignment(a => a ? { ...a, switchRequested: true, switchReason: reason.trim() } : a);
      setShowSwitch(false);
      setReason("");
      setToast({ msg: "Switch request submitted. We'll be in touch within 24 hours.", type: "success" }); // S5
    } catch {
      setToast({ msg: "Failed to submit request. Please try again.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 size={28} className="animate-spin" style={{ color: "#8DC63F" }} />
    </div>
  );

  // ── FIX 7: Error state instead of endless spinner ───────────────────────
  if (fetchError) return (
    <div className="max-w-5xl mx-auto">
      <div className="rounded-2xl p-10 text-center"
        style={{ background: "white", boxShadow: "0 1px 4px rgba(42,74,26,0.07)" }}>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
          style={{ background: "rgba(247,148,29,0.08)" }}>
          <AlertTriangle size={22} style={{ color: "#F7941D" }} />
        </div>
        <p className="text-sm font-semibold mb-1" style={{ color: "#2A4A1A" }}>Something went wrong</p>
        <p className="text-xs" style={{ color: "#8A9BA8" }}>{fetchError}</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {toast && <Toast {...toast} />}

      {/* Subtitle only — page name lives in the sticky header */}
      <p className="text-sm" style={{ color: "#8A9BA8" }}>
        Your assigned therapist and session information
      </p>

      {/* No assignment yet */}
      {!assignment && (
        <div className="rounded-2xl p-10 text-center"
          style={{ background: "white", boxShadow: "0 1px 4px rgba(42,74,26,0.07)" }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
            style={{ background: "rgba(141,198,63,0.08)" }}>
            <Users size={24} style={{ color: "#8DC63F" }} />
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: "#2A4A1A" }}>
            No therapist assigned yet
          </p>
          <p className="text-xs mb-4" style={{ color: "#8A9BA8" }}>
            Complete your intake questionnaire to get matched with the right therapist.
          </p>
          <Link
            href="/onboarding/intake"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)" }}
          >
            Complete Intake <ChevronRight size={14} />
          </Link>
        </div>
      )}

      {/* S3: Assignment exists but doctor doc is gone/deleted */}
      {assignment && doctorMissing && (
        <div className="rounded-2xl p-10 text-center"
          style={{ background: "white", boxShadow: "0 1px 4px rgba(42,74,26,0.07)" }}>
          <UserX size={28} className="mx-auto mb-3" style={{ color: "#8A9BA8" }} />
          <p className="text-sm font-semibold mb-1" style={{ color: "#2A4A1A" }}>
            Therapist profile unavailable
          </p>
          <p className="text-xs" style={{ color: "#8A9BA8" }}>
            Your therapist&apos;s profile couldn&apos;t be loaded. Please contact support.
          </p>
        </div>
      )}

      {/* ── Main content ─────────────────────────────────────────────────── */}
      {doctor && assignment && (
        <>
          {/* Switch request pending banner — driven by Firestore (FIX 13) */}
          {assignment.switchRequested && (
            <div className="rounded-2xl p-4 flex items-start gap-3"
              style={{ background: "rgba(247,148,29,0.08)", border: "1px solid rgba(247,148,29,0.2)" }}>
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" style={{ color: "#F7941D" }} />
              <div className="min-w-0">
                <p className="text-sm font-semibold" style={{ color: "#C4700A" }}>
                  Switch request pending
                </p>
                <p className="text-xs mt-0.5" style={{ color: "#8A9BA8" }}>
                  Our team will review your request and get back to you within 24 hours.
                </p>
                {/* S4: Reflect the submitted reason back */}
                {assignment.switchReason && (
                  <p className="text-xs mt-2 italic px-3 py-2 rounded-lg"
                    style={{ background: "rgba(247,148,29,0.06)", color: "#8A9BA8" }}>
                    Your reason: &ldquo;{assignment.switchReason}&rdquo;
                  </p>
                )}
              </div>
            </div>
          )}

          {/* S1: Next session banner */}
          {nextSession && (
            <div className="rounded-2xl p-4 flex items-center gap-4 flex-wrap"
              style={{ background: "rgba(141,198,63,0.06)", border: "1px solid rgba(141,198,63,0.2)" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(141,198,63,0.15)" }}>
                <Calendar size={18} style={{ color: "#8DC63F" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: "#2A4A1A" }}>
                  Next Session — {nextSession.type}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "#8A9BA8" }}>
                  {fmtSessionTime(nextSession.date, nextSession.time)}
                </p>
              </div>
              {nextSession.meetLink ? (
                <a
                  href={nextSession.meetLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white flex-shrink-0 transition-all hover:-translate-y-0.5"
                  style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)" }}
                >
                  <ExternalLink size={14} /> Join Meet
                </a>
              ) : (
                <Link
                  href="/client/appointments"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border flex-shrink-0"
                  style={{ borderColor: "rgba(42,74,26,0.15)", color: "#2A4A1A" }}
                >
                  View Details
                </Link>
              )}
            </div>
          )}

          {/* ── Doctor card ───────────────────────────────────────────────── */}
          {/* No overflow-hidden on the outer card — it clipped the overlapping avatar. */}
          <div className="rounded-2xl"
            style={{ background: "white", boxShadow: "0 1px 4px rgba(42,74,26,0.07)" }}>

            {/* Gradient header — no initial/monogram fallback (letter clipping); photo only when set */}
            <div
              className={`p-6 relative overflow-hidden rounded-t-2xl ${(doctor as any).photoURL ? "pb-16" : ""}`}
              style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)" }}
            >
              <div className="absolute right-0 top-0 w-48 h-full opacity-10 pointer-events-none"
                style={{ background: "radial-gradient(circle at 80% 50%, #8DC63F, transparent 70%)" }} />
              <div className="flex items-start justify-between relative z-10">
                <div className="min-w-0 pr-3">
                  <p className="text-xs font-semibold uppercase tracking-widest mb-1"
                    style={{ color: "rgba(141,198,63,0.8)" }}>
                    Your Therapist
                  </p>
                  <h3 className="text-2xl text-white" style={{ fontFamily: "var(--font-dm-serif)" }}>
                    {(doctor as any).title ? `${(doctor as any).title} ` : ""}
                    {doctor.displayName}
                  </h3>
                  {assignment.assignedAt && (
                    <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.45)" }}>
                      With you since {fmtMonthYear(assignment.assignedAt)}
                    </p>
                  )}
                </div>
                {(assignment.matchPercent ?? 0) > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full flex-shrink-0"
                    style={{ background: "rgba(141,198,63,0.15)" }}>
                    <Heart size={12} style={{ color: "#8DC63F" }} />
                    <span className="text-xs font-semibold" style={{ color: "#8DC63F" }}>
                      {assignment.matchPercent}% match
                    </span>
                  </div>
                )}
              </div>
            </div>

            {(doctor as any).photoURL && (
              <div className="px-6 relative z-10" style={{ marginTop: "-3.5rem" }}>
                <img
                  src={(doctor as any).photoURL}
                  alt={doctor.displayName || "Therapist"}
                  className="w-28 h-28 rounded-2xl object-cover shadow-md"
                  style={{ border: "3px solid white" }}
                />
              </div>
            )}

            <div className={`px-6 pb-6 ${(doctor as any).photoURL ? "pt-4" : "pt-5"}`}>
              {/* FIX 12: Only render bio when it exists */}
              {(doctor as any).bio && (
                <p className="text-sm leading-relaxed mb-5" style={{ color: "#4A5568" }}>
                  {(doctor as any).bio}
                </p>
              )}

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3 mb-5">
                {[
                  {
                    label: "Experience",
                    value: (doctor as any).yearsExperience
                      ? `${(doctor as any).yearsExperience} years`
                      : "—",
                    Icon: Award,
                  },
                  {
                    label: "Languages",
                    // FIX 10: null-guard before .join()
                    value: ((doctor as any).languages as string[] ?? []).join(", ") || "—",
                    Icon: Globe,
                  },
                  {
                    label: "Availability",
                    // FIX 6: clamp to 0 so "spots open" never goes negative
                    value:
                      (doctor as any).maxClients != null &&
                      (doctor as any).currentClients != null
                        ? `${Math.max(0, (doctor as any).maxClients - (doctor as any).currentClients)} spots open`
                        : "Open",
                    Icon: Users,
                  },
                  {
                    label: "Session Type",
                    // FIX 9: null-guard before [0]
                    value: ((doctor as any).sessionTypes as string[] ?? [])[0] ?? "Individual",
                    Icon: Clock,
                  },
                ].map(({ label, value, Icon }) => (
                  <div key={label} className="rounded-xl p-3 flex items-center gap-3"
                    style={{ background: "rgba(42,74,26,0.03)" }}>
                    <Icon size={14} style={{ color: "#8DC63F" }} />
                    <div>
                      <p className="text-xs" style={{ color: "#8A9BA8" }}>{label}</p>
                      <p className="text-sm font-semibold" style={{ color: "#2A4A1A" }}>{value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Specializations — FIX 11: null-guard on the whole array */}
              {((doctor as any).specializations as string[] ?? []).length > 0 && (
                <div className="mb-5">
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2"
                    style={{ color: "#8A9BA8" }}>
                    Specializations
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {((doctor as any).specializations as string[]).map(s => (
                      <span key={s} className="text-xs px-2.5 py-1 rounded-full font-medium"
                        style={{
                          background: "rgba(141,198,63,0.08)",
                          color: "#2A4A1A",
                          border: "1px solid rgba(141,198,63,0.2)",
                        }}>
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Approaches — FIX 2: null-guard wraps both the condition AND the .map() */}
              {((doctor as any).approaches as string[] ?? []).length > 0 && (
                <div className="mb-5">
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2"
                    style={{ color: "#8A9BA8" }}>
                    Therapeutic Approaches
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {((doctor as any).approaches as string[]).map(a => (
                      <span key={a} className="text-xs px-2.5 py-1 rounded-full font-medium"
                        style={{ background: "rgba(42,74,26,0.05)", color: "#4A5568" }}>
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Action buttons — FIX 8: Next.js <Link> */}
              <div className="flex gap-3 pt-4 border-t" style={{ borderColor: "rgba(42,74,26,0.06)" }}>
                <Link
                  href="/client/messages"
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:-translate-y-0.5"
                  style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)" }}
                >
                  <MessageCircle size={15} /> Message
                </Link>
                <Link
                  href="/client/appointments"
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
                  style={{ background: "rgba(141,198,63,0.1)", color: "#6BA028" }}
                >
                  <Calendar size={15} /> Book Session
                </Link>
              </div>
            </div>
          </div>

          {/* ── Request switch card — FIX 13: gated on Firestore flag only ── */}
          {!assignment.switchRequested && (
            <div className="rounded-2xl p-5"
              style={{ background: "white", boxShadow: "0 1px 4px rgba(42,74,26,0.07)" }}>
              {!showSwitch ? (
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "#2A4A1A" }}>
                      Not the right fit?
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "#8A9BA8" }}>
                      You can request a different therapist at any time.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowSwitch(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border flex-shrink-0"
                    style={{ borderColor: "rgba(42,74,26,0.15)", color: "#2A4A1A" }}
                  >
                    <RefreshCw size={14} /> Request Switch
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-semibold mb-1" style={{ color: "#2A4A1A" }}>
                    Request a different therapist
                  </p>
                  <p className="text-xs mb-3" style={{ color: "#8A9BA8" }}>
                    Please share a bit about why you&apos;d like to switch. This helps us find a better match.
                  </p>
                  <textarea
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    rows={3}
                    placeholder="e.g. I feel I need someone who specialises more in anxiety..."
                    className="w-full px-4 py-3 rounded-xl text-sm border focus:outline-none resize-none mb-3"
                    style={{ borderColor: "rgba(42,74,26,0.15)", background: "#FAFAFA", color: "#22272B" }}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowSwitch(false); setReason(""); }}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold border"
                      style={{ borderColor: "rgba(42,74,26,0.12)", color: "#8A9BA8" }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSwitchRequest}
                      disabled={!reason.trim() || submitting}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                      style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)" }}
                    >
                      {submitting
                        ? <Loader2 size={14} className="animate-spin" />
                        : <><CheckCircle size={14} /> Submit Request</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
