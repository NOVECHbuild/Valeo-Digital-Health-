"use client";

import { useState, useEffect } from "react";
import {
  collection, addDoc, getDocs, orderBy, query,
  serverTimestamp, doc, deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/hooks/useAuth";
import {
  Send, Trash2, Loader2, AlertCircle, CheckCircle,
  Megaphone, Users, User, Stethoscope, Globe, X,
} from "lucide-react";

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
}

const AUDIENCE_OPTIONS: { value: Audience; label: string; icon: any; color: string }[] = [
  { value: "all",     label: "Everyone",  icon: Globe,       color: "#8DC63F" },
  { value: "clients", label: "Clients",   icon: User,        color: "#2A4A1A" },
  { value: "doctors", label: "Doctors",   icon: Stethoscope, color: "#F7941D" },
];

const TYPE_OPTIONS: { value: AnnouncementType; label: string; color: string; bg: string }[] = [
  { value: "info",        label: "Info",        color: "#6BA028", bg: "rgba(141,198,63,0.1)"  },
  { value: "warning",     label: "Warning",     color: "#C4700A", bg: "rgba(247,148,29,0.1)"  },
  { value: "maintenance", label: "Maintenance", color: "#F7941D", bg: "rgba(247,148,29,0.1)"   },
];

function TypeBadge({ type }: { type: AnnouncementType }) {
  const t = TYPE_OPTIONS.find(o => o.value === type)!;
  return (
    <span className="px-2.5 py-1 rounded-full text-xs font-semibold capitalize"
      style={{ background: t.bg, color: t.color }}>
      {t.label}
    </span>
  );
}

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [sending,       setSending]       = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [form, setForm] = useState({
    title:    "",
    message:  "",
    audience: "all" as Audience,
    type:     "info" as AnnouncementType,
  });

  function showToast(type: "success" | "error", msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, "announcements"), orderBy("createdAt", "desc")));
        setAnnouncements(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Announcement));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleSend() {
    if (!form.title.trim() || !form.message.trim()) {
      showToast("error", "Title and message are required.");
      return;
    }
    setSending(true);
    try {
      const docRef = await addDoc(collection(db, "announcements"), {
        ...form,
        title:     form.title.trim(),
        message:   form.message.trim(),
        createdBy: user?.displayName ?? "Admin",
        createdAt: serverTimestamp(),
      });
      const newAnn: Announcement = {
        id: docRef.id,
        ...form,
        createdBy: user?.displayName ?? "Admin",
        createdAt: new Date(),
      };
      setAnnouncements(prev => [newAnn, ...prev]);
      setForm({ title: "", message: "", audience: "all", type: "info" });
      showToast("success", `Announcement sent to ${form.audience === "all" ? "everyone" : form.audience}.`);
    } catch {
      showToast("error", "Failed to send announcement.");
    } finally {
      setSending(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      await deleteDoc(doc(db, "announcements", id));
      setAnnouncements(prev => prev.filter(a => a.id !== id));
      showToast("success", "Announcement deleted.");
    } catch {
      showToast("error", "Failed to delete announcement.");
    } finally {
      setDeleting(null);
    }
  }

  const charCount = form.message.length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-lg text-sm font-medium"
          style={{ background: toast.type === "success" ? "#1E3810" : "#F7941D", color: "white" }}>
          {toast.type === "success" ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div>
        <h2 className="text-2xl" style={{ fontFamily: "var(--font-dm-serif)", color: "#1E3810" }}>
          Announcements
        </h2>
        <p className="text-sm mt-0.5" style={{ color: "#8A9BA8" }}>
          Broadcast messages to users across the platform
        </p>
      </div>

      {/* Compose Card */}
      <div className="rounded-2xl p-6 space-y-5"
        style={{ background: "white", boxShadow: "0 1px 4px rgba(30,56,16,0.07)" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(141,198,63,0.1)" }}>
            <Megaphone size={16} style={{ color: "#8DC63F" }} />
          </div>
          <h3 className="text-sm font-semibold" style={{ color: "#1E3810" }}>New Announcement</h3>
        </div>

        {/* Audience */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#8A9BA8" }}>Send To</p>
          <div className="flex gap-2 flex-wrap">
            {AUDIENCE_OPTIONS.map(opt => {
              const Icon = opt.icon;
              const active = form.audience === opt.value;
              return (
                <button key={opt.value} onClick={() => setForm(f => ({ ...f, audience: opt.value }))}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: active ? "linear-gradient(135deg, #1E3810, #2D2D4E)" : "rgba(30,56,16,0.04)",
                    color: active ? "white" : "#4A5568",
                    border: active ? "none" : "1px solid rgba(30,56,16,0.1)",
                  }}>
                  <Icon size={14} style={{ color: active ? "white" : opt.color }} />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Type */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#8A9BA8" }}>Type</p>
          <div className="flex gap-2 flex-wrap">
            {TYPE_OPTIONS.map(opt => {
              const active = form.type === opt.value;
              return (
                <button key={opt.value} onClick={() => setForm(f => ({ ...f, type: opt.value }))}
                  className="px-4 py-2 rounded-xl text-xs font-semibold capitalize transition-all"
                  style={{
                    background: active ? opt.bg : "rgba(30,56,16,0.03)",
                    color: active ? opt.color : "#8A9BA8",
                    border: `1.5px solid ${active ? opt.color : "rgba(30,56,16,0.1)"}`,
                  }}>
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Title */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#8A9BA8" }}>Title</p>
          <input type="text" value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="e.g. Scheduled maintenance this Sunday"
            className="w-full px-4 py-3 rounded-xl text-sm outline-none"
            style={{ background: "#F8F9FA", border: "1px solid rgba(30,56,16,0.1)", color: "#1E3810" }} />
        </div>

        {/* Message */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#8A9BA8" }}>Message</p>
            <span className="text-xs" style={{ color: charCount > 500 ? "#F7941D" : "#C4C4C4" }}>
              {charCount}/500
            </span>
          </div>
          <textarea value={form.message}
            onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
            rows={4} maxLength={500}
            placeholder="Write your announcement here..."
            className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
            style={{ background: "#F8F9FA", border: "1px solid rgba(30,56,16,0.1)", color: "#1E3810" }} />
        </div>

        {/* Send button */}
        <div className="flex justify-end">
          <button onClick={handleSend} disabled={sending || !form.title.trim() || !form.message.trim()}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:translate-y-0"
            style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)" }}>
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            {sending ? "Sending…" : "Send Announcement"}
          </button>
        </div>
      </div>

      {/* History */}
      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ color: "#8A9BA8" }}>
          Recent Announcements ({announcements.length})
        </h3>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={24} className="animate-spin" style={{ color: "#8DC63F" }} />
          </div>
        ) : announcements.length === 0 ? (
          <div className="rounded-2xl py-14 text-center"
            style={{ background: "white", boxShadow: "0 1px 4px rgba(30,56,16,0.07)" }}>
            <Megaphone size={28} className="mx-auto mb-3" style={{ color: "#C4C4C4" }} />
            <p className="text-sm" style={{ color: "#8A9BA8" }}>No announcements yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {announcements.map(ann => {
              const audience = AUDIENCE_OPTIONS.find(a => a.value === ann.audience)!;
              const AudienceIcon = audience.icon;
              return (
                <div key={ann.id} className="rounded-2xl p-5"
                  style={{ background: "white", boxShadow: "0 1px 4px rgba(30,56,16,0.07)" }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <TypeBadge type={ann.type} />
                        <span className="flex items-center gap-1 text-xs font-medium"
                          style={{ color: audience.color }}>
                          <AudienceIcon size={11} /> {audience.label}
                        </span>
                        <span className="text-xs" style={{ color: "#C4C4C4" }}>
                          {ann.createdAt?.toDate
                            ? ann.createdAt.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                            : new Date(ann.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      </div>
                      <p className="text-sm font-semibold mb-1" style={{ color: "#1E3810" }}>{ann.title}</p>
                      <p className="text-sm leading-relaxed" style={{ color: "#4A5568" }}>{ann.message}</p>
                      <p className="text-xs mt-2" style={{ color: "#C4C4C4" }}>Sent by {ann.createdBy}</p>
                    </div>
                    <button onClick={() => handleDelete(ann.id)} disabled={deleting === ann.id}
                      className="p-2 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0">
                      {deleting === ann.id
                        ? <Loader2 size={14} className="animate-spin" style={{ color: "#F7941D" }} />
                        : <Trash2 size={14} style={{ color: "#F7941D" }} />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
