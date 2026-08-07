"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Users, DollarSign, Calendar, TrendingUp, ArrowRight,
  Activity, Clock, Stethoscope, Settings, Loader2,
  CheckCircle, AlertCircle, UserPlus, Banknote, Globe,
} from "lucide-react";
import Link from "next/link";

type UserDoc     = { uid: string; role: string; displayName: string; email: string; createdAt: any; isActive?: boolean; };
type Appointment = { id: string; status: string; sessionType: string; createdAt: any; clientId: string; doctorId: string; };
type Payment     = { id: string; amount: number; status: string; createdAt: any; source: "online"|"manual"; };

const C = { ocean:"#2A4A1A", dark:"#1E3810", teal:"#8DC63F", coral:"#F7941D", gold:"#F7941D", slate:"#8A9BA8" };

function toDate(ts: any): Date|null {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();
  if (ts instanceof Date) return ts;
  if (typeof ts === "string") return new Date(ts);
  return null;
}
function timeAgo(d: Date): string {
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff/60000), h = Math.floor(diff/3600000), day = Math.floor(diff/86400000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${day}d ago`;
}
const fmt = (n: number) => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(n);

function StatCard({ label, value, sub, icon: Icon, accent, trend }: {
  label: string; value: string|number; sub: string;
  icon: React.ElementType; accent: string;
  trend?: { value: string; positive: boolean };
}) {
  return (
    <div className="rounded-2xl p-5" style={{ background:"white", boxShadow:"0 1px 4px rgba(30,56,16,0.07)" }}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color:C.slate }}>{label}</span>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background:accent+"15" }}>
          <Icon size={17} style={{ color:accent }}/>
        </div>
      </div>
      <p className="text-3xl font-semibold mb-1" style={{ fontFamily:"var(--font-dm-serif)", color:C.dark }}>{value}</p>
      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color:C.slate }}>{sub}</p>
        {trend && (
          <span className="text-xs font-medium flex items-center gap-1" style={{ color: trend.positive ? C.teal : C.coral }}>
            <TrendingUp size={11}/>{trend.value}
          </span>
        )}
      </div>
    </div>
  );
}

function QuickAction({ href, icon: Icon, label, accent }: { href:string; icon:React.ElementType; label:string; accent:string }) {
  return (
    <Link href={href} className="group flex items-center gap-3 p-3 rounded-xl transition-all hover:-translate-y-0.5"
      style={{ background:"rgba(30,56,16,0.03)", border:"1px solid rgba(30,56,16,0.06)" }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background:accent+"15" }}>
        <Icon size={16} style={{ color:accent }}/>
      </div>
      <span className="text-sm font-medium flex-1" style={{ color:C.dark }}>{label}</span>
      <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" style={{ color:C.slate }}/>
    </Link>
  );
}

type FeedEvent = { id:string; label:string; sub:string; time:Date; type:"user"|"appt"|"payment"; };

function FeedItem({ event }: { event: FeedEvent }) {
  const cfg = {
    user:    { Icon: UserPlus, color: C.teal  },
    appt:    { Icon: Calendar, color: C.coral },
    payment: { Icon: Banknote, color: C.gold  },
  }[event.type];
  return (
    <div className="flex items-start gap-3 py-3 border-b last:border-0" style={{ borderColor:"rgba(30,56,16,0.05)" }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background:cfg.color+"15" }}>
        <cfg.Icon size={14} style={{ color:cfg.color }}/>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color:C.dark }}>{event.label}</p>
        <p className="text-xs" style={{ color:C.slate }}>{event.sub}</p>
      </div>
      <span className="text-xs flex-shrink-0 mt-0.5" style={{ color:"#C4C4C4" }}>{timeAgo(event.time)}</span>
    </div>
  );
}

export default function AdminDashboard() {
  const [users,    setUsers]    = useState<UserDoc[]>([]);
  const [appts,    setAppts]    = useState<Appointment[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading,  setLoading]  = useState(true);
  // ⬇ Fix: date rendered client-side only to prevent hydration mismatch
  const [today, setToday] = useState("");

  useEffect(() => {
    // Set date only on client — avoids server/client timezone mismatch
    setToday(new Date().toLocaleDateString("en-US", {
      weekday:"long", month:"long", day:"numeric", year:"numeric"
    }));

    (async () => {
      const [uSnap, aSnap, pSnap, mpSnap] = await Promise.all([
        getDocs(collection(db, "users")),
        getDocs(query(collection(db, "appointments"),    orderBy("createdAt","desc"))),
        getDocs(query(collection(db, "payments"),        orderBy("createdAt","desc"))),
        getDocs(query(collection(db, "manualPayments"),  orderBy("createdAt","desc"))),
      ]);
      setUsers(uSnap.docs.map(d => ({ uid:d.id, ...d.data() }) as UserDoc));
      setAppts(aSnap.docs.map(d => ({ id:d.id, ...d.data() }) as Appointment));

      const online: Payment[] = pSnap.docs.map(d => {
        const data = d.data() as any;
        return { id:d.id, amount:data.amount??0, status:data.status??"pending", createdAt:data.createdAt, source:"online" };
      });
      const manual: Payment[] = mpSnap.docs.map(d => {
        const data = d.data() as any;
        return { id:d.id, amount:data.amount??0, status:data.status??"completed", createdAt:data.createdAt, source:"manual" };
      });
      setPayments([...online, ...manual]);
      setLoading(false);
    })();
  }, []);

  const now        = new Date();
  const thisMonthK = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const monthKey   = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;

  const clients        = users.filter(u => u.role==="client");
  const doctors        = users.filter(u => u.role==="doctor");
  const completedAppts = appts.filter(a => a.status==="completed");
  const pendingAppts   = appts.filter(a => a.status==="pending");

  const completedPay  = payments.filter(p => p.status==="completed");
  const totalRevenue  = completedPay.reduce((s,p) => s+p.amount, 0);
  const onlineRevenue = completedPay.filter(p => p.source==="online").reduce((s,p) => s+p.amount, 0);
  const manualRevenue = completedPay.filter(p => p.source==="manual").reduce((s,p) => s+p.amount, 0);

  const sessionsThisMonth = completedAppts.filter(a => { const d=toDate(a.createdAt); return d && monthKey(d)===thisMonthK; }).length;
  const newUsersThisMonth = clients.filter(u => { const d=toDate(u.createdAt); return d && monthKey(d)===thisMonthK; }).length;
  const revenueThisMonth  = completedPay.filter(p => { const d=toDate(p.createdAt); return d && monthKey(d)===thisMonthK; }).reduce((s,p)=>s+p.amount,0);

  const feedEvents: FeedEvent[] = [];
  clients.slice(0,10).forEach(u => {
    const d = toDate(u.createdAt);
    if (d) feedEvents.push({ id:"u-"+u.uid, label:`${u.displayName||u.email} joined`, sub:"New client registered", time:d, type:"user" });
  });
  appts.slice(0,10).forEach(a => {
    const d = toDate(a.createdAt);
    if (d) feedEvents.push({ id:"a-"+a.id, label:`${a.sessionType||"Session"} booked`, sub:`Status: ${a.status}`, time:d, type:"appt" });
  });
  completedPay.slice(0,10).forEach(p => {
    const d = toDate(p.createdAt);
    if (d) feedEvents.push({ id:"p-"+p.id, label:`Payment received — ${fmt(p.amount)}`, sub:p.source==="manual"?"Manual / Cash":"Online (Stripe)", time:d, type:"payment" });
  });
  const feed = feedEvents.sort((a,b) => b.time.getTime()-a.time.getTime()).slice(0,8);

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 size={28} className="animate-spin" style={{ color:C.teal }}/>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Hero banner */}
      <div className="rounded-2xl p-6 relative overflow-hidden"
        style={{ background:"linear-gradient(135deg, #1E3810 0%, #2D2D4E 100%)", boxShadow:"0 4px 24px rgba(30,56,16,0.2)" }}>
        <div className="absolute right-0 top-0 w-80 h-full opacity-10"
          style={{ background:"radial-gradient(circle at 80% 50%, #F7941D, transparent 70%)" }}/>
        <div className="relative z-10 flex items-start justify-between flex-wrap gap-4">
          <div>
            {/* Render date only after client mount — no hydration mismatch */}
            <p className="text-sm mb-1" style={{ color:"rgba(255,255,255,0.45)" }}>
              {today || <span className="opacity-0">–</span>}
            </p>
            <h2 className="text-2xl text-white mb-2" style={{ fontFamily:"var(--font-dm-serif)" }}>Platform Overview</h2>
            <p className="text-sm" style={{ color:"rgba(255,255,255,0.55)" }}>
              The Valeo Experience is <span className="text-white font-semibold">operational</span>. All systems normal.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl"
              style={{ background:"rgba(141,198,63,0.12)", border:"1px solid rgba(141,198,63,0.2)" }}>
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background:C.teal }}/>
              <span className="text-sm font-medium" style={{ color:C.teal }}>All Systems Online</span>
            </div>
            {pendingAppts.length > 0 && (
              <Link href="/admin/assignments" className="flex items-center gap-2 px-4 py-2 rounded-xl transition-opacity hover:opacity-80"
                style={{ background:"rgba(247,148,29,0.15)", border:"1px solid rgba(247,148,29,0.3)" }}>
                <AlertCircle size={13} style={{ color:C.coral }}/>
                <span className="text-sm font-medium" style={{ color:C.coral }}>
                  {pendingAppts.length} pending appointment{pendingAppts.length!==1?"s":""}
                </span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Clients"  value={clients.length}        sub={`+${newUsersThisMonth} this month`}    icon={Users}       accent={C.teal}  trend={{ value:`+${newUsersThisMonth} this month`, positive:true }}/>
        <StatCard label="Active Doctors" value={doctors.length}        sub="Verified practitioners"                icon={Stethoscope} accent={C.ocean} />
        <StatCard label="Sessions"       value={completedAppts.length} sub={`${sessionsThisMonth} this month`}     icon={Calendar}    accent={C.coral} trend={{ value:`${sessionsThisMonth} this month`, positive:true }}/>
        <StatCard label="Revenue"        value={fmt(totalRevenue)}     sub={`${fmt(revenueThisMonth)} this month`} icon={DollarSign}  accent={C.gold}  trend={{ value:`${fmt(revenueThisMonth)} this month`, positive:true }}/>
      </div>

      {/* Revenue split */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl p-4 flex items-center gap-4" style={{ background:"white", boxShadow:"0 1px 4px rgba(30,56,16,0.07)" }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background:C.teal+"15" }}>
            <Globe size={18} style={{ color:C.teal }}/>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color:C.slate }}>Online Revenue</p>
            <p className="text-xl font-bold" style={{ fontFamily:"var(--font-dm-serif)", color:C.dark }}>{fmt(onlineRevenue)}</p>
          </div>
        </div>
        <div className="rounded-2xl p-4 flex items-center gap-4" style={{ background:"white", boxShadow:"0 1px 4px rgba(30,56,16,0.07)" }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background:C.gold+"15" }}>
            <Banknote size={18} style={{ color:C.gold }}/>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color:C.slate }}>Manual / Cash</p>
            <p className="text-xl font-bold" style={{ fontFamily:"var(--font-dm-serif)", color:C.dark }}>{fmt(manualRevenue)}</p>
          </div>
        </div>
      </div>

      {/* Activity feed + Quick Actions */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl p-5" style={{ background:"white", boxShadow:"0 1px 4px rgba(30,56,16,0.07)" }}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color:C.slate }}>Recent Activity</h3>
            <Activity size={15} style={{ color:C.slate }}/>
          </div>
          {feed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ background:"rgba(247,148,29,0.06)" }}>
                <Activity size={24} style={{ color:C.coral }}/>
              </div>
              <p className="text-sm font-medium mb-1" style={{ color:C.dark }}>No activity yet</p>
              <p className="text-xs" style={{ color:C.slate }}>User registrations, bookings, and payments will appear here.</p>
            </div>
          ) : (
            <div>{feed.map(event => <FeedItem key={event.id} event={event}/>)}</div>
          )}
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider px-1" style={{ color:C.slate }}>Quick Actions</h3>
          <QuickAction href="/admin/users"              icon={Users}       label="Manage Users"      accent={C.teal}  />
          <QuickAction href="/admin/users/add-doctor"   icon={Stethoscope} label="Add Doctor"        accent={C.ocean} />
          <QuickAction href="/admin/financials"         icon={DollarSign}  label="View Financials"   accent={C.gold}  />
          <QuickAction href="/admin/analytics"          icon={TrendingUp}  label="Analytics"         accent={C.coral} />
          <QuickAction href="/admin/announcements"      icon={Activity}    label="Announcements"     accent="#9B59B6" />
          <QuickAction href="/admin/settings"           icon={Settings}    label="Platform Settings" accent={C.dark}  />
          <div className="rounded-xl p-4" style={{ background:"rgba(30,56,16,0.03)", border:"1px solid rgba(30,56,16,0.08)" }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color:C.slate }}>System Health</p>
            {[
              { label:"Firebase Auth",  status:"Operational",    ok:true  },
              { label:"Firestore DB",   status:"Operational",    ok:true  },
              { label:"Storage",        status:"Operational",    ok:true  },
              { label:"Stripe Gateway", status:"Test mode",      ok:true  },
            ].map(({ label, status, ok }) => (
              <div key={label} className="flex items-center justify-between py-1.5 border-b last:border-0" style={{ borderColor:"rgba(30,56,16,0.06)" }}>
                <span className="text-xs" style={{ color:"#4A5568" }}>{label}</span>
                <span className="text-xs font-medium flex items-center gap-1" style={{ color:ok?C.teal:C.coral }}>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background:ok?C.teal:C.coral }}/>
                  {status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom summary cards */}
      <div className="grid lg:grid-cols-4 gap-4">
        {[
          { label:"Clients",           count:clients.length,        icon:Users,       accent:C.teal,  desc:"Registered clients",  href:"/admin/users"        },
          { label:"Doctors",           count:doctors.length,        icon:Stethoscope, accent:C.ocean, desc:"Active practitioners", href:"/admin/users"        },
          { label:"Pending",           count:pendingAppts.length,   icon:Clock,       accent:C.coral, desc:"Awaiting approval",    href:"/admin/analytics"    },
          { label:"Sessions Complete", count:completedAppts.length, icon:CheckCircle, accent:C.gold,  desc:"All time",            href:"/admin/analytics"    },
        ].map(({ label, count, icon: Icon, accent, desc, href }) => (
          <Link key={label} href={href}
            className="group rounded-2xl p-5 flex items-center gap-4 transition-all hover:-translate-y-0.5"
            style={{ background:"white", boxShadow:"0 1px 4px rgba(30,56,16,0.07)" }}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background:accent+"12" }}>
              <Icon size={22} style={{ color:accent }}/>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-2xl font-semibold" style={{ fontFamily:"var(--font-dm-serif)", color:C.dark }}>{count}</p>
              <p className="text-sm font-medium truncate" style={{ color:C.dark }}>{label}</p>
              <p className="text-xs" style={{ color:C.slate }}>{desc}</p>
            </div>
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-1 flex-shrink-0" style={{ color:C.slate }}/>
          </Link>
        ))}
      </div>

    </div>
  );
}
