"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { collection, query, where, onSnapshot } from "firebase/firestore";
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
  Bell,
  Heart,
  Settings,
  ChevronRight,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  const { user } = useAuth();
  const [sidebarOpen,    setSidebarOpen]    = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);

  const firstName = user?.displayName?.split(" ")[0] ?? "there";

  // ── FIX: Real unread message count via onSnapshot ─────────────────────
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "messages"),
      where("participants", "array-contains", user.uid),
    );
    const unsub = onSnapshot(q, snap => {
      let unread = 0;
      snap.docs.forEach(d => {
        const data = d.data();
        if (data.lastSenderId !== user.uid && data.lastMessage && !data.readByClient)
          unread++;
      });
      setUnreadMessages(unread);
    });
    return () => unsub();
  }, [user]);

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
    <div className="min-h-screen flex overflow-hidden" style={{ background: "#F5F4F0" }}>

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
          "fixed top-0 left-0 h-full z-30 flex flex-col transition-transform duration-300",
          // FIX: lg:!translate-x-0 prevents sidebar flash on desktop
          "lg:!translate-x-0 lg:static lg:z-auto",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ width: "256px", minWidth: "256px", background: "#2A4A1A" }}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-6 py-6 border-b border-white/10">
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
          className="mx-4 mt-5 mb-2 rounded-xl p-3 flex items-center gap-3"
          style={{ background: "rgba(255,255,255,0.07)" }}
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{ background: "#8DC63F", color: "#2A4A1A" }}
          >
            {firstName?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div className="overflow-hidden">
            <p className="text-white text-sm font-medium truncate">{user?.displayName}</p>
            <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.4)" }}>
              {user?.email}
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 min-h-0 px-3 py-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
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
        <div className="p-3 border-t border-white/10">
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
          className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b"
          style={{
            background: "rgba(245,244,240,0.92)",
            backdropFilter: "blur(12px)",
            borderColor: "rgba(42,74,26,0.08)",
          }}
        >
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-black/5"
              style={{ color: "#2A4A1A" }}
              aria-label="Open sidebar"
            >
              <Menu size={20} />
            </button>
            {/* FIX: Header title uses startsWith-aware pageTitle */}
            <h1
              className="text-lg font-medium"
              style={{ fontFamily: "var(--font-dm-serif)", color: "#2A4A1A" }}
            >
              {pageTitle}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* FIX: Bell only shows red dot when there are real unread messages */}
            <button
              className="relative p-2 rounded-lg hover:bg-black/5 transition-colors"
              style={{ color: "#4A5568" }}
              aria-label="Notifications"
            >
              <Bell size={18} />
              {unreadMessages > 0 && (
                <span
                  className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
                  style={{ background: "#F7941D" }}
                />
              )}
            </button>

            {/* Book session CTA */}
            <Link
              href="/client/appointments"
              className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all"
              style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)" }}
            >
              <Calendar size={14} />
              Book Session
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
