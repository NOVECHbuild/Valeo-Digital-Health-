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

// Icon + accent per category
const CAT_META: Record<ResourceCategory, { icon: any; color: string }> = {
  books:  { icon: BookOpen,  color: "#2A4A1A" },
  watch:  { icon: Play,      color: "#F7941D" },
  read:   { icon: Newspaper, color: "#6BA028" },
  guides: { icon: FileText,  color: "#8DC63F" },
};

function ResourceCard({ r }: { r: Resource }) {
  const meta = CAT_META[r.category] ?? CAT_META.guides;
  const Icon = meta.icon;
  return (
    <div className="rounded-2xl overflow-hidden flex flex-col" style={{ background: "white", boxShadow: "0 1px 4px rgba(42,74,26,0.07)" }}>
      {/* Cover (books) or coloured banner */}
      {r.coverImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={r.coverImage} alt={r.title} className="w-full h-40 object-cover" />
      ) : (
        <div className="h-24 flex items-center justify-center" style={{ background: meta.color + "12" }}>
          <Icon size={30} style={{ color: meta.color }} />
        </div>
      )}

      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: meta.color + "14", color: meta.color }}>
            <Icon size={10} /> {r.source || RESOURCE_CATEGORIES.find(c => c.key === r.category)?.label}
          </span>
          {r.featured && (
            <span className="flex items-center gap-1 text-xs font-medium" style={{ color: "#F7941D" }}>
              <Star size={10} /> Featured
            </span>
          )}
        </div>
        <p className="text-sm font-semibold mb-1" style={{ color: "#2A4A1A" }}>{r.title}</p>
        {r.description && <p className="text-xs leading-relaxed mb-4 flex-1" style={{ color: "#8A9BA8" }}>{r.description}</p>}
        <a href={r.url} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:-translate-y-0.5 mt-auto"
          style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color})` }}>
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

  // Featured first, then by recency (already createdAt desc)
  const ordered = useMemo(
    () => [...resources].sort((a, b) => (a.featured === b.featured ? 0 : a.featured ? -1 : 1)),
    [resources],
  );
  const filtered = filter === "all" ? ordered : ordered.filter(r => r.category === filter);

  // Only show category tabs that actually have content
  const presentCats = RESOURCE_CATEGORIES.filter(c => resources.some(r => r.category === c.key));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="rounded-2xl p-6 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #2A4A1A 0%, #3D6B24 100%)", boxShadow: "0 4px 24px rgba(42,74,26,0.15)" }}>
        <div className="absolute right-0 top-0 w-64 h-full opacity-10" style={{ background: "radial-gradient(circle at 80% 50%, #8DC63F, transparent 70%)" }} />
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "rgba(141,198,63,0.2)", border: "1px solid rgba(141,198,63,0.3)" }}>
            <Library size={24} style={{ color: "#8DC63F" }} />
          </div>
          <div>
            <h2 className="text-2xl text-white" style={{ fontFamily: "var(--font-dm-serif)" }}>Resources</h2>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.65)" }}>
              Books, videos, articles and guides shared by Dr. Miller.
            </p>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
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
          <p className="text-xs" style={{ color: "#8A9BA8" }}>Dr. Miller's recommended books, videos and articles will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(r => <ResourceCard key={r.id} r={r} />)}
        </div>
      )}
    </div>
  );
}
