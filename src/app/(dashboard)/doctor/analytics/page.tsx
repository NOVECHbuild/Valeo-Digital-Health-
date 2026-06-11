"use client";

import { useState, useEffect } from "react";
import {
  collection, query, where, getDocs, orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import {
  TrendingUp, TrendingDown, Users, Calendar,
  CheckCircle, DollarSign, FileText, ClipboardList,
  Clock, Loader2, Minus,
} from "lucide-react";

// ══════════════════════════════════════════════════════════════
//  TYPES
// ══════════════════════════════════════════════════════════════
interface Appointment {
  id: string; clientId: string; clientName?: string;
  type: string; date: string; time: string; duration: number;
  status: "pending" | "approved" | "completed" | "rejected" | "cancelled";
  createdAt: any;
}
interface Payment {
  id: string; clientId?: string; amount: number;
  status: "success" | "paid" | "pending" | "failed" | "manual";
  type?: string; createdAt: any;
}
interface RawNote    { id: string; clientId: string; createdAt: any; }
interface RawAssess  { id: string; status: "pending" | "completed"; completedAt: any; }

// ══════════════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════════════
function toDate(ts: any): Date | null {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  if (ts instanceof Date) return ts;
  if (typeof ts === "string") return new Date(ts);
  return null;
}

function pctChange(curr: number, prev: number): number | null {
  if (prev === 0) return curr > 0 ? 100 : null;
  return Math.round(((curr - prev) / prev) * 100);
}

function fmt$(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function isoWeekKey(d: Date): string {
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return monday.toISOString().split("T")[0];
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ══════════════════════════════════════════════════════════════
//  SVG PRIMITIVES
// ══════════════════════════════════════════════════════════════

/** Vertical bar chart — values[], labels[], color */
function BarChart({ values, labels, color = "#8DC63F", height = 90 }: {
  values: number[]; labels: string[]; color?: string; height?: number;
}) {
  const max = Math.max(...values, 1);
  const W = 320; const pad = 4;
  const barW = (W - pad * (values.length - 1)) / values.length;

  return (
    <svg viewBox={`0 0 ${W} ${height + 20}`} className="w-full">
      {values.map((v, i) => {
        const bh = Math.max((v / max) * height, v > 0 ? 3 : 0);
        const x  = i * (barW + pad);
        const y  = height - bh;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={bh}
              rx={3} fill={color} fillOpacity={0.85} />
            <text x={x + barW / 2} y={height + 14}
              textAnchor="middle" fontSize={9} fill="#8A9BA8">
              {labels[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Smooth sparkline */
function Sparkline({ values, color = "#8DC63F", height = 36 }: {
  values: number[]; color?: string; height?: number;
}) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const W = 120;
  const step = W / (values.length - 1);
  const pts  = values.map((v, i) => `${i * step},${height - (v / max) * (height - 4)}`).join(" ");
  const area = `M0,${height} L${pts.replace(/,/g, " L").replace(/ L/g, ",")} L${W},${height} Z`
               .replace("M0,", "M0,").replace(/(\d+) L/g, "$1,L");

  // Build proper path
  const coords = values.map((v, i) => ({
    x: i * step,
    y: height - (v / max) * (height - 4),
  }));
  const linePath = coords.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${(values.length - 1) * step},${height} L0,${height} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`sg-${color.replace("#","")}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#sg-${color.replace("#","")})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Donut chart */
function DonutChart({ slices, size = 96 }: {
  slices: { value: number; color: string; label: string }[]; size?: number;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const r = 36; const cx = size / 2; const cy = size / 2;
  let cumAngle = -Math.PI / 2;

  function arc(value: number): string {
    const angle = (value / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(cumAngle);
    const y1 = cy + r * Math.sin(cumAngle);
    cumAngle += angle;
    const x2 = cx + r * Math.cos(cumAngle);
    const y2 = cy + r * Math.sin(cumAngle);
    const large = angle > Math.PI ? 1 : 0;
    return `M${cx},${cy} L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${large},1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`;
  }

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      {slices.filter(s => s.value > 0).map((s, i) => (
        <path key={i} d={arc(s.value)} fill={s.color} fillOpacity={0.9} />
      ))}
      <circle cx={cx} cy={cy} r={22} fill="white" />
    </svg>
  );
}

// ══════════════════════════════════════════════════════════════
//  KPI CARD
// ══════════════════════════════════════════════════════════════
function KpiCard({ label, value, sub, trend, sparkValues, color, Icon }: {
  label: string; value: string | number; sub?: string;
  trend?: number | null; sparkValues?: number[];
  color: string; Icon: any;
}) {
  const trendColor = trend === null || trend === undefined ? "#C4C4C4"
                   : trend > 0  ? "#6BA028"
                   : trend < 0  ? "#F7941D"
                   : "#8A9BA8";
  const TrendIcon = trend === null || trend === undefined ? Minus
                  : trend > 0  ? TrendingUp
                  : trend < 0  ? TrendingDown
                  : Minus;

  return (
    <div className="rounded-2xl p-5 flex flex-col justify-between"
      style={{ background: "white", boxShadow: "0 1px 4px rgba(42,74,26,0.07)", minHeight: 130 }}>
      <div className="flex items-start justify-between mb-2">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: color + "15" }}>
          <Icon size={16} style={{ color }} />
        </div>
        {sparkValues && sparkValues.length > 1 && (
          <div className="w-24 opacity-70">
            <Sparkline values={sparkValues} color={color} height={30} />
          </div>
        )}
      </div>
      <div>
        <p className="text-2xl font-semibold"
          style={{ fontFamily: "var(--font-dm-serif)", color: "#2A4A1A" }}>{value}</p>
        <p className="text-xs mt-0.5" style={{ color: "#8A9BA8" }}>{label}</p>
        {(trend !== undefined || sub) && (
          <div className="flex items-center gap-1.5 mt-2">
            {trend !== undefined && (
              <>
                <TrendIcon size={11} style={{ color: trendColor }} />
                <span className="text-xs font-semibold" style={{ color: trendColor }}>
                  {trend === null ? "—" : `${trend > 0 ? "+" : ""}${trend}%`}
                </span>
              </>
            )}
            {sub && <span className="text-xs" style={{ color: "#C4C4C4" }}>{sub}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  MAIN PAGE
// ══════════════════════════════════════════════════════════════
export default function DoctorAnalyticsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  // Raw data
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [payments,     setPayments]     = useState<Payment[]>([]);
  const [notes,        setNotes]        = useState<RawNote[]>([]);
  const [assessments,  setAssessments]  = useState<RawAssess[]>([]);

  // Computed — all set inside useEffect to avoid hydration issues
  const [now,              setNow]              = useState<Date | null>(null);
  const [sessionsMonth,    setSessMonth]        = useState(0);
  const [sessionsLastMonth,setSessLastMonth]    = useState(0);
  const [revenueMonth,     setRevMonth]         = useState(0);
  const [revenueLastMonth, setRevLastMonth]     = useState(0);
  const [completionRate,   setCompletionRate]   = useState(0);
  const [activeClients,    setActiveClients]    = useState(0);
  const [avgDuration,      setAvgDuration]      = useState(0);
  const [notesMonth,       setNotesMonth]       = useState(0);
  const [assessDone,       setAssessDone]       = useState(0);
  const [assessPending,    setAssessPending]    = useState(0);

  // Chart data
  const [weekBars,         setWeekBars]         = useState<{ label: string; count: number }[]>([]);
  const [typeSlices,       setTypeSlices]       = useState<{ value: number; color: string; label: string }[]>([]);
  const [dayBars,          setDayBars]          = useState<number[]>(Array(7).fill(0));
  const [monthRevBars,     setMonthRevBars]     = useState<{ label: string; rev: number }[]>([]);
  const [topClients,       setTopClients]       = useState<{ name: string; count: number; completed: number }[]>([]);
  const [revSparkline,     setRevSparkline]     = useState<number[]>([]);

  // ── Fetch all data ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const today = new Date();
    setNow(today);

    (async () => {
      const [apptSnap, paySnap, noteSnap, assessSnap] = await Promise.all([
        getDocs(query(collection(db, "appointments"), where("doctorId", "==", user.uid), orderBy("createdAt", "desc"))),
        getDocs(query(collection(db, "payments"),     where("doctorId", "==", user.uid), orderBy("createdAt", "desc"))),
        getDocs(query(collection(db, "notes"),        where("doctorId", "==", user.uid))),
        getDocs(query(collection(db, "assessments"),  where("doctorId", "==", user.uid))),
      ]);

      const appts:   Appointment[] = apptSnap.docs.map(d  => ({ id: d.id, ...d.data()  } as Appointment));
      const pays:    Payment[]     = paySnap.docs.map(d   => ({ id: d.id, ...d.data()  } as Payment));
      const nts:     RawNote[]     = noteSnap.docs.map(d  => ({ id: d.id, ...d.data()  } as RawNote));
      const assmnts: RawAssess[]   = assessSnap.docs.map(d=> ({ id: d.id, ...d.data()  } as RawAssess));

      setAppointments(appts);
      setPayments(pays);
      setNotes(nts);
      setAssessments(assmnts);

      // ── Date boundaries ──────────────────────────────────────────────────
      const yr  = today.getFullYear();
      const mo  = today.getMonth();
      const thisMonthStart  = new Date(yr, mo, 1);
      const lastMonthStart  = new Date(yr, mo - 1, 1);
      const lastMonthEnd    = new Date(yr, mo, 0, 23, 59, 59);

      // ── Sessions this / last month ────────────────────────────────────────
      const completedAppts = appts.filter(a => a.status === "completed");

      const sessThisM = completedAppts.filter(a => {
        const d = toDate(a.createdAt);
        return d && d >= thisMonthStart && d <= today;
      }).length;
      const sessLastM = completedAppts.filter(a => {
        const d = toDate(a.createdAt);
        return d && d >= lastMonthStart && d <= lastMonthEnd;
      }).length;
      setSessMonth(sessThisM);
      setSessLastMonth(sessLastM);

      // ── Revenue ──────────────────────────────────────────────────────────
      const paidPays = pays.filter(p => ["success","paid","manual"].includes(p.status));
      const revThisM = paidPays
        .filter(p => { const d = toDate(p.createdAt); return d && d >= thisMonthStart; })
        .reduce((s, p) => s + (p.amount || 0), 0);
      const revLastM = paidPays
        .filter(p => { const d = toDate(p.createdAt); return d && d >= lastMonthStart && d <= lastMonthEnd; })
        .reduce((s, p) => s + (p.amount || 0), 0);
      setRevMonth(revThisM);
      setRevLastMonth(revLastM);

      // ── Completion rate ───────────────────────────────────────────────────
      const nonRejected = appts.filter(a => !["rejected","cancelled"].includes(a.status));
      const rate = nonRejected.length > 0
        ? Math.round((completedAppts.length / nonRejected.length) * 100)
        : 0;
      setCompletionRate(rate);

      // ── Active clients (upcoming approved/pending) ────────────────────────
      const upcoming = appts.filter(a => ["pending","approved"].includes(a.status));
      const uniqueActive = new Set(upcoming.map(a => a.clientId)).size;
      setActiveClients(uniqueActive);

      // ── Avg session duration ──────────────────────────────────────────────
      const withDur = completedAppts.filter(a => a.duration > 0);
      const avg = withDur.length > 0
        ? Math.round(withDur.reduce((s, a) => s + a.duration, 0) / withDur.length)
        : 0;
      setAvgDuration(avg);

      // ── Notes this month ──────────────────────────────────────────────────
      const ntm = nts.filter(n => {
        const d = toDate(n.createdAt);
        return d && d >= thisMonthStart;
      }).length;
      setNotesMonth(ntm);

      // ── Assessment stats ─────────────────────────────────────────────────
      setAssessDone(assmnts.filter(a => a.status === "completed").length);
      setAssessPending(assmnts.filter(a => a.status === "pending").length);

      // ── Sessions per week (last 8 weeks) ──────────────────────────────────
      const weekMap: Record<string, number> = {};
      for (let w = 7; w >= 0; w--) {
        const d = new Date(today);
        d.setDate(today.getDate() - w * 7);
        const key = isoWeekKey(d);
        weekMap[key] = 0;
      }
      completedAppts.forEach(a => {
        const d = toDate(a.createdAt);
        if (!d) return;
        const key = isoWeekKey(d);
        if (key in weekMap) weekMap[key]++;
      });
      const weekEntries = Object.entries(weekMap).slice(-8);
      setWeekBars(weekEntries.map(([k, v]) => ({
        label: new Date(k + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        count: v,
      })));

      // ── Session type breakdown ────────────────────────────────────────────
      const typeMap: Record<string, number> = {};
      appts.forEach(a => { typeMap[a.type] = (typeMap[a.type] || 0) + 1; });
      const typeColors = ["#2A4A1A","#8DC63F","#F7941D","#F7941D","#8E44AD","#2980B9"];
      const slices = Object.entries(typeMap)
        .sort((a, b) => b[1] - a[1])
        .map(([label, value], i) => ({ label, value, color: typeColors[i % typeColors.length] }));
      setTypeSlices(slices);

      // ── Busiest day of week ───────────────────────────────────────────────
      const dayCount = Array(7).fill(0);
      appts.forEach(a => {
        const d = toDate(a.createdAt);
        if (d) dayCount[d.getDay()]++;
      });
      setDayBars(dayCount);

      // ── Revenue last 6 months ────────────────────────────────────────────
      const monthRevMap: Record<string, number> = {};
      for (let m = 5; m >= 0; m--) {
        const d = new Date(yr, mo - m, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthRevMap[key] = 0;
      }
      paidPays.forEach(p => {
        const d = toDate(p.createdAt);
        if (!d) return;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (key in monthRevMap) monthRevMap[key] += p.amount || 0;
      });
      const revEntries = Object.entries(monthRevMap);
      setMonthRevBars(revEntries.map(([k, v]) => ({
        label: MONTH_LABELS[parseInt(k.split("-")[1]) - 1],
        rev: v,
      })));
      setRevSparkline(revEntries.map(([, v]) => v));

      // ── Top clients ───────────────────────────────────────────────────────
      const clientMap: Record<string, { name: string; count: number; completed: number }> = {};
      appts.forEach(a => {
        if (!a.clientId) return;
        if (!clientMap[a.clientId]) clientMap[a.clientId] = { name: a.clientName || "Unknown", count: 0, completed: 0 };
        clientMap[a.clientId].count++;
        if (a.status === "completed") clientMap[a.clientId].completed++;
      });
      const top = Object.values(clientMap)
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);
      setTopClients(top);

      setLoading(false);
    })();
  }, [user]);

  // ── Derived display values ────────────────────────────────────────────────
  const sessTrend = pctChange(sessionsMonth, sessionsLastMonth);
  const revTrend  = pctChange(revenueMonth,  revenueLastMonth);
  const totalClients = new Set(appointments.map(a => a.clientId)).size;

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: "60vh" }}>
        <Loader2 size={32} className="animate-spin" style={{ color: "#8DC63F" }} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h2 className="text-2xl" style={{ fontFamily: "var(--font-dm-serif)", color: "#2A4A1A" }}>
          Practice Analytics
        </h2>
        <p className="text-sm mt-0.5" style={{ color: "#8A9BA8" }}>
          {now ? `Your performance overview · as of ${now.toLocaleDateString("en-US", { month: "long", year: "numeric" })}` : "Your performance overview"}
        </p>
      </div>

      {/* ── KPI row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Sessions This Month"
          value={sessionsMonth}
          trend={sessTrend}
          sub="vs last month"
          sparkValues={weekBars.map(w => w.count)}
          color="#8DC63F"
          Icon={Calendar}
        />
        <KpiCard
          label="Revenue This Month"
          value={fmt$(revenueMonth)}
          trend={revTrend}
          sub="vs last month"
          sparkValues={revSparkline}
          color="#F7941D"
          Icon={DollarSign}
        />
        <KpiCard
          label="Completion Rate"
          value={`${completionRate}%`}
          sub={`${appointments.filter(a => a.status === "completed").length} completed sessions`}
          color="#6BA028"
          Icon={CheckCircle}
        />
        <KpiCard
          label="Active Clients"
          value={activeClients}
          sub={`${totalClients} total all-time`}
          color="#2A4A1A"
          Icon={Users}
        />
      </div>

      {/* ── Secondary KPI row ───────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl p-4 flex items-center gap-3"
          style={{ background: "white", boxShadow: "0 1px 4px rgba(42,74,26,0.07)" }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(142,68,173,0.1)" }}>
            <Clock size={16} style={{ color: "#8E44AD" }} />
          </div>
          <div>
            <p className="text-xl font-semibold" style={{ fontFamily: "var(--font-dm-serif)", color: "#2A4A1A" }}>
              {avgDuration > 0 ? `${avgDuration} min` : "—"}
            </p>
            <p className="text-xs" style={{ color: "#8A9BA8" }}>Avg Session Duration</p>
          </div>
        </div>
        <div className="rounded-2xl p-4 flex items-center gap-3"
          style={{ background: "white", boxShadow: "0 1px 4px rgba(42,74,26,0.07)" }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(42,74,26,0.08)" }}>
            <FileText size={16} style={{ color: "#2A4A1A" }} />
          </div>
          <div>
            <p className="text-xl font-semibold" style={{ fontFamily: "var(--font-dm-serif)", color: "#2A4A1A" }}>
              {notesMonth}
            </p>
            <p className="text-xs" style={{ color: "#8A9BA8" }}>Notes Written This Month</p>
          </div>
        </div>
        <div className="rounded-2xl p-4 flex items-center gap-3"
          style={{ background: "white", boxShadow: "0 1px 4px rgba(42,74,26,0.07)" }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(41,128,185,0.1)" }}>
            <ClipboardList size={16} style={{ color: "#2980B9" }} />
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <p className="text-xl font-semibold" style={{ fontFamily: "var(--font-dm-serif)", color: "#2A4A1A" }}>
                {assessDone}
              </p>
              {assessPending > 0 && (
                <span className="text-xs font-semibold" style={{ color: "#F7941D" }}>
                  +{assessPending} pending
                </span>
              )}
            </div>
            <p className="text-xs" style={{ color: "#8A9BA8" }}>Assessments Completed</p>
          </div>
        </div>
      </div>

      {/* ── Charts row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Sessions per week — wide */}
        <div className="lg:col-span-2 rounded-2xl p-5"
          style={{ background: "white", boxShadow: "0 1px 4px rgba(42,74,26,0.07)" }}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm font-semibold" style={{ color: "#2A4A1A" }}>Sessions Per Week</p>
              <p className="text-xs" style={{ color: "#8A9BA8" }}>Completed sessions · last 8 weeks</p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
              style={{ background: "rgba(141,198,63,0.1)", color: "#6BA028" }}>
              {weekBars.reduce((s, w) => s + w.count, 0)} total
            </span>
          </div>
          {weekBars.every(w => w.count === 0) ? (
            <div className="py-8 text-center">
              <p className="text-sm" style={{ color: "#C4C4C4" }}>No completed sessions yet</p>
            </div>
          ) : (
            <BarChart
              values={weekBars.map(w => w.count)}
              labels={weekBars.map(w => w.label)}
              color="#8DC63F"
              height={100}
            />
          )}
        </div>

        {/* Session type donut */}
        <div className="rounded-2xl p-5"
          style={{ background: "white", boxShadow: "0 1px 4px rgba(42,74,26,0.07)" }}>
          <p className="text-sm font-semibold mb-1" style={{ color: "#2A4A1A" }}>Session Types</p>
          <p className="text-xs mb-4" style={{ color: "#8A9BA8" }}>All-time breakdown</p>

          {typeSlices.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm" style={{ color: "#C4C4C4" }}>No sessions yet</p>
            </div>
          ) : (
            <>
              <div className="flex justify-center mb-4">
                <DonutChart slices={typeSlices} size={96} />
              </div>
              <div className="space-y-2">
                {typeSlices.slice(0, 4).map(s => {
                  const total = typeSlices.reduce((t, x) => t + x.value, 0);
                  const pct   = Math.round((s.value / total) * 100);
                  return (
                    <div key={s.label} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: s.color }} />
                      <span className="text-xs truncate flex-1" style={{ color: "#4A5568" }}>
                        {s.label}
                      </span>
                      <span className="text-xs font-semibold" style={{ color: "#2A4A1A" }}>
                        {pct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Revenue + Day heatmap ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Revenue last 6 months */}
        <div className="rounded-2xl p-5"
          style={{ background: "white", boxShadow: "0 1px 4px rgba(42,74,26,0.07)" }}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm font-semibold" style={{ color: "#2A4A1A" }}>Revenue</p>
              <p className="text-xs" style={{ color: "#8A9BA8" }}>Last 6 months · USD</p>
            </div>
            <span className="text-xs font-semibold" style={{ color: "#F7941D" }}>
              {fmt$(monthRevBars.reduce((s, m) => s + m.rev, 0))} total
            </span>
          </div>
          {monthRevBars.every(m => m.rev === 0) ? (
            <div className="py-8 text-center">
              <p className="text-sm" style={{ color: "#C4C4C4" }}>No revenue recorded yet</p>
            </div>
          ) : (
            <BarChart
              values={monthRevBars.map(m => m.rev)}
              labels={monthRevBars.map(m => m.label)}
              color="#F7941D"
              height={90}
            />
          )}
        </div>

        {/* Busiest day of week */}
        <div className="rounded-2xl p-5"
          style={{ background: "white", boxShadow: "0 1px 4px rgba(42,74,26,0.07)" }}>
          <div className="mb-4">
            <p className="text-sm font-semibold" style={{ color: "#2A4A1A" }}>Busiest Days</p>
            <p className="text-xs" style={{ color: "#8A9BA8" }}>Bookings by day of week · all-time</p>
          </div>
          {dayBars.every(v => v === 0) ? (
            <div className="py-8 text-center">
              <p className="text-sm" style={{ color: "#C4C4C4" }}>No bookings yet</p>
            </div>
          ) : (
            <BarChart
              values={dayBars}
              labels={DAY_LABELS}
              color="#2A4A1A"
              height={90}
            />
          )}
        </div>
      </div>

      {/* ── Top clients ────────────────────────────────────────────────── */}
      <div className="rounded-2xl p-5"
        style={{ background: "white", boxShadow: "0 1px 4px rgba(42,74,26,0.07)" }}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm font-semibold" style={{ color: "#2A4A1A" }}>Most Active Clients</p>
            <p className="text-xs" style={{ color: "#8A9BA8" }}>Ranked by total sessions booked</p>
          </div>
          <span className="text-xs" style={{ color: "#C4C4C4" }}>{totalClients} total clients</span>
        </div>

        {topClients.length === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: "#C4C4C4" }}>No sessions yet</p>
        ) : (
          <div className="space-y-3">
            {topClients.map((c, i) => {
              const rate = c.count > 0 ? Math.round((c.completed / c.count) * 100) : 0;
              const maxCount = topClients[0]?.count || 1;
              return (
                <div key={c.name + i} className="flex items-center gap-3">
                  {/* Rank */}
                  <span className="w-5 text-xs font-bold text-right flex-shrink-0"
                    style={{ color: i === 0 ? "#F7941D" : "#C4C4C4" }}>
                    {i + 1}
                  </span>
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ background: "rgba(42,74,26,0.06)", color: "#2A4A1A" }}>
                    {c.name[0]?.toUpperCase() ?? "?"}
                  </div>
                  {/* Name + bar */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium truncate" style={{ color: "#2A4A1A" }}>
                        {c.name}
                      </span>
                      <span className="text-xs flex-shrink-0 ml-2" style={{ color: "#8A9BA8" }}>
                        {c.count} session{c.count !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden"
                      style={{ background: "rgba(42,74,26,0.06)" }}>
                      <div className="h-full rounded-full transition-all"
                        style={{
                          width: `${(c.count / maxCount) * 100}%`,
                          background: i === 0 ? "#F7941D" : "#8DC63F",
                        }} />
                    </div>
                  </div>
                  {/* Completion rate */}
                  <span className="text-xs font-semibold flex-shrink-0 w-10 text-right"
                    style={{ color: rate >= 80 ? "#6BA028" : rate >= 50 ? "#F7941D" : "#8A9BA8" }}>
                    {rate}%
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Zero-data prompt ───────────────────────────────────────────── */}
      {appointments.length === 0 && (
        <div className="rounded-2xl p-8 text-center"
          style={{ background: "rgba(141,198,63,0.04)", border: "1px dashed rgba(141,198,63,0.3)" }}>
          <p className="text-sm font-medium mb-1" style={{ color: "#2A4A1A" }}>
            Analytics will fill in as sessions are completed
          </p>
          <p className="text-xs" style={{ color: "#8A9BA8" }}>
            Charts and metrics update automatically — no action needed.
          </p>
        </div>
      )}
    </div>
  );
}
