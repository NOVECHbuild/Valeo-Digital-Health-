"use client";

import { useState, useEffect } from "react";
import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import {
  RESOURCE_CATEGORIES, CATEGORY_LABEL, type Resource, type ResourceCategory,
} from "@/lib/resources";
import {
  BookOpen, Plus, Edit3, Trash2, X, Loader2, Save,
  CheckCircle, AlertCircle, Star, ExternalLink, Link2, Upload,
} from "lucide-react";

interface Props { accent: string; accentDark: string; }

type FormState = {
  title: string; description: string; category: ResourceCategory;
  url: string; source: string; coverImage: string; storagePath: string; featured: boolean;
};

const EMPTY_FORM: FormState = {
  title: "", description: "", category: "books",
  url: "", source: "", coverImage: "", storagePath: "", featured: false,
};

export default function ResourcesManager({ accent, accentDark }: Props) {
  const { user } = useAuth();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [editing,   setEditing]   = useState<Resource | null | false>(false); // false=closed, null=new
  const [form,      setForm]      = useState<FormState>(EMPTY_FORM);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [deleting,  setDeleting]  = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [toast,     setToast]     = useState<{ type: "success" | "error"; msg: string } | null>(null);

  function showToast(type: "success" | "error", msg: string) {
    setToast({ type, msg }); setTimeout(() => setToast(null), 4000);
  }

  useEffect(() => {
    const q = query(collection(db, "resources"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q,
      snap => { setResources(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Resource)); setLoading(false); },
      ()   => setLoading(false),
    );
    return () => unsub();
  }, []);

  function openNew()           { setForm(EMPTY_FORM); setError(null); setEditing(null); }
  function openEdit(r: Resource) {
    setForm({
      title: r.title, description: r.description, category: r.category,
      url: r.url, source: r.source ?? "", coverImage: r.coverImage ?? "",
      storagePath: r.storagePath ?? "", featured: !!r.featured,
    });
    setError(null); setEditing(r);
  }

  // Upload a file to Firebase Storage and use its public download URL.
  async function handleFileUpload(file: File | undefined) {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const path = `resources/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
      const r = ref(storage, path);
      await uploadBytes(r, file);
      const downloadUrl = await getDownloadURL(r);
      setForm(f => ({ ...f, url: downloadUrl, storagePath: path, source: f.source || "Download" }));
    } catch {
      setError("File upload failed. Use a PDF or image under 15 MB.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!form.title.trim() || !form.url.trim()) {
      setError("Title and link (URL) are required."); return;
    }
    setSaving(true);
    try {
      const payload = {
        title:       form.title.trim(),
        description: form.description.trim(),
        category:    form.category,
        url:         form.url.trim(),
        source:      form.source.trim(),
        coverImage:  form.coverImage.trim(),
        storagePath: form.storagePath || "",
        featured:    form.featured,
        updatedAt:   serverTimestamp(),
      };
      if (editing && (editing as Resource).id) {
        await updateDoc(doc(db, "resources", (editing as Resource).id), payload);
        showToast("success", "Resource updated.");
      } else {
        await addDoc(collection(db, "resources"), {
          ...payload, createdBy: user?.displayName ?? user?.email ?? "Staff", createdAt: serverTimestamp(),
        });
        showToast("success", "Resource added.");
      }
      setEditing(false);
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this resource? Clients will no longer see it.")) return;
    setDeleting(id);
    try {
      const r = resources.find(x => x.id === id);
      await deleteDoc(doc(db, "resources", id));
      if (r?.storagePath) { try { await deleteObject(ref(storage, r.storagePath)); } catch { /* file may already be gone */ } }
      showToast("success", "Resource removed.");
    } catch {
      showToast("error", "Failed to remove.");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-lg text-sm font-medium"
          style={{ background: toast.type === "success" ? "#2A4A1A" : "#F7941D", color: "white" }}>
          {toast.type === "success" ? <CheckCircle size={16} /> : <AlertCircle size={16} />}{toast.msg}
        </div>
      )}

      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl" style={{ fontFamily: "var(--font-dm-serif)", color: "#2A4A1A" }}>Resources Library</h2>
          <p className="text-sm mt-0.5" style={{ color: "#8A9BA8" }}>
            Books, videos, articles and guides shared with all clients.
          </p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:-translate-y-0.5 transition-all"
          style={{ background: `linear-gradient(135deg, ${accent}, ${accentDark})` }}>
          <Plus size={15} /> Add Resource
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin" style={{ color: accent }} /></div>
      ) : resources.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: "white", boxShadow: "0 1px 4px rgba(42,74,26,0.07)" }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: accent + "14" }}>
            <BookOpen size={24} style={{ color: accent }} />
          </div>
          <p className="text-sm font-medium mb-1" style={{ color: "#2A4A1A" }}>No resources yet</p>
          <p className="text-xs mb-4" style={{ color: "#8A9BA8" }}>Add books, YouTube clips, articles, and guides.</p>
          <button onClick={openNew}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: `linear-gradient(135deg, ${accent}, ${accentDark})` }}>
            <Plus size={14} /> Add Resource
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {resources.map(r => (
            <div key={r.id} className="rounded-2xl p-4 flex items-start gap-4"
              style={{ background: "white", boxShadow: "0 1px 4px rgba(42,74,26,0.07)", opacity: deleting === r.id ? 0.5 : 1 }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: accent + "14" }}>
                <BookOpen size={18} style={{ color: accent }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(42,74,26,0.06)", color: "#4A5568" }}>
                    {CATEGORY_LABEL[r.category]}
                  </span>
                  {r.source && <span className="text-xs" style={{ color: "#8A9BA8" }}>· {r.source}</span>}
                  {r.featured && (
                    <span className="flex items-center gap-1 text-xs font-medium" style={{ color: "#F7941D" }}>
                      <Star size={10} /> Featured
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold truncate" style={{ color: "#2A4A1A" }}>{r.title}</p>
                {r.description && <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "#8A9BA8" }}>{r.description}</p>}
                <a href={r.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs mt-1 hover:underline" style={{ color: accent }}>
                  <Link2 size={10} /> {r.url.length > 48 ? r.url.slice(0, 48) + "…" : r.url}
                </a>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => openEdit(r)} className="p-1.5 rounded-lg hover:bg-black/5" style={{ color: "#8A9BA8" }}><Edit3 size={14} /></button>
                <button onClick={() => handleDelete(r.id)} className="p-1.5 rounded-lg hover:bg-red-50" style={{ color: "#8A9BA8" }}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Editor modal ── */}
      {editing !== false && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16"
          style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-lg rounded-3xl overflow-hidden max-h-[85vh] flex flex-col" style={{ background: "#F6FAF0" }}>
            <div className="flex items-center justify-between px-6 py-5 border-b flex-shrink-0" style={{ borderColor: "rgba(42,74,26,0.08)" }}>
              <h3 className="font-semibold text-sm" style={{ color: "#2A4A1A" }}>
                {editing && (editing as Resource).id ? "Edit Resource" : "Add Resource"}
              </h3>
              <button onClick={() => setEditing(false)} className="p-2 rounded-lg hover:bg-black/5"><X size={18} style={{ color: "#4A5568" }} /></button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-4">
              {error && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm" style={{ background: "rgba(247,148,29,0.08)", color: "#F7941D" }}>
                  <AlertCircle size={14} />{error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#8A9BA8" }}>Category</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as ResourceCategory }))}
                  className="w-full px-3 py-2.5 rounded-xl text-sm border focus:outline-none"
                  style={{ borderColor: "rgba(42,74,26,0.15)", background: "white", color: "#22272B" }}>
                  {RESOURCE_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label} — {c.blurb}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#8A9BA8" }}>Title *</label>
                <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. The Power of Healing Within"
                  className="w-full px-3 py-2.5 rounded-xl text-sm border focus:outline-none" style={{ borderColor: "rgba(42,74,26,0.15)", background: "white" }} />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#8A9BA8" }}>Link / URL *</label>
                <input type="url" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value, storagePath: "" }))}
                  placeholder="https://…"
                  className="w-full px-3 py-2.5 rounded-xl text-sm border focus:outline-none" style={{ borderColor: "rgba(42,74,26,0.15)", background: "white" }} />
                {/* Or upload a file (PDF / image) → public download link */}
                <label className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border-2 border-dashed cursor-pointer"
                  style={{ borderColor: "rgba(42,74,26,0.18)", color: accent }}>
                  {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                  {uploading ? "Uploading…" : form.storagePath ? "File uploaded ✓ — choose another to replace" : "…or upload a file (PDF / image, ≤15 MB)"}
                  <input type="file" accept="application/pdf,image/*" className="hidden"
                    onChange={e => handleFileUpload(e.target.files?.[0])} disabled={uploading} />
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#8A9BA8" }}>Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3}
                  placeholder="A short blurb shown to clients."
                  className="w-full px-3 py-2.5 rounded-xl text-sm border resize-none focus:outline-none" style={{ borderColor: "rgba(42,74,26,0.15)", background: "white" }} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#8A9BA8" }}>Source</label>
                  <input type="text" value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                    placeholder="Amazon, YouTube…"
                    className="w-full px-3 py-2.5 rounded-xl text-sm border focus:outline-none" style={{ borderColor: "rgba(42,74,26,0.15)", background: "white" }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: "#8A9BA8" }}>Cover image URL</label>
                  <input type="url" value={form.coverImage} onChange={e => setForm(f => ({ ...f, coverImage: e.target.value }))}
                    placeholder="https://… (optional)"
                    className="w-full px-3 py-2.5 rounded-xl text-sm border focus:outline-none" style={{ borderColor: "rgba(42,74,26,0.15)", background: "white" }} />
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <button type="button" onClick={() => setForm(f => ({ ...f, featured: !f.featured }))}
                  className="relative flex-shrink-0 w-11 h-6 rounded-full transition-all"
                  style={{ background: form.featured ? accent : "rgba(42,74,26,0.12)" }}>
                  <span className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all" style={{ left: form.featured ? "24px" : "4px" }} />
                </button>
                <span className="text-sm" style={{ color: "#2A4A1A" }}>Feature this resource (shows first)</span>
              </label>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t flex-shrink-0" style={{ borderColor: "rgba(42,74,26,0.08)" }}>
              <button onClick={() => setEditing(false)} className="flex-1 py-3 rounded-xl text-sm font-semibold border-2" style={{ borderColor: "rgba(42,74,26,0.15)", color: "#2A4A1A" }}>Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ background: `linear-gradient(135deg, ${accent}, ${accentDark})` }}>
                {saving ? <><Loader2 size={14} className="animate-spin" />Saving…</> : <><Save size={14} />Save Resource</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
