"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy, where, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Calendar, Clock, Video, CheckCircle,
  AlertCircle, Loader2, User, Stethoscope, XCircle,
} from "lucide-react";
import JoinSessionLink from "@/components/JoinSessionLink";

interface Appointment {
  id:          string;
  clientId:    string;
  doctorId:    string;
  doctorName:  string;
  date:        string;
  time:        string;
  sessionType: string;
  status:      string;
  meetLink?:   string;
  amount?:     number;
  createdAt:   any;
}

interface UserProfile {
  displayName: string;
  email:       string;
  role:        string;
}

type StatusKey = "pending" | "approved" | "completed" | "cancelled" | "rejected";

const STATUS_CONFIG: Record<StatusKey, { color: string; bg: string; icon: any; label: string }> = {
  pending:   { color: "#C4700A", bg: "rgba(247,148,29,0.12)",  icon: AlertCircle,  label: "Pending"   },
  approved:  { color: "#6BA028", bg: "rgba(141,198,63,0.12)",  icon: CheckCircle,  label: "Approved"  },
  completed: { color: "#2A4A1A", bg: "rgba(42,74,26,0.1)",     icon: CheckCircle,  label: "Completed" },
  cancelled: { color: "#8A9BA8", bg: "rgba(138,155,168,0.12)", icon: XCircle,      label: "Cancelled" },
  rejected:  { color: "#F7941D", bg: "rgba(247,148,29,0.12)",   icon: XCircle,      label: "Rejected"  },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as StatusKey] ?? STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.color }}>
      <Icon size={10} /> {cfg.label}
    </span>
  );
}

export default function ClientAppointmentsPage() {
  const params   = useParams();
  const router   = useRouter();
  const uid      = params.uid as string;

  const [profile,      setProfile]      = useState<UserProfile | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [filter,       setFilter]       = useState<"all" | StatusKey>("all");

  useEffect(() => {
    if (!uid) return;
    (async () => {
      try {
        const [userSnap, apptSnap] = await Promise.all([
          getDoc(doc(db, "users", uid)),
          getDocs(query(
            collection(db, "appointments"),
            where("clientId", "==", uid),
            orderBy("createdAt", "desc")
          )),
        ]);
        if (userSnap.exists()) setProfile(userSnap.data() as UserProfile);
        setAppointments(apptSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Appointment));
      } finally {
        setLoading(false);
      }
    })();
  }, [uid]);

  const filtered = appointments.filter(a =>
    filter === "all" || a.status === filter
  );

  const counts = {
    all:       appointments.length,
    pending:   appointments.filter(a => a.status === "pending").length,
    approved:  appointments.filter(a => a.status === "approved").length,
    completed: appointments.filter(a => a.status === "completed").length,
    cancelled: appointments.filter(a => a.status === "cancelled").length,
  };

  const totalSpent = appointments
    .filter(a => a.status === "completed" && a.amount)
    .reduce((sum, a) => sum + (a.amount ?? 0), 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.push("/admin/users")}
          className="p-2 rounded-xl hover:bg-black/5 transition-colors"
          style={{ color: "#8A9BA8" }}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-2xl" style={{ fontFamily: "var(--font-dm-serif)", color: "#1E3810" }}>
            {profile ? `${profile.displayName}'s Appointments` : "Client Appointments"}
          </h2>
          {profile && (
            <p className="text-sm mt-0.5" style={{ color: "#8A9BA8" }}>{profile.email}</p>
          )}
        </div>
      </div>

      {/* Stats */}
      {!loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Total",     value: counts.all,       color: "#1E3810" },
            { label: "Completed", value: counts.completed, color: "#6BA028" },
            { label: "Upcoming",  value: counts.approved,  color: "#8DC63F" },
            { label: "Spent",     value: `$${totalSpent.toFixed(0)}`, color: "#F7941D" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-2xl p-4 text-center"
              style={{ background: "white", boxShadow: "0 1px 4px rgba(30,56,16,0.07)" }}>
              <p className="text-2xl font-semibold" style={{ fontFamily: "var(--font-dm-serif)", color }}>
                {value}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "#8A9BA8" }}>{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["all", "pending", "approved", "completed", "cancelled"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-3 py-2 rounded-xl text-xs font-semibold capitalize transition-all"
            style={{
              background: filter === f ? "#1E3810" : "white",
              color:      filter === f ? "white" : "#4A5568",
              boxShadow:  filter === f ? "none" : "0 1px 3px rgba(30,56,16,0.07)",
            }}>
            {f === "all" ? `All (${counts.all})` : `${f} (${counts[f] ?? 0})`}
          </button>
        ))}
      </div>

      {/* Appointment list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin" style={{ color: "#8DC63F" }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl py-16 text-center"
          style={{ background: "white", boxShadow: "0 1px 4px rgba(30,56,16,0.07)" }}>
          <Calendar size={28} className="mx-auto mb-3" style={{ color: "#C4C4C4" }} />
          <p className="text-sm font-medium" style={{ color: "#1E3810" }}>No appointments found</p>
          <p className="text-xs mt-1" style={{ color: "#8A9BA8" }}>
            {filter === "all" ? "This client has no appointment history." : `No ${filter} appointments.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(appt => (
            <div key={appt.id} className="rounded-2xl p-5"
              style={{ background: "white", boxShadow: "0 1px 4px rgba(30,56,16,0.07)" }}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="space-y-2">
                  {/* Session type */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold" style={{ color: "#1E3810" }}>{appt.sessionType}</p>
                    <StatusBadge status={appt.status} />
                  </div>
                  {/* Doctor */}
                  <div className="flex items-center gap-1.5 text-xs" style={{ color: "#4A5568" }}>
                    <Stethoscope size={12} style={{ color: "#8DC63F" }} />
                    {appt.doctorName ?? "Unknown Doctor"}
                  </div>
                  {/* Date + Time */}
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5 text-xs" style={{ color: "#8A9BA8" }}>
                      <Calendar size={12} />
                      {appt.date
                        ? new Date(appt.date + "T00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
                        : "—"}
                    </span>
                    <span className="flex items-center gap-1.5 text-xs" style={{ color: "#8A9BA8" }}>
                      <Clock size={12} /> {appt.time ?? "—"}
                    </span>
                  </div>
                </div>
                <div className="text-right space-y-2">
                  {appt.amount && (
                    <p className="text-sm font-bold" style={{ color: "#2A4A1A" }}>
                      ${Number(appt.amount).toFixed(2)} USD
                    </p>
                  )}
                  {appt.meetLink && appt.status === "approved" && (
                    <JoinSessionLink
                      href={appt.meetLink}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
                      style={{ background: "rgba(141,198,63,0.1)", color: "#6BA028" }}
                      ariaLabel="Join Meet"
                    >
                      <Video size={11} /> Join Meet
                    </JoinSessionLink>
                  )}
                  <p className="text-xs" style={{ color: "#C4C4C4" }}>
                    Booked {appt.createdAt?.toDate
                      ? appt.createdAt.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric" })
                      : "—"}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
