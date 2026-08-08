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
  sortAppointmentsBySession,
  sortClientAppointmentFeed,
  localTodayStr,
  type Appointment,
} from "@/hooks/useAppointments";
import {
  PAYMENT_BADGE,
  resolvePaymentStatus,
  isDoctorApproved,
  REVIEW_HOLD_HOURS,
  PAYMENT_HOLD_HOURS,
} from "@/lib/paymentStatus";
import {
  collection, query, where, getDocs, getDoc, onSnapshot,
  doc, updateDoc, serverTimestamp,
} from "firebase/firestore";
import {
  availableSlotsForDate,
  bookableServices,
  isDateBookable,
  isUsableSchedule,
  labelToMinutes,
  overlapsAny,
  type AvailabilitySchedule,
} from "@/lib/availability";
import {
  SERIES_DEFAULT,
  SERIES_MAX,
  SERIES_MIN,
  expandWeeklyDates,
  evaluateSeriesOccurrence,
  seriesChipLabel,
  type SeriesOccurrence,
} from "@/lib/series";
import { isConsentCurrent } from "@/lib/consent";
import MeetJoinPanel from "@/components/MeetJoinPanel";
import { joinPhaseMessage, useCanJoinSession, useJoinPhase } from "@/lib/joinWindow";
import {
  Calendar, Clock, Plus, X, CheckCircle, AlertCircle,
  XCircle, Loader2, ChevronLeft, ChevronRight, Video,
  CreditCard, Lock, ExternalLink, Ban, AlertTriangle, Repeat,
} from "lucide-react";
export const dynamic = "force-dynamic";

// ── Config ─────────────────────────────────────────────────────────────────

// Legacy fallback when the doctor has not saved weekly hours yet.
const TIME_SLOTS = [
  "9:00 AM","9:30 AM","10:00 AM","10:30 AM",
  "11:00 AM","11:30 AM","2:00 PM","2:30 PM",
  "3:00 PM","3:30 PM","4:00 PM","4:30 PM",
];

// ── Hooks ──────────────────────────────────────────────────────────────────

// Live booked intervals for a date (duration-aware overlap blocking).
function useBookedIntervals(doctorId: string, date: string) {
  const [intervals, setIntervals] = useState<{ start: number; end: number }[]>([]);
  useEffect(() => {
    if (!doctorId || !date) { setIntervals([]); return; }
    const q = query(
      collection(db, "appointments"),
      where("doctorId", "==", doctorId),
      where("date",     "==", date),
      where("status",   "in", ["pending","approved"]),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setIntervals(snap.docs.map(d => {
          const a = d.data() as any;
          const start = labelToMinutes(a.time || "");
          const dur   = Number(a.duration) || 60;
          return { start, end: start + dur };
        }));
      },
      () => setIntervals([]),
    );
    return () => unsub();
  }, [doctorId, date]);
  return intervals;
}

// Live doctor's schedule — ignores Google-only stubs with no weekly hours.
function useDoctorSchedule(doctorId: string) {
  const [schedule, setSchedule] = useState<AvailabilitySchedule | null>(null);
  useEffect(() => {
    if (!doctorId) { setSchedule(null); return; }
    const unsub = onSnapshot(
      doc(db, "schedules", doctorId),
      (snap) => {
        if (!snap.exists()) { setSchedule(null); return; }
        const data = snap.data();
        setSchedule(isUsableSchedule(data) ? (data as AvailabilitySchedule) : null);
      },
      () => setSchedule(null),
    );
    return () => unsub();
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
function StatusBadge({ status, cancelledReason, paymentStatus, doctorApproved }: {
  status: Appointment["status"];
  cancelledReason?: string;
  paymentStatus?: Appointment["paymentStatus"];
  doctorApproved?: boolean;
}) {
  const styles: Record<string, { bg: string; color: string; label: string; Icon: any }> = {
    pending:   { bg: "rgba(247,148,29,0.12)",  color: "#C4700A", label: "Pending Review", Icon: Clock },
    approved:  { bg: "rgba(141,198,63,0.12)",  color: "#6BA028", label: "Confirmed",      Icon: CheckCircle },
    rejected:  { bg: "rgba(247,148,29,0.12)",   color: "#F7941D", label: "Declined",       Icon: XCircle },
    completed: { bg: "rgba(42,74,26,0.08)",    color: "#2A4A1A", label: "Completed",      Icon: CheckCircle },
    cancelled: { bg: "rgba(138,155,168,0.12)", color: "#8A9BA8", label: "Cancelled",      Icon: XCircle },
    payment_failed: { bg: "rgba(247,148,29,0.12)", color: "#C4700A", label: "Payment failed", Icon: XCircle },
  };
  let s = styles[status] ?? styles.pending;
  if (status === "pending" && paymentStatus === "unpaid" && doctorApproved) {
    s = { bg: "rgba(247,148,29,0.12)", color: "#C4700A", label: "Awaiting payment", Icon: Clock };
  } else if (status === "pending" && paymentStatus === "unpaid" && !doctorApproved) {
    s = { bg: "rgba(247,148,29,0.12)", color: "#C4700A", label: "Awaiting approval", Icon: Clock };
  }
  if (status === "cancelled" && cancelledReason === "no_show") {
    s = { bg: "rgba(247,148,29,0.12)", color: "#C4700A", label: "No-show", Icon: Ban };
  } else if (status === "cancelled" && (cancelledReason === "payment_expired" || cancelledReason === "review_expired")) {
    s = { bg: "rgba(138,155,168,0.12)", color: "#8A9BA8", label: "Hold expired", Icon: XCircle };
  } else if (status === "cancelled" && cancelledReason === "payment_failed") {
    s = { bg: "rgba(247,148,29,0.12)", color: "#C4700A", label: "Payment failed", Icon: XCircle };
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ background: s.bg, color: s.color }}>
      <s.Icon size={11} />{s.label}
    </span>
  );
}

function PaymentBadge({ appt }: { appt: Appointment }) {
  const ps = resolvePaymentStatus(appt);
  if (ps === "unknown") return null;
  // Don't show "Pay to confirm" until the therapist has accepted the time
  if (ps === "unpaid" && !isDoctorApproved(appt)) return null;
  const b = PAYMENT_BADGE[ps];
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ background: b.bg, color: b.color }}>
      {b.label}
    </span>
  );
}

// ── Appointment card ───────────────────────────────────────────────────────
// FIX 5: Shows Meet link for approved sessions
// FIX 6: Cancel button for pending/approved sessions
function AppointmentCard({
  appt, onCancel, onPay, payingId,
}: {
  appt: Appointment;
  onCancel?: (appt: Appointment) => void;
  onPay?: (appt: Appointment) => void;
  payingId?: string | null;
}) {
  const canCancel  = ["pending","approved"].includes(appt.status);
  const meetLink   = (appt as any).meetLink as string | undefined;
  const hasMeet    = Boolean(meetLink) && appt.status === "approved";
  // Clients may join in the session window (not days early / long after).
  const joinPhase  = useJoinPhase(appt);
  const showJoin   = useCanJoinSession(appt) && hasMeet;
  const joinHint   = hasMeet && !showJoin ? joinPhaseMessage(joinPhase) : null;
  const needsPay   = appt.status === "pending" && resolvePaymentStatus(appt) === "unpaid" && isDoctorApproved(appt);
  const awaitingTherapist = appt.status === "pending" && resolvePaymentStatus(appt) === "unpaid" && !isDoctorApproved(appt);
  const awaitingLink    = appt.status === "approved" && !meetLink;
  const paying = payingId === appt.id;

  return (
    <div className="rounded-2xl p-5 transition-all"
      style={{ background: "white", boxShadow: "0 1px 3px rgba(42,74,26,0.06)" }}>
      <div className="flex items-start gap-4">
        {/* Date badge */}
        <div className="w-12 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0"
          style={{ background: (showJoin || hasMeet) ? "rgba(141,198,63,0.12)" : "rgba(42,74,26,0.06)" }}>
          <span className="text-xs font-bold" style={{ color: (showJoin || hasMeet) ? "#6BA028" : "#2A4A1A" }}>
            {new Date(appt.date + "T12:00:00").toLocaleDateString("en-US", { month: "short" })}
          </span>
          <span className="text-lg font-bold leading-none" style={{ color: (showJoin || hasMeet) ? "#6BA028" : "#2A4A1A" }}>
            {new Date(appt.date + "T12:00:00").getDate()}
          </span>
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="font-semibold text-sm" style={{ color: "#2A4A1A" }}>{appt.type}</p>
            <div className="flex flex-col items-end gap-1">
              <StatusBadge
                status={appt.status}
                cancelledReason={appt.cancelledReason}
                paymentStatus={appt.paymentStatus}
                doctorApproved={isDoctorApproved(appt)}
              />
              <PaymentBadge appt={appt} />
            </div>
          </div>
          <p className="text-xs mb-2" style={{ color: "#8A9BA8" }}>{appt.doctorName ?? "Your therapist"}</p>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1 text-xs" style={{ color: "#4A5568" }}>
              <Clock size={11} />{appt.time}
            </span>
            <span className="flex items-center gap-1 text-xs" style={{ color: "#4A5568" }}>
              <Video size={11} />{appt.duration} min
            </span>
            {seriesChipLabel(appt.seriesIndex, appt.seriesCount) && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                style={{ background: "rgba(42,74,26,0.08)", color: "#2A4A1A" }}>
                <Repeat size={10} />
                {seriesChipLabel(appt.seriesIndex, appt.seriesCount)}
              </span>
            )}
          </div>
          {appt.notes && (
            <p className="text-xs mt-2 italic" style={{ color: "#8A9BA8" }}>{appt.notes}</p>
          )}
          {needsPay && (
            <p className="text-xs mt-2" style={{ color: "#C4700A" }}>
              {appt.initiatedBy === "doctor"
                ? `Your therapist scheduled this session. Pay within ${PAYMENT_HOLD_HOURS} hours (and before it starts) to confirm — then you can join.`
                : `Your therapist approved this time. Pay within ${PAYMENT_HOLD_HOURS} hours (and before the session) to confirm.`}
            </p>
          )}
          {awaitingTherapist && (
            <p className="text-xs mt-2" style={{ color: "#F7941D" }}>
              Awaiting therapist approval (within {REVIEW_HOLD_HOURS} hours). You&apos;ll pay after they accept this time.
            </p>
          )}
          {awaitingLink && (
            <p className="text-xs mt-2" style={{ color: "#F7941D" }}>
              Session confirmed — video link is being prepared. Refresh in a moment, or message your therapist.
            </p>
          )}
          {joinHint && (
            <p className="text-xs mt-2" style={{ color: "#8A9BA8" }}>
              {joinHint}
            </p>
          )}
        </div>
      </div>

      {(showJoin || canCancel || needsPay) && (
        <div className="mt-4 pt-4 border-t space-y-3"
          style={{ borderColor: "rgba(42,74,26,0.06)" }}>
          {needsPay && onPay && (
            <button
              onClick={() => onPay(appt)}
              disabled={paying}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:-translate-y-0.5 disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #F7941D, #C4700A)" }}>
              {paying ? <Loader2 size={14} className="animate-spin" /> : null}
              {paying ? "Opening checkout…" : `Pay $${appt.amount ?? "—"} & confirm`}
            </button>
          )}
          {showJoin && meetLink && <MeetJoinPanel meetLink={meetLink} />}
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
// Days follow the doctor's schedule (enabled days, blocked dates, max advance).
function MiniCalendar({ selected, onSelect, schedule }: {
  selected: string;
  onSelect: (d: string) => void;
  schedule: AvailabilitySchedule | null;
}) {
  const todayRef = useRef<Date | null>(null);
  if (!todayRef.current) {
    const t = new Date(); t.setHours(0,0,0,0);
    todayRef.current = t;
  }
  const today = todayRef.current;

  const [viewDate, setViewDate] = useState<Date | null>(null);
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

  const hint = schedule
    ? (Number(schedule.maxAdvanceDays) > 0
      ? `Tomorrow onward · up to ${schedule.maxAdvanceDays} days ahead`
      : "Tomorrow onward · based on your therapist's schedule")
    : "Tomorrow onward · Mon–Fri if schedule not set";

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
          const d        = new Date(year, month, day);
          const disabled = !isDateBookable(schedule, dateStr, today);
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
        {hint}
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
  const [filter, setFilter]             = useState<FilterTab>("upcoming");
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [cancelling, setCancelling]     = useState(false);
  const [payingId, setPayingId]         = useState<string | null>(null);
  const [repeatWeekly, setRepeatWeekly] = useState(false);
  const [seriesCount, setSeriesCount]   = useState(SERIES_DEFAULT);
  const [seriesPreview, setSeriesPreview] = useState<SeriesOccurrence[]>([]);
  const [seriesLoading, setSeriesLoading] = useState(false);

  // Already-booked intervals for the selected date (for duration-aware blocking)
  const bookedIntervals = useBookedIntervals(doctorId, selectedDate);

  // The doctor's saved schedule + the services they offer (active only).
  // Falls back to the platform defaults if they haven't configured anything.
  const schedule = useDoctorSchedule(doctorId);
  const services = useMemo(() => bookableServices(schedule), [schedule]);

  // Drop a selected day if the doctor's schedule no longer allows it.
  useEffect(() => {
    if (!selectedDate) return;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (!isDateBookable(schedule, selectedDate, today)) {
      setSelectedDate("");
      setSelectedTime("");
    }
  }, [schedule, selectedDate]);
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
  }, [selectedDate, daySlots, selectedService?.duration, schedule?.timezone, doctorId]);

  // FIX 2: Toast auto-dismiss — effect depends on toast object, dismisses on its own timer
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  // Handle return from payment gateway
  useEffect(() => {
    const success = searchParams.get("success");
    const err     = searchParams.get("error");
    const free    = searchParams.get("free");

    if (success) {
      setToast({
        type: "success",
        msg: free
          ? "Free consultation confirmed! Check Appointments for your session details."
          : "Payment successful! Your session is confirmed.",
      });
    } else if (err === "payment_failed") {
      setToast({ type: "error", msg: "Payment was not completed. Please try again." });
    } else if (err) {
      setToast({ type: "error", msg: "Something went wrong. Please try again." });
    }
  }, [searchParams]);

  // ?book=1 opens the booking modal (Quick Actions, header Book, deep links).
  // Open modal BEFORE clearing the query — replace used to cancel this effect mid-flight.
  useEffect(() => {
    if (searchParams.get("book") !== "1") return;
    if (doctorLoading) return;
    let cancelled = false;
    (async () => {
      if (!doctor) { router.push("/onboarding/match"); return; }
      if (!user) return;
      try {
        const cSnap = await getDoc(doc(db, "consents", user.uid));
        const version = cSnap.exists() ? (cSnap.data() as { version?: string }).version : null;
        if (!isConsentCurrent(version)) {
          router.push("/onboarding/consent?next=/client/appointments%3Fbook%3D1");
          return;
        }
      } catch {
        router.push("/onboarding/consent?next=/client/appointments%3Fbook%3D1");
        return;
      }
      if (cancelled) return;
      setShowBooking(true);
      setStep(1);
      router.replace("/client/appointments", { scroll: false });
    })();
    return () => { cancelled = true; };
  }, [searchParams, doctorLoading, doctor, user, router]);

  function resetBooking() {
    setStep(1); setSelectedType(""); setSelectedDate(""); setSelectedTime("");
    setNotes(""); setError(null); setRedirecting(false); setShowBooking(false);
    setRepeatWeekly(false); setSeriesCount(SERIES_DEFAULT);
    setSeriesPreview([]); setSeriesLoading(false);
  }

  async function buildSeriesPreview(): Promise<SeriesOccurrence[]> {
    if (!selectedDate || !selectedTime) return [];
    const dates = expandWeeklyDates(selectedDate, seriesCount);
    const results: SeriesOccurrence[] = [];
    for (const date of dates) {
      let booked: { start: number; end: number }[] = [];
      try {
        const snap = await getDocs(
          query(
            collection(db, "appointments"),
            where("doctorId", "==", doctorId),
            where("date", "==", date),
            where("status", "in", ["pending", "approved"]),
          )
        );
        booked = snap.docs.map(d => {
          const a = d.data() as any;
          const start = labelToMinutes(a.time || "");
          const dur = Number(a.duration) || 60;
          return { start, end: start + dur };
        });
      } catch { /* treat as no bookings */ }

      let occ = evaluateSeriesOccurrence({
        date,
        time: selectedTime,
        duration: selectedDuration,
        schedule,
        fallbackSlots: TIME_SLOTS,
        bookedIntervals: booked,
      });

      if (occ.available) {
        try {
          const res = await authedFetch("/api/calendar/freebusy", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              date,
              slots: [selectedTime],
              duration: selectedDuration,
              timezone: schedule?.timezone,
              doctorId,
            }),
          });
          const data = await res.json();
          if (Array.isArray(data?.busy) && data.busy.includes(selectedTime)) {
            occ = { date, time: selectedTime, available: false, reason: "calendar" };
          }
        } catch { /* fail-safe: keep available */ }
      }
      results.push(occ);
    }
    return results;
  }

  // Multi-doctor gate + telehealth consent required before booking.
  async function startBooking() {
    if (!doctor) { router.push("/onboarding/match"); return; }
    if (!user) return;
    try {
      const cSnap = await getDoc(doc(db, "consents", user.uid));
      const version = cSnap.exists() ? (cSnap.data() as any).version : null;
      if (!isConsentCurrent(version)) {
        router.push("/onboarding/consent?next=/client/appointments");
        return;
      }
    } catch {
      router.push("/onboarding/consent?next=/client/appointments");
      return;
    }
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

  async function handleResumePay(appt: Appointment) {
    if (!user) return;
    setPayingId(appt.id);
    try {
      const res = await authedFetch("/api/payments/initiate", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          appointmentId: appt.id,
          clientId:      user.uid,
          clientName:    user.displayName ?? "Client",
          clientEmail:   user.email ?? "",
          sessionType:   appt.type,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setToast({ type: "error", msg: data.error ?? "Could not open checkout." });
        setPayingId(null);
        return;
      }
      if (data.free && data.redirect) {
        window.location.href = data.redirect;
        return;
      }
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl as string;
        return;
      }
      setToast({ type: "error", msg: "Could not open checkout." });
      setPayingId(null);
    } catch {
      setToast({ type: "error", msg: "Could not open checkout." });
      setPayingId(null);
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
      let toBook: SeriesOccurrence[] = [{ date: selectedDate, time: selectedTime, available: true }];
      if (repeatWeekly) {
        const preview = seriesPreview.length
          ? seriesPreview
          : await buildSeriesPreview();
        toBook = preview.filter(o => o.available);
        if (toBook.length === 0) {
          setError("None of the weekly dates are available. Pick another start date or turn off repeat.");
          setSubmitting(false);
          return;
        }
      }

      const seriesId =
        repeatWeekly && toBook.length > 1
          ? (typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : `series-${Date.now()}`)
          : undefined;
      const count = seriesId ? toBook.length : undefined;

      let appointmentId = "";
      for (let i = 0; i < toBook.length; i++) {
        const id = await bookAppointment({
          clientId:    user.uid,
          clientName:  user.displayName ?? "Client",
          clientEmail: user.email ?? "",
          doctorId,
          doctorName:  doctor?.doctorName ?? "",
          type:        selectedService?.name ?? selectedType,
          date:        toBook[i].date,
          time:        toBook[i].time,
          duration:    selectedService?.duration ?? 60,
          amount:      selectedPrice,
          ...(notes ? { notes } : {}),
          ...(seriesId
            ? { seriesId, seriesIndex: i + 1, seriesCount: count }
            : {}),
        });
        if (i === 0) appointmentId = id;
      }

      // Notify doctor — payment happens only after they approve the time.
      authedFetch("/api/email/appointment", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ appointmentId, event: "requested" }),
      }).catch(() => {});

      setStep(4);
      setSubmitting(false);
      setToast({
        type: "success",
        msg: "Request sent. Your therapist has 12 hours to approve — then you'll pay to confirm.",
      });

    } catch (err) {
      console.error("Booking error:", err);
      setError("Failed to book appointment. Please try again.");
      setSubmitting(false);
      setRedirecting(false);
    }
  }

  // ── Filtered appointments ─────────────────────────────────────────────
  // Local calendar day (not UTC) so Caribbean evenings don't shift "today"
  const todayStr = localTodayStr();

  const filteredRaw = appointments.filter(a => {
    if (filter === "upcoming") {
      // Live sessions from today forward — closest first after sort
      return ["pending", "approved"].includes(a.status) && (a.date || "") >= todayStr;
    }
    if (filter === "past")      return ["completed", "rejected"].includes(a.status) ||
      (["pending", "approved"].includes(a.status) && (a.date || "") < todayStr);
    if (filter === "cancelled") return a.status === "cancelled";
    return true;
  });

  // All: upcoming (soonest) then history. Upcoming: soonest. Past/cancelled: newest first.
  const filtered =
    filter === "all"
      ? sortClientAppointmentFeed(filteredRaw, todayStr)
      : sortAppointmentsBySession(
          filteredRaw,
          filter === "past" || filter === "cancelled" ? "desc" : "asc",
        );

  const counts: Record<FilterTab, number> = {
    all:       appointments.length,
    upcoming:  appointments.filter(a =>
      ["pending", "approved"].includes(a.status) && (a.date || "") >= todayStr).length,
    past:      appointments.filter(a =>
      ["completed", "rejected"].includes(a.status) ||
      (["pending", "approved"].includes(a.status) && (a.date || "") < todayStr)).length,
    cancelled: appointments.filter(a => a.status === "cancelled").length,
  };

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

      {/* Book Session lives in the sticky header (one CTA — avoid duplicate on this page) */}
      <p className="text-sm" style={{ color: "#8A9BA8" }}>
        Manage your sessions with {doctorName}
      </p>

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
              onPay={handleResumePay}
              payingId={payingId}
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
                  {step === 4 ? "Request sent" : "Book a Session"}
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

              {/* Step 4 — Request submitted (awaiting therapist) */}
              {step === 4 && (
                <div className="text-center py-10">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                    style={{ background: "rgba(141,198,63,0.12)" }}>
                    <CheckCircle size={28} style={{ color: "#6BA028" }} />
                  </div>
                  <h4 className="text-xl mb-2" style={{ fontFamily: "var(--font-dm-serif)", color: "#2A4A1A" }}>
                    Request sent
                  </h4>
                  <p className="text-sm mb-2 px-2" style={{ color: "#4A5568" }}>
                    {doctorName} has <strong>{REVIEW_HOLD_HOURS} hours</strong> to approve this time.
                    After they approve, you&apos;ll pay to confirm (within {PAYMENT_HOLD_HOURS} hours, before the session).
                  </p>
                  <button
                    type="button"
                    onClick={() => { resetBooking(); }}
                    className="mt-6 px-6 py-3 rounded-xl text-sm font-semibold text-white"
                    style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)" }}
                  >
                    Done
                  </button>
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
                  <MiniCalendar schedule={schedule} selected={selectedDate} onSelect={d => {
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

                  {selectedDate && selectedTime && (
                    <div className="rounded-xl p-4 space-y-3"
                      style={{ background: "white", border: "1px solid rgba(42,74,26,0.1)" }}>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={repeatWeekly}
                          onChange={e => setRepeatWeekly(e.target.checked)}
                          className="w-4 h-4 rounded accent-[#2A4A1A]"
                        />
                        <span className="flex items-center gap-1.5 text-sm font-medium" style={{ color: "#2A4A1A" }}>
                          <Repeat size={14} /> Repeat weekly
                        </span>
                      </label>
                      {repeatWeekly && (
                        <div className="flex items-center justify-between gap-3 pl-7">
                          <span className="text-xs" style={{ color: "#8A9BA8" }}>
                            How many weeks? ({SERIES_MIN}–{SERIES_MAX})
                          </span>
                          <select
                            value={seriesCount}
                            onChange={e => setSeriesCount(Number(e.target.value))}
                            className="px-3 py-1.5 rounded-lg text-sm border focus:outline-none"
                            style={{ borderColor: "rgba(42,74,26,0.15)", color: "#2A4A1A" }}
                          >
                            {Array.from({ length: SERIES_MAX - SERIES_MIN + 1 }, (_, i) => SERIES_MIN + i).map(n => (
                              <option key={n} value={n}>{n}</option>
                            ))}
                          </select>
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
                    <button
                      disabled={!selectedDate || !selectedTime || seriesLoading}
                      onClick={async () => {
                        if (repeatWeekly) {
                          setSeriesLoading(true);
                          try {
                            setSeriesPreview(await buildSeriesPreview());
                          } finally {
                            setSeriesLoading(false);
                          }
                        } else {
                          setSeriesPreview([]);
                        }
                        setStep(3);
                      }}
                      className="flex-1 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40 flex items-center justify-center gap-2"
                      style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)" }}>
                      {seriesLoading
                        ? <><Loader2 size={15} className="animate-spin" /> Checking…</>
                        : "Continue"}
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
                      ...(repeatWeekly
                        ? [{
                            label: "Repeat",
                            value: `Weekly × ${seriesCount}`,
                          }]
                        : []),
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between py-2 border-b last:border-0"
                        style={{ borderColor: "rgba(42,74,26,0.06)" }}>
                        <span className="text-xs" style={{ color: "#8A9BA8" }}>{label}</span>
                        <span className="text-sm font-medium" style={{ color: "#2A4A1A" }}>{value}</span>
                      </div>
                    ))}
                    {/* FIX 4: USD currency — pay first session only when series */}
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-sm font-bold" style={{ color: "#2A4A1A" }}>
                        Session fee
                      </span>
                      <span className="text-lg font-bold" style={{ color: "#2A4A1A" }}>
                        {selectedService?.price === 0 ? "Free" : `USD $${selectedService?.price}`}
                      </span>
                    </div>
                  </div>

                  {repeatWeekly && (
                    <div className="rounded-2xl p-4 space-y-2"
                      style={{ background: "white", border: "1px solid rgba(42,74,26,0.08)" }}>
                      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#8A9BA8" }}>
                        Weekly dates
                      </p>
                      {seriesPreview.length === 0 ? (
                        <p className="text-xs" style={{ color: "#8A9BA8" }}>Loading preview…</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {seriesPreview.map((o, i) => (
                            <li key={o.date} className="flex items-center justify-between text-xs">
                              <span style={{ color: "#2A4A1A" }}>
                                {i + 1}. {fmtDate(o.date)} · {o.time}
                              </span>
                              <span className="font-semibold"
                                style={{ color: o.available ? "#6BA028" : "#F7941D" }}>
                                {o.available
                                  ? "Available"
                                  : o.reason === "calendar"
                                    ? "Calendar busy"
                                    : o.reason === "booked"
                                      ? "Already booked"
                                      : "Unavailable"}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {seriesPreview.some(o => !o.available) && (
                        <p className="text-[11px] pt-1" style={{ color: "#8A9BA8" }}>
                          Unavailable weeks are skipped — only available dates will be booked.
                        </p>
                      )}
                    </div>
                  )}

                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                    placeholder={`Anything ${doctorName} should know before your session (optional)…`}
                    className="w-full px-4 py-3 rounded-xl text-sm border resize-none focus:outline-none"
                    style={{ borderColor: "rgba(42,74,26,0.15)", background: "white" }} />

                  <div className="flex items-start gap-3 p-4 rounded-xl"
                    style={{ background: "rgba(141,198,63,0.06)", border: "1px solid rgba(141,198,63,0.2)" }}>
                    <Clock size={14} className="flex-shrink-0 mt-0.5" style={{ color: "#8DC63F" }} />
                    <p className="text-xs" style={{ color: "#4A5568" }}>
                      {doctorName} will review this request within <strong>{REVIEW_HOLD_HOURS} hours</strong>.
                      {selectedService && selectedService.price > 0
                        ? ` After approval, you'll pay USD $${selectedService.price} to confirm (within ${PAYMENT_HOLD_HOURS} hours, before the session).`
                        : " Free sessions are confirmed when they approve — no payment needed."}
                    </p>
                  </div>

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
                    <button
                      disabled={
                        submitting ||
                        !doctorId ||
                        (repeatWeekly && seriesPreview.filter(o => o.available).length === 0)
                      }
                      onClick={handleSubmit}
                      className="flex-1 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60 flex items-center justify-center gap-2"
                      style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)" }}>
                      {submitting
                        ? <><Loader2 size={15} className="animate-spin" /> Sending request…</>
                        : <><CheckCircle size={15} /> Request session</>}
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
