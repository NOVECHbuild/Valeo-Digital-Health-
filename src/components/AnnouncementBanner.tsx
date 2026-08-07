"use client";

import { useState, useEffect } from "react";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Info, AlertTriangle, Wrench, X, Megaphone } from "lucide-react";

// ════════════════════════════════════════════════════════════════════════════
//  AnnouncementBanner
//  Surfaces admin-created announcements on the client and doctor dashboards.
//  - Reads the `announcements` collection (newest first).
//  - Filters by audience: clients see "all" + "clients", doctors see "all" + "doctors".
//  - Dismissals are remembered per-browser in localStorage so users aren't nagged.
// ════════════════════════════════════════════════════════════════════════════

type Audience = "all" | "clients" | "doctors";
type AnnouncementType = "info" | "warning" | "maintenance";

interface Announcement {
  id:        string;
  title:     string;
  message:   string;
  audience:  Audience;
  type:      AnnouncementType;
  createdBy: string;
  createdAt: any;
  active?:   boolean; // default true when missing (legacy docs)
}

const TYPE_STYLE: Record<AnnouncementType, { icon: any; color: string; bg: string; border: string }> = {
  info:        { icon: Info,          color: "#6BA028", bg: "rgba(141,198,63,0.08)", border: "rgba(141,198,63,0.3)" },
  warning:     { icon: AlertTriangle, color: "#C4700A", bg: "rgba(247,148,29,0.08)", border: "rgba(247,148,29,0.3)" },
  maintenance: { icon: Wrench,        color: "#F7941D", bg: "rgba(247,148,29,0.08)", border: "rgba(247,148,29,0.3)" },
};

const STORAGE_KEY = "valeo_dismissed_announcements";

function readDismissed(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export default function AnnouncementBanner({ audience }: { audience: "client" | "doctor" }) {
  const [items,     setItems]     = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);

  // Which announcement audiences this viewer should see
  const visibleFor: Audience[] = audience === "client" ? ["all", "clients"] : ["all", "doctors"];

  useEffect(() => {
    setDismissed(readDismissed());
    (async () => {
      try {
        // Pull recent announcements; filter audience client-side (no composite index needed)
        const snap = await getDocs(
          query(collection(db, "announcements"), orderBy("createdAt", "desc"), limit(20))
        );
        const all = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Announcement);
        setItems(
          all
            .filter(a => a.active !== false && visibleFor.includes(a.audience))
            .slice(0, 5)
        );
      } catch {
        // silent — banner just stays empty
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audience]);

  function dismiss(id: string) {
    const next = Array.from(new Set([...dismissed, id]));
    setDismissed(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore storage errors */
    }
  }

  const visible = items.filter(a => !dismissed.includes(a.id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-3">
      {visible.map(ann => {
        const s = TYPE_STYLE[ann.type] ?? TYPE_STYLE.info;
        const Icon = s.icon;
        return (
          <div
            key={ann.id}
            className="rounded-2xl p-4 flex items-start gap-3"
            style={{ background: s.bg, border: `1px solid ${s.border}` }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "white" }}
            >
              <Icon size={17} style={{ color: s.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <Megaphone size={11} style={{ color: s.color }} />
                <p className="text-sm font-semibold" style={{ color: "#2A4A1A" }}>{ann.title}</p>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: "#4A5568" }}>{ann.message}</p>
            </div>
            <button
              onClick={() => dismiss(ann.id)}
              className="p-1.5 rounded-lg hover:bg-black/5 flex-shrink-0"
              style={{ color: "#8A9BA8" }}
              aria-label="Dismiss announcement"
            >
              <X size={15} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
