"use client";

import { useState, useEffect, useMemo } from "react";
import { doc, getDoc, getDocs, setDoc, serverTimestamp, collection, query, where, onSnapshot } from "firebase/firestore";
import Link from "next/link";
import { db, auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import {
  useDoctorAppointments,
  updateAppointmentStatus,
  sortAppointmentsBySession,
  type Appointment,
} from "@/hooks/useAppointments";
import { type Service, servicesForEditing, bookableServices } from "@/lib/availability";
import { isDoctorApproved, PAYMENT_BADGE, resolvePaymentStatus } from "@/lib/paymentStatus";
import { authedFetch } from "@/lib/authedFetch";
import MeetJoinPanel from "@/components/MeetJoinPanel";
import {
  Calendar, Clock, CheckCircle, XCircle, Loader2, Users,
  FileText, Filter, Save, AlertCircle, Plus, X, Info,
  ToggleLeft, ToggleRight, Trash2, ChevronDown, Lock,
  ChevronLeft, ChevronRight, Link2, ExternalLink, RefreshCw, Video,
  Zap,
} from "lucide-react";

// ══════════════════════════════════════════════════════════════
//  AVAILABILITY TYPES & CONSTANTS (unchanged from original)
// ══════════════════════════════════════════════════════════════

type DayKey = "monday"|"tuesday"|"wednesday"|"thursday"|"friday"|"saturday"|"sunday";
type DaySchedule     = { enabled: boolean; slots: { start: string; end: string }[] };
type AvailabilitySchedule = {
  availability:   Record<DayKey, DaySchedule>;
  slotDuration:   number;
  bufferTime:     number;
  maxAdvanceDays: number;
  timezone:       string;
  blockedDates:   string[];
  sessionPricing: Record<string, number>;
  services?:      Service[];
  googleCalendarId?: string;
};

const DAYS: { key: DayKey; label: string }[] = [
  { key:"monday",    label:"Monday"    },
  { key:"tuesday",   label:"Tuesday"   },
  { key:"wednesday", label:"Wednesday" },
  { key:"thursday",  label:"Thursday"  },
  { key:"friday",    label:"Friday"    },
  { key:"saturday",  label:"Saturday"  },
  { key:"sunday",    label:"Sunday"    },
];

const SESSION_TYPES   = ["Individual Therapy","Couples Therapy","Life Coaching","Workplace Wellness","Free Consultation"];
const SLOT_DURATIONS  = [30, 45, 60, 90];
const BUFFER_TIMES    = [0, 5, 10, 15, 30];
const MAX_ADVANCE     = [7, 14, 30, 60, 90];
// Full Caribbean + global timezone list
const TIMEZONES = [
  // Caribbean
  "America/Barbados",
  "America/St_Vincent",
  "America/Port_of_Spain",
  "America/Jamaica",
  "America/Martinique",
  "America/Guadeloupe",
  "America/St_Lucia",
  "America/Grenada",
  "America/Antigua",
  "America/Dominica",
  "America/St_Kitts",
  "America/Anguilla",
  "America/Aruba",
  "America/Curacao",
  "America/Nassau",
  "America/Puerto_Rico",
  "America/Santo_Domingo",
  "America/Havana",
  "America/Port-au-Prince",
  // North America
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Vancouver",
  // Europe
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Amsterdam",
  // Rest of world
  "Asia/Dubai",
  "Asia/Tokyo",
  "Australia/Sydney",
];

// Auto-detect the browser's timezone — falls back to Barbados
function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Barbados";
  } catch {
    return "America/Barbados";
  }
}

const DEFAULT_AVAIL: AvailabilitySchedule = {
  availability: {
    monday:    { enabled: true,  slots: [{ start:"09:00", end:"17:00" }] },
    tuesday:   { enabled: true,  slots: [{ start:"09:00", end:"17:00" }] },
    wednesday: { enabled: true,  slots: [{ start:"09:00", end:"17:00" }] },
    thursday:  { enabled: true,  slots: [{ start:"09:00", end:"17:00" }] },
    friday:    { enabled: true,  slots: [{ start:"09:00", end:"17:00" }] },
    saturday:  { enabled: false, slots: [] },
    sunday:    { enabled: false, slots: [] },
  },
  slotDuration:   60,
  bufferTime:     10,
  maxAdvanceDays: 30,
  timezone:       typeof window !== "undefined" ? detectTimezone() : "America/Barbados",
  blockedDates:   [],
  sessionPricing: { "Individual Therapy":150,"Couples Therapy":200,"Life Coaching":120,"Workplace Wellness":180,"Free Consultation":0 },
  googleCalendarId: "",
};

// ══════════════════════════════════════════════════════════════
//  APPOINTMENT TAB COMPONENTS (unchanged)
// ══════════════════════════════════════════════════════════════

function StatusBadge({ status, cancelledReason, paymentStatus }: {
  status: Appointment["status"];
  cancelledReason?: string;
  paymentStatus?: Appointment["paymentStatus"];
}) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    pending:   { bg:"rgba(247,148,29,0.12)",  color:"#C4700A", label:"Pending"   },
    approved:  { bg:"rgba(141,198,63,0.12)",  color:"#6BA028", label:"Confirmed" },
    rejected:  { bg:"rgba(247,148,29,0.12)",   color:"#F7941D", label:"Rejected"  },
    completed: { bg:"rgba(42,74,26,0.1)",     color:"#2A4A1A", label:"Completed" },
    cancelled: { bg:"rgba(138,155,168,0.12)", color:"#8A9BA8", label:"Cancelled" },
    payment_failed: { bg:"rgba(247,148,29,0.12)", color:"#C4700A", label:"Payment failed" },
  };
  let s = styles[status] ?? styles.pending;
  if (status === "cancelled" && cancelledReason === "no_show") {
    s = { bg: "rgba(247,148,29,0.12)", color: "#C4700A", label: "No-show" };
  } else if (status === "cancelled" && (cancelledReason === "payment_expired" || cancelledReason === "review_expired" || cancelledReason === "payment_failed")) {
    s = {
      bg: "rgba(138,155,168,0.12)",
      color: "#8A9BA8",
      label: cancelledReason === "payment_failed" ? "Payment failed" : "Hold expired",
    };
  }
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ background:s.bg, color:s.color }}>{s.label}</span>
  );
}

function PaymentBadge({ appt }: { appt: Appointment }) {
  const ps = resolvePaymentStatus(appt);
  if (ps === "unknown") return null;
  if (ps === "unpaid" && !isDoctorApproved(appt)) return null;
  const b = PAYMENT_BADGE[ps];
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ background: b.bg, color: b.color }}>{b.label}</span>
  );
}

function FilterTab({ label, count, active, onClick }: { label:string; count:number; active:boolean; onClick:()=>void }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all"
      style={{ background:active?"#1E3810":"rgba(30,56,16,0.05)", color:active?"white":"#8A9BA8" }}>
      {label}
      <span className="px-1.5 py-0.5 rounded-full text-xs"
        style={{ background:active?"rgba(255,255,255,0.2)":active?"#1E3810":"rgba(30,56,16,0.1)", color:active?"white":"#8A9BA8" }}>
        {count}
      </span>
    </button>
  );
}

function PostCompleteNoteModal({
  appt, hasNote, onClose,
}: {
  appt: Appointment;
  hasNote: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-md rounded-3xl p-6 space-y-4"
        style={{ background: "#F6FAF0", boxShadow: "0 20px 50px rgba(30,56,16,0.2)" }}>
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(141,198,63,0.15)" }}>
            <CheckCircle size={22} style={{ color: "#6BA028" }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold" style={{ fontFamily: "var(--font-dm-serif)", color: "#1E3810" }}>
              Session completed
            </h3>
            <p className="text-sm mt-1" style={{ color: "#4A5568" }}>
              {appt.clientName} · {appt.type} · {appt.date} at {appt.time}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-black/5" aria-label="Close">
            <X size={18} style={{ color: "#8A9BA8" }} />
          </button>
        </div>

        {hasNote ? (
          <p className="text-sm" style={{ color: "#4A5568" }}>
            A session note is already linked. You can review or update it anytime.
          </p>
        ) : (
          <p className="text-sm" style={{ color: "#4A5568" }}>
            Capture SOAP notes while the session is fresh. You can also add them later from Schedule.
          </p>
        )}

        <div className="flex flex-col gap-2 pt-1">
          <Link href={`/doctor/clients?clientId=${appt.clientId}&file=${appt.id}`}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg,#1E3810,#3D6B24)" }}>
            <FileText size={15} />
            File visit (clinical file)
          </Link>
          <Link href={`/doctor/notes?appointmentId=${appt.id}`}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "white", color: "#2A4A1A", border: "1px solid rgba(42,74,26,0.12)" }}>
            {hasNote ? "Open session note" : "Add session note"}
          </Link>
          <button type="button" onClick={onClose}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{ color: "#8A9BA8" }}>
            Do later
          </button>
        </div>
      </div>
    </div>
  );
}

function AppointmentCard({ appt, onApprove, onReject, onCreateMeet, loading, hasNote }: {
  appt:Appointment;
  onApprove:(id:string)=>Promise<void>;
  onReject:(id:string)=>Promise<void>;
  onCreateMeet?:(id:string)=>Promise<void>;
  loading:string|null;
  hasNote?:boolean;
}) {
  const isActing = loading === appt.id;
  const meetLink = (appt as any).meetLink as string | undefined;
  const awaitingClientPay =
    appt.status === "pending" &&
    resolvePaymentStatus(appt) === "unpaid" &&
    isDoctorApproved(appt);
  const needsDoctorReview =
    appt.status === "pending" &&
    resolvePaymentStatus(appt) === "unpaid" &&
    !isDoctorApproved(appt);
  return (
    <div className="rounded-2xl p-5" style={{ background:"white", boxShadow:"0 1px 4px rgba(30,56,16,0.07)" }}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
            style={{ background:"rgba(141,198,63,0.15)", color:"#1E3810" }}>
            {appt.clientName?.[0]?.toUpperCase()??"C"}
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color:"#1E3810" }}>{appt.clientName}</p>
            <p className="text-xs" style={{ color:"#8A9BA8" }}>{appt.clientEmail}</p>
            {appt.seriesId && appt.seriesIndex && appt.seriesCount && (
              <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                style={{ background:"rgba(42,74,26,0.08)", color:"#1E3810" }}>
                Series · {appt.seriesIndex}/{appt.seriesCount}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusBadge status={appt.status} cancelledReason={(appt as any).cancelledReason} paymentStatus={appt.paymentStatus}/>
          {needsDoctorReview && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ background:"rgba(247,148,29,0.12)", color:"#C4700A" }}>Needs approval</span>
          )}
          {awaitingClientPay && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ background:"rgba(247,148,29,0.12)", color:"#C4700A" }}>
              {appt.initiatedBy === "doctor" ? "Urgent · awaiting payment" : "Awaiting payment"}
            </span>
          )}
          <PaymentBadge appt={appt}/>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-4">
        {[
          { label:"Session Type", value:appt.type },
          { label:"Date & Time",  value:`${new Date(appt.date+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})} · ${appt.time}` },
          { label:"Duration",     value:`${appt.duration} minutes` },
          { label:"Format",       value:"Video Call" },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl p-3" style={{ background:"rgba(30,56,16,0.03)" }}>
            <p className="text-xs mb-1" style={{ color:"#8A9BA8" }}>{label}</p>
            <p className="text-sm font-medium" style={{ color:"#1E3810" }}>{value}</p>
          </div>
        ))}
      </div>
      {appt.notes && (
        <div className="rounded-xl p-3 mb-4 flex items-start gap-2"
          style={{ background:"rgba(141,198,63,0.06)", border:"1px solid rgba(141,198,63,0.15)" }}>
          <FileText size={14} className="flex-shrink-0 mt-0.5" style={{ color:"#8DC63F" }}/>
          <p className="text-xs italic" style={{ color:"#4A5568" }}>{appt.notes}</p>
        </div>
      )}
      {meetLink && appt.status === "approved" ? (
        <div className="mb-4">
          <MeetJoinPanel meetLink={meetLink} />
        </div>
      ) : appt.status === "approved" && onCreateMeet ? (
        <button onClick={() => onCreateMeet(appt.id)} disabled={!!isActing}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold mb-4 w-full justify-center disabled:opacity-60"
          style={{ background:"rgba(66,133,244,0.08)", color:"#4285F4", border:"1px solid rgba(66,133,244,0.15)" }}>
          {isActing ? <Loader2 size={12} className="animate-spin"/> : <Video size={12}/>}
          Create Meet link for client
        </button>
      ) : null}
      {needsDoctorReview && (
        <p className="text-xs mb-3 rounded-xl px-3 py-2" style={{ background:"rgba(247,148,29,0.1)", color:"#C4700A" }}>
          New request — approve within 12 hours to hold this slot, then the client will pay to confirm.
        </p>
      )}
      {awaitingClientPay && (
        <p className="text-xs mb-3 rounded-xl px-3 py-2" style={{ background:"rgba(247,148,29,0.1)", color:"#C4700A" }}>
          You approved this time. Waiting for the client to pay (within 24 hours, before the session). You can still reject to release the slot.
        </p>
      )}
      {appt.status === "pending" && (
        <div className="flex gap-2">
          {needsDoctorReview && (
            <button onClick={() => onApprove(appt.id)} disabled={!!isActing}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
              style={{ background:"linear-gradient(135deg,#1E3810,#3D6B24)" }}>
              {isActing ? <Loader2 size={14} className="animate-spin"/> : <CheckCircle size={14}/>} Approve time
            </button>
          )}
          <button onClick={() => onReject(appt.id)} disabled={!!isActing}
            className={`${awaitingClientPay || !needsDoctorReview ? "flex-1" : ""} flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60`}
            style={{ background:"rgba(247,148,29,0.1)", color:"#F7941D" }}>
            {isActing ? <Loader2 size={14} className="animate-spin"/> : <XCircle size={14}/>} Reject
          </button>
        </div>
      )}
      {appt.status === "approved" && (
        <button onClick={() => onApprove(appt.id)} disabled={!!isActing}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60"
          style={{ background:"rgba(42,74,26,0.08)", color:"#2A4A1A" }}>
          {isActing ? <Loader2 size={14} className="animate-spin"/> : <CheckCircle size={14}/>} Mark Completed
        </button>
      )}

      {/* Clinical file + session note — once approved or completed */}
      {(appt.status === "approved" || appt.status === "completed") && (
        <div className="mt-2 space-y-2">
          <Link href={`/doctor/clients?clientId=${appt.clientId}&file=${appt.id}`}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all hover:-translate-y-0.5"
            style={{
              background: "linear-gradient(135deg,#1E3810,#3D6B24)",
              color: "white",
            }}>
            <FileText size={14}/> File visit
          </Link>
          <Link href={`/doctor/notes?appointmentId=${appt.id}`}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all hover:-translate-y-0.5"
            style={{
              background: hasNote ? "rgba(141,198,63,0.12)" : "white",
              color: "#2A4A1A",
              border: "1px solid rgba(141,198,63,0.3)",
            }}>
            <FileText size={14}/> {hasNote ? "View session note" : "Add session note"}
          </Link>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  CALENDAR TAB
// ══════════════════════════════════════════════════════════════

const STATUS_DOT: Record<string,string> = {
  pending:"#F7941D", approved:"#8DC63F", completed:"#1E3810", rejected:"#F7941D", cancelled:"#8A9BA8",
};

function CalendarTab({ appointments }: { appointments: Appointment[] }) {
  // ⚠️ Hydration fix: never call new Date() at render time.
  // Vercel server runs UTC. Doctors are in Barbados, St. Vincent, or anywhere worldwide.
  // Any mismatch causes React hydration errors → blank calendar.
  // Solution: initialise dates to null, set client-side only in useEffect.
  const [current,  setCurrent]  = useState<Date|null>(null);
  const [today,    setToday]    = useState<Date|null>(null);
  const [selected, setSelected] = useState<string|null>(null);

  useEffect(() => {
    const now = new Date();
    setCurrent(now);
    setToday(now);
  }, []);

  // Guard: don't render the grid until client date is known
  const year  = current?.getFullYear() ?? 0;
  const month = current?.getMonth()    ?? 0;

  // Build day grid
  const firstDay   = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const cells: (number|null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({length:daysInMonth},(_,i)=>i+1),
  ];
  // Pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);

  // Map appointments by date string (soonest time first within each day)
  const apptsByDate = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    appointments.forEach(a => {
      if (!a.date) return;
      if (!map[a.date]) map[a.date] = [];
      map[a.date].push(a);
    });
    Object.keys(map).forEach(d => {
      map[d] = sortAppointmentsBySession(map[d], "asc");
    });
    return map;
  }, [appointments]);

  const monthLabel = current
    ? current.toLocaleDateString("en-US",{ month:"long", year:"numeric" })
    : "";

  const selectedAppts = selected ? (apptsByDate[selected] ?? []) : [];

  const dayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

  // Don't render the grid until client-side date is hydrated
  if (!current || !today) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 size={24} className="animate-spin" style={{ color:"#8DC63F" }}/>
    </div>
  );

  return (
    <div className="space-y-4">

      {/* Calendar header */}
      <div className="rounded-2xl p-5" style={{ background:"white", boxShadow:"0 1px 4px rgba(30,56,16,0.07)" }}>
        <div className="flex items-center justify-between mb-5">
          <button onClick={() => setCurrent(new Date(year, month-1, 1))}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-black/5"
            style={{ color:"#1E3810" }}>
            <ChevronLeft size={16}/>
          </button>
          <h3 className="text-base font-semibold" style={{ fontFamily:"var(--font-dm-serif)", color:"#1E3810" }}>
            {monthLabel}
          </h3>
          <button onClick={() => setCurrent(new Date(year, month+1, 1))}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-black/5"
            style={{ color:"#1E3810" }}>
            <ChevronRight size={16}/>
          </button>
        </div>

        <div className="scroll-x-touch -mx-1 px-1">
        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1 min-w-[280px]">
          {dayNames.map(d => (
            <div key={d} className="text-center text-xs font-semibold py-1" style={{ color:"#8A9BA8" }}>{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-0.5 min-w-[280px]">
          {cells.map((day, i) => {
            if (day === null) return <div key={`e-${i}`}/>;
            const dateStr = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
            const dayAppts = apptsByDate[dateStr] ?? [];
            const isToday  = !!today && day===today.getDate() && month===today.getMonth() && year===today.getFullYear();
            const isSelected = dateStr === selected;

            return (
              <button key={dateStr} onClick={() => setSelected(isSelected ? null : dateStr)}
                className="relative rounded-xl p-1.5 min-h-[48px] sm:min-h-[56px] flex flex-col items-center transition-all hover:scale-105"
                style={{
                  background: isSelected ? "#1E3810" : isToday ? "rgba(141,198,63,0.12)" : dayAppts.length>0 ? "rgba(30,56,16,0.02)" : "transparent",
                  border: isToday && !isSelected ? "1.5px solid #8DC63F" : isSelected ? "none" : "1.5px solid transparent",
                }}>
                <span className="text-xs font-semibold mb-1"
                  style={{ color: isSelected?"white" : isToday?"#1E3810" : "#4A5568" }}>
                  {day}
                </span>
                {/* Appointment dots */}
                {dayAppts.length > 0 && (
                  <div className="flex gap-0.5 flex-wrap justify-center">
                    {dayAppts.slice(0,3).map((a,idx) => (
                      <span key={idx} className="w-1.5 h-1.5 rounded-full"
                        style={{ background: isSelected?"rgba(255,255,255,0.7)" : STATUS_DOT[a.status]??"#8A9BA8" }}/>
                    ))}
                    {dayAppts.length > 3 && (
                      <span className="text-xs leading-none" style={{ color:isSelected?"rgba(255,255,255,0.7)":"#8A9BA8", fontSize:"9px" }}>
                        +{dayAppts.length-3}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 pt-4 border-t flex-wrap" style={{ borderColor:"rgba(30,56,16,0.06)" }}>
          {Object.entries(STATUS_DOT).map(([status,color]) => (
            <span key={status} className="flex items-center gap-1.5 text-xs capitalize" style={{ color:"#8A9BA8" }}>
              <span className="w-2 h-2 rounded-full" style={{ background:color }}/>
              {status}
            </span>
          ))}
        </div>
      </div>

      {/* Selected day detail */}
      {selected && (
        <div className="rounded-2xl p-5" style={{ background:"white", boxShadow:"0 1px 4px rgba(30,56,16,0.07)" }}>
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold" style={{ color:"#1E3810" }}>
              {new Date(selected+"T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"})}
            </h4>
            <button onClick={() => setSelected(null)} className="p-1 rounded-lg hover:bg-black/5" style={{ color:"#8A9BA8" }}>
              <X size={14}/>
            </button>
          </div>
          {selectedAppts.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color:"#C4C4C4" }}>No appointments this day</p>
          ) : (
            <div className="space-y-3">
              {selectedAppts.map(a => (
                <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background:"rgba(30,56,16,0.03)", border:"1px solid rgba(30,56,16,0.06)" }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{ background:"rgba(141,198,63,0.15)", color:"#1E3810" }}>
                    {a.clientName?.[0]?.toUpperCase()??"C"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color:"#1E3810" }}>{a.clientName}</p>
                    <p className="text-xs" style={{ color:"#8A9BA8" }}>
                      {a.time} · {a.type}
                      {a.seriesId && a.seriesIndex && a.seriesCount
                        ? ` · Series ${a.seriesIndex}/${a.seriesCount}`
                        : ""}
                    </p>
                  </div>
                  <StatusBadge status={a.status} cancelledReason={(a as any).cancelledReason}/>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Month summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label:"This Month", value:appointments.filter(a=>{
              if (!today) return false;
              const d=new Date(a.date+"T12:00:00"); return d.getMonth()===today.getMonth()&&d.getFullYear()===today.getFullYear();
            }).length, color:"#1E3810" },
          { label:"Pending",   value:appointments.filter(a=>a.status==="pending").length,   color:"#F7941D" },
          { label:"Confirmed", value:appointments.filter(a=>a.status==="approved").length,  color:"#8DC63F" },
          { label:"Completed", value:appointments.filter(a=>a.status==="completed").length, color:"#6BA028" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-2xl p-4 text-center" style={{ background:"white", boxShadow:"0 1px 4px rgba(30,56,16,0.07)" }}>
            <p className="text-2xl font-bold" style={{ fontFamily:"var(--font-dm-serif)", color }}>{value}</p>
            <p className="text-xs mt-1" style={{ color:"#8A9BA8" }}>{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  AVAILABILITY COMPONENTS (unchanged)
// ══════════════════════════════════════════════════════════════

function genTimeOptions() {
  const opts = [];
  for (let h = 6; h <= 21; h++) {
    for (const m of [0,30]) {
      const hh=String(h).padStart(2,"0"),mm=String(m).padStart(2,"0");
      opts.push({ value:`${hh}:${mm}`, label:`${h>12?h-12:h}:${mm} ${h>=12?"PM":"AM"}` });
    }
  }
  return opts;
}
const TIME_OPTS = genTimeOptions();
const timeLbl   = (v: string) => TIME_OPTS.find(t=>t.value===v)?.label??v;

function genSlots(start: string, end: string, dur: number, buf: number): string[] {
  const[sh,sm]=start.split(":").map(Number),[eh,em]=end.split(":").map(Number);
  const s0=sh*60+sm,e0=eh*60+em,step=dur+buf;
  const slots:string[]=[];
  for(let t=s0;t+dur<=e0;t+=step){
    const fmt=(tt:number)=>{const hh=Math.floor(tt/60),mm=tt%60,ap=hh>=12?"PM":"AM",h12=hh>12?hh-12:hh===0?12:hh;return `${h12}:${String(mm).padStart(2,"0")} ${ap}`;};
    slots.push(`${fmt(t)} – ${fmt(t+dur)}`);
  }
  return slots;
}

function DayRow({ dayKey, label, sched, dur, buf, onChange }: {
  dayKey:DayKey; label:string; sched:DaySchedule; dur:number; buf:number; onChange:(s:DaySchedule)=>void;
}) {
  const[preview,setPreview]=useState(false);
  const allSlots=sched.enabled?sched.slots.flatMap(s=>genSlots(s.start,s.end,dur,buf)):[];
  const toggle=()=>onChange({ enabled:!sched.enabled, slots:!sched.enabled&&sched.slots.length===0?[{start:"09:00",end:"17:00"}]:sched.slots });
  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background:sched.enabled?"white":"rgba(42,74,26,0.02)", boxShadow:sched.enabled?"0 1px 4px rgba(42,74,26,0.07)":"none", border:sched.enabled?"none":"1px solid rgba(42,74,26,0.07)" }}>
      <div className="flex items-center gap-4 p-4">
        <button onClick={toggle} className="flex-shrink-0">
          {sched.enabled?<ToggleRight size={26} style={{color:"#8DC63F"}}/>:<ToggleLeft size={26} style={{color:"#C4C4C4"}}/>}
        </button>
        <div className="w-28 flex-shrink-0">
          <p className="text-sm font-semibold" style={{color:sched.enabled?"#2A4A1A":"#C4C4C4"}}>{label}</p>
          {sched.enabled&&<p className="text-xs" style={{color:"#8A9BA8"}}>{allSlots.length} slots</p>}
        </div>
        {!sched.enabled?(
          <p className="text-sm" style={{color:"#C4C4C4"}}>Unavailable</p>
        ):(
          <div className="flex-1 space-y-2">
            {sched.slots.map((slot,i)=>(
              <div key={i} className="flex items-center gap-2 flex-wrap">
                <select value={slot.start} onChange={e=>onChange({...sched,slots:sched.slots.map((s,idx)=>idx===i?{...s,start:e.target.value}:s)})}
                  className="px-3 py-1.5 rounded-xl text-xs border focus:outline-none" style={{borderColor:"rgba(42,74,26,0.15)",background:"#FAFAFA"}}>
                  {TIME_OPTS.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <span className="text-xs" style={{color:"#8A9BA8"}}>to</span>
                <select value={slot.end} onChange={e=>onChange({...sched,slots:sched.slots.map((s,idx)=>idx===i?{...s,end:e.target.value}:s)})}
                  className="px-3 py-1.5 rounded-xl text-xs border focus:outline-none" style={{borderColor:"rgba(42,74,26,0.15)",background:"#FAFAFA"}}>
                  {TIME_OPTS.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                {sched.slots.length>1&&(
                  <button onClick={()=>onChange({...sched,slots:sched.slots.filter((_,idx)=>idx!==i)})} className="p-1 rounded-lg hover:bg-red-50">
                    <Trash2 size={13} style={{color:"#F7941D"}}/>
                  </button>
                )}
              </div>
            ))}
            <button onClick={()=>{const last=sched.slots[sched.slots.length-1];onChange({...sched,slots:[...sched.slots,{start:last?.end??"09:00",end:"18:00"}]});}}
              className="flex items-center gap-1 text-xs font-semibold" style={{color:"#8DC63F"}}>
              <Plus size={12}/> Add time range
            </button>
          </div>
        )}
        {sched.enabled&&allSlots.length>0&&(
          <button onClick={()=>setPreview(!preview)} className="flex items-center gap-1 text-xs flex-shrink-0 px-2 py-1 rounded-lg"
            style={{color:"#8A9BA8",background:"rgba(42,74,26,0.04)"}}>
            <ChevronDown size={12} className={`transition-transform ${preview?"rotate-180":""}`}/> Preview
          </button>
        )}
      </div>
      {preview&&allSlots.length>0&&(
        <div className="px-4 pb-4 pt-3 border-t" style={{borderColor:"rgba(42,74,26,0.06)"}}>
          <div className="flex flex-wrap gap-1.5">
            {allSlots.map((s,i)=>(
              <span key={i} className="text-xs px-2.5 py-1 rounded-lg font-medium"
                style={{background:"rgba(141,198,63,0.1)",color:"#6BA028"}}>{s}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  GOOGLE CALENDAR CONNECT PANEL
// ══════════════════════════════════════════════════════════════

function GoogleCalendarPanel({ calendarId, doctorId }: { calendarId: string; doctorId: string }) {
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{type:"success"|"error"; text:string}|null>(null);

  const connected = !!calendarId;

  // Reflect the OAuth redirect result (/doctor/schedule?calendar=connected|error)
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("calendar");
    if (c === "connected") {
      setSyncMsg({ type: "success", text: "Google Calendar connected. Sessions can now get a Meet link automatically." });
    } else if (c === "error") {
      setSyncMsg({
        type: "error",
        text: "Couldn't connect Google Calendar. If Google showed redirect_uri_mismatch, the callback URL in Google Cloud must exactly match https://www.valeoexperience.com/api/auth/callback/google (and the non-www version if you use it).",
      });
    }
  }, []);

  // Start the OAuth flow — sends the doctor to Google with their verified token.
  async function connectGoogle() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const u = auth.currentUser;
      if (!u) { setSyncMsg({ type: "error", text: "Please sign in again." }); setSyncing(false); return; }
      const token = await u.getIdToken();
      window.location.href = `/api/auth/google/start?token=${encodeURIComponent(token)}`;
    } catch {
      setSyncMsg({ type: "error", text: "Could not start the connection. Please try again." });
      setSyncing(false);
    }
  }

  // Verify the current connection.
  async function checkConnection() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res  = await authedFetch(`/api/calendar/test?doctorId=${encodeURIComponent(doctorId)}`);
      const data = await res.json();
      if (data.ok) {
        setSyncMsg({ type: "success", text: `Connected${data.calendar ? ` (${data.calendar})` : ""}. Your bookings respect your calendar and sessions get a Meet link.` });
      } else {
        setSyncMsg({ type: "error", text: data.error || "Not connected yet." });
      }
    } catch {
      setSyncMsg({ type: "error", text: "Could not reach the calendar service. Please try again." });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="rounded-2xl p-5" style={{ background:"white", boxShadow:"0 1px 4px rgba(42,74,26,0.07)" }}>
      {/* Header */}
      <div className="flex items-start gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background:"rgba(66,133,244,0.1)" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="4" width="18" height="17" rx="2" stroke="#4285F4" strokeWidth="2"/>
            <path d="M3 9h18" stroke="#4285F4" strokeWidth="2"/>
            <path d="M8 2v4M16 2v4" stroke="#4285F4" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color:"#2A4A1A" }}>Google Calendar &amp; Meet</p>
          <p className="text-xs mt-0.5" style={{ color:"#8A9BA8" }}>
            Connect once so Valeo can create Google Meet links for sessions and keep your calendar in sync.
          </p>
        </div>
        {connected && (
          <span className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0"
            style={{ background:"rgba(141,198,63,0.1)", color:"#6BA028" }}>
            <span className="w-1.5 h-1.5 rounded-full bg-current"/> Connected
          </span>
        )}
      </div>

      {/* How it works */}
      <div className="rounded-xl p-3 mb-5 space-y-2"
        style={{ background:"rgba(66,133,244,0.04)", border:"1px solid rgba(66,133,244,0.12)" }}>
        <p className="text-xs font-semibold" style={{ color:"#4285F4" }}>How it works</p>
        {[
          "Connect your Google account here — this is what powers Meet link generation.",
          "When the client pays after you approve their time (or you tap Create Meet link), Valeo adds a Calendar event with a Google Meet URL.",
          "You and the client both get a Join Google Meet button once the link exists.",
        ].map((t,i) => (
          <p key={i} className="text-xs flex gap-2" style={{ color:"#4A5568" }}>
            <span className="font-bold flex-shrink-0" style={{ color:"#4285F4" }}>{i+1}.</span>{t}
          </p>
        ))}
      </div>

      {/* Connect / status */}
      <div className="space-y-3">
        {connected && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
            style={{ background:"rgba(141,198,63,0.08)", color:"#6BA028" }}>
            <CheckCircle size={13}/> Connected calendar: <strong>{calendarId}</strong>
          </div>
        )}

        <button onClick={connectGoogle} disabled={syncing}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
          style={{ background:"linear-gradient(135deg, #4285F4, #2B6CB0)" }}>
          {syncing ? <Loader2 size={14} className="animate-spin"/> : connected ? <RefreshCw size={14}/> : <Link2 size={14}/>}
          {syncing ? "Opening Google…" : connected ? "Reconnect Google Calendar" : "Connect Google Calendar"}
        </button>

        {connected && (
          <button onClick={checkConnection} disabled={syncing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
            style={{ background:"rgba(66,133,244,0.08)", color:"#2B6CB0" }}>
            <RefreshCw size={14}/> Check connection
          </button>
        )}

        {syncMsg && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs"
            style={{
              background: syncMsg.type==="success" ? "rgba(141,198,63,0.08)" : "rgba(247,148,29,0.08)",
              color:      syncMsg.type==="success" ? "#6BA028" : "#F7941D",
              border:     `1px solid ${syncMsg.type==="success" ? "rgba(141,198,63,0.2)" : "rgba(247,148,29,0.2)"}`,
            }}>
            {syncMsg.type==="success" ? <CheckCircle size={13} className="flex-shrink-0 mt-0.5"/> : <AlertCircle size={13} className="flex-shrink-0 mt-0.5"/>}
            {syncMsg.text}
          </div>
        )}

        {connected && (
          <a href="https://calendar.google.com" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium hover:underline"
            style={{ color:"#4285F4" }}>
            <ExternalLink size={11}/> Open Google Calendar
          </a>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  BOOK FOR CLIENT (urgent / same-day — doctor-initiated)
// ══════════════════════════════════════════════════════════════

type AssignableClient = { uid: string; displayName: string; email: string };

function localDateInputValue(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function BookForClientModal({
  avail,
  onClose,
  onDone,
}: {
  avail: AvailabilitySchedule;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const { user } = useAuth();
  const services = bookableServices(avail);
  const [clients, setClients] = useState<AssignableClient[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [clientId, setClientId] = useState("");
  const [serviceId, setServiceId] = useState(services[0]?.id || "");
  const [date, setDate] = useState(localDateInputValue);
  const [time, setTime] = useState("09:00");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState<"client" | "service" | null>(null);

  const selectedClient = clients.find(c => c.uid === clientId) || null;
  const selectedService = services.find(s => s.id === serviceId) || services[0];

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setLoadingClients(true);
      try {
        const assignSnap = await getDocs(
          query(collection(db, "assignments"), where("doctorId", "==", user.uid)),
        );
        const ids = assignSnap.docs.map(d => d.id);
        const docs = await Promise.all(ids.map(id => getDoc(doc(db, "users", id))));
        if (cancelled) return;
        const list: AssignableClient[] = docs
          .filter(s => s.exists())
          .map(s => {
            const d = s.data() as { displayName?: string; email?: string };
            return {
              uid: s.id,
              displayName: d.displayName || d.email || "Client",
              email: d.email || "",
            };
          })
          .sort((a, b) => a.displayName.localeCompare(b.displayName));
        setClients(list);
        if (list.length) setClientId(list[0].uid);
      } catch {
        if (!cancelled) setClients([]);
      } finally {
        if (!cancelled) setLoadingClients(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  async function submit() {
    if (!clientId || !selectedService || !date || !time) {
      setError("Pick a client, service, date, and time.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await authedFetch("/api/appointments/doctor-book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          date,
          time,
          type: selectedService.name,
          duration: selectedService.duration,
          amount: selectedService.price,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not schedule this session.");
        return;
      }
      onDone(
        data.free
          ? "Free session confirmed — Meet link will appear shortly."
          : "Session scheduled. Client has been asked to pay before they can join.",
      );
      onClose();
    } catch {
      setError("Could not schedule this session. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(30,56,16,0.45)" }}
      onClick={onClose}>
      <div
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl p-5 space-y-4 max-h-[92vh] overflow-y-auto"
        style={{ background: "white", boxShadow: "0 12px 40px rgba(30,56,16,0.2)" }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold" style={{ color: "#1E3810" }}>Book for client</p>
            <p className="text-xs mt-0.5" style={{ color: "#8A9BA8" }}>
              Same-day and any time allowed. Client still pays before Join.
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg" style={{ color: "#8A9BA8" }}>
            <X size={16} />
          </button>
        </div>

        {loadingClients ? (
          <div className="flex justify-center py-8">
            <Loader2 size={22} className="animate-spin" style={{ color: "#8DC63F" }} />
          </div>
        ) : clients.length === 0 ? (
          <p className="text-sm py-4" style={{ color: "#8A9BA8" }}>
            No assigned clients yet. Assign a client in Admin before booking for them.
          </p>
        ) : (
          <>
            <div className="space-y-1">
              <span className="text-xs font-medium" style={{ color: "#4A5568" }}>Client</span>
              <button
                type="button"
                onClick={() => setPicker(p => p === "client" ? null : "client")}
                className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left"
                style={{ border: "1px solid rgba(30,56,16,0.12)", background: picker === "client" ? "rgba(141,198,63,0.06)" : "white" }}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold truncate" style={{ color: "#1E3810" }}>
                    {selectedClient?.displayName || "Select client"}
                  </span>
                  {selectedClient?.email && (
                    <span className="block text-xs truncate" style={{ color: "#8A9BA8" }}>
                      {selectedClient.email}
                    </span>
                  )}
                </span>
                <ChevronDown size={16} style={{ color: "#8A9BA8", transform: picker === "client" ? "rotate(180deg)" : undefined, transition: "transform .15s" }} />
              </button>
              {picker === "client" && (
                <div className="rounded-xl overflow-hidden max-h-48 overflow-y-auto"
                  style={{ border: "1px solid rgba(30,56,16,0.1)", background: "#FAFCF7" }}>
                  {clients.map(c => {
                    const active = c.uid === clientId;
                    return (
                      <button
                        key={c.uid}
                        type="button"
                        onClick={() => { setClientId(c.uid); setPicker(null); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                        style={{
                          background: active ? "rgba(141,198,63,0.12)" : "transparent",
                          borderBottom: "1px solid rgba(30,56,16,0.06)",
                        }}
                      >
                        <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: "rgba(42,74,26,0.08)", color: "#1E3810" }}>
                          {(c.displayName || "?").charAt(0).toUpperCase()}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold truncate" style={{ color: "#1E3810" }}>{c.displayName}</span>
                          <span className="block text-xs truncate" style={{ color: "#8A9BA8" }}>{c.email}</span>
                        </span>
                        {active && <CheckCircle size={16} style={{ color: "#6BA028" }} className="flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <span className="text-xs font-medium" style={{ color: "#4A5568" }}>Service</span>
              <button
                type="button"
                onClick={() => setPicker(p => p === "service" ? null : "service")}
                className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left"
                style={{ border: "1px solid rgba(30,56,16,0.12)", background: picker === "service" ? "rgba(141,198,63,0.06)" : "white" }}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold truncate" style={{ color: "#1E3810" }}>
                    {selectedService?.name || "Select service"}
                  </span>
                  {selectedService && (
                    <span className="block text-xs" style={{ color: "#8A9BA8" }}>
                      {selectedService.duration} min · {selectedService.price === 0 ? "Free" : `$${selectedService.price}`}
                    </span>
                  )}
                </span>
                <ChevronDown size={16} style={{ color: "#8A9BA8", transform: picker === "service" ? "rotate(180deg)" : undefined, transition: "transform .15s" }} />
              </button>
              {picker === "service" && (
                <div className="rounded-xl overflow-hidden max-h-48 overflow-y-auto"
                  style={{ border: "1px solid rgba(30,56,16,0.1)", background: "#FAFCF7" }}>
                  {services.map(s => {
                    const active = s.id === serviceId;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => { setServiceId(s.id); setPicker(null); }}
                        className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left"
                        style={{
                          background: active ? "rgba(141,198,63,0.12)" : "transparent",
                          borderBottom: "1px solid rgba(30,56,16,0.06)",
                        }}
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold truncate" style={{ color: "#1E3810" }}>{s.name}</span>
                          <span className="block text-xs" style={{ color: "#8A9BA8" }}>
                            {s.duration} min · {s.price === 0 ? "Free" : `$${s.price}`}
                          </span>
                        </span>
                        {active && <CheckCircle size={16} style={{ color: "#6BA028" }} className="flex-shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-xs font-medium" style={{ color: "#4A5568" }}>Date</span>
                <input type="date" value={date} min={localDateInputValue()}
                  onChange={e => setDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ border: "1px solid rgba(30,56,16,0.12)", color: "#1E3810" }} />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium" style={{ color: "#4A5568" }}>Time</span>
                <input type="time" value={time} onChange={e => setTime(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ border: "1px solid rgba(30,56,16,0.12)", color: "#1E3810" }} />
              </label>
            </div>

            <label className="block space-y-1">
              <span className="text-xs font-medium" style={{ color: "#4A5568" }}>Note (optional)</span>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                placeholder="e.g. Urgent follow-up"
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
                style={{ border: "1px solid rgba(30,56,16,0.12)", color: "#1E3810" }} />
            </label>

            {error && (
              <p className="text-xs rounded-xl px-3 py-2" style={{ background: "rgba(247,148,29,0.1)", color: "#C4700A" }}>
                {error}
              </p>
            )}

            <button type="button" onClick={submit} disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: "linear-gradient(135deg,#F7941D,#C4700A)" }}>
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
              {submitting ? "Scheduling…" : "Schedule session"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  MAIN PAGE
// ══════════════════════════════════════════════════════════════

type MainTab    = "appointments" | "calendar" | "availability";
type ApptFilter = "pending" | "approved" | "completed" | "all";

export default function DoctorSchedulePage() {
  const { user } = useAuth();

  const { appointments, loading: apptLoading } = useDoctorAppointments();
  const [apptFilter, setApptFilter] = useState<ApptFilter>("pending");
  const [acting,     setActing]     = useState<string|null>(null);
  // Appointment IDs that already have a session note (live)
  const [notedApptIds, setNotedApptIds] = useState<Set<string>>(new Set());

  const [avail,        setAvail]        = useState<AvailabilitySchedule>(DEFAULT_AVAIL);
  const [availLoading, setAvailLoading] = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [toast,        setToast]        = useState<{type:"success"|"error"; msg:string}|null>(null);
  const [newBlockDate, setNewBlockDate] = useState("");
  const [availSubTab,  setAvailSubTab]  = useState<"hours"|"pricing"|"settings"|"calendar-sync">("hours");

  const [mainTab, setMainTab] = useState<MainTab>("appointments");
  const [postComplete, setPostComplete] = useState<Appointment | null>(null);
  const [bookForClientOpen, setBookForClientOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const snap = await getDoc(doc(db,"schedules",user.uid));
      if (snap.exists()) {
        const data = snap.data() as AvailabilitySchedule;
        // Seed a services list on first load (migration from legacy sessionPricing)
        if (!data.services || data.services.length === 0) data.services = servicesForEditing(data);
        setAvail(data);
      } else {
        // New doctor — auto-detect their timezone + seed default services
        setAvail(prev => ({ ...prev, timezone: detectTimezone(), services: servicesForEditing(null) }));
      }
      setAvailLoading(false);
    })();
  }, [user]);

  // Live set of appointment IDs that have a session note
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db,"notes"), where("doctorId","==",user.uid));
    const unsub = onSnapshot(q, snap => {
      const ids = new Set<string>();
      snap.docs.forEach(d => {
        const aid = (d.data() as any).appointmentId;
        if (aid) ids.add(aid);
      });
      setNotedApptIds(ids);
    });
    return () => unsub();
  }, [user]);

  function showToast(type:"success"|"error", msg:string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }

  async function saveAvailability() {
    if (!user) return;
    setSaving(true);
    try {
      await setDoc(doc(db,"schedules",user.uid), { ...avail, doctorId:user.uid, updatedAt:serverTimestamp() });
      showToast("success","Availability saved.");
    } catch { showToast("error","Failed to save. Try again."); }
    finally   { setSaving(false); }
  }

  // Update one service in the doctor's services list
  function updateService(i: number, patch: Partial<Service>) {
    setAvail(a => ({ ...a, services: (a.services ?? []).map((s, idx) => idx === i ? { ...s, ...patch } : s) }));
  }

  const counts = {
    pending:   appointments.filter(a=>a.status==="pending").length,
    approved:  appointments.filter(a=>a.status==="approved").length,
    completed: appointments.filter(a=>a.status==="completed").length,
    all:       appointments.length,
  };
  const filteredRaw = apptFilter==="all" ? appointments : appointments.filter(a=>a.status===apptFilter);
  // Soonest session on top; completed history newest-first
  const filtered = sortAppointmentsBySession(
    filteredRaw,
    apptFilter === "completed" ? "desc" : "asc",
  );

  async function handleApprove(id: string) {
    const appt = appointments.find(a=>a.id===id);
    if (!appt) return;
    setActing(id);
    try {
      // Already confirmed → mark completed
      if (appt.status === "approved") {
        await updateAppointmentStatus(id, "completed");
        showToast("success", "Session marked completed.");
        setPostComplete(appt);
        return;
      }

      // Pending request → accept the time (client pays next, unless free)
      if (appt.status === "pending") {
        const res = await authedFetch("/api/appointments/approve-schedule", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ appointmentId: id }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          showToast("error", data.error || "Could not approve this request.");
          return;
        }
        if (data.free) {
          showToast("success", "Free session confirmed — Meet link will appear shortly.");
        } else {
          showToast("success", "Time approved — client has been asked to pay to confirm.");
        }
      }
    }
    finally { setActing(null); }
  }
  async function handleCreateMeet(id: string) {
    setActing(id);
    try {
      const res = await authedFetch("/api/meet/create", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ appointmentId: id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast("error", data.error || "Could not create Meet link.");
        return;
      }
      showToast("success", "Meet link created — you and the client can Join Session.");
    } catch (err) {
      console.error("[Schedule] Create Meet failed:", err);
      showToast("error", "Could not create Meet link. Check your Google Calendar connection.");
    } finally {
      setActing(null);
    }
  }

  function goToCalendarSync() {
    setMainTab("availability");
    setAvailSubTab("calendar-sync");
  }

  async function handleReject(id: string) {
    setActing(id);
    try {
      await updateAppointmentStatus(id,"rejected");
      // Notify the client their request wasn't confirmed (fire-and-forget)
      authedFetch("/api/email/appointment", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ appointmentId: id, event: "cancelled", cancelledBy: "doctor" }),
      }).catch(() => {});
    }
    finally { setActing(null); }
  }

  const enabledDays      = DAYS.filter(d=>avail.availability[d.key].enabled);
  const totalWeeklySlots = enabledDays.reduce((sum,d) =>
    sum + avail.availability[d.key].slots.reduce((s2,slot) =>
      s2 + genSlots(slot.start,slot.end,avail.slotDuration,avail.bufferTime).length, 0), 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {postComplete && (
        <PostCompleteNoteModal
          appt={postComplete}
          hasNote={notedApptIds.has(postComplete.id)}
          onClose={() => setPostComplete(null)}
        />
      )}

      {bookForClientOpen && (
        <BookForClientModal
          avail={avail}
          onClose={() => setBookForClientOpen(false)}
          onDone={(msg) => showToast("success", msg)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-lg text-sm font-medium"
          style={{ background:toast.type==="success"?"#2A4A1A":"#F7941D", color:"white" }}>
          {toast.type==="success"?<CheckCircle size={16}/>:<AlertCircle size={16}/>}
          {toast.msg}
        </div>
      )}

      {/* Subtitle + actions — page name lives in the sticky header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm" style={{ color:"#8A9BA8" }}>Manage appointments, view your calendar, and set availability</p>
        </div>
        <div className="flex items-center gap-2">
          {mainTab==="appointments" && (
            <button type="button" onClick={() => setBookForClientOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
              style={{ background:"linear-gradient(135deg,#F7941D,#C4700A)" }}>
              <Zap size={14}/> Book for client
            </button>
          )}
          {counts.pending>0 && mainTab==="appointments" && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background:"rgba(247,148,29,0.1)", color:"#F7941D" }}>
              <Clock size={14}/> {counts.pending} pending review
            </div>
          )}
          {mainTab==="availability" && (
            <button onClick={saveAvailability} disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
              style={{ background:"linear-gradient(135deg,#1E3810,#3D6B24)" }}>
              {saving?<Loader2 size={14} className="animate-spin"/>:<Save size={14}/>}
              {saving?"Saving...":"Save Availability"}
            </button>
          )}
        </div>
      </div>

      {/* Main tabs */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background:"rgba(30,56,16,0.06)" }}>
        {([
          { key:"appointments", label:"Appointments" },
          { key:"calendar",     label:"Calendar"     },
          { key:"availability", label:"Availability"  },
        ] as const).map(({ key, label }) => (
          <button key={key} onClick={() => setMainTab(key)}
            className="px-5 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{ background:mainTab===key?"white":"transparent", color:mainTab===key?"#1E3810":"#8A9BA8", boxShadow:mainTab===key?"0 1px 3px rgba(30,56,16,0.1)":"none" }}>
            {label}
            {key==="appointments" && counts.pending>0 && (
              <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full font-bold"
                style={{ background:"#F7941D", color:"white" }}>{counts.pending}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── APPOINTMENTS TAB ── */}
      {mainTab==="appointments" && (
        <div className="space-y-5">
          {!availLoading && !avail.googleCalendarId && (
            <div className="rounded-2xl px-4 py-3.5 flex flex-wrap items-center justify-between gap-3"
              style={{ background:"rgba(66,133,244,0.06)", border:"1px solid rgba(66,133,244,0.18)" }}>
              <div className="flex items-start gap-2.5 min-w-0">
                <Video size={16} className="flex-shrink-0 mt-0.5" style={{ color:"#4285F4" }}/>
                <div>
                  <p className="text-sm font-semibold" style={{ color:"#2A4A1A" }}>
                    Connect Google Calendar to generate Meet links
                  </p>
                  <p className="text-xs mt-0.5" style={{ color:"#4A5568" }}>
                    Required before you or clients can join video sessions from Valeo.
                  </p>
                </div>
              </div>
              <button type="button" onClick={goToCalendarSync}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white flex-shrink-0"
                style={{ background:"linear-gradient(135deg,#4285F4,#2B6CB0)" }}>
                <Link2 size={13}/> Connect Google Calendar
              </button>
            </div>
          )}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label:"Pending",   value:counts.pending,   accent:"#F7941D", Icon:Clock        },
              { label:"Confirmed", value:counts.approved,  accent:"#8DC63F", Icon:CheckCircle  },
              { label:"Completed", value:counts.completed, accent:"#1E3810", Icon:CheckCircle  },
              { label:"Total",     value:counts.all,       accent:"#F7941D", Icon:Users        },
            ].map(({ label, value, accent, Icon }) => (
              <div key={label} className="rounded-2xl p-4 flex items-center gap-3"
                style={{ background:"white", boxShadow:"0 1px 4px rgba(30,56,16,0.07)" }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background:accent+"15" }}>
                  <Icon size={16} style={{ color:accent }}/>
                </div>
                <div>
                  <p className="text-2xl font-semibold leading-none" style={{ fontFamily:"var(--font-dm-serif)", color:"#1E3810" }}>{value}</p>
                  <p className="text-xs mt-0.5" style={{ color:"#8A9BA8" }}>{label}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={14} style={{ color:"#8A9BA8" }}/>
            <FilterTab label="Pending"   count={counts.pending}   active={apptFilter==="pending"}   onClick={()=>setApptFilter("pending")}  />
            <FilterTab label="Confirmed" count={counts.approved}  active={apptFilter==="approved"}  onClick={()=>setApptFilter("approved")} />
            <FilterTab label="Completed" count={counts.completed} active={apptFilter==="completed"} onClick={()=>setApptFilter("completed")}/>
            <FilterTab label="All"       count={counts.all}       active={apptFilter==="all"}       onClick={()=>setApptFilter("all")}      />
          </div>
          {apptLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin" style={{ color:"#8DC63F" }}/></div>
          ) : filtered.length===0 ? (
            <div className="rounded-2xl p-10 text-center" style={{ background:"white", boxShadow:"0 1px 4px rgba(30,56,16,0.07)" }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background:"rgba(141,198,63,0.08)" }}>
                <Calendar size={24} style={{ color:"#8DC63F" }}/>
              </div>
              <p className="text-sm font-medium mb-1" style={{ color:"#1E3810" }}>
                No {apptFilter==="all"?"":apptFilter} appointments
              </p>
              <p className="text-xs" style={{ color:"#8A9BA8" }}>
                {apptFilter==="pending"?"No new requests waiting for review.":"Nothing to show here yet."}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {filtered.map(appt => (
                <AppointmentCard key={appt.id} appt={appt} onApprove={handleApprove} onReject={handleReject} onCreateMeet={handleCreateMeet} loading={acting} hasNote={notedApptIds.has(appt.id)}/>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── CALENDAR TAB ── */}
      {mainTab==="calendar" && <CalendarTab appointments={appointments}/>}

      {/* ── AVAILABILITY TAB ── */}
      {mainTab==="availability" && (
        <div className="space-y-5">
          {availLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin" style={{ color:"#8DC63F" }}/></div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label:"Available Days", value:enabledDays.length,        accent:"#2A4A1A", Icon:Calendar },
                  { label:"Slots / Week",   value:totalWeeklySlots,          accent:"#8DC63F", Icon:Clock    },
                  { label:"Blocked Dates",  value:avail.blockedDates.length, accent:"#F7941D", Icon:X        },
                ].map(({ label, value, accent, Icon }) => (
                  <div key={label} className="rounded-2xl p-4 flex items-center gap-3"
                    style={{ background:"white", boxShadow:"0 1px 4px rgba(42,74,26,0.07)" }}>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background:accent+"12" }}>
                      <Icon size={16} style={{ color:accent }}/>
                    </div>
                    <div>
                      <p className="text-xl font-bold leading-none" style={{ fontFamily:"var(--font-dm-serif)", color:"#2A4A1A" }}>{value}</p>
                      <p className="text-xs mt-0.5" style={{ color:"#8A9BA8" }}>{label}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Sub-tabs — now includes Calendar Sync */}
              <div className="flex gap-1 p-1 rounded-xl w-fit flex-wrap" style={{ background:"rgba(42,74,26,0.06)" }}>
                {([
                  { key:"hours",         label:"Working Hours"    },
                  { key:"pricing",       label:"Services"  },
                  { key:"settings",      label:"Settings"         },
                  { key:"calendar-sync", label:"📅 Google Cal"    },
                ] as const).map(({ key, label }) => (
                  <button key={key} onClick={() => setAvailSubTab(key)}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{ background:availSubTab===key?"white":"transparent", color:availSubTab===key?"#2A4A1A":"#8A9BA8", boxShadow:availSubTab===key?"0 1px 3px rgba(42,74,26,0.1)":"none" }}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Working hours */}
              {availSubTab==="hours" && (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 px-4 py-3 rounded-xl"
                    style={{ background:"rgba(141,198,63,0.06)", border:"1px solid rgba(141,198,63,0.15)" }}>
                    <Info size={13} className="flex-shrink-0 mt-0.5" style={{ color:"#6BA028" }}/>
                    <p className="text-xs" style={{ color:"#6BA028" }}>
                      Toggle days on/off and set your hours. Click <strong>Preview</strong> to see the exact slots clients will see when booking.
                    </p>
                  </div>
                  {DAYS.map(d => (
                    <DayRow key={d.key} dayKey={d.key} label={d.label}
                      sched={avail.availability[d.key]} dur={avail.slotDuration} buf={avail.bufferTime}
                      onChange={s=>setAvail(a=>({ ...a, availability:{ ...a.availability, [d.key]:s } }))}/>
                  ))}
                  <div className="rounded-2xl p-5 mt-1" style={{ background:"white", boxShadow:"0 1px 4px rgba(42,74,26,0.07)" }}>
                    <p className="text-sm font-semibold mb-1" style={{ color:"#2A4A1A" }}>Blocked Dates</p>
                    <p className="text-xs mb-4" style={{ color:"#8A9BA8" }}>Block specific dates for holidays or leave.</p>
                    <div className="flex gap-2 mb-4">
                      <input type="date" value={newBlockDate} onChange={e=>setNewBlockDate(e.target.value)}
                        min={typeof window !== "undefined" ? new Date().toISOString().split("T")[0] : ""}
                        className="flex-1 px-3 py-2 rounded-xl text-sm border focus:outline-none"
                        style={{ borderColor:"rgba(42,74,26,0.15)", background:"#FAFAFA" }}/>
                      <button onClick={()=>{ if(!newBlockDate||avail.blockedDates.includes(newBlockDate))return; setAvail(a=>({ ...a, blockedDates:[...a.blockedDates,newBlockDate].sort() })); setNewBlockDate(""); }}
                        disabled={!newBlockDate}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
                        style={{ background:"linear-gradient(135deg,#2A4A1A,#3D6B24)" }}>
                        <Plus size={14}/> Block
                      </button>
                    </div>
                    {avail.blockedDates.length===0 ? (
                      <p className="text-xs text-center py-3" style={{ color:"#C4C4C4" }}>No blocked dates</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {avail.blockedDates.map(d => (
                          <div key={d} className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium"
                            style={{ background:"rgba(247,148,29,0.08)", color:"#F7941D" }}>
                            {new Date(d+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}
                            <button onClick={()=>setAvail(a=>({ ...a, blockedDates:a.blockedDates.filter(x=>x!==d) }))}><X size={12}/></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Services & pricing */}
              {availSubTab==="pricing" && (
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-sm font-semibold" style={{ color:"#2A4A1A" }}>Your Services</p>
                      <p className="text-xs" style={{ color:"#8A9BA8" }}>
                        Define what you offer. Inactive services are hidden from booking. Price 0 = free (no payment).
                      </p>
                    </div>
                    <button
                      onClick={()=>setAvail(a=>({ ...a, services:[...(a.services??[]),
                        { id:`svc-${Date.now()}`, name:"New Service", duration:60, price:100, description:"", active:true }] }))}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold text-white flex-shrink-0"
                      style={{ background:"linear-gradient(135deg,#2A4A1A,#3D6B24)" }}>
                      <Plus size={14}/> Add Service
                    </button>
                  </div>

                  {(avail.services ?? []).length === 0 ? (
                    <p className="text-xs text-center py-8" style={{ color:"#C4C4C4" }}>No services yet — add one to get started.</p>
                  ) : (avail.services ?? []).map((svc, i) => (
                    <div key={svc.id} className="rounded-2xl p-4 space-y-3"
                      style={{ background:"white", boxShadow:"0 1px 4px rgba(42,74,26,0.07)", opacity: svc.active===false ? 0.65 : 1 }}>
                      <div className="flex items-center gap-3">
                        <input value={svc.name} onChange={e=>updateService(i,{ name:e.target.value })}
                          placeholder="Service name"
                          className="flex-1 px-3 py-2 rounded-xl text-sm border font-medium focus:outline-none"
                          style={{ borderColor:"rgba(42,74,26,0.15)", background:"#FAFAFA", color:"#2A4A1A" }}/>
                        <button onClick={()=>updateService(i,{ active: svc.active===false })}
                          title={svc.active===false ? "Inactive" : "Active"}
                          className="relative flex-shrink-0 w-11 h-6 rounded-full transition-all"
                          style={{ background: svc.active!==false ? "#8DC63F" : "rgba(42,74,26,0.15)" }}>
                          <span className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all"
                            style={{ left: svc.active!==false ? "24px" : "4px" }}/>
                        </button>
                        <button onClick={()=>setAvail(a=>({ ...a, services:(a.services??[]).filter((_,idx)=>idx!==i) }))}
                          className="p-2 rounded-lg hover:bg-red-50 flex-shrink-0" style={{ color:"#8A9BA8" }}>
                          <Trash2 size={14}/>
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color:"#8A9BA8" }}>Duration (min)</label>
                          <input type="number" min={5} step={5} value={svc.duration}
                            onChange={e=>updateService(i,{ duration:Number(e.target.value) })}
                            className="w-full px-3 py-2 rounded-xl text-sm border focus:outline-none"
                            style={{ borderColor:"rgba(42,74,26,0.15)", background:"#FAFAFA", color:"#2A4A1A" }}/>
                        </div>
                        <div>
                          <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color:"#8A9BA8" }}>Price (USD)</label>
                          <input type="number" min={0} step={25} value={svc.price}
                            onChange={e=>updateService(i,{ price:Number(e.target.value) })}
                            className="w-full px-3 py-2 rounded-xl text-sm border focus:outline-none font-semibold"
                            style={{ borderColor:"rgba(42,74,26,0.15)", background:"#FAFAFA", color:"#2A4A1A" }}/>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-semibold uppercase tracking-wider mb-1 block" style={{ color:"#8A9BA8" }}>
                          Description <span style={{ color:"#C4C4C4" }}>(optional)</span>
                        </label>
                        <input value={svc.description ?? ""} onChange={e=>updateService(i,{ description:e.target.value })}
                          placeholder="Short description shown to clients"
                          className="w-full px-3 py-2 rounded-xl text-sm border focus:outline-none"
                          style={{ borderColor:"rgba(42,74,26,0.15)", background:"#FAFAFA", color:"#2A4A1A" }}/>
                      </div>
                      <div className="flex items-center gap-3">
                        {svc.price===0 && <span className="text-xs" style={{ color:"#8DC63F" }}>Free — books without payment</span>}
                        {svc.active===false && <span className="text-xs" style={{ color:"#C4700A" }}>Inactive — hidden from booking</span>}
                      </div>
                    </div>
                  ))}

                  <div className="mt-1 p-3 rounded-xl flex items-start gap-2" style={{ background:"rgba(42,74,26,0.03)", border:"1px solid rgba(42,74,26,0.07)" }}>
                    <Lock size={12} className="flex-shrink-0 mt-0.5" style={{ color:"#8A9BA8" }}/>
                    <p className="text-xs" style={{ color:"#8A9BA8" }}>
                      Click <strong>Save Availability</strong> to apply. Prices are shown to clients before booking and used by Stripe to charge the correct amount.
                    </p>
                  </div>
                </div>
              )}

              {/* Settings */}
              {availSubTab==="settings" && (
                <div className="rounded-2xl p-5 space-y-6" style={{ background:"white", boxShadow:"0 1px 4px rgba(42,74,26,0.07)" }}>
                  {[
                    { title:"Session Duration", key:"slotDuration", opts:SLOT_DURATIONS, fmt:(d:number)=>`${d} min` },
                    { title:"Buffer Between Sessions", key:"bufferTime", opts:BUFFER_TIMES, fmt:(b:number)=>b===0?"None":`${b} min` },
                    { title:"Maximum Advance Booking", key:"maxAdvanceDays", opts:MAX_ADVANCE, fmt:(d:number)=>`${d} days` },
                  ].map(({ title, key, opts, fmt }) => (
                    <div key={key}>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color:"#8A9BA8" }}>{title}</p>
                      <div className="flex gap-2 flex-wrap">
                        {opts.map((o:number) => (
                          <button key={o} onClick={()=>setAvail(a=>({ ...a, [key]:o }))}
                            className="px-4 py-2 rounded-xl text-sm font-semibold border-2 transition-all"
                            style={{ borderColor:(avail as any)[key]===o?"#2A4A1A":"rgba(42,74,26,0.12)", background:(avail as any)[key]===o?"rgba(42,74,26,0.06)":"white", color:(avail as any)[key]===o?"#2A4A1A":"#4A5568" }}>
                            {fmt(o)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color:"#8A9BA8" }}>Timezone</p>
                    <select value={avail.timezone} onChange={e=>setAvail(a=>({ ...a, timezone:e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl text-sm border focus:outline-none"
                      style={{ borderColor:"rgba(42,74,26,0.15)", background:"#FAFAFA", color:"#22272B" }}>
                      {TIMEZONES.map(tz=><option key={tz} value={tz}>{tz.replace(/_/g," ")}</option>)}
                    </select>
                  </div>
                  <div className="pt-4 border-t" style={{ borderColor:"rgba(42,74,26,0.06)" }}>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color:"#8A9BA8" }}>Weekly Summary</p>
                    <div className="space-y-1.5">
                      {DAYS.map(d => {
                        const day=avail.availability[d.key];
                        const slots=day.enabled?day.slots.reduce((sum,s)=>sum+genSlots(s.start,s.end,avail.slotDuration,avail.bufferTime).length,0):0;
                        return (
                          <div key={d.key} className="flex items-center justify-between py-1.5 border-b last:border-0" style={{ borderColor:"rgba(42,74,26,0.05)" }}>
                            <span className="text-xs font-semibold w-24" style={{ color:day.enabled?"#2A4A1A":"#C4C4C4" }}>{d.label}</span>
                            <span className="text-xs flex-1 text-center" style={{ color:"#4A5568" }}>
                              {day.enabled?day.slots.map(s=>`${timeLbl(s.start)} – ${timeLbl(s.end)}`).join(", "):"Unavailable"}
                            </span>
                            {day.enabled&&<span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background:"rgba(141,198,63,0.1)", color:"#6BA028" }}>{slots} slots</span>}
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-3 flex items-center justify-between pt-2 border-t" style={{ borderColor:"rgba(42,74,26,0.06)" }}>
                      <span className="text-xs" style={{ color:"#8A9BA8" }}>Total weekly capacity</span>
                      <span className="text-sm font-bold" style={{ color:"#2A4A1A" }}>{totalWeeklySlots} slots</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Google Calendar Sync */}
              {availSubTab==="calendar-sync" && (
                <GoogleCalendarPanel
                  calendarId={avail.googleCalendarId??""}
                  doctorId={user?.uid ?? ""}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
