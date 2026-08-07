"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import {
  Calendar, Users, ClipboardList, DollarSign,
  Clock, CheckCircle, AlertCircle, ArrowRight,
  TrendingUp, FileText, Loader2, Banknote,
  MessageCircle, Activity,
} from "lucide-react";
import Link from "next/link";
import AnnouncementBanner from "@/components/AnnouncementBanner";

// ── Types ──────────────────────────────────────────────────────────────────
type Appointment = {
  id: string; status: string; sessionType: string;
  createdAt: any; scheduledAt: any; clientId: string;
  clientName?: string;
};
type ClientDoc = { uid: string; displayName: string; email: string; createdAt: any; };
type Payment   = { id: string; amount: number; status: string; createdAt: any; source: string; };
type Assessment = { id: string; status: string; assignedTo?: string; };
type Message   = { id: string; createdAt: any; senderId: string; read?: boolean; };

// ── Helpers ────────────────────────────────────────────────────────────────
function toDate(ts: any): Date | null {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  if (ts instanceof Date) return ts;
  if (typeof ts === "string") return new Date(ts);
  return null;
}
function monthKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; }
function isToday(d: Date) {
  const now = new Date();
  return d.getDate()===now.getDate() && d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear();
}
function isThisWeek(d: Date) {
  const now = new Date();
  const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay()); startOfWeek.setHours(0,0,0,0);
  return d >= startOfWeek;
}
const fmt = (n: number) => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(n);

// ── Stat Card ──────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon: Icon, accent, trend }: {
  label: string; value: string|number; sub: string;
  icon: React.ElementType; accent: string; trend?: string;
}) {
  return (
    <div className="rounded-2xl p-5" style={{ background:"white", boxShadow:"0 1px 4px rgba(30,56,16,0.07)" }}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color:"#8A9BA8" }}>{label}</span>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background:accent+"15" }}>
          <Icon size={17} style={{ color:accent }}/>
        </div>
      </div>
      <p className="text-3xl font-semibold mb-1" style={{ fontFamily:"var(--font-dm-serif)", color:"#1E3810" }}>{value}</p>
      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color:"#8A9BA8" }}>{sub}</p>
        {trend && (
          <span className="text-xs font-medium flex items-center gap-1" style={{ color:"#8DC63F" }}>
            <TrendingUp size={11}/> {trend}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Appointment Row ────────────────────────────────────────────────────────
function AppointmentRow({ name, time, type, status }: {
  name: string; time: string; type: string;
  status: "pending"|"approved"|"completed"|"cancelled";
}) {
  const styles = {
    pending:   { bg:"rgba(247,148,29,0.1)",  color:"#F7941D", label:"Pending"   },
    approved:  { bg:"rgba(141,198,63,0.1)",  color:"#6BA028", label:"Approved"  },
    completed: { bg:"rgba(42,74,26,0.08)",   color:"#1E3810", label:"Completed" },
    cancelled: { bg:"rgba(247,148,29,0.1)",   color:"#F7941D", label:"Cancelled" },
  };
  const s = styles[status] ?? styles.pending;
  return (
    <div className="flex items-center gap-4 py-3 border-b last:border-0" style={{ borderColor:"rgba(30,56,16,0.06)" }}>
      <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
        style={{ background:"rgba(141,198,63,0.15)", color:"#1E3810" }}>
        {name?.[0]?.toUpperCase() ?? "?"}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color:"#1E3810" }}>{name}</p>
        <p className="text-xs" style={{ color:"#8A9BA8" }}>{type}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-xs font-medium mb-0.5" style={{ color:"#1E3810" }}>{time}</p>
        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background:s.bg, color:s.color }}>{s.label}</span>
      </div>
    </div>
  );
}

// ── Action Card ────────────────────────────────────────────────────────────
function ActionCard({ href, icon: Icon, label, count, accent, hint }: {
  href: string; icon: React.ElementType; label: string; count?: number; accent: string; hint?: string;
}) {
  const showCount = typeof count === "number";
  return (
    <Link href={href} className="group rounded-xl p-4 flex items-center gap-3 transition-all hover:-translate-y-0.5"
      style={{ background:"white", boxShadow:"0 1px 4px rgba(30,56,16,0.07)" }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background:accent+"15" }}>
        <Icon size={18} style={{ color:accent }}/>
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium" style={{ color:"#1E3810" }}>{label}</p>
        <p className="text-xs" style={{ color: showCount && count > 0 ? accent : "#8A9BA8" }}>
          {hint ?? (showCount ? (count > 0 ? `${count} pending` : "All clear") : "Open")}
        </p>
      </div>
      {showCount && count > 0 && (
        <span className="text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background:accent, color:"white" }}>{count > 9 ? "9+" : count}</span>
      )}
      <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" style={{ color:"#8A9BA8" }}/>
    </Link>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function DoctorDashboard() {
  const { user } = useAuth();

  const [appts,       setAppts]       = useState<Appointment[]>([]);
  const [clients,     setClients]     = useState<ClientDoc[]>([]);
  const [payments,    setPayments]    = useState<Payment[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading,     setLoading]     = useState(true);

  // Client-only state to avoid hydration mismatch
  const [greeting,    setGreeting]    = useState("");
  const [today,       setToday]       = useState("");

  useEffect(() => {
    if (!user?.uid) return;

    // Set greeting client-side only
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening");
    setToday(new Date().toLocaleDateString("en-US", { weekday:"long", month:"long", day:"numeric" }));

    (async () => {
      // All queries scoped to this doctor's uid
      const [aSnap, uSnap, pSnap, asSnap] = await Promise.all([
        getDocs(query(collection(db,"appointments"), where("doctorId","==",user.uid), orderBy("createdAt","desc"))),
        getDocs(collection(db,"users")),
        getDocs(query(collection(db,"payments"), where("doctorId","==",user.uid), orderBy("createdAt","desc"))),
        getDocs(query(collection(db,"assessments"), where("doctorId","==",user.uid))),
      ]);

      const allAppts = aSnap.docs.map(d => ({ id:d.id, ...d.data() }) as Appointment);
      const allUsers = uSnap.docs.map(d => ({ uid:d.id, ...d.data() }) as ClientDoc);

      // Enrich appointments with client names
      const enriched = allAppts.map(a => ({
        ...a,
        clientName: allUsers.find(u => u.uid===a.clientId)?.displayName ?? "Unknown Client",
      }));

      // Only clients assigned to this doctor
      const myClientIds = [...new Set(allAppts.map(a => a.clientId))];
      const myClients   = allUsers.filter(u => myClientIds.includes(u.uid));

      setAppts(enriched);
      setClients(myClients);
      setPayments(pSnap.docs.map(d => ({ id:d.id, ...d.data() }) as Payment));
      setAssessments(asSnap.docs.map(d => ({ id:d.id, ...d.data() }) as Assessment));
      setLoading(false);
    })();
  }, [user?.uid]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const now        = new Date();
  const thisMonthK = monthKey(now);

  const todayAppts     = appts.filter(a => { const d=toDate(a.scheduledAt??a.createdAt); return d && isToday(d); });
  const pendingAppts   = appts.filter(a => a.status==="pending");
  const completedAppts = appts.filter(a => a.status==="completed");

  const completedThisMonth = completedAppts.filter(a => { const d=toDate(a.createdAt); return d && monthKey(d)===thisMonthK; }).length;
  const newClientsThisMonth = clients.filter(c => { const d=toDate(c.createdAt); return d && monthKey(d)===thisMonthK; }).length;

  const completedPay    = payments.filter(p => p.status==="completed");
  const revenueThisMonth = completedPay.filter(p => { const d=toDate(p.createdAt); return d && monthKey(d)===thisMonthK; }).reduce((s,p)=>s+p.amount,0);
  const totalRevenue    = completedPay.reduce((s,p) => s+p.amount, 0);

  const pendingAssessments = assessments.filter(a => a.status==="pending").length;

  const weekAppts      = appts.filter(a => { const d=toDate(a.createdAt); return d && isThisWeek(d) && a.status==="completed"; }).length;
  const weekNewClients = clients.filter(c => { const d=toDate(c.createdAt); return d && isThisWeek(d); }).length;
  const weekAssess     = assessments.filter(a => { return a.status==="completed"; }).length;

  // Fix "Dr. Dr." — strip leading "Dr. " from displayName if present
  const rawName   = user?.displayName ?? "Doctor";
  const cleanName = rawName.replace(/^Dr\.?\s*/i, "");
  const firstName = cleanName.split(" ")[0];

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 size={28} className="animate-spin" style={{ color:"#8DC63F" }}/>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Platform announcements */}
      <AnnouncementBanner audience="doctor" />

      {/* Welcome banner */}
      <div className="rounded-2xl p-6 relative overflow-hidden"
        style={{ background:"linear-gradient(135deg, #1E3810 0%, #3D6B24 100%)", boxShadow:"0 4px 24px rgba(30,56,16,0.2)" }}>
        <div className="absolute right-0 top-0 w-80 h-full opacity-10"
          style={{ background:"radial-gradient(circle at 80% 50%, #8DC63F, transparent 70%)" }}/>
        <div className="relative z-10 flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm mb-1" style={{ color:"rgba(255,255,255,0.55)" }}>
              {greeting || "Welcome back"}, Dr. {firstName}{today ? ` · ${today}` : ""}
            </p>
            <h2 className="text-2xl text-white mb-2" style={{ fontFamily:"var(--font-dm-serif)" }}>
              Here&apos;s your practice overview
            </h2>
            <p className="text-sm" style={{ color:"rgba(255,255,255,0.6)" }}>
              You have{" "}
              <span className="text-white font-semibold">
                {todayAppts.length} appointment{todayAppts.length!==1?"s":""}
              </span>{" "}
              scheduled today.
              {pendingAppts.length > 0 && (
                <span style={{ color:"#F9C74F" }}>
                  {" "}· {pendingAppts.length} awaiting approval.
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl"
              style={{ background:"rgba(141,198,63,0.15)", border:"1px solid rgba(141,198,63,0.25)" }}>
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background:"#8DC63F" }}/>
              <span className="text-sm font-medium" style={{ color:"#8DC63F" }}>Practice Active</span>
            </div>
            {pendingAppts.length > 0 && (
              <Link href="/doctor/schedule"
                className="flex items-center gap-2 px-4 py-2 rounded-xl transition-opacity hover:opacity-80"
                style={{ background:"rgba(249,199,79,0.15)", border:"1px solid rgba(249,199,79,0.3)" }}>
                <AlertCircle size={13} style={{ color:"#F9C74F" }}/>
                <span className="text-sm font-medium" style={{ color:"#F9C74F" }}>
                  {pendingAppts.length} pending
                </span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Clients"     value={clients.length}          sub={`+${newClientsThisMonth} this month`}    icon={Users}       accent="#8DC63F" trend={newClientsThisMonth > 0 ? `+${newClientsThisMonth} new` : undefined}/>
        <StatCard label="This Month"        value={completedThisMonth}      sub="Sessions completed"                      icon={CheckCircle} accent="#1E3810"/>
        <StatCard label="Pending Approvals" value={pendingAppts.length}     sub="Awaiting confirmation"                   icon={AlertCircle} accent="#F7941D"/>
        <StatCard label="Revenue"           value={fmt(revenueThisMonth)}   sub={`${fmt(totalRevenue)} total`}            icon={DollarSign}  accent="#F7941D"/>
      </div>

      {/* Today's Schedule + Needs Attention */}
      <div className="grid lg:grid-cols-5 gap-4">

        {/* Today's schedule */}
        <div className="lg:col-span-3 rounded-2xl p-5" style={{ background:"white", boxShadow:"0 1px 4px rgba(30,56,16,0.07)" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color:"#8A9BA8" }}>Today&apos;s Schedule</h3>
            <Link href="/doctor/schedule" className="text-xs font-medium flex items-center gap-1 hover:underline" style={{ color:"#8DC63F" }}>
              View all <ArrowRight size={11}/>
            </Link>
          </div>
          {todayAppts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ background:"rgba(141,198,63,0.08)" }}>
                <Calendar size={24} style={{ color:"#8DC63F" }}/>
              </div>
              <p className="text-sm font-medium mb-1" style={{ color:"#1E3810" }}>No appointments today</p>
              <p className="text-xs" style={{ color:"#8A9BA8" }}>Your schedule is clear. Appointments will appear here.</p>
            </div>
          ) : (
            todayAppts.map(a => {
              const d = toDate(a.scheduledAt ?? a.createdAt);
              const time = d ? d.toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"}) : "—";
              return (
                <AppointmentRow
                  key={a.id}
                  name={a.clientName ?? "Unknown"}
                  time={time}
                  type={a.sessionType ?? "Session"}
                  status={a.status as any}
                />
              );
            })
          )}
        </div>

        {/* Needs Attention */}
        <div className="lg:col-span-2 space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider px-1" style={{ color:"#8A9BA8" }}>Needs Attention</h3>
          <ActionCard href="/doctor/schedule"    icon={Clock}         label="Pending Approvals"     count={pendingAppts.length}    accent="#F7941D"/>
          <ActionCard href="/doctor/assessments" icon={ClipboardList} label="Assessments to Review" count={pendingAssessments}     accent="#8DC63F"/>
          <ActionCard href="/doctor/notes"       icon={FileText}      label="Session Notes"         hint="SOAP + AI assist"       accent="#1E3810"/>
          <ActionCard href="/doctor/clients"     icon={Users}         label="New Client Requests"   count={newClientsThisMonth}   accent="#F7941D"/>

          {/* This week stats */}
          <div className="rounded-xl p-4 mt-2"
            style={{ background:"linear-gradient(135deg, rgba(141,198,63,0.08), rgba(141,198,63,0.03))", border:"1px solid rgba(141,198,63,0.15)" }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color:"#8A9BA8" }}>This Week</p>
            {[
              { label:"Sessions Completed", value: weekAppts      },
              { label:"New Clients",         value: weekNewClients },
              { label:"Assessments Sent",    value: weekAssess     },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-1.5 border-b last:border-0"
                style={{ borderColor:"rgba(141,198,63,0.1)" }}>
                <span className="text-xs" style={{ color:"#4A5568" }}>{label}</span>
                <span className="text-xs font-bold" style={{ color:"#1E3810" }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Clients */}
      <div className="rounded-2xl p-5" style={{ background:"white", boxShadow:"0 1px 4px rgba(30,56,16,0.07)" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color:"#8A9BA8" }}>Recent Clients</h3>
          <Link href="/doctor/clients" className="text-xs font-medium flex items-center gap-1 hover:underline" style={{ color:"#8DC63F" }}>
            View all <ArrowRight size={11}/>
          </Link>
        </div>
        {clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background:"rgba(42,74,26,0.06)" }}>
              <Users size={20} style={{ color:"#1E3810" }}/>
            </div>
            <p className="text-sm font-medium mb-1" style={{ color:"#1E3810" }}>No clients yet</p>
            <p className="text-xs" style={{ color:"#8A9BA8" }}>Clients will appear here once they book sessions.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {clients.slice(0,6).map(c => {
              const sessions = appts.filter(a => a.clientId===c.uid && a.status==="completed").length;
              const lastAppt = appts.filter(a => a.clientId===c.uid).sort((a,b) => {
                const da=toDate(a.createdAt)?.getTime()??0, db2=toDate(b.createdAt)?.getTime()??0;
                return db2-da;
              })[0];
              const lastDate = toDate(lastAppt?.createdAt);
              return (
                <Link key={c.uid} href="/doctor/clients"
                  className="group flex items-center gap-3 p-3 rounded-xl transition-all hover:-translate-y-0.5"
                  style={{ background:"rgba(30,56,16,0.03)", border:"1px solid rgba(30,56,16,0.06)" }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                    style={{ background:"rgba(141,198,63,0.15)", color:"#1E3810" }}>
                    {c.displayName?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color:"#1E3810" }}>{c.displayName}</p>
                    <p className="text-xs" style={{ color:"#8A9BA8" }}>
                      {sessions} session{sessions!==1?"s":""}{lastDate ? ` · ${lastDate.toLocaleDateString("en-US",{month:"short",day:"numeric"})}` : ""}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
