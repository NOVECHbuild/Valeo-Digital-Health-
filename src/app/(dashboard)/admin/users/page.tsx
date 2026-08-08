"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, orderBy, query, doc, updateDoc, serverTimestamp, addDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import {
  Users, Search, Plus, X, Loader2, Shield,
  CheckCircle, AlertCircle, Mail, MoreVertical,
  UserX, UserCheck, ChevronDown, KeyRound, Pencil,
  Calendar, Download, Send, CreditCard, Phone, User,
  Save, ChevronRight,
} from "lucide-react";

type Role = "client" | "doctor" | "admin";

interface PlatformUser {
  uid:         string;
  displayName: string;
  email:       string;
  role:        Role;
  isActive:    boolean;
  onboarded:   boolean;
  phone?:      string;
  createdAt:   any;
}

// ── Role Badge ────────────────────────────────────────────────────────────────
function RoleBadge({ role }: { role: Role }) {
  const map = {
    client: { bg: "rgba(141,198,63,0.12)",  color: "#6BA028" },
    doctor: { bg: "rgba(247,148,29,0.12)",  color: "#C4700A" },
    admin:  { bg: "rgba(247,148,29,0.12)",   color: "#F7941D" },
  };
  const s = map[role];
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize"
      style={{ background: s.bg, color: s.color }}>
      {role}
    </span>
  );
}

// ── Edit User Drawer ──────────────────────────────────────────────────────────
function EditUserDrawer({ user, onClose, onSave }: {
  user: PlatformUser;
  onClose: () => void;
  onSave: (uid: string, data: Partial<PlatformUser>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    displayName: user.displayName,
    phone: user.phone || "",
    role: user.role,
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave(user.uid, form);
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md h-full flex flex-col"
        style={{ background: "white", boxShadow: "-8px 0 32px rgba(0,0,0,0.15)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b"
          style={{ borderColor: "rgba(30,56,16,0.08)" }}>
          <div>
            <h3 style={{ fontFamily: "var(--font-dm-serif)", fontSize: "20px", color: "#1E3810" }}>Edit User</h3>
            <p className="text-xs mt-0.5" style={{ color: "#8A9BA8" }}>{user.email}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-black/5">
            <X size={18} style={{ color: "#8A9BA8" }} />
          </button>
        </div>
        {/* Fields */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#8A9BA8" }}>Full Name</label>
            <div className="relative">
              <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "#8A9BA8" }} />
              <input type="text" value={form.displayName}
                onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: "#F8F9FA", border: "1px solid rgba(30,56,16,0.1)", color: "#1E3810" }} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#8A9BA8" }}>Phone Number</label>
            <div className="relative">
              <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "#8A9BA8" }} />
              <input type="tel" value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+1 (784) 000-0000"
                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none"
                style={{ background: "#F8F9FA", border: "1px solid rgba(30,56,16,0.1)", color: "#1E3810" }} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#8A9BA8" }}>Role</label>
            <div className="grid grid-cols-3 gap-2">
              {(["client", "doctor", "admin"] as Role[]).map(r => (
                <button key={r} onClick={() => setForm(f => ({ ...f, role: r }))}
                  className="py-2.5 rounded-xl text-xs font-semibold capitalize transition-all"
                  style={{
                    background: form.role === r ? "linear-gradient(135deg, #1E3810, #2D2D4E)" : "rgba(30,56,16,0.04)",
                    color: form.role === r ? "white" : "#4A5568",
                    border: form.role === r ? "none" : "1px solid rgba(30,56,16,0.1)",
                  }}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          {/* Email — locked */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "#8A9BA8" }}>Email Address</label>
            <div className="relative">
              <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "#C4C4C4" }} />
              <input type="email" value={user.email} disabled
                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm"
                style={{ background: "rgba(30,56,16,0.03)", border: "1px solid rgba(30,56,16,0.06)", color: "#C4C4C4", cursor: "not-allowed" }} />
            </div>
            <p className="text-xs mt-1" style={{ color: "#8A9BA8" }}>Email cannot be changed.</p>
          </div>
        </div>
        {/* Footer */}
        <div className="px-6 py-4 border-t flex gap-3" style={{ borderColor: "rgba(30,56,16,0.08)" }}>
          <button onClick={onClose} className="flex-1 py-3 rounded-xl text-sm font-semibold"
            style={{ background: "rgba(30,56,16,0.05)", color: "#4A5568" }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: "linear-gradient(135deg, #1E3810, #2D2D4E)", opacity: saving ? 0.7 : 1 }}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── User Row ──────────────────────────────────────────────────────────────────
function UserRow({ user, onToggleActive, onChangeRole, onResetPassword, onEdit, onViewAppointments, acting }: {
  user: PlatformUser;
  onToggleActive: (uid: string, active: boolean) => void;
  onChangeRole:   (uid: string, role: Role) => void;
  onResetPassword: (uid: string, email: string) => void;
  onEdit: (user: PlatformUser) => void;
  onViewAppointments: (uid: string) => void;
  acting: string | null;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const isActing = acting === user.uid;

  return (
    <tr className="border-b transition-colors hover:bg-black/[0.015]"
      style={{ borderColor: "rgba(42,74,26,0.06)" }}>

      {/* User */}
      <td className="py-4 px-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #1E3810, #2D2D4E)", color: "white" }}>
            {user.displayName?.[0]?.toUpperCase() ?? "U"}
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: "#1E3810" }}>{user.displayName}</p>
            <p className="text-xs" style={{ color: "#8A9BA8" }}>{user.email}</p>
            {user.phone && <p className="text-xs" style={{ color: "#C4C4C4" }}>{user.phone}</p>}
          </div>
        </div>
      </td>

      {/* Role */}
      <td className="py-4 px-4">
        <div className="relative">
          <button onClick={() => { setRoleOpen(!roleOpen); setMenuOpen(false); }}
            className="flex items-center gap-1">
            <RoleBadge role={user.role} />
            <ChevronDown size={11} style={{ color: "#8A9BA8" }} />
          </button>
          {roleOpen && (
            <div className="absolute top-8 left-0 z-30 rounded-xl overflow-hidden py-1"
              style={{ background: "white", boxShadow: "0 4px 16px rgba(42,74,26,0.14)", minWidth: "130px" }}>
              {(["client","doctor","admin"] as Role[]).filter(r => r !== user.role).map(r => (
                <button key={r} disabled={isActing}
                  onClick={() => { onChangeRole(user.uid, r); setRoleOpen(false); }}
                  className="w-full text-left px-4 py-2 text-xs capitalize hover:bg-black/5 disabled:opacity-50"
                  style={{ color: "#22272B" }}>
                  Set as {r}
                </button>
              ))}
            </div>
          )}
        </div>
      </td>

      {/* Status */}
      <td className="py-4 px-4">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium"
          style={{ color: user.isActive !== false ? "#6BA028" : "#8A9BA8" }}>
          <span className="w-2 h-2 rounded-full"
            style={{ background: user.isActive !== false ? "#8DC63F" : "#C4C4C4" }} />
          {user.isActive !== false ? "Active" : "Inactive"}
        </span>
      </td>

      {/* Onboarding */}
      <td className="py-4 px-4 hidden lg:table-cell">
        {user.role === "client" ? (
          user.onboarded
            ? <span className="flex items-center gap-1 text-xs" style={{ color: "#6BA028" }}>
                <CheckCircle size={11} /> Done
              </span>
            : <span className="flex items-center gap-1 text-xs" style={{ color: "#F7941D" }}>
                <AlertCircle size={11} /> Pending
              </span>
        ) : (
          <span className="text-xs" style={{ color: "#C4C4C4" }}>—</span>
        )}
      </td>

      {/* Joined */}
      <td className="py-4 px-4 hidden md:table-cell">
        <span className="text-xs" style={{ color: "#8A9BA8" }}>
          {user.createdAt?.toDate
            ? user.createdAt.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
            : user.createdAt
            ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
            : "—"}
        </span>
      </td>

      {/* Actions */}
      <td className="py-4 px-5">
        <div className="relative flex justify-end">
          {isActing
            ? <Loader2 size={15} className="animate-spin" style={{ color: "#8DC63F" }} />
            : (
              <button onClick={() => { setMenuOpen(!menuOpen); setRoleOpen(false); }}
                className="p-1.5 rounded-lg hover:bg-black/5">
                <MoreVertical size={15} style={{ color: "#8A9BA8" }} />
              </button>
            )}
          {menuOpen && (
            <div className="absolute top-8 right-0 z-30 rounded-xl overflow-hidden py-1"
              style={{ background: "white", boxShadow: "0 4px 20px rgba(42,74,26,0.16)", minWidth: "190px" }}>

              {/* Edit */}
              <button onClick={() => { onEdit(user); setMenuOpen(false); }}
                className="w-full text-left px-4 py-2.5 text-xs flex items-center gap-2 hover:bg-black/5"
                style={{ color: "#1E3810" }}>
                <Pencil size={13} style={{ color: "#8DC63F" }} /> Edit Details
              </button>

              {/* Reset Password */}
              <button onClick={() => { onResetPassword(user.uid, user.email); setMenuOpen(false); }}
                className="w-full text-left px-4 py-2.5 text-xs flex items-center gap-2 hover:bg-black/5"
                style={{ color: "#1E3810" }}>
                <KeyRound size={13} style={{ color: "#F7941D" }} /> Reset Password
              </button>

              {/* View Appointments (clients only) */}
              {user.role === "client" && (
                <button onClick={() => { onViewAppointments(user.uid); setMenuOpen(false); }}
                  className="w-full text-left px-4 py-2.5 text-xs flex items-center gap-2 hover:bg-black/5"
                  style={{ color: "#1E3810" }}>
                  <Calendar size={13} style={{ color: "#2A4A1A" }} /> View Appointments
                </button>
              )}

              <div style={{ height: "1px", background: "rgba(30,56,16,0.06)", margin: "4px 0" }} />

              {/* Copy Email */}
              <button onClick={() => { navigator.clipboard.writeText(user.email); setMenuOpen(false); }}
                className="w-full text-left px-4 py-2.5 text-xs flex items-center gap-2 hover:bg-black/5"
                style={{ color: "#4A5568" }}>
                <Mail size={13} /> Copy Email
              </button>

              {/* Deactivate / Reactivate */}
              <button onClick={() => { onToggleActive(user.uid, user.isActive === false); setMenuOpen(false); }}
                className="w-full text-left px-4 py-2.5 text-xs flex items-center gap-2 hover:bg-black/5"
                style={{ color: user.isActive !== false ? "#F7941D" : "#6BA028" }}>
                {user.isActive !== false
                  ? <><UserX size={13} /> Deactivate</>
                  : <><UserCheck size={13} /> Reactivate</>}
              </button>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AdminUsersPage() {
  const router = useRouter();
  const [users,      setUsers]      = useState<PlatformUser[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [filter,     setFilter]     = useState<"all"|Role>("all");
  const [acting,     setActing]     = useState<string | null>(null);
  const [toast,      setToast]      = useState<{ type: "success"|"error"; msg: string } | null>(null);
  const [editUser,   setEditUser]   = useState<PlatformUser | null>(null);
  const [exporting,  setExporting]  = useState(false);

  function showToast(type: "success"|"error", msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, "users"), orderBy("createdAt", "desc")));
        setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() }) as PlatformUser));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleToggleActive(uid: string, newActive: boolean) {
    setActing(uid);
    try {
      await updateDoc(doc(db, "users", uid), { isActive: newActive, updatedAt: serverTimestamp() });
      setUsers(p => p.map(u => u.uid === uid ? { ...u, isActive: newActive } : u));
      showToast("success", `Account ${newActive ? "reactivated" : "deactivated"}.`);
    } catch {
      showToast("error", "Failed to update account.");
    } finally {
      setActing(null);
    }
  }

  async function handleChangeRole(uid: string, role: Role) {
    setActing(uid);
    try {
      await updateDoc(doc(db, "users", uid), { role, updatedAt: serverTimestamp() });
      setUsers(p => p.map(u => u.uid === uid ? { ...u, role } : u));
      showToast("success", `Role updated to ${role}.`);
    } catch {
      showToast("error", "Failed to update role.");
    } finally {
      setActing(null);
    }
  }

  async function handleResetPassword(uid: string, email: string) {
    setActing(uid);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/admin/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error();
      showToast("success", `Password reset email sent to ${email}`);
    } catch {
      showToast("error", "Failed to send reset email.");
    } finally {
      setActing(null);
    }
  }

  async function handleEditSave(uid: string, data: Partial<PlatformUser>) {
    try {
      await updateDoc(doc(db, "users", uid), { ...data, updatedAt: serverTimestamp() });
      setUsers(p => p.map(u => u.uid === uid ? { ...u, ...data } : u));
      showToast("success", "User details updated.");
    } catch {
      showToast("error", "Failed to update user.");
    }
  }

  function handleViewAppointments(uid: string) {
    router.push(`/admin/users/${uid}/appointments`);
  }

  function handleExportCSV() {
    setExporting(true);
    try {
      const headers = ["Name", "Email", "Role", "Status", "Phone", "Joined"];
      const rows = users.map(u => [
        u.displayName,
        u.email,
        u.role,
        u.isActive !== false ? "Active" : "Inactive",
        u.phone || "",
        u.createdAt?.toDate
          ? u.createdAt.toDate().toLocaleDateString()
          : u.createdAt
          ? new Date(u.createdAt).toLocaleDateString()
          : "",
      ]);
      const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `valeo-users-${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("success", "User data exported successfully.");
    } catch {
      showToast("error", "Failed to export data.");
    } finally {
      setExporting(false);
    }
  }

  const filtered = users.filter(u =>
    (filter === "all" || u.role === filter) &&
    (u.displayName?.toLowerCase().includes(search.toLowerCase()) ||
     u.email?.toLowerCase().includes(search.toLowerCase()))
  );

  const counts = {
    all:    users.length,
    client: users.filter(u => u.role === "client").length,
    doctor: users.filter(u => u.role === "doctor").length,
    admin:  users.filter(u => u.role === "admin").length,
    active: users.filter(u => u.isActive !== false).length,
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Edit Drawer */}
      {editUser && (
        <EditUserDrawer
          user={editUser}
          onClose={() => setEditUser(null)}
          onSave={handleEditSave}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-lg text-sm font-medium"
          style={{ background: toast.type === "success" ? "#1E3810" : "#F7941D", color: "white" }}>
          {toast.type === "success" ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* Subtitle + actions — page name lives in the sticky header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm" style={{ color: "#8A9BA8" }}>Manage all platform accounts and roles</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Export CSV */}
          <button onClick={handleExportCSV} disabled={exporting}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:-translate-y-0.5"
            style={{ background: "white", color: "#4A5568", border: "1px solid rgba(30,56,16,0.12)", boxShadow: "0 1px 3px rgba(30,56,16,0.07)" }}>
            <Download size={15} style={{ color: "#8DC63F" }} />
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
          {/* Announcement */}
          <button onClick={() => router.push("/admin/announcements")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:-translate-y-0.5"
            style={{ background: "white", color: "#4A5568", border: "1px solid rgba(30,56,16,0.12)", boxShadow: "0 1px 3px rgba(30,56,16,0.07)" }}>
            <Send size={15} style={{ color: "#F7941D" }} />
            Announce
          </button>
          {/* Manual Payment */}
          <button onClick={() => router.push("/admin/financials")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:-translate-y-0.5"
            style={{ background: "white", color: "#4A5568", border: "1px solid rgba(30,56,16,0.12)", boxShadow: "0 1px 3px rgba(30,56,16,0.07)" }}>
            <CreditCard size={15} style={{ color: "#F7941D" }} />
            Manual Payment
          </button>
          {/* Add Doctor */}
          <button onClick={() => router.push("/admin/users/add-doctor")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:-translate-y-0.5 transition-all"
            style={{ background: "linear-gradient(135deg, #1E3810, #2D2D4E)" }}>
            <Plus size={15} /> Add Doctor
          </button>
          {/* Create Account */}
          <button onClick={() => router.push("/admin/users/create")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:-translate-y-0.5 transition-all"
            style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)" }}>
            <Plus size={15} /> Create Account
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Users", value: counts.all,    accent: "#1E3810", Icon: Users },
          { label: "Clients",     value: counts.client, accent: "#8DC63F", Icon: Users },
          { label: "Doctors",     value: counts.doctor, accent: "#F7941D", Icon: Shield },
          { label: "Active",      value: counts.active, accent: "#6BA028", Icon: CheckCircle },
        ].map(({ label, value, accent, Icon }) => (
          <div key={label} className="rounded-2xl p-4 flex items-center gap-3"
            style={{ background: "white", boxShadow: "0 1px 4px rgba(30,56,16,0.07)" }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: accent + "15" }}>
              <Icon size={16} style={{ color: accent }} />
            </div>
            <div>
              <p className="text-2xl font-semibold leading-none"
                style={{ fontFamily: "var(--font-dm-serif)", color: "#1E3810" }}>{value}</p>
              <p className="text-xs mt-0.5" style={{ color: "#8A9BA8" }}>{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {(["all","client","doctor","admin"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-3 py-2 rounded-xl text-xs font-semibold capitalize transition-all"
              style={{
                background: filter === f ? "#1E3810" : "white",
                color:      filter === f ? "white" : "#4A5568",
                boxShadow:  filter === f ? "none" : "0 1px 3px rgba(30,56,16,0.07)",
              }}>
              {f === "all" ? `All (${counts.all})` : `${f.charAt(0).toUpperCase() + f.slice(1)}s (${counts[f as Role]})`}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "#8A9BA8" }} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm border focus:outline-none"
            style={{ borderColor: "rgba(30,56,16,0.12)", background: "white" }} />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3.5 top-1/2 -translate-y-1/2">
              <X size={13} style={{ color: "#8A9BA8" }} />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: "white", boxShadow: "0 1px 4px rgba(30,56,16,0.07)" }}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin" style={{ color: "#8DC63F" }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
              style={{ background: "rgba(141,198,63,0.08)" }}>
              <Users size={24} style={{ color: "#8DC63F" }} />
            </div>
            <p className="text-sm font-medium" style={{ color: "#1E3810" }}>No users found</p>
            <p className="text-xs mt-1" style={{ color: "#8A9BA8" }}>
              {search ? "Try a different search term." : "Users appear here after registration."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(30,56,16,0.07)" }}>
                  {[
                    { label: "User",       cls: "" },
                    { label: "Role",       cls: "" },
                    { label: "Status",     cls: "" },
                    { label: "Onboarding", cls: "hidden lg:table-cell" },
                    { label: "Joined",     cls: "hidden md:table-cell" },
                    { label: "",           cls: "" },
                  ].map(({ label, cls }) => (
                    <th key={label}
                      className={`text-left py-3 px-4 first:px-5 last:px-5 text-xs font-semibold uppercase tracking-wider ${cls}`}
                      style={{ color: "#8A9BA8" }}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <UserRow key={u.uid} user={u}
                    onToggleActive={handleToggleActive}
                    onChangeRole={handleChangeRole}
                    onResetPassword={handleResetPassword}
                    onEdit={setEditUser}
                    onViewAppointments={handleViewAppointments}
                    acting={acting} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {filtered.length > 0 && (
          <div className="px-5 py-3 border-t flex items-center justify-between"
            style={{ borderColor: "rgba(30,56,16,0.06)" }}>
            <p className="text-xs" style={{ color: "#8A9BA8" }}>
              Showing {filtered.length} of {users.length} users
            </p>
            {search && (
              <button onClick={() => setSearch("")} className="text-xs font-medium hover:underline"
                style={{ color: "#1E3810" }}>Clear search</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
