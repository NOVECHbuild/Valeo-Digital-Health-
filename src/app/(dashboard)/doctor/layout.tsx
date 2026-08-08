"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useUnreadCount } from "@/lib/useMessages";
import {
  LayoutDashboard, Calendar, Users, ClipboardList,
  FileText, BarChart2, LogOut, Menu, X,
  Stethoscope, MessageCircle, ChevronRight,
  Settings, BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import NotificationBell from "@/components/NotificationBell";
import MobileBottomNav from "@/components/MobileBottomNav";
import PwaInstallHint from "@/components/PwaInstallHint";

// ── Nav items ────────────────────────────────────────────────────────────────
// NOTE: Settings is listed here — if it doesn't appear, run:
//   Vercel dashboard → Deployments → Redeploy (clear cache)
const navItems = [
  { href: "/doctor",             label: "Dashboard",   icon: LayoutDashboard },
  { href: "/doctor/schedule",    label: "Schedule",    icon: Calendar        },
  { href: "/doctor/clients",     label: "Clients",     icon: Users           },
  { href: "/doctor/messages",    label: "Messages",    icon: MessageCircle   },
  { href: "/doctor/assessments", label: "Assessments", icon: ClipboardList   },
  { href: "/doctor/notes",       label: "Notes",       icon: FileText        },
  { href: "/doctor/resources",   label: "Resources",   icon: BookOpen        },
  { href: "/doctor/analytics",   label: "Analytics",   icon: BarChart2       },
  { href: "/doctor/settings",    label: "Settings",    icon: Settings        },
];

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, displayName: profileName } = useAuth();
  const [sidebarOpen,    setSidebarOpen]    = useState(false);
  const [specialization, setSpecialization] = useState("Health Psychologist");
  // Real unread count from the conversations' unreadDoctor counters
  const unreadMessages = useUnreadCount(user?.uid ?? "", "doctor");

  // ── Dr. name — strip leading "Dr." so we never get "Dr. Dr. Name" ─────────
  const rawName   = profileName ?? user?.displayName ?? "Doctor";
  const cleanName = rawName.replace(/^Dr\.?\s*/i, "");
  const firstName = cleanName.split(" ")[0];

  // ── FIX 3: Load specialization from Firestore instead of hardcoding ───────
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        // Check doctors collection first (has specialization), fall back to users
        const doctorSnap = await getDoc(doc(db, "doctors", user.uid));
        if (doctorSnap.exists()) {
          const data = doctorSnap.data();
          if (data.specialization) setSpecialization(data.specialization);
        }
      } catch {
        // silent — fallback value is already set
      }
    })();
  }, [user]);

  // ── FIX 5: Escape key closes mobile sidebar ───────────────────────────────
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape" && sidebarOpen) setSidebarOpen(false);
  }, [sidebarOpen]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  async function handleSignOut() {
    await signOut(auth);
    router.push("/login");
  }

  // ── FIX 2 + 6: Active route and page title using startsWith ──────────────
  // Original used exact `pathname === href` — any sub-route like
  // /doctor/schedule/edit showed no active nav item and blank header title.
  function isActive(href: string): boolean {
    if (href === "/doctor") return pathname === "/doctor";
    return pathname === href || pathname.startsWith(href + "/");
  }

  const activeItem  = navItems.find(i => isActive(i.href));
  const pageTitle   = activeItem?.label ?? "Dashboard";

  return (
    // One page scroll: sidebar + main move together (no nested sidebar scrollbar).
    <div className="flex min-h-dvh" style={{ background: "#F0F4F4" }}>

      {/* Mobile overlay — above bottom nav so More menu is fully usable */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── SIDEBAR ─────────────────────────────────────────────────── */}
      <aside
        className={cn(
          "z-[60] flex w-64 flex-shrink-0 flex-col",
          // Mobile drawer: fixed; allow scroll if needed but hide the scrollbar chrome
          "fixed inset-y-0 left-0 h-dvh overflow-y-auto overflow-x-hidden",
          "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
          "transition-transform duration-300 ease-out lg:transition-none",
          // Desktop: in document flow — stretches with page, scrolls with window
          "lg:static lg:z-auto lg:h-auto lg:min-h-dvh lg:overflow-visible lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
        style={{ background: "#1E3810" }}
      >
        {/* Logo */}
        <div className="flex flex-shrink-0 items-center justify-between px-6 py-6 border-b border-white/10">
          <div>
            <span className="text-white text-lg block" style={{ fontFamily: "var(--font-dm-serif)" }}>
              Valeo
            </span>
            <span className="text-xs tracking-widest uppercase" style={{ color: "#8DC63F" }}>
              Doctor Portal
            </span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-white/50 hover:text-white transition-colors"
            aria-label="Close sidebar">
            <X size={18} />
          </button>
        </div>

        {/* Doctor identity pill */}
        <div className="mx-4 mt-5 mb-2 flex flex-shrink-0 items-center gap-3 rounded-xl p-3"
          style={{ background: "rgba(255,255,255,0.07)" }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
            style={{ background: "linear-gradient(135deg, #8DC63F, #6BA028)", color: "#1E3810", fontFamily: "var(--font-dm-serif)" }}>
            {cleanName[0]?.toUpperCase() ?? "D"}
          </div>
          <div className="overflow-hidden">
            <p className="text-white text-sm font-medium truncate">Dr. {cleanName}</p>
            {/* FIX 3: Dynamic specialization from Firestore */}
            <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.4)" }}>
              {specialization}
            </p>
          </div>
        </div>

        {/* Nav — no internal scroll on desktop; grows with the column */}
        <nav className="flex-1 space-y-0.5 px-3 py-2">
          <p className="text-xs font-semibold tracking-widest uppercase px-3 py-2"
            style={{ color: "rgba(255,255,255,0.3)" }}>
            Navigation
          </p>

          {navItems.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);   // FIX 2
            const isMsgs = href === "/doctor/messages";

            return (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                  active ? "" : "text-white/60 hover:text-white hover:bg-white/5"
                )}
                style={active ? { background: "#8DC63F", color: "#1E3810" } : {}}>
                <Icon size={17} className="flex-shrink-0" />
                <span className="flex-1 min-w-0 truncate">{label}</span>

                {/* FIX 4: Unread message badge on Messages nav item */}
                {isMsgs && unreadMessages > 0 && (
                  <span
                    className="flex items-center justify-center rounded-full text-xs font-bold min-w-[18px] h-[18px] px-1"
                    style={{
                      background: active ? "#1E3810" : "#F7941D",
                      color: "white",
                      fontSize: "10px",
                    }}>
                    {unreadMessages > 9 ? "9+" : unreadMessages}
                  </span>
                )}

                {active && !isMsgs && <ChevronRight size={13} />}
              </Link>
            );
          })}
        </nav>

        {/* Sign out — clear of home-indicator; sits above bottom nav when drawer open */}
        <div
          className="mt-auto flex-shrink-0 border-t border-white/10 p-3"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }}
        >
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-3 min-h-[48px] rounded-lg text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 transition-all">
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────── */}
      <div className="flex min-h-dvh flex-1 flex-col min-w-0">

        {/* Top bar */}
        <header
          className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b"
          style={{
            background: "rgba(240,244,244,0.92)",
            backdropFilter: "blur(12px)",
            borderColor: "rgba(30,56,16,0.08)",
            paddingTop: "max(0.75rem, env(safe-area-inset-top))",
          }}>

          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-black/5"
              style={{ color: "#1E3810" }}
              aria-label="Open sidebar">
              <Menu size={20} />
            </button>
            <h1
              className="text-lg font-medium truncate"
              style={{ fontFamily: "var(--font-dm-serif)", color: "#1E3810" }}>
              {pageTitle}
            </h1>
          </div>

          <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
            <NotificationBell role="doctor" unreadCount={unreadMessages} />

            <div
              className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: "rgba(141,198,63,0.12)", color: "#1E3810" }}>
              <Stethoscope size={14} />
              Dr. {firstName}
            </div>
          </div>
        </header>

        <main
          className="flex-1 p-4 sm:p-6"
          style={{ paddingBottom: "calc(5.5rem + env(safe-area-inset-bottom, 0px))" }}
        >
          {children}
        </main>

        <MobileBottomNav
          tabs={[
            { href: "/doctor", label: "Home", icon: LayoutDashboard, exact: true },
            { href: "/doctor/schedule", label: "Schedule", icon: Calendar },
            { href: "/doctor/clients", label: "Clients", icon: Users },
            { href: "/doctor/messages", label: "Messages", icon: MessageCircle },
          ]}
          onMore={() => setSidebarOpen(true)}
        />
        <PwaInstallHint />
      </div>
    </div>
  );
}
