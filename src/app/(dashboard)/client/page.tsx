"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import {
  collection, query, where, onSnapshot,
  orderBy, limit, getDocs, doc, getDoc,
} from "firebase/firestore";
import {
  Calendar, ClipboardList, MessageSquare, TrendingUp,
  Clock, CheckCircle, ArrowRight, Heart, Loader2,
  AlertTriangle, Brain, Video,
} from "lucide-react";
import Link from "next/link";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import { useUnreadCount } from "@/lib/useMessages";

// ── Types ─────────────────────────────────────────────────────────────────
interface ActivityItem {
  id:     string;
  icon:   React.ElementType;
  label:  string;
  time:   string;
  accent: string;
}

interface UpcomingSession {
  id:       string;
  date:     string;
  time:     string;
  type:     string;
  meetLink?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────
function toDate(ts: any): Date {
  if (!ts) return new Date(0);
  if (ts.toDate) return ts.toDate();
  if (typeof ts === "string") return new Date(ts);
  return new Date(ts);
}

function timeAgo(date: Date): string {
  const diffMs  = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1)   return "Just now";
  if (diffMin < 60)  return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24)  return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7)  return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Sub-components ────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, icon: Icon, accent, loading,
}: {
  label: string; value: string | number; sub: string;
  icon: React.ElementType; accent: string; loading?: boolean;
}) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-4"
      style={{ background: "white", boxShadow: "0 1px 3px rgba(42,74,26,0.06)" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium" style={{ color: "#4A5568" }}>{label}</span>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: accent + "18" }}>
          <Icon size={17} style={{ color: accent }} />
        </div>
      </div>
      <div>
        {loading ? (
          <div className="h-8 w-10 rounded animate-pulse" style={{ background: "rgba(42,74,26,0.06)" }} />
        ) : (
          <p className="text-3xl font-semibold"
            style={{ fontFamily: "var(--font-dm-serif)", color: "#2A4A1A" }}>
            {value}
          </p>
        )}
        <p className="text-xs mt-0.5" style={{ color: "#8A9BA8" }}>{sub}</p>
      </div>
    </div>
  );
}

function QuickAction({
  href, icon: Icon, label, desc, accent,
}: {
  href: string; icon: React.ElementType; label: string;
  desc: string; accent: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-2xl p-5 flex items-center gap-4 transition-all duration-200 hover:-translate-y-0.5"
      style={{ background: "white", boxShadow: "0 1px 3px rgba(42,74,26,0.06)" }}
    >
      <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-all group-hover:scale-110"
        style={{ background: accent + "18" }}>
        <Icon size={20} style={{ color: accent }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: "#2A4A1A" }}>{label}</p>
        <p className="text-xs mt-0.5 truncate" style={{ color: "#8A9BA8" }}>{desc}</p>
      </div>
      <ArrowRight size={16}
        className="flex-shrink-0 transition-transform group-hover:translate-x-1"
        style={{ color: "#8A9BA8" }}
      />
    </Link>
  );
}

function ActivityRow({ icon: Icon, label, time, accent }: ActivityItem) {
  return (
    <div className="flex items-center gap-3 py-3 border-b last:border-0"
      style={{ borderColor: "rgba(42,74,26,0.06)" }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: accent + "15" }}>
        <Icon size={15} style={{ color: accent }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm" style={{ color: "#22272B" }}>{label}</p>
      </div>
      <span className="text-xs flex-shrink-0" style={{ color: "#8A9BA8" }}>{time}</span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function ClientDashboard() {
  const { user } = useAuth();

  // ── State ──────────────────────────────────────────────────────────────
  const [loading,         setLoading]         = useState(true);
  const [greeting,        setGreeting]        = useState("Good day");
  const [totalSessions,   setTotalSessions]   = useState(0);
  const [upcomingCount,   setUpcomingCount]   = useState(0);
  const [pendingAssess,   setPendingAssess]   = useState(0);
  const [activity,        setActivity]        = useState<ActivityItem[]>([]);
  const [nextSession,     setNextSession]     = useState<UpcomingSession | null>(null);

  const firstName = user?.displayName?.split(" ")[0] ?? "there";

  // Real unread count from the conversations' unreadClient counters
  const unreadMessages = useUnreadCount(user?.uid ?? "", "client");

  // ── FIX: greeting computed in useEffect to avoid hydration mismatch ────
  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening");
  }, []);

  // ── Live data queries ──────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const uid = user.uid;

    // Today's date for comparisons (computed once, outside any render)
    const todayStr = new Date().toISOString().split("T")[0];

    // 1. Appointments ────────────────────────────────────────────────────
    const apptQ = query(
      collection(db, "appointments"),
      where("clientId", "==", uid),
    );
    const unsubAppts = onSnapshot(apptQ, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() as any }));

      // Completed sessions count
      setTotalSessions(docs.filter(a => a.status === "completed").length);

      // Upcoming (approved + date >= today)
      const upcoming = docs.filter(a =>
        a.status === "approved" && a.date >= todayStr
      ).sort((a, b) => a.date < b.date ? -1 : 1);
      setUpcomingCount(upcoming.length);

      // Next session
      if (upcoming.length > 0) {
        const n = upcoming[0];
        setNextSession({
          id:       n.id,
          date:     n.date,
          time:     n.time,
          type:     n.type,
          meetLink: n.meetLink,
        });
      } else {
        setNextSession(null);
      }
    });

    // 2. Assessments — pending (sent to client, not yet submitted) ────────
    const assessQ = query(
      collection(db, "assessments"),
      where("clientId", "==", uid),
      where("status",   "==", "sent"),
    );
    const unsubAssess = onSnapshot(assessQ, snap => {
      setPendingAssess(snap.size);
    });

    // 3. Recent activity (last 5 events across appointments + assessments) ─
    // We pull the most recent 8 appointments + 8 assessments and merge them
    (async () => {
      try {
        const [apptSnap, assessSnap] = await Promise.all([
          getDocs(query(
            collection(db, "appointments"),
            where("clientId", "==", uid),
            orderBy("createdAt", "desc"),
            limit(8),
          )),
          getDocs(query(
            collection(db, "assessments"),
            where("clientId", "==", uid),
            orderBy("updatedAt", "desc"),
            limit(8),
          )),
        ]);

        const events: { date: Date; item: ActivityItem }[] = [];

        apptSnap.docs.forEach(d => {
          const a = d.data() as any;
          const ts = toDate(a.createdAt);

          let label  = "";
          let icon   = Calendar;
          let accent = "#8DC63F";

          if (a.status === "completed") {
            label  = `Session completed${a.type ? " · " + a.type : ""}`;
            icon   = CheckCircle;
            accent = "#8DC63F";
          } else if (a.status === "approved") {
            label  = `Session booked for ${a.date ?? ""}`;
            icon   = Calendar;
            accent = "#2A4A1A";
          } else if (a.status === "pending") {
            label  = `Appointment request submitted`;
            icon   = Clock;
            accent = "#F7941D";
          } else if (a.status === "cancelled") {
            label  = `Session cancelled`;
            icon   = AlertTriangle;
            accent = "#F7941D";
          }

          if (label) events.push({ date: ts, item: { id: d.id, icon, label, time: timeAgo(ts), accent } });
        });

        assessSnap.docs.forEach(d => {
          const a = d.data() as any;
          const ts = toDate(a.updatedAt ?? a.createdAt);

          let label  = "";
          let icon   = ClipboardList;
          let accent = "#F7941D";

          if (a.status === "completed") {
            label  = `${a.title ?? "Assessment"} completed`;
            icon   = CheckCircle;
            accent = "#8DC63F";
          } else if (a.status === "sent") {
            label  = `New assessment: ${a.title ?? "Wellness check-in"}`;
            icon   = ClipboardList;
            accent = "#F7941D";
          }

          if (label) events.push({ date: ts, item: { id: d.id, icon, label, time: timeAgo(ts), accent } });
        });

        // Sort newest first, take 6
        events.sort((a, b) => b.date.getTime() - a.date.getTime());
        setActivity(events.slice(0, 6).map(e => e.item));
      } catch {
        // silent — activity just stays empty
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      unsubAppts();
      unsubAssess();
    };
  }, [user]);

  // ── Format next session date nicely ────────────────────────────────────
  function fmtNextSession(): string {
    if (!nextSession) return "";
    try {
      const d = new Date(nextSession.date + "T12:00:00");
      return d.toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric",
      }) + " at " + nextSession.time;
    } catch {
      return nextSession.date + " at " + nextSession.time;
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* ── Platform announcements ── */}
      <AnnouncementBanner audience="client" />

      {/* ── Welcome banner ── */}
      <div
        className="rounded-2xl p-6 flex items-center justify-between overflow-hidden relative"
        style={{
          background: "linear-gradient(135deg, #2A4A1A 0%, #3D6B24 100%)",
          boxShadow: "0 4px 24px rgba(42,74,26,0.15)",
        }}
      >
        <div
          className="absolute right-0 top-0 w-64 h-full opacity-10"
          style={{ background: "radial-gradient(circle at 80% 50%, #8DC63F, transparent 70%)" }}
        />
        <div className="relative z-10">
          <p className="text-sm mb-1" style={{ color: "rgba(255,255,255,0.6)" }}>
            {greeting}
          </p>
          <h2
            className="text-2xl text-white mb-2"
            style={{ fontFamily: "var(--font-dm-serif)" }}
          >
            {firstName} 👋
          </h2>
          {nextSession ? (
            <div>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.65)" }}>
                Your next session is coming up.
              </p>
              <div
                className="inline-flex items-center gap-2 mt-3 px-3 py-1.5 rounded-xl text-xs font-semibold"
                style={{ background: "rgba(141,198,63,0.2)", color: "#8DC63F" }}
              >
                <Calendar size={12} />
                {fmtNextSession()}
              </div>
              {nextSession.meetLink && (
                <a
                  href={nextSession.meetLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 mt-3 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
                  style={{ background: "linear-gradient(135deg, #8DC63F, #6BA028)" }}
                >
                  <Video size={15} /> Join Session
                </a>
              )}
            </div>
          ) : (
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.65)" }}>
              Your wellness journey continues. Here&apos;s your overview.
            </p>
          )}
        </div>
        <div className="hidden sm:flex flex-col items-center gap-1 relative z-10">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(141,198,63,0.2)", border: "1px solid rgba(141,198,63,0.3)" }}
          >
            <Heart size={26} style={{ color: "#8DC63F" }} />
          </div>
          <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>Wellness</span>
        </div>
      </div>

      {/* ── Stats grid ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Sessions"
          value={totalSessions}
          sub="Completed sessions"
          icon={CheckCircle}
          accent="#8DC63F"
          loading={loading}
        />
        <StatCard
          label="Upcoming"
          value={upcomingCount}
          sub="Approved sessions"
          icon={Calendar}
          accent="#2A4A1A"
          loading={loading}
        />
        <StatCard
          label="Assessments"
          value={pendingAssess}
          sub="Pending to complete"
          icon={ClipboardList}
          accent={pendingAssess > 0 ? "#F7941D" : "#8DC63F"}
          loading={loading}
        />
        <StatCard
          label="Messages"
          value={unreadMessages}
          sub="Unread messages"
          icon={MessageSquare}
          accent={unreadMessages > 0 ? "#F7941D" : "#8DC63F"}
          loading={loading}
        />
      </div>

      {/* ── Two column layout ── */}
      <div className="grid lg:grid-cols-5 gap-4">

        {/* Quick actions */}
        <div className="lg:col-span-2 space-y-3">
          <h3
            className="text-sm font-semibold uppercase tracking-wider px-1"
            style={{ color: "#8A9BA8" }}
          >
            Quick Actions
          </h3>
          <QuickAction
            href="/client/appointments"
            icon={Calendar}
            label="Book a Session"
            desc="Schedule your next appointment"
            accent="#2A4A1A"
          />
          {pendingAssess > 0 ? (
            <QuickAction
              href="/client/assessments"
              icon={ClipboardList}
              label={`Complete Assessment${pendingAssess > 1 ? `s (${pendingAssess})` : ""}`}
              desc="Pending wellness check-ins"
              accent="#F7941D"
            />
          ) : (
            <QuickAction
              href="/client/assessments"
              icon={ClipboardList}
              label="View Assessments"
              desc="See your wellness history"
              accent="#F7941D"
            />
          )}
          <QuickAction
            href="/client/messages"
            icon={MessageSquare}
            label={unreadMessages > 0 ? `Messages (${unreadMessages} unread)` : "Send a Message"}
            desc="Reach out to your therapist"
            accent="#8DC63F"
          />
          <QuickAction
            href="/client/my-doctor"
            icon={Brain}
            label="My Therapist"
            desc="View your therapist's profile"
            accent="#F7941D"
          />
        </div>

        {/* Recent activity */}
        <div
          className="lg:col-span-3 rounded-2xl p-5"
          style={{ background: "white", boxShadow: "0 1px 3px rgba(42,74,26,0.06)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3
              className="text-sm font-semibold uppercase tracking-wider"
              style={{ color: "#8A9BA8" }}
            >
              Recent Activity
            </h3>
            <Clock size={15} style={{ color: "#8A9BA8" }} />
          </div>

          {loading ? (
            /* Skeleton */
            <div className="space-y-3 py-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg animate-pulse"
                    style={{ background: "rgba(42,74,26,0.06)", flexShrink: 0 }} />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 rounded animate-pulse w-3/4"
                      style={{ background: "rgba(42,74,26,0.06)" }} />
                  </div>
                  <div className="h-3 w-10 rounded animate-pulse"
                    style={{ background: "rgba(42,74,26,0.06)" }} />
                </div>
              ))}
            </div>
          ) : activity.length > 0 ? (
            activity.map(item => (
              <ActivityRow key={item.id} {...item} />
            ))
          ) : (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
                style={{ background: "rgba(141,198,63,0.1)" }}
              >
                <Calendar size={24} style={{ color: "#8DC63F" }} />
              </div>
              <p className="text-sm font-medium mb-1" style={{ color: "#2A4A1A" }}>
                No activity yet
              </p>
              <p className="text-xs mb-4" style={{ color: "#8A9BA8" }}>
                Your sessions and activity will appear here.
              </p>
              <Link
                href="/client/appointments"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)" }}
              >
                <Calendar size={14} />
                Book First Session
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ── Next session banner (if upcoming) ── */}
      {nextSession && (
        <div
          className="rounded-2xl p-5 flex items-center gap-4 flex-wrap"
          style={{
            background: "rgba(42,74,26,0.04)",
            border: "1px solid rgba(42,74,26,0.1)",
          }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(141,198,63,0.15)" }}
          >
            <Calendar size={18} style={{ color: "#8DC63F" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: "#2A4A1A" }}>
              Next Session — {nextSession.type}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "#8A9BA8" }}>
              {fmtNextSession()}
            </p>
          </div>
          {nextSession.meetLink ? (
            <a
              href={nextSession.meetLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)" }}
            >
              <Video size={15} />
              Join Session
            </a>
          ) : (
            <Link
              href="/client/appointments"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border"
              style={{ borderColor: "rgba(42,74,26,0.15)", color: "#2A4A1A" }}
            >
              View Details
            </Link>
          )}
        </div>
      )}

      {/* ── Motivational footer ── */}
      <div
        className="rounded-2xl p-5 flex items-center gap-4"
        style={{ background: "rgba(141,198,63,0.08)", border: "1px solid rgba(141,198,63,0.2)" }}
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(141,198,63,0.15)" }}
        >
          <Heart size={18} style={{ color: "#8DC63F" }} />
        </div>
        <p className="text-sm italic" style={{ color: "#4A5568" }}>
          &ldquo;Healing is not a destination. It is a journey we take together.&rdquo;
          <span className="not-italic font-medium ml-2" style={{ color: "#2A4A1A" }}>
            — Dr. Jozelle M. Miller
          </span>
        </p>
      </div>

    </div>
  );
}
