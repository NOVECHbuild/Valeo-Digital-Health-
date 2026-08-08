"use client";

import { useState, useEffect, useMemo } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  RESOURCE_CATEGORIES, CATEGORY_ACTION, type Resource, type ResourceCategory,
} from "@/lib/resources";
import {
  BookOpen, Play, Newspaper, FileText, ExternalLink,
  Loader2, Star, Library,
} from "lucide-react";

const CAT_META: Record<ResourceCategory, { icon: any; color: string; tint: string; chip: string }> = {
  books:  { icon: BookOpen,  color: "#2A4A1A", tint: "rgba(42,74,26,0.08)",  chip: "rgba(42,74,26,0.1)" },
  watch:  { icon: Play,      color: "#F7941D", tint: "rgba(247,148,29,0.1)", chip: "rgba(247,148,29,0.12)" },
  read:   { icon: Newspaper, color: "#6BA028", tint: "rgba(107,160,40,0.1)", chip: "rgba(107,160,40,0.12)" },
  guides: { icon: FileText,  color: "#8DC63F", tint: "rgba(141,198,63,0.12)", chip: "rgba(141,198,63,0.14)" },
};

/** Extract a YouTube video id from common URL shapes. */
function youtubeId(url?: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1).split("/")[0] || null;
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return v;
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live") return parts[1] || null;
    }
  } catch { /* ignore */ }
  return null;
}

function coverFor(r: Resource): string | null {
  if (r.coverImage?.trim()) return r.coverImage.trim();
  const yt = youtubeId(r.url);
  if (yt) return `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`;
  return null;
}

function CategoryBanner({
  category, tall,
}: { category: ResourceCategory; tall?: boolean }) {
  const meta = CAT_META[category] ?? CAT_META.guides;
  const Icon = meta.icon;
  return (
    <div
      className={`w-full flex items-center justify-center ${tall ? "h-40" : "h-24"}`}
      style={{ background: meta.tint }}
    >
      <Icon size={tall ? 36 : 30} style={{ color: meta.color }} />
    </div>
  );
}

function ResourceCover({ r }: { r: Resource }) {
  const [failed, setFailed] = useState(false);
  const src = coverFor(r);

  if (!src || failed) {
    return <CategoryBanner category={r.category} tall={!!src} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="w-full h-40 object-cover bg-black/5"
      onError={() => setFailed(true)}
    />
  );
}

function ResourceCard({ r }: { r: Resource }) {
  const meta = CAT_META[r.category] ?? CAT_META.guides;
  const Icon = meta.icon;
  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col h-full"
      style={{ background: "white", boxShadow: "0 1px 4px rgba(42,74,26,0.07)" }}
    >
      <ResourceCover r={r} />

      <div className="p-5 flex flex-col flex-1 min-h-0">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span
            className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: meta.chip, color: meta.color }}
          >
            <Icon size={10} /> {r.source || RESOURCE_CATEGORIES.find(c => c.key === r.category)?.label}
          </span>
          {r.featured && (
            <span className="flex items-center gap-1 text-xs font-medium" style={{ color: "#F7941D" }}>
              <Star size={10} /> Featured
            </span>
          )}
        </div>
        <p className="text-sm font-semibold mb-1 line-clamp-2" style={{ color: "#2A4A1A" }}>{r.title}</p>
        {r.description && (
          <p className="text-xs leading-relaxed mb-4 flex-1 line-clamp-3" style={{ color: "#8A9BA8" }}>
            {r.description}
          </p>
        )}
        <a
          href={r.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:-translate-y-0.5 mt-auto"
          style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color})` }}
        >
          {CATEGORY_ACTION[r.category] ?? "Open"} <ExternalLink size={13} />
        </a>
      </div>
    </div>
  );
}

export default function ClientResourcesPage() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState<"all" | ResourceCategory>("all");

  useEffect(() => {
    const q = query(collection(db, "resources"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q,
      snap => { setResources(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Resource)); setLoading(false); },
      ()   => setLoading(false),
    );
    return () => unsub();
  }, []);

  const ordered = useMemo(
    () => [...resources].sort((a, b) => (a.featured === b.featured ? 0 : a.featured ? -1 : 1)),
    [resources],
  );
  const filtered = filter === "all" ? ordered : ordered.filter(r => r.category === filter);
  const presentCats = RESOURCE_CATEGORIES.filter(c => resources.some(r => r.category === c.key));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="rounded-2xl p-6 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #2A4A1A 0%, #3D6B24 100%)", boxShadow: "0 4px 24px rgba(42,74,26,0.15)" }}>
        <div className="absolute right-0 top-0 w-64 h-full opacity-10 pointer-events-none" style={{ background: "radial-gradient(circle at 80% 50%, #8DC63F, transparent 70%)" }} />
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "rgba(141,198,63,0.2)", border: "1px solid rgba(141,198,63,0.3)" }}>
            <Library size={24} style={{ color: "#8DC63F" }} />
          </div>
          <div>
            <p className="text-sm sm:text-base" style={{ color: "rgba(255,255,255,0.85)", fontFamily: "var(--font-dm-serif)" }}>
              Books, videos, articles and guides shared by your care team.
            </p>
          </div>
        </div>
      </div>

      {presentCats.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {[{ key: "all", label: "All" }, ...presentCats.map(c => ({ key: c.key, label: c.label }))].map(t => {
            const active = filter === t.key;
            return (
              <button key={t.key} onClick={() => setFilter(t.key as any)}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: active ? "linear-gradient(135deg, #2A4A1A, #3D6B24)" : "white",
                  color: active ? "white" : "#4A5568",
                  boxShadow: active ? "none" : "0 1px 3px rgba(42,74,26,0.06)",
                }}>
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin" style={{ color: "#8DC63F" }} /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: "white", boxShadow: "0 1px 4px rgba(42,74,26,0.07)" }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: "rgba(141,198,63,0.1)" }}>
            <BookOpen size={24} style={{ color: "#8DC63F" }} />
          </div>
          <p className="text-sm font-medium mb-1" style={{ color: "#2A4A1A" }}>No resources yet</p>
          <p className="text-xs" style={{ color: "#8A9BA8" }}>Recommended books, videos and articles will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
          {filtered.map(r => <ResourceCard key={r.id} r={r} />)}
        </div>
      )}
    </div>
  );
}
