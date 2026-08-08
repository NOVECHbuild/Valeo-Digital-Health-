"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bell, MessageSquare, ClipboardList, Calendar, Megaphone, X,
} from "lucide-react";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

type Role = "client" | "doctor" | "admin";

type FeedItem = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  Icon: typeof MessageSquare;
  accent: string;
};

/**
 * Header notification bell — mobile bottom sheet + role-aware live feed.
 */
export default function NotificationBell({
  role,
  unreadCount = 0,
  messagesHref,
}: {
  role: Role;
  unreadCount?: number;
  messagesHref?: string;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const href =
    messagesHref ??
    (role === "client" ? "/client/messages" : role === "doctor" ? "/doctor/messages" : undefined);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const next: FeedItem[] = [];
      try {
        if (role !== "admin" && unreadCount > 0 && href) {
          next.push({
            id: "messages",
            title: `${unreadCount} unread message${unreadCount === 1 ? "" : "s"}`,
            subtitle: "Open Messages to reply",
            href,
            Icon: MessageSquare,
            accent: "#F7941D",
          });
        }

        if (role === "client") {
          const today = new Date();
          const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
          const todayStr = today.toISOString().split("T")[0];
          const tomorrowStr = tomorrow.toISOString().split("T")[0];
          const apptSnap = await getDocs(
            query(
              collection(db, "appointments"),
              where("clientId", "==", user.uid),
              where("status", "==", "approved"),
              limit(20),
            ),
          );
          const soon = apptSnap.docs
            .map(d => ({ id: d.id, ...d.data() } as any))
            .filter(a => a.date === todayStr || a.date === tomorrowStr);
          if (soon.length > 0) {
            const a = soon.sort((x, y) => `${x.date}${x.time}`.localeCompare(`${y.date}${y.time}`))[0];
            next.push({
              id: `appt-${a.id}`,
              title: a.date === todayStr ? "Session today" : "Session tomorrow",
              subtitle: `${a.type || "Session"} · ${a.time || ""}`.trim(),
              href: "/client/appointments",
              Icon: Calendar,
              accent: "#8DC63F",
            });
          }

          const assessSnap = await getDocs(
            query(
              collection(db, "assessments"),
              where("clientId", "==", user.uid),
              where("status", "==", "pending"),
              limit(5),
            ),
          );
          if (!assessSnap.empty) {
            next.push({
              id: "assessments",
              title: `${assessSnap.size} pending assessment${assessSnap.size === 1 ? "" : "s"}`,
              subtitle: "Complete forms assigned by your therapist",
              href: "/client/assessments",
              Icon: ClipboardList,
              accent: "#C4700A",
            });
          }
        }

        if (role === "doctor") {
          const pendingSnap = await getDocs(
            query(
              collection(db, "appointments"),
              where("doctorId", "==", user.uid),
              where("status", "==", "pending"),
              limit(10),
            ),
          );
          if (!pendingSnap.empty) {
            next.push({
              id: "pending-appts",
              title: `${pendingSnap.size} booking request${pendingSnap.size === 1 ? "" : "s"}`,
              subtitle: "Review in Schedule",
              href: "/doctor/schedule",
              Icon: Calendar,
              accent: "#F7941D",
            });
          }
        }

        if (role === "admin") {
          next.push({
            id: "announcements",
            title: "Announcements",
            subtitle: "Broadcast to clients and doctors",
            href: "/admin/announcements",
            Icon: Megaphone,
            accent: "#6BA028",
          });
        }
      } catch (e) {
        console.warn("[NotificationBell] feed", e);
      }
      if (!cancelled) {
        setItems(next);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, user, role, unreadCount, href]);

  const showDot = items.length > 0 || (role !== "admin" && unreadCount > 0);

  const panel = (
    <>
      <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "rgba(42,74,26,0.06)" }}>
        <p className="text-sm font-semibold" style={{ color: "#2A4A1A" }}>Notifications</p>
        <button type="button" className="sm:hidden p-2 rounded-lg hover:bg-black/5" onClick={() => setOpen(false)} aria-label="Close">
          <X size={16} style={{ color: "#8A9BA8" }} />
        </button>
      </div>

      <div className="max-h-[60vh] overflow-y-auto">
        {loading ? (
          <p className="px-4 py-6 text-center text-xs" style={{ color: "#8A9BA8" }}>Loading…</p>
        ) : items.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-sm font-medium mb-1" style={{ color: "#2A4A1A" }}>You&apos;re all caught up</p>
            <p className="text-xs" style={{ color: "#8A9BA8" }}>
              {role === "admin" ? "Use Announcements to broadcast updates." : "New alerts will show up here."}
            </p>
            {href && role !== "admin" && (
              <Link href={href} onClick={() => setOpen(false)} className="inline-flex mt-3 text-xs font-semibold" style={{ color: "#6BA028" }}>
                Go to Messages
              </Link>
            )}
          </div>
        ) : (
          items.map(item => {
            const Icon = item.Icon;
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-start gap-3 px-4 py-3.5 hover:bg-black/[0.03] transition-colors border-b last:border-0"
                style={{ borderColor: "rgba(42,74,26,0.04)" }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(42,74,26,0.06)" }}
                >
                  <Icon size={16} style={{ color: item.accent }} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium" style={{ color: "#2A4A1A" }}>{item.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#8A9BA8" }}>{item.subtitle}</p>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </>
  );

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="relative p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-black/5 transition-colors"
        style={{ color: "#4A5568" }}
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell size={20} />
        {showDot && (
          <span
            className="absolute top-2 right-2 w-2 h-2 rounded-full"
            style={{ background: "#F7941D" }}
          />
        )}
      </button>

      {/* Desktop dropdown */}
      {open && (
        <div
          className="hidden sm:block absolute right-0 mt-2 w-80 rounded-2xl overflow-hidden z-50"
          style={{
            background: "white",
            boxShadow: "0 12px 40px rgba(30,56,16,0.18)",
            border: "1px solid rgba(42,74,26,0.08)",
          }}
        >
          {panel}
        </div>
      )}

      {/* Mobile bottom sheet */}
      {open && (
        <div className="sm:hidden fixed inset-0 z-50" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setOpen(false)}>
          <div
            className="absolute inset-x-0 bottom-0 rounded-t-3xl overflow-hidden"
            style={{
              background: "white",
              paddingBottom: "env(safe-area-inset-bottom, 0px)",
              maxHeight: "75vh",
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center pt-2 pb-1">
              <span className="w-10 h-1 rounded-full" style={{ background: "rgba(42,74,26,0.15)" }} />
            </div>
            {panel}
          </div>
        </div>
      )}
    </div>
  );
}
