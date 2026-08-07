"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, MessageSquare } from "lucide-react";

type Role = "client" | "doctor" | "admin";

/**
 * Header notification bell — lightweight panel (no separate notifications system).
 * Client/doctor: unread message count + link to Messages.
 * Admin: honest empty state (no fake red dot).
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
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const showDot = role !== "admin" && unreadCount > 0;
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

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-lg hover:bg-black/5 transition-colors"
        style={{ color: "#4A5568" }}
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell size={18} />
        {showDot && (
          <span
            className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
            style={{ background: "#F7941D" }}
          />
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-72 rounded-2xl overflow-hidden z-50"
          style={{
            background: "white",
            boxShadow: "0 12px 40px rgba(30,56,16,0.18)",
            border: "1px solid rgba(42,74,26,0.08)",
          }}
        >
          <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(42,74,26,0.06)" }}>
            <p className="text-sm font-semibold" style={{ color: "#2A4A1A" }}>
              Notifications
            </p>
          </div>

          {role === "admin" ? (
            <div className="px-4 py-5 text-center">
              <p className="text-sm font-medium mb-1" style={{ color: "#2A4A1A" }}>
                No in-app alerts yet
              </p>
              <p className="text-xs" style={{ color: "#8A9BA8" }}>
                Use Announcements to broadcast to clients and doctors.
              </p>
              <Link
                href="/admin/announcements"
                onClick={() => setOpen(false)}
                className="inline-flex mt-3 text-xs font-semibold"
                style={{ color: "#6BA028" }}
              >
                Open announcements
              </Link>
            </div>
          ) : unreadCount > 0 && href ? (
            <Link
              href={href}
              onClick={() => setOpen(false)}
              className="flex items-start gap-3 px-4 py-3.5 hover:bg-black/[0.03] transition-colors"
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(247,148,29,0.12)" }}
              >
                <MessageSquare size={16} style={{ color: "#F7941D" }} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium" style={{ color: "#2A4A1A" }}>
                  {unreadCount} unread message{unreadCount === 1 ? "" : "s"}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "#8A9BA8" }}>
                  Open Messages to reply
                </p>
              </div>
            </Link>
          ) : (
            <div className="px-4 py-5 text-center">
              <p className="text-sm font-medium mb-1" style={{ color: "#2A4A1A" }}>
                You&apos;re all caught up
              </p>
              <p className="text-xs" style={{ color: "#8A9BA8" }}>
                New messages will show up here.
              </p>
              {href && (
                <Link
                  href={href}
                  onClick={() => setOpen(false)}
                  className="inline-flex mt-3 text-xs font-semibold"
                  style={{ color: "#6BA028" }}
                >
                  Go to Messages
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
