"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard,
  Users,
  DollarSign,
  BarChart2,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  Shield,
  ChevronRight,
  UserCheck,
  Megaphone,
  CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin",             label: "Overview",    icon: LayoutDashboard },
  { href: "/admin/users",       label: "Users",       icon: Users },
  { href: "/admin/assignments",  label: "Assignments", icon: UserCheck },
  { href: "/admin/financials",  label: "Financials",  icon: DollarSign },
  { href: "/admin/analytics",   label: "Analytics",   icon: BarChart2 },
  { href: "/admin/settings",    label: "Settings",    icon: Settings },
  { href: "/admin/announcements", label: "Announcements",    icon: Megaphone },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router   = useRouter();
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function handleSignOut() {
    await signOut(auth);
    router.push("/login");
  }

  // ── Active route + page title using startsWith ──────────────────────────
  // Original used exact `pathname === href` — any sub-route like
  // /admin/users/add-doctor showed no active nav item and a blank header title.
  function isActive(href: string): boolean {
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(href + "/");
  }

  const pageTitle = navItems.find(i => isActive(i.href))?.label ?? "Admin Console";

  return (
    <div className="min-h-screen flex overflow-hidden" style={{ background: "#F4F4F6" }}>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={cn(
          // FIX: added flex-shrink-0 and overflow-hidden to prevent nav leaking
          "fixed top-0 left-0 h-full z-30 flex flex-col flex-shrink-0 overflow-hidden transition-transform duration-300",
          "lg:!translate-x-0 lg:static lg:z-auto",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ width: "256px", minWidth: "256px", background: "#1E3810" }}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-6 py-6 border-b border-white/10">
          <div>
            <span
              className="text-white text-lg block"
              style={{ fontFamily: "var(--font-dm-serif)" }}
            >
              Valeo
            </span>
            <span className="text-xs tracking-widest uppercase" style={{ color: "#F7941D" }}>
              Admin Console
            </span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-white/50 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Admin pill */}
        <div
          className="mx-4 mt-5 mb-2 rounded-xl p-3 flex items-center gap-3"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #F7941D, #C4700A)", color: "white" }}
          >
            <Shield size={15} />
          </div>
          <div className="overflow-hidden">
            <p className="text-white text-sm font-medium truncate">
              {user?.displayName ?? "Admin"}
            </p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
              Platform Administrator
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 min-h-0 px-3 py-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
          <p
            className="text-xs font-semibold tracking-widest uppercase px-3 py-2"
            style={{ color: "rgba(255,255,255,0.25)" }}
          >
            Console
          </p>
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                  active ? "" : "text-white/55 hover:text-white hover:bg-white/5"
                )}
                style={active ? { background: "#F7941D", color: "white" } : {}}
              >
                <Icon size={17} className="flex-shrink-0" />
                <span className="flex-1 min-w-0 truncate">{label}</span>
                {active && <ChevronRight size={13} className="flex-shrink-0" />}
              </Link>
            );
          })}
        </nav>

        {/* Sign out */}
        <div className="p-3 border-t border-white/10">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                       text-white/40 hover:text-white hover:bg-white/5 transition-all"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar */}
        <header
          className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b"
          style={{
            background: "rgba(244,244,246,0.92)",
            backdropFilter: "blur(12px)",
            borderColor: "rgba(30,56,16,0.08)",
          }}
        >
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-black/5"
              style={{ color: "#1E3810" }}
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2">
              <Shield size={16} style={{ color: "#F7941D" }} />
              <h1
                className="text-lg font-medium"
                style={{ fontFamily: "var(--font-dm-serif)", color: "#1E3810" }}
              >
                {pageTitle}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              className="relative p-2 rounded-lg hover:bg-black/5 transition-colors"
              style={{ color: "#4A5568" }}
            >
              <Bell size={18} />
              <span
                className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
                style={{ background: "#F7941D" }}
              />
            </button>
            <div
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: "rgba(247,148,29,0.1)", color: "#F7941D" }}
            >
              <Shield size={12} />
              Admin Access
            </div>
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
