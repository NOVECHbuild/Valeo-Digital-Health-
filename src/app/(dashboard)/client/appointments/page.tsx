"use client";

import { useState, useEffect, useRef, useMemo, Suspense } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSearchParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { useAssignedDoctor } from "@/hooks/useAssignedDoctor";
import { authedFetch } from "@/lib/authedFetch";
import {
  useClientAppointments,
  bookAppointment,
  type Appointment,
} from "@/hooks/useAppointments";
import {
  collection, query, where, getDocs, getDoc,
  doc, updateDoc, serverTimestamp,
} from "firebase/firestore";
import {
  availableSlotsForDate,
  bookableServices,
  labelToMinutes,
  overlapsAny,
  type AvailabilitySchedule,
} from "@/lib/availability";
import {
  Calendar, Clock, Plus, X, CheckCircle, AlertCircle,
  XCircle, Loader2, ChevronLeft, ChevronRight, Video,
  CreditCard, Lock, ExternalLink, Ban, AlertTriangle,
} from "lucide-react";
export const dynamic = "force-dynamic";

// ── Config ─────────────────────────────────────────────────────────────────

const SESSION_TYPES = [
  { id: "individual",   label: "Individual Therapy",  duration: 60, price: 400, description: "One-on-one therapy session" },
  { id: "couples",      label: "Couples Therapy",     duration: 90, price: 600, description: "Therapy for couples" },
  { id: "coaching",     label: "Life Coaching",       duration: 60, price: 350, description: "Goal-focused coaching session" },
  { id: "workplace",    label: "Workplace Wellness",  duration: 60, price: 500, description: "Workplace mental health support" },
  { id: "consultation", label: "Free Consultation",   duration: 15, price: 0,   description: "Initial 15-minute consultation" },
];

const TIME_SLOTS = [
  "9:00 AM","9:30 AM","10:00 AM","10:30 AM",
  "11:00 AM","11:30 AM","2:00 PM","2:30 PM",
  "3:00 PM","3:30 PM","4:00 PM","4:30 PM",
];

// ── Hooks ──────────────────────────────────────────────────────────────────

// Fetch already-booked appointments for a date as minute-intervals [start,end)
// so we can block any candidate slot that overlaps (duration-aware).
function useBookedIntervals(doctorId: string, date: string) {
  const [intervals, setIntervals] = useState<{ start: number; end: number }[]>([]);
  useEffect(() => {
    if (!doctorId || !date) { setIntervals([]); return; }
    (async () => {
      const snap = await getDocs(
        query(
          collection(db, "appointments"),
          where("doctorId", "==", doctorId),
          where("date",     "==", date),
          where("status",   "in", ["pending","approved"]),
        )
      );
      setIntervals(snap.docs.map(d => {
        const a = d.data() as any;
        const start = labelToMinutes(a.time || "");
        const dur   = Number(a.duration) || 60;
        return { start, end: start + dur };
      }));
    })();
  }, [doctorId, date]);
  return intervals;
}

// Load the doctor's saved availability schedule (schedules/{doctorId})
function useDoctorSchedule(doctorId: string) {
  const [schedule, setSchedule] = useState<AvailabilitySchedule | null>(null);
  useEffect(() => {
    if (!doctorId) { setSchedule(null); return; }
    (async () => {
      try {
        const snap = await getDoc(doc(db, "schedules", doctorId));
        setSchedule(snap.exists() ? (snap.data() as AvailabilitySchedule) : null);
      } catch {
        setSchedule(null); // fall back to default slots
      }
    })();
  }, [doctorId]);
  return schedule;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtDate(dateStr: string) {
  try {
    return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });
  } catch { return dateStr; }
}

// ── Confirm dialog (avoids window.confirm which is blocked in some browsers) ─
function ConfirmDialog({
  message, onConfirm, onCancel, loading,
}: {
  message: string; onConfirm: () => void; onCancel: () => void; loading?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-sm rounded-2xl p-6"
        style={{ background: "white", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4"
          style={{ background: "rgba(247,148,29,0.1)" }}>
          <AlertTriangle size={22} style={{ color: "#F7941D" }} />
        </div>
        <p className="text-sm text-center mb-5" style={{ color: "#22272B" }}>{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold border"
            style={{ borderColor: "rgba(42,74,26,0.15)", color: "#4A5568" }}>
            Keep it
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ background: "#F7941D" }}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
            Cancel Session
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Status badge ───────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: Appointment["status"] }) {
  const styles: Record<string, { bg: string; color: string; label: string; Icon: any }> = {
    pending:   { bg: "rgba(247,148,29,0.12)",  color: "#C4700A", label: "Pending Review", Icon: Clock },
    approved:  { bg: "rgba(141,198,63,0.12)",  color: "#6BA028", label: "Confirmed",      Icon: CheckCircle },
    rejected:  { bg: "rgba(247,148,29,0.12)",   color: "#F7941D", label: "Declined",       Icon: XCircle },
    completed: { bg: "rgba(42,74,26,0.08)",    color: "#2A4A1A", label: "Completed",      Icon: CheckCircle },
    cancelled: { bg: "rgba(138,155,168,0.12)", color: "#8A9BA8", label: "Cancelled",      Icon: XCircle },
  };
  const s = styles[status] ?? styles.pending;
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ background: s.bg, color: s.color }}>
      <s.Icon size={11} />{s.label}
    </span>
  );
}

// ── Appointment card ───────────────────────────────────────────────────────
// FIX 5: Shows Meet link for approved sessions
// FIX 6: Cancel button for pending/approved sessions
function AppointmentCard({
  appt, onCancel,
}: {
  appt: Appointment;
  onCancel?: (appt: Appointment) => void;
}) {
  const canCancel  = ["pending","approved"].includes(appt.status);
  const showJoin   = appt.status === "approved" && (appt as any).meetLink;
  const meetLink   = (appt as any).meetLink as string | undefined;

  return (
    <div className="rounded-2xl p-5 transition-all"
      style={{ background: "white", boxShadow: "0 1px 3px rgba(42,74,26,0.06)" }}>
      <div className="flex items-start gap-4">
        {/* Date badge */}
        <div className="w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0"
          style={{ background: showJoin ? "rgba(141,198,63,0.12)" : "rgba(42,74,26,0.06)" }}>
          <span className="text-xs font-bold" style={{ color: showJoin ? "#6BA028" : "#2A4A1A" }}>
            {new Date(appt.date + "T12:00:00").toLocaleDateString("en-US", { month: "short" })}
          </span>
          <span className="text-lg font-bold leading-none" style={{ color: showJoin ? "#6BA028" : "#2A4A1A" }}>
            {new Date(appt.date + "T12:00:00").getDate()}
          </span>
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="font-semibold text-sm" style={{ color: "#2A4A1A" }}>{appt.type}</p>
            <StatusBadge status={appt.status} />
          </div>
          <p className="text-xs mb-2" style={{ color: "#8A9BA8" }}>{appt.doctorName ?? "Your therapist"}</p>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1 text-xs" style={{ color: "#4A5568" }}>
              <Clock size={11} />{appt.time}
            </span>
            <span className="flex items-center gap-1 text-xs" style={{ color: "#4A5568" }}>
              <Video size={11} />{appt.duration} min
            </span>
          </div>
          {appt.notes && (
            <p className="text-xs mt-2 italic" style={{ color: "#8A9BA8" }}>{appt.notes}</p>
          )}
        </div>
      </div>

      {/* FIX 5: Action row for approved sessions with Meet link */}
      {(showJoin || canCancel) && (
        <div className="flex items-center gap-2 mt-4 pt-4 border-t"
          style={{ borderColor: "rgba(42,74,26,0.06)" }}>
          {showJoin && (
            <a href={meetLink} target="_blank" rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:-translate-y-0.5"
              style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)" }}>
              <ExternalLink size={14} /> Join Google Meet
            </a>
          )}
          {/* FIX 6: Cancel button */}
          {canCancel && onCancel && (
            <button
              onClick={() => onCancel(appt)}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors hover:bg-red-50"
              style={{ color: "#F7941D", border: "1px solid rgba(247,148,29,0.2)" }}>
              <Ban size={13} /> Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Mini calendar ──────────────────────────────────────────────────────────
// FIX 7: today computed via useRef (stable, no hydration mismatch)
function MiniCalendar({ selected, onSelect }: { selected: string; onSelect: (d: string) => void }) {
  // FIX 7: Stable reference — won't cause hydration mismatch
  const todayRef = useRef<Date | null>(null);
  if (!todayRef.current) {
    const t = new Date(); t.setHours(0,0,0,0);
    todayRef.current = t;
  }
  const today = todayRef.current;

  const [viewDate, setViewDate] = useState<Date | null>(null);
  // Initialise viewDate in useEffect to avoid SSR mismatch
  useEffect(() => { setViewDate(new Date()); }, []);

  if (!viewDate) return (
    <div className="rounded-2xl p-4 h-48 flex items-center justify-center"
      style={{ background: "white", boxShadow: "0 1px 3px rgba(42,74,26,0.06)" }}>
      <Loader2 size={20} className="animate-spin" style={{ color: "#8DC63F" }} />
    </div>
  );

  const year = viewDate.getFullYear(), month = viewDate.getMonth();
  const cells: (number | null)[] = [];
  for (let i = 0; i < new Date(year, month, 1).getDay(); i++) cells.push(null);
  for (let d = 1; d <= new Date(year, month + 1, 0).getDate(); d++) cells.push(d);

  return (
    <div className="rounded-2xl p-4"
      style={{ background: "white", boxShadow: "0 1px 3px rgba(42,74,26,0.06)" }}>
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setViewDate(new Date(year, month - 1, 1))}
          className="p-1 rounded-lg hover:bg-black/5">
          <ChevronLeft size={16} style={{ color: "#4A5568" }} />
        </button>
        <span className="text-sm font-semibold" style={{ color: "#2A4A1A" }}>
          {viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </span>
        <button onClick={() => setViewDate(new Date(year, month + 1, 1))}
          className="p-1 rounded-lg hover:bg-black/5">
          <ChevronRight size={16} style={{ color: "#4A5568" }} />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
          <div key={d} className="text-center text-xs font-medium py-1" style={{ color: "#8A9BA8" }}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} />;
          const dateStr = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
          const d       = new Date(year, month, day);
          const isWeekend  = d.getDay() === 0 || d.getDay() === 6;
          const isPast     = d < today;
          const disabled   = isPast || isWeekend;
          const isSelected = dateStr === selected;
          const isToday    = d.getTime() === today.getTime();
          return (
            <button key={day} disabled={disabled} onClick={() => onSelect(dateStr)}
              className="aspect-square flex items-center justify-center text-xs rounded-lg transition-all relative"
              style={{
                background: isSelected ? "#2A4A1A" : "transparent",
                color:      isSelected ? "white" : disabled ? "#C4C4C4" : "#22272B",
                cursor:     disabled ? "not-allowed" : "pointer",
                fontWeight: isSelected || isToday ? 700 : 400,
                outline:    isToday && !isSelected ? "2px solid rgba(141,198,63,0.5)" : "none",
              }}>
              {day}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-center mt-3" style={{ color: "#8A9BA8" }}>
        Mon – Fri only · Weekends unavailable
      </p>
    </div>
  );
}

// ── FILTER TABS ────────────────────────────────────────────────────────────
// SUGGESTION: Filter tabs for better usability as sessions accumulate
type FilterTab = "all" | "upcoming" | "past" | "cancelled";

function FilterTabs({ active, onChange, counts }: {
  active: FilterTab;
  onChange: (t: FilterTab) => void;
  counts: Record<FilterTab, number>;
}) {
  const tabs: { id: FilterTab; label: string }[] = [
    { id: "all",       label: "All" },
    { id: "upcoming",  label: "Upcoming" },
    { id: "past",      label: "Past" },
    { id: "cancelled", label: "Cancelled" },
  ];
  return (
    <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: "rgba(42,74,26,0.06)" }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={{
            background: active === t.id ? "white" : "transparent",
            color:      active === t.id ? "#2A4A1A" : "#8A9BA8",
            boxShadow:  active === t.id ? "0 1px 3px rgba(42,74,26,0.1)" : "none",
          }}>
          {t.label}
          {counts[t.id] > 0 && (
            <span className="rounded-full w-4 h-4 flex items-center justify-center text-[10px]"
              style={{
                background: active === t.id ? "rgba(42,74,26,0.1)" : "rgba(42,74,26,0.06)",
                color: "#2A4A1A",
              }}>
              {counts[t.id]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
function ClientAppointmentsPageInner() {
  const { user }                  = useAuth();
  const { appointments, loading } = useClientAppointments();
  const searchParams              = useSearchParams();
  const router                    = useRouter();

  // Multi-doctor: book with THIS client's assigned doctor (not the first one).
  const { doctor, loading: doctorLoading } = useAssignedDoctor();
  const doctorId   = doctor?.doctorId ?? "";
  const doctorName = doctor?.doctorName ?? "your therapist";

  const [showBooking, setShowBooking]   = useState(false);
  const [step, setStep]                 = useState<1|2|3|4>(1);
  const [selectedType, setSelectedType] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [notes, setNotes]               = useState("");
  const [submitting, setSubmitting]     = useState(false);
  const [redirecting, setRedirecting]   = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [toast, setToast]               = useState<{ type: "success"|"error"; msg: string } | null>(null);
  const [filter, setFilter]             = useState<FilterTab>("all");
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [cancelling, setCancelling]     = useState(false);

  // Already-booked intervals for the selected date (for duration-aware blocking)
  const bookedIntervals = useBookedIntervals(doctorId, selectedDate);

  // The doctor's saved schedule + the services they offer (active only).
  // Falls back to the platform defaults if they haven't configured anything.
  const schedule = useDoctorSchedule(doctorId);
  const services = useMemo(() => bookableServices(schedule), [schedule]);
  const selectedService  = services.find(s => s.id === selectedType);
  const selectedPrice    = selectedService?.price ?? 0;
  const selectedDuration = selectedService?.duration ?? 60;

  const daySlots = useMemo(() => {
    if (!selectedDate) return [] as string[];
    if (schedule) return availableSlotsForDate(schedule, selectedDate, selectedDuration);
    return TIME_SLOTS;
  }, [schedule, selectedDate, selectedDuration]);

  // Layer 2: Google Calendar free/busy. Fails safe — on any error the list is
  // empty and booking proceeds on platform availability alone.
  const [busySlots, setBusySlots] = useState<string[]>([]);
  useEffect(() => {
    if (!selectedDate || daySlots.length === 0) { setBusySlots([]); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await authedFetch("/api/calendar/freebusy", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            date:     selectedDate,
            slots:    daySlots,
            duration: selectedService?.duration ?? 60,
            timezone: schedule?.timezone,
            doctorId,
          }),
        });
        const data = await res.json();
        if (!cancelled) setBusySlots(Array.isArray(data?.busy) ? data.busy : []);
      } catch {
        if (!cancelled) setBusySlots([]);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedDate, daySlots, selectedService?.duration, schedule?.timezone]);

  // FIX 2: Toast auto-dismiss — effect depends on toast object, dismisses on its own timer
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  // Handle return from WiPay
  useEffect(() => {
    const success = searchParams.get("success");
    const err     = searchParams.get("error");
    const free    = searchParams.get("free");

    if (success) {
      setToast({
        type: "success",
        msg: free
          ? `Free consultation booked! ${doctorName} will confirm shortly.`
          : "Payment successful! Your session is confirmed.",
      });
    } else if (err === "payment_failed") {
      setToast({ type: "error", msg: "Payment was not completed. Please try again." });
    } else if (err) {
      setToast({ type: "error", msg: "Something went wrong. Please try again." });
    }
  }, [searchParams]);

  function resetBooking() {
    setStep(1); setSelectedType(""); setSelectedDate(""); setSelectedTime("");
    setNotes(""); setError(null); setRedirecting(false); setShowBooking(false);
  }

  // Multi-doctor gate: a client must be matched to a doctor before booking.
  function startBooking() {
    if (!doctor) { router.push("/onboarding/match"); return; }
    setShowBooking(true); setStep(1);
  }

  // FIX 6: Cancel an appointment
  async function handleCancelConfirm() {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await updateDoc(doc(db, "appointments", cancelTarget.id), {
        status:      "cancelled",
        cancelledAt: serverTimestamp(),
        cancelledBy: "client",
      });
      // Notify the doctor (fire-and-forget)
      authedFetch("/api/email/appointment", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ appointmentId: cancelTarget.id, event: "cancelled", cancelledBy: "client" }),
      }).catch(() => {});
      setToast({ type: "success", msg: "Session cancelled successfully." });
    } catch {
      setToast({ type: "error", msg: "Failed to cancel. Please try again." });
    } finally {
      setCancelling(false);
      setCancelTarget(null);
    }
  }

    async function handleSubmit() {
    if (!user || !selectedType || !selectedDate || !selectedTime) return;
    if (!doctorId) {
      setError(`Unable to reach ${doctorName}'s profile. Please refresh and try again.`);
      return;
    }
    setSubmitting(true); setError(null);

    try {
      const appointmentId = await bookAppointment({
        clientId:    user.uid,
        clientName:  user.displayName ?? "Client",
        clientEmail: user.email ?? "",
        doctorId,
        doctorName:  doctor?.doctorName ?? "",
        type:        selectedService?.name ?? selectedType,
        date:        selectedDate,
        time:        selectedTime,
        duration:    selectedService?.duration ?? 60,
        amount:      selectedPrice,
        ...(notes ? { notes } : {}),
      });

      // Notify by email (fire-and-forget — never block booking on email)
      authedFetch("/api/email/appointment", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ appointmentId, event: "requested" }),
      }).catch(() => {});

      // Free consultation — skip payment
      if (selectedPrice === 0) {
        setSubmitting(false);
        resetBooking();
        setToast({ type: "success", msg: `Free consultation booked! ${doctorName} will confirm shortly.` });
        return;
      }

      // Paid session — get WiPay form params from server
      setStep(4);
      setSubmitting(false);
      setRedirecting(true);

      const res  = await authedFetch("/api/payments/initiate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          appointmentId,
          clientId:    user.uid,
          clientName:  user.displayName ?? "Client",
          clientEmail: user.email ?? "",
          sessionType: selectedService?.name,
        }),
      });
const data = await res.json();

if (!res.ok || data.error) {
  setError(data.error ?? "Could not initiate payment. Please try again.");
  setRedirecting(false);
  return;
}

if (data.free && data.redirect) {
  window.location.href = data.redirect;
  return;
}

if (data.formAction && data.formFields) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = data.formAction;
  Object.entries(data.formFields as Record<string, string>).forEach(([key, value]) => {
    const input = document.createElement("input");
    input.type  = "hidden";
    input.name  = key;
    input.value = value;
    form.appendChild(input);
  });
  document.body.appendChild(form);
  form.submit();
  return;
}
setError("Could not initiate payment. Please try again.");
setRedirecting(false);

    } catch (err) {
      console.error("Booking error:", err);
      setError("Failed to book appointment. Please try again.");
      setSubmitting(false);
      setRedirecting(false);
    }
  }

  // ── Filtered appointments ─────────────────────────────────────────────
  const todayStr = typeof window !== "undefined" ? new Date().toISOString().split("T")[0] : "";

  const filtered = appointments.filter(a => {
    if (filter === "upcoming")  return ["pending","approved"].includes(a.status);
    if (filter === "past")      return ["completed","rejected"].includes(a.status);
    if (filter === "cancelled") return a.status === "cancelled";
    return true;
  });

  const counts: Record<FilterTab, number> = {
    all:       appointments.length,
    upcoming:  appointments.filter(a => ["pending","approved"].includes(a.status)).length,
    past:      appointments.filter(a => ["completed","rejected"].includes(a.status)).length,
    cancelled: appointments.filter(a => a.status === "cancelled").length,
  };

  // ── Upcoming for the top section ──────────────────────────────────────
  const upcoming = appointments.filter(a => ["pending","approved"].includes(a.status));
  const past     = appointments.filter(a => ["completed","rejected","cancelled"].includes(a.status));

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Confirm cancel dialog */}
      {cancelTarget && (
        <ConfirmDialog
          message={`Cancel your ${cancelTarget.type} session on ${cancelTarget.date} at ${cancelTarget.time}? This cannot be undone.`}
          onConfirm={handleCancelConfirm}
          onCancel={() => setCancelTarget(null)}
          loading={cancelling}
        />
      )}

      {/* FIX 2: Toast — auto-dismisses correctly */}
      {toast && (
        <div
          className="fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-lg text-sm font-medium max-w-sm"
          style={{ background: toast.type === "success" ? "#2A4A1A" : "#F7941D", color: "white" }}>
          {toast.type === "success" ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl" style={{ fontFamily: "var(--font-dm-serif)", color: "#2A4A1A" }}>
            Appointments
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "#8A9BA8" }}>
            Manage your sessions with {doctorName}
          </p>
        </div>
        <button
          onClick={startBooking}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:-translate-y-0.5"
          style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)" }}>
          <Plus size={16} /> Book Session
        </button>
      </div>

      {/* Not-yet-matched notice — booking requires an assigned doctor */}
      {!doctorLoading && !doctor && (
        <div className="rounded-2xl p-4 flex items-start gap-3"
          style={{ background: "rgba(247,148,29,0.06)", border: "1px solid rgba(247,148,29,0.2)" }}>
          <AlertTriangle size={18} style={{ color: "#C4700A", flexShrink: 0, marginTop: 1 }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: "#2A4A1A" }}>You haven&apos;t been matched with a therapist yet</p>
            <p className="text-xs mt-0.5" style={{ color: "#8A9BA8" }}>Get matched first, then you can book sessions with your therapist.</p>
          </div>
          <button onClick={() => router.push("/onboarding/match")}
            className="px-3 py-2 rounded-xl text-xs font-semibold text-white flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #F7941D, #C4700A)" }}>
            Get matched
          </button>
        </div>
      )}

      {/* SUGGESTION: Filter tabs */}
      <FilterTabs active={filter} onChange={setFilter} counts={counts} />

      {/* Sessions list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={28} className="animate-spin" style={{ color: "#8DC63F" }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl p-10 text-center"
          style={{ background: "white", boxShadow: "0 1px 3px rgba(42,74,26,0.06)" }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
            style={{ background: "rgba(141,198,63,0.08)" }}>
            <Calendar size={24} style={{ color: "#8DC63F" }} />
          </div>
          <p className="text-sm font-medium mb-1" style={{ color: "#2A4A1A" }}>
            {filter === "all" ? "No sessions yet" : `No ${filter} sessions`}
          </p>
          <p className="text-xs mb-4" style={{ color: "#8A9BA8" }}>
            {filter === "all" || filter === "upcoming"
              ? "Book your first session to get started."
              : "Nothing here yet."}
          </p>
          {(filter === "all" || filter === "upcoming") && (
            <button onClick={startBooking}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)" }}>
              <Plus size={14} /> Book Session
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(a => (
            <AppointmentCard
              key={a.id}
              appt={a}
              onCancel={["pending","approved"].includes(a.status) ? setCancelTarget : undefined}
            />
          ))}
        </div>
      )}

      {/* ── BOOKING MODAL ── */}
      {showBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-2xl rounded-3xl overflow-hidden"
            style={{ background: "#F6FAF0", maxHeight: "90vh", overflowY: "auto" }}>

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-5 border-b"
              style={{ borderColor: "rgba(42,74,26,0.08)" }}>
              <div>
                <h3 className="text-xl" style={{ fontFamily: "var(--font-dm-serif)", color: "#2A4A1A" }}>
                  {step === 4 ? "Processing Payment…" : "Book a Session"}
                </h3>
                {step !== 4 && (
                  <div className="flex items-center gap-2 mt-2">
                    {[1,2,3].map(s => (
                      <div key={s} className="flex items-center gap-1">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                          style={{
                            background: step >= s ? "#2A4A1A" : "rgba(42,74,26,0.1)",
                            color:      step >= s ? "white" : "#8A9BA8",
                          }}>
                          {step > s ? "✓" : s}
                        </div>
                        {s < 3 && (
                          <div className="w-6 h-0.5 rounded"
                            style={{ background: step > s ? "#2A4A1A" : "rgba(42,74,26,0.1)" }} />
                        )}
                      </div>
                    ))}
                    <span className="text-xs ml-1" style={{ color: "#8A9BA8" }}>
                      {step === 1 ? "Choose session type" : step === 2 ? "Pick date & time" : "Review & confirm"}
                    </span>
                  </div>
                )}
              </div>
              {step !== 4 && (
                <button onClick={resetBooking} className="p-2 rounded-lg hover:bg-black/5">
                  <X size={18} style={{ color: "#4A5568" }} />
                </button>
              )}
            </div>

            <div className="p-6">

              {/* Step 4 — Payment redirect */}
              {step === 4 && (
                <div className="text-center py-10">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                    style={{ background: "rgba(42,74,26,0.06)" }}>
                    {redirecting
                      ? <Loader2 size={28} className="animate-spin" style={{ color: "#2A4A1A" }} />
                      : <CreditCard size={28} style={{ color: "#2A4A1A" }} />}
                  </div>
                  <h4 className="text-xl mb-2" style={{ fontFamily: "var(--font-dm-serif)", color: "#2A4A1A" }}>
                    {redirecting ? "Redirecting to payment…" : "Ready to pay"}
                  </h4>
                  <p className="text-sm mb-1" style={{ color: "#4A5568" }}>
                    You will be securely redirected to WiPay to complete payment of{" "}
                    {/* FIX 4: USD throughout */}
                    <strong>USD ${selectedPrice}</strong>.
                  </p>
                  <p className="text-xs flex items-center justify-center gap-1 mt-4"
                    style={{ color: "#8A9BA8" }}>
                    <Lock size={11} /> Secured by WiPay · SSL encrypted
                  </p>
                  {error && (
                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm mt-4"
                      style={{ background: "rgba(247,148,29,0.08)", color: "#F7941D" }}>
                      <AlertCircle size={15} />{error}
                    </div>
                  )}
                </div>
              )}

              {/* Step 1 — Session type */}
              {step === 1 && (
                <div className="space-y-3">
                  {services.map(service => (
                    <button key={service.id} onClick={() => setSelectedType(service.id)}
                      className="w-full text-left p-4 rounded-xl border-2 transition-all"
                      style={{
                        borderColor: selectedType === service.id ? "#2A4A1A" : "rgba(42,74,26,0.1)",
                        background:  selectedType === service.id ? "rgba(42,74,26,0.04)" : "white",
                      }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold" style={{ color: "#2A4A1A" }}>{service.name}</p>
                          <p className="text-xs mt-0.5" style={{ color: "#8A9BA8" }}>{service.description ? `${service.description} · ` : ""}{service.duration} min</p>
                        </div>
                        <div className="text-right flex-shrink-0 ml-4">
                          <p className="text-sm font-bold" style={{ color: "#2A4A1A" }}>
                            {service.price === 0 ? "Free" : `USD $${service.price}`}
                          </p>
                          {service.price === 0 && (
                            <p className="text-xs" style={{ color: "#8DC63F" }}>No payment needed</p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                  <button disabled={!selectedType} onClick={() => setStep(2)}
                    className="w-full py-3 rounded-xl text-sm font-semibold text-white mt-2 disabled:opacity-40"
                    style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)" }}>
                    Continue
                  </button>
                </div>
              )}

              {/* Step 2 — Date & time */}
              {step === 2 && (
                <div className="space-y-4">
                  <MiniCalendar selected={selectedDate} onSelect={d => {
                    setSelectedDate(d);
                    setSelectedTime(""); // reset time when date changes
                  }} />

                  {selectedDate && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-2"
                        style={{ color: "#8A9BA8" }}>
                        Available times —{" "}
                        {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                      </p>
                      {daySlots.length === 0 ? (
                        <div className="rounded-xl p-4 text-center text-xs"
                          style={{ background: "rgba(247,148,29,0.06)", color: "#C4700A", border: "1px solid rgba(247,148,29,0.15)" }}>
                          {doctorName} isn&apos;t available on this day. Please choose another date.
                        </div>
                      ) : (
                        <div className="grid grid-cols-4 gap-2">
                          {daySlots.map(time => {
                            // Grey out slots already booked on the platform OR busy on Google Calendar
                            const isBooked = overlapsAny(labelToMinutes(time), selectedDuration, bookedIntervals) || busySlots.includes(time);
                            const isSel    = selectedTime === time;
                            return (
                              <button key={time} onClick={() => !isBooked && setSelectedTime(time)}
                                disabled={isBooked}
                                className="py-2 rounded-lg text-xs font-medium border-2 transition-all relative"
                                style={{
                                  borderColor: isSel ? "#2A4A1A" : isBooked ? "rgba(42,74,26,0.06)" : "rgba(42,74,26,0.12)",
                                  background:  isSel ? "#2A4A1A" : isBooked ? "rgba(42,74,26,0.03)" : "white",
                                  color:       isSel ? "white" : isBooked ? "#C4C4C4" : "#22272B",
                                  cursor:      isBooked ? "not-allowed" : "pointer",
                                  textDecoration: isBooked ? "line-through" : "none",
                                }}>
                                {time}
                                {isBooked && (
                                  <span className="block text-[9px] mt-0.5" style={{ color: "#C4C4C4" }}>Booked</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button onClick={() => setStep(1)}
                      className="flex-1 py-3 rounded-xl text-sm font-semibold border-2"
                      style={{ borderColor: "rgba(42,74,26,0.15)", color: "#2A4A1A" }}>
                      Back
                    </button>
                    <button disabled={!selectedDate || !selectedTime} onClick={() => setStep(3)}
                      className="flex-1 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
                      style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)" }}>
                      Continue
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3 — Review & confirm */}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="rounded-2xl p-5 space-y-3"
                    style={{ background: "white", border: "1px solid rgba(42,74,26,0.08)" }}>
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#8A9BA8" }}>
                      Booking Summary
                    </p>
                    {[
                      { label: "Session",  value: selectedService?.name ?? "" },
                      { label: "Therapist",value: doctorName },
                      { label: "Date",     value: fmtDate(selectedDate) },
                      { label: "Time",     value: selectedTime },
                      { label: "Duration", value: `${selectedService?.duration} minutes` },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between py-2 border-b last:border-0"
                        style={{ borderColor: "rgba(42,74,26,0.06)" }}>
                        <span className="text-xs" style={{ color: "#8A9BA8" }}>{label}</span>
                        <span className="text-sm font-medium" style={{ color: "#2A4A1A" }}>{value}</span>
                      </div>
                    ))}
                    {/* FIX 4: USD currency */}
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-sm font-bold" style={{ color: "#2A4A1A" }}>Total</span>
                      <span className="text-lg font-bold" style={{ color: "#2A4A1A" }}>
                        {selectedService?.price === 0 ? "Free" : `USD $${selectedService?.price}`}
                      </span>
                    </div>
                  </div>

                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                    placeholder={`Anything ${doctorName} should know before your session (optional)…`}
                    className="w-full px-4 py-3 rounded-xl text-sm border resize-none focus:outline-none"
                    style={{ borderColor: "rgba(42,74,26,0.15)", background: "white" }} />

                  {/* FIX 3 + 4: Payment notice only shown for paid sessions */}
                  {selectedService && selectedService.price > 0 && (
                    <div className="flex items-start gap-3 p-4 rounded-xl"
                      style={{ background: "rgba(141,198,63,0.06)", border: "1px solid rgba(141,198,63,0.2)" }}>
                      <Lock size={14} className="flex-shrink-0 mt-0.5" style={{ color: "#8DC63F" }} />
                      <p className="text-xs" style={{ color: "#4A5568" }}>
                        You will be redirected to <strong>WiPay</strong> to securely complete your payment of{" "}
                        <strong>USD ${selectedService.price}</strong>. Your session will be confirmed upon payment.
                      </p>
                    </div>
                  )}

                  {/* Free session info box */}
                  {selectedService?.price === 0 && (
                    <div className="flex items-start gap-3 p-4 rounded-xl"
                      style={{ background: "rgba(141,198,63,0.06)", border: "1px solid rgba(141,198,63,0.2)" }}>
                      <CheckCircle size={14} className="flex-shrink-0 mt-0.5" style={{ color: "#8DC63F" }} />
                      <p className="text-xs" style={{ color: "#4A5568" }}>
                        No payment required. Dr. Miller will review and confirm your free consultation shortly.
                      </p>
                    </div>
                  )}

                  {error && (
                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
                      style={{ background: "rgba(247,148,29,0.08)", color: "#F7941D" }}>
                      <AlertCircle size={15} />{error}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button onClick={() => setStep(2)}
                      className="flex-1 py-3 rounded-xl text-sm font-semibold border-2"
                      style={{ borderColor: "rgba(42,74,26,0.15)", color: "#2A4A1A" }}>
                      Back
                    </button>
                    <button disabled={submitting || !doctorId} onClick={handleSubmit}
                      className="flex-1 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60 flex items-center justify-center gap-2"
                      style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)" }}>
                      {submitting
                        ? <><Loader2 size={15} className="animate-spin" /> Processing…</>
                        : selectedService?.price === 0
                          ? <><CheckCircle size={15} /> Confirm Booking</>
                          : <><CreditCard size={15} /> Pay USD ${selectedService?.price}</>}
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Suspense wrapper ────────────────────────────────────────────────────────
export default function ClientAppointmentsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-24">
        <Loader2 size={28} className="animate-spin" style={{ color: "#8DC63F" }} />
      </div>
    }>
      <ClientAppointmentsPageInner />
    </Suspense>
  );
}
