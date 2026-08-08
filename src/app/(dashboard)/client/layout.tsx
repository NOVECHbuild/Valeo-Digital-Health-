"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useUnreadCount } from "@/lib/useMessages";
import {
  LayoutDashboard,
  Calendar,
  ClipboardList,
  MessageSquare,
  CreditCard,
  User,
  LogOut,
  Menu,
  X,
  Heart,
  Settings,
  ChevronRight,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import NotificationBell from "@/components/NotificationBell";
import MobileBottomNav from "@/components/MobileBottomNav";
import PwaInstallHint from "@/components/PwaInstallHint";

// ── Nav items ─────────────────────────────────────────────────────────────
// FIX: Settings added; order intentional (Settings near bottom, above sign-out)
const navItems = [
  { href: "/client",              label: "Dashboard",    icon: LayoutDashboard },
  { href: "/client/appointments", label: "Appointments", icon: Calendar        },
  { href: "/client/my-doctor",    label: "My Therapist", icon: Heart           },
  { href: "/client/resources",    label: "Resources",    icon: BookOpen        },
  { href: "/client/assessments",  label: "Assessments",  icon: ClipboardList   },
  { href: "/client/messages",     label: "Messages",     icon: MessageSquare   },
  { href: "/client/payments",     label: "Payments",     icon: CreditCard      },
  { href: "/client/profile",      label: "Profile",      icon: User            },
  { href: "/client/settings",     label: "Settings",     icon: Settings        },
];

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, displayName: profileName } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const shellName = profileName ?? user?.displayName ?? null;
  const firstName = shellName?.split(" ")[0] ?? "there";

  // Real unread message count from the conversations' unreadClient counters
  const unreadMessages = useUnreadCount(user?.uid ?? "", "client");

  // ── FIX: Escape key closes mobile sidebar ─────────────────────────────
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

  // ── FIX: startsWith-aware active check (sub-routes highlight correctly) ─
  function isActive(href: string): boolean {
    if (href === "/client") return pathname === "/client";
    return pathname === href || pathname.startsWith(href + "/");
  }

  const pageTitle = navItems.find(i => isActive(i.href))?.label ?? "Dashboard";

  return (
    <div className="flex h-dvh max-h-dvh overflow-hidden" style={{ background: "#F5F4F0" }}>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── SIDEBAR ───────────────────────────────────────────────── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex h-dvh max-h-dvh w-64 flex-shrink-0 flex-col overflow-hidden",
          "transition-transform duration-300 ease-out lg:transition-none",
          "lg:static lg:z-auto lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
        style={{ background: "#2A4A1A" }}
      >
        {/* Logo */}
        <div className="flex flex-shrink-0 items-center justify-between px-6 py-6 border-b border-white/10">
          <div>
            <span className="text-white text-lg block" style={{ fontFamily: "var(--font-dm-serif)" }}>
              Valeo
            </span>
            <span className="text-xs tracking-widest uppercase" style={{ color: "#8DC63F" }}>
              Health Platform
            </span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-white/50 hover:text-white transition-colors"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        {/* User pill */}
        <div
          className="mx-4 mt-5 mb-2 flex flex-shrink-0 items-center gap-3 rounded-xl p-3"
          style={{ background: "rgba(255,255,255,0.07)" }}
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{ background: "#8DC63F", color: "#2A4A1A" }}
          >
            {firstName?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div className="overflow-hidden">
            <p className="text-white text-sm font-medium truncate">{shellName}</p>
            <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.4)" }}>
              {user?.email}
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="min-h-0 flex-1 space-y-0.5 overflow-x-hidden overflow-y-auto px-3 py-2">
          <p
            className="text-xs font-semibold tracking-widest uppercase px-3 py-2"
            style={{ color: "rgba(255,255,255,0.3)" }}
          >
            Menu
          </p>

          {navItems.map(({ href, label, icon: Icon }) => {
            const active  = isActive(href);
            const isMsgs  = href === "/client/messages";

            return (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                  active ? "" : "text-white/60 hover:text-white hover:bg-white/5"
                )}
                style={active ? { background: "#8DC63F", color: "#2A4A1A" } : {}}
              >
                <Icon size={17} className="flex-shrink-0" />
                <span className="flex-1 min-w-0 truncate">{label}</span>

                {/* FIX: Unread badge on Messages nav item */}
                {isMsgs && unreadMessages > 0 && (
                  <span
                    className="flex items-center justify-center rounded-full text-xs font-bold min-w-[18px] h-[18px] px-1"
                    style={{
                      background: active ? "#2A4A1A" : "#F7941D",
                      color: "white",
                      fontSize: "10px",
                    }}
                  >
                    {unreadMessages > 9 ? "9+" : unreadMessages}
                  </span>
                )}

                {/* FIX: Active chevron — skipped on messages so badge shows instead */}
                {active && !isMsgs && <ChevronRight size={13} />}
              </Link>
            );
          })}
        </nav>

        {/* Sign out */}
        <div className="flex-shrink-0 border-t border-white/10 p-3">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/5 transition-all"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ──────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar */}
        <header
          className="sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b"
          style={{
            background: "rgba(245,244,240,0.92)",
            backdropFilter: "blur(12px)",
            borderColor: "rgba(42,74,26,0.08)",
            paddingTop: "max(0.75rem, env(safe-area-inset-top))",
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-black/5"
              style={{ color: "#2A4A1A" }}
              aria-label="Open sidebar"
            >
              <Menu size={20} />
            </button>
            <h1
              className="text-lg font-medium truncate"
              style={{ fontFamily: "var(--font-dm-serif)", color: "#2A4A1A" }}
            >
              {pageTitle}
            </h1>
          </div>

          <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
            <NotificationBell role="client" unreadCount={unreadMessages} />

            <Link
              href="/client/appointments?book=1"
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 min-h-[44px] rounded-lg text-sm font-semibold text-white transition-all"
              style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)" }}
              aria-label="Book Session"
            >
              <Calendar size={14} />
              <span className="hidden xs:inline sm:inline">Book</span>
              <span className="hidden sm:inline"> Session</span>
            </Link>
          </div>
        </header>

        <main
          className="flex-1 p-4 sm:p-6 overflow-y-auto overflow-x-hidden"
          style={{ paddingBottom: "calc(5.5rem + env(safe-area-inset-bottom, 0px))" }}
        >
          {children}
        </main>

        <MobileBottomNav
          tabs={[
            { href: "/client", label: "Home", icon: LayoutDashboard, exact: true },
            { href: "/client/appointments", label: "Sessions", icon: Calendar },
            { href: "/client/messages", label: "Messages", icon: MessageSquare },
            { href: "/client/payments", label: "Payments", icon: CreditCard },
          ]}
          onMore={() => setSidebarOpen(true)}
        />
        <PwaInstallHint />
      </div>
    </div>
  );
}
