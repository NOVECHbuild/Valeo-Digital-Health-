"use client";

import { useState, useEffect, useRef } from "react";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import {
  User, Mail, Phone, MapPin, Shield, Lock,
  CheckCircle, AlertCircle, Loader2, Edit3, Save, X,
  Heart, Clock, Users, AlertTriangle,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────
interface ProfileData {
  displayName:   string;
  email:         string;
  phone:         string;
  dateOfBirth:   string;
  country:       string;
  city:          string;
  goals:         string[];
  preferredTime: string;
  emergencyContact: {
    name:  string;
    phone: string;
  };
}

const GOALS = [
  "Manage stress & anxiety",
  "Improve relationships",
  "Work through grief or loss",
  "Build self-confidence",
  "Navigate life transitions",
  "Improve work-life balance",
  "Process trauma",
  "General mental wellness",
];

// FIX 1: Accent → rgba map (replaces invalid hex-alpha string concat)
const ACCENT_RGBA: Record<string, string> = {
  "#2A4A1A": "rgba(42,74,26,0.1)",
  "#8DC63F": "rgba(141,198,63,0.1)",
  "#F7941D": "rgba(247,148,29,0.1)",
};

// S1: First + last initial when name has a space
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] ?? "U").toUpperCase();
}

// S3: Password strength helper
function passwordStrength(pw: string): { level: 0|1|2|3; label: string; color: string } {
  if (!pw) return { level: 0, label: "", color: "" };
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[0-9]/.test(pw)) score++;
  if (score <= 1) return { level: 1, label: "Weak",   color: "#F7941D" };
  if (score === 2) return { level: 2, label: "Fair",   color: "#F7941D" };
  return              { level: 3, label: "Strong", color: "#6BA028" };
}

// ── Section wrapper ────────────────────────────────────────────────────────
function Section({
  title, icon: Icon, children, accent = "#2A4A1A",
}: {
  title: string; icon: React.ElementType;
  children: React.ReactNode; accent?: string;
}) {
  return (
    <div className="rounded-2xl p-6"
      style={{ background: "white", boxShadow: "0 1px 4px rgba(42,74,26,0.07)" }}>
      <div className="flex items-center gap-2 mb-5 pb-4 border-b"
        style={{ borderColor: "rgba(42,74,26,0.07)" }}>
        {/* FIX 1: Use ACCENT_RGBA map, not accent+"12" string concat */}
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: ACCENT_RGBA[accent] ?? "rgba(42,74,26,0.1)" }}>
          <Icon size={16} style={{ color: accent }} />
        </div>
        <h3 className="text-sm font-semibold" style={{ color: "#2A4A1A" }}>{title}</h3>
      </div>
      {children}
    </div>
  );
}

// ── Field ──────────────────────────────────────────────────────────────────
function Field({
  label, value, editing, children,
}: {
  label: string; value: string; editing: boolean; children?: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
        style={{ color: "#8A9BA8" }}>
        {label}
      </label>
      {editing ? children : (
        <p className="text-sm py-2.5 px-0" style={{ color: value ? "#22272B" : "#C4C4C4" }}>
          {value || "Not set"}
        </p>
      )}
    </div>
  );
}

// ── Input ──────────────────────────────────────────────────────────────────
function Input({ value, onChange, placeholder, type = "text" }: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2.5 rounded-xl text-sm border focus:outline-none transition-colors"
      style={{ borderColor: "rgba(42,74,26,0.15)", background: "#FAFAFA" }} />
  );
}

// ── Edit action buttons (reusable) ─────────────────────────────────────────
function EditActions({ saving, onCancel, onSave }: {
  saving: boolean; onCancel: () => void; onSave: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={onCancel}
        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
        style={{ color: "#8A9BA8", background: "rgba(42,74,26,0.04)" }}>
        <X size={12} /> Cancel
      </button>
      <button onClick={onSave} disabled={saving}
        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-60"
        style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)" }}>
        {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
        Save
      </button>
    </div>
  );
}

// ── Toast ──────────────────────────────────────────────────────────────────
function Toast({ type, msg }: { type: "success" | "error"; msg: string }) {
  return (
    <div className="fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-lg text-sm font-medium"
      style={{ background: type === "success" ? "#2A4A1A" : "#F7941D", color: "white" }}>
      {type === "success" ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
      {msg}
    </div>
  );
}

// S2: Profile completeness indicator
function CompletenessBar({ profile }: { profile: ProfileData }) {
  const fields = [
    profile.displayName,
    profile.phone,
    profile.dateOfBirth,
    profile.city,
    profile.goals.length > 0 ? "yes" : "",
    profile.emergencyContact.name,
  ];
  const filled = fields.filter(Boolean).length;
  const pct = Math.round((filled / fields.length) * 100);
  const color = pct < 50 ? "#F7941D" : pct < 100 ? "#8DC63F" : "#6BA028";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(42,74,26,0.08)" }}>
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-semibold flex-shrink-0" style={{ color }}>
        {pct}% complete
      </span>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function ClientProfilePage() {
  const { user } = useAuth();

  const emptyProfile: ProfileData = {
    displayName: "", email: "", phone: "", dateOfBirth: "",
    country: "", city: "", goals: [], preferredTime: "",
    emergencyContact: { name: "", phone: "" },
  };

  const [profile, setProfile]         = useState<ProfileData>(emptyProfile);
  const [draft, setDraft]             = useState<ProfileData>(emptyProfile);
  const [loading, setLoading]         = useState(true);
  const [fetchError, setFetchError]   = useState<string | null>(null); // FIX 2
  const [editSection, setEditSection] = useState<string | null>(null);
  const [saving, setSaving]           = useState(false);
  const [toast, setToast]             = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Password state
  const [currentPassword,  setCurrentPassword]  = useState("");
  const [newPassword,      setNewPassword]       = useState("");
  const [confirmPassword,  setConfirmPassword]   = useState("");
  const [pwSaving,         setPwSaving]          = useState(false);
  const [pwError,          setPwError]           = useState<string | null>(null);

  // FIX 3: Toast timer via ref for cleanup
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showToast(type: "success" | "error", msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ type, msg });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  // FIX 2: try/catch on profile load
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const d = snap.data();
          const loaded: ProfileData = {
            displayName:   d.displayName   ?? user.displayName ?? "",
            email:         d.email         ?? user.email ?? "",
            phone:         d.phone         ?? "",
            dateOfBirth:   d.dateOfBirth   ?? "",
            country:       d.country       ?? "",
            city:          d.city          ?? "",
            goals:         d.goals         ?? [],
            preferredTime: d.preferredTime ?? "",
            emergencyContact: {
              name:  d.emergencyContact?.name  ?? "",
              phone: d.emergencyContact?.phone ?? "",
            },
          };
          setProfile(loaded);
          setDraft(loaded);
        }
      } catch (err) {
        console.error("[Profile] load:", err);
        setFetchError("Could not load your profile. Please refresh.");
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  function startEdit(section: string) {
    setDraft({ ...profile });
    setEditSection(section);
  }

  function cancelEdit() {
    setDraft({ ...profile });
    setEditSection(null);
  }

  // FIX 5: Only write the fields relevant to the active section
  async function saveSection() {
    if (!user) return;
    setSaving(true);
    try {
      // Build a partial update based on which section is open
      let partial: Record<string, any> = { updatedAt: serverTimestamp() };

      if (editSection === "personal") {
        partial = {
          ...partial,
          displayName: draft.displayName,
          phone:       draft.phone,
          dateOfBirth: draft.dateOfBirth,
          country:     draft.country,
          city:        draft.city,
        };
        if (draft.displayName !== profile.displayName) {
          await updateProfile(user, { displayName: draft.displayName });
        }
      } else if (editSection === "goals") {
        partial = {
          ...partial,
          goals:         draft.goals,
          preferredTime: draft.preferredTime,
        };
      } else if (editSection === "emergency") {
        partial = {
          ...partial,
          emergencyContact: draft.emergencyContact,
        };
      }

      await updateDoc(doc(db, "users", user.uid), partial);
      setProfile({ ...draft });
      setEditSection(null);
      showToast("success", "Profile updated successfully.");
    } catch (err) {
      console.error("[Profile] save:", err);
      showToast("error", "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // FIX 9: finally block ensures pwSaving always clears
  async function handlePasswordChange() {
    if (!user || !user.email) return;
    setPwError(null);

    if (newPassword.length < 8) {
      setPwError("New password must be at least 8 characters."); return;
    }
    if (newPassword !== confirmPassword) {
      setPwError("Passwords do not match."); return;
    }

    setPwSaving(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      setEditSection(null);
      showToast("success", "Password changed successfully.");
    } catch (err: any) {
      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        setPwError("Current password is incorrect.");
      } else {
        setPwError("Failed to change password. Please try again.");
      }
    } finally {
      setPwSaving(false); // always clears
    }
  }

  function toggleGoal(goal: string) {
    setDraft(d => ({
      ...d,
      goals: d.goals.includes(goal)
        ? d.goals.filter(g => g !== goal)
        : [...d.goals, goal],
    }));
  }

  // Password strength (S3)
  const strength = passwordStrength(newPassword);

  // Last sign-in for password row (BUG 7)
  const lastSignIn = user?.metadata?.lastSignInTime
    ? new Date(user.metadata.lastSignInTime).toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric",
      })
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <Loader2 size={28} className="animate-spin" style={{ color: "#8DC63F" }} />
      </div>
    );
  }

  const isEditing = (s: string) => editSection === s;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {toast && <Toast type={toast.type} msg={toast.msg} />}

      {/* FIX 2: Fetch error banner */}
      {fetchError && (
        <div className="rounded-2xl p-4 flex items-start gap-3"
          style={{ background: "rgba(247,148,29,0.06)", border: "1px solid rgba(247,148,29,0.15)" }}>
          <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" style={{ color: "#F7941D" }} />
          <p className="text-sm" style={{ color: "#F7941D" }}>{fetchError}</p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4">
        {/* S1: First + last initials */}
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)", color: "white" }}>
          {getInitials(profile.displayName || user?.displayName || "U")}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl" style={{ fontFamily: "var(--font-dm-serif)", color: "#2A4A1A" }}>
            {profile.displayName || "Your Profile"}
          </h2>
          <p className="text-sm mb-2" style={{ color: "#8A9BA8" }}>{profile.email}</p>
          {/* S2: Completeness bar */}
          <CompletenessBar profile={profile} />
        </div>
      </div>

      {/* ── Personal Information ── */}
      <Section title="Personal Information" icon={User}>
        <div className="flex items-center justify-between mb-4">
          <span />
          {!isEditing("personal") ? (
            <button onClick={() => startEdit("personal")}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
              style={{ color: "#2A4A1A", background: "rgba(42,74,26,0.06)" }}>
              <Edit3 size={12} /> Edit
            </button>
          ) : (
            <EditActions saving={saving} onCancel={cancelEdit} onSave={saveSection} />
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Full Name" value={profile.displayName} editing={isEditing("personal")}>
            <Input value={draft.displayName}
              onChange={v => setDraft(d => ({ ...d, displayName: v }))}
              placeholder="Your full name" />
          </Field>

          {/* FIX 4: Email is always read-only — no Input child, no dead onChange */}
          <Field label="Email Address" value={profile.email} editing={false} />

          <Field label="Phone Number" value={profile.phone} editing={isEditing("personal")}>
            {/* FIX 10: Generic Caribbean format placeholder */}
            <Input value={draft.phone}
              onChange={v => setDraft(d => ({ ...d, phone: v }))}
              placeholder="+1 (xxx) xxx-xxxx" />
          </Field>
          <Field label="Date of Birth" value={profile.dateOfBirth} editing={isEditing("personal")}>
            <Input value={draft.dateOfBirth}
              onChange={v => setDraft(d => ({ ...d, dateOfBirth: v }))}
              type="date" />
          </Field>
          <Field label="City" value={profile.city} editing={isEditing("personal")}>
            <Input value={draft.city}
              onChange={v => setDraft(d => ({ ...d, city: v }))}
              placeholder="Port of Spain" />
          </Field>
          <Field label="Country" value={profile.country} editing={isEditing("personal")}>
            <Input value={draft.country}
              onChange={v => setDraft(d => ({ ...d, country: v }))}
              placeholder="Trinidad & Tobago" />
          </Field>
        </div>
      </Section>

      {/* ── Wellness Goals ── */}
      <Section title="Wellness Goals" icon={Heart} accent="#8DC63F">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs" style={{ color: "#8A9BA8" }}>
            {profile.goals.length > 0
              ? `${profile.goals.length} goal${profile.goals.length > 1 ? "s" : ""} selected`
              : "No goals set yet"}
          </p>
          {!isEditing("goals") ? (
            <button onClick={() => startEdit("goals")}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{ color: "#2A4A1A", background: "rgba(42,74,26,0.06)" }}>
              <Edit3 size={12} /> Edit
            </button>
          ) : (
            <EditActions saving={saving} onCancel={cancelEdit} onSave={saveSection} />
          )}
        </div>

        {isEditing("goals") ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {GOALS.map(goal => {
                const selected = draft.goals.includes(goal);
                return (
                  <button key={goal} onClick={() => toggleGoal(goal)}
                    className="text-left p-3 rounded-xl border-2 text-xs font-medium transition-all"
                    style={{
                      borderColor: selected ? "#2A4A1A" : "rgba(42,74,26,0.1)",
                      background:  selected ? "rgba(42,74,26,0.05)" : "white",
                      color:       selected ? "#2A4A1A" : "#4A5568",
                    }}>
                    {selected && <CheckCircle size={11} className="inline mr-1" style={{ color: "#8DC63F" }} />}
                    {goal}
                  </button>
                );
              })}
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                style={{ color: "#8A9BA8" }}>Preferred Session Time</label>
              {/* FIX 8: Added Evening option */}
              <select value={draft.preferredTime}
                onChange={e => setDraft(d => ({ ...d, preferredTime: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl text-sm border focus:outline-none"
                style={{ borderColor: "rgba(42,74,26,0.15)", background: "#FAFAFA" }}>
                <option value="">No preference</option>
                <option value="morning">Morning (9am – 12pm)</option>
                <option value="afternoon">Afternoon (12pm – 4pm)</option>
                <option value="evening">Evening (4pm – 7pm)</option>
              </select>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {profile.goals.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {profile.goals.map(goal => (
                  <span key={goal} className="px-3 py-1.5 rounded-full text-xs font-medium"
                    style={{ background: "rgba(141,198,63,0.1)", color: "#6BA028" }}>
                    {goal}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm" style={{ color: "#C4C4C4" }}>No goals selected</p>
            )}
            {profile.preferredTime && (
              <div className="flex items-center gap-2 mt-2">
                <Clock size={13} style={{ color: "#8A9BA8" }} />
                <span className="text-xs" style={{ color: "#8A9BA8" }}>
                  Preferred: {
                    profile.preferredTime === "morning"   ? "Morning (9am – 12pm)" :
                    profile.preferredTime === "afternoon" ? "Afternoon (12pm – 4pm)" :
                    profile.preferredTime === "evening"   ? "Evening (4pm – 7pm)" :
                    profile.preferredTime
                  }
                </span>
              </div>
            )}
          </div>
        )}
      </Section>

      {/* ── Emergency Contact ── */}
      <Section title="Emergency Contact" icon={Users} accent="#F7941D">
        <div className="flex items-center justify-between mb-4">
          <span />
          {!isEditing("emergency") ? (
            <button onClick={() => startEdit("emergency")}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{ color: "#2A4A1A", background: "rgba(42,74,26,0.06)" }}>
              <Edit3 size={12} /> Edit
            </button>
          ) : (
            <EditActions saving={saving} onCancel={cancelEdit} onSave={saveSection} />
          )}
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Contact Name" value={profile.emergencyContact.name} editing={isEditing("emergency")}>
            <Input value={draft.emergencyContact.name}
              onChange={v => setDraft(d => ({ ...d, emergencyContact: { ...d.emergencyContact, name: v } }))}
              placeholder="Full name" />
          </Field>
          <Field label="Phone Number" value={profile.emergencyContact.phone} editing={isEditing("emergency")}>
            <Input value={draft.emergencyContact.phone}
              onChange={v => setDraft(d => ({ ...d, emergencyContact: { ...d.emergencyContact, phone: v } }))}
              placeholder="+1 (xxx) xxx-xxxx" />
          </Field>
        </div>
      </Section>

      {/* ── Security ── */}
      <Section title="Security" icon={Shield} accent="#F7941D">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs" style={{ color: "#8A9BA8" }}>Change your account password</p>
          {!isEditing("password") ? (
            <button onClick={() => { setEditSection("password"); setPwError(null); }}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{ color: "#2A4A1A", background: "rgba(42,74,26,0.06)" }}>
              <Lock size={12} /> Change Password
            </button>
          ) : (
            <button onClick={() => {
              setEditSection(null); setPwError(null);
              setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
            }}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{ color: "#8A9BA8", background: "rgba(42,74,26,0.04)" }}>
              <X size={12} /> Cancel
            </button>
          )}
        </div>

        {isEditing("password") && (
          <div className="space-y-4">
            {pwError && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
                style={{ background: "rgba(247,148,29,0.08)", color: "#F7941D" }}>
                <AlertCircle size={14} />{pwError}
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                style={{ color: "#8A9BA8" }}>Current Password</label>
              <input type="password" value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="Your current password"
                className="w-full px-3 py-2.5 rounded-xl text-sm border focus:outline-none"
                style={{ borderColor: "rgba(42,74,26,0.15)", background: "#FAFAFA" }} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                style={{ color: "#8A9BA8" }}>New Password</label>
              <input type="password" value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Min. 8 characters"
                className="w-full px-3 py-2.5 rounded-xl text-sm border focus:outline-none"
                style={{ borderColor: "rgba(42,74,26,0.15)", background: "#FAFAFA" }} />
              {/* S3: Password strength meter */}
              {newPassword && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="flex-1 h-1 rounded-full transition-all"
                        style={{
                          background: i <= strength.level ? strength.color : "rgba(42,74,26,0.08)",
                        }} />
                    ))}
                  </div>
                  <p className="text-xs" style={{ color: strength.color }}>{strength.label}</p>
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                style={{ color: "#8A9BA8" }}>Confirm New Password</label>
              <input type="password" value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className="w-full px-3 py-2.5 rounded-xl text-sm border focus:outline-none"
                style={{
                  borderColor: confirmPassword && confirmPassword !== newPassword
                    ? "#F7941D" : "rgba(42,74,26,0.15)",
                  background: "#FAFAFA",
                }} />
              {confirmPassword && confirmPassword !== newPassword && (
                <p className="text-xs mt-1" style={{ color: "#F7941D" }}>Passwords do not match</p>
              )}
            </div>
            <button onClick={handlePasswordChange}
              disabled={pwSaving || !currentPassword || !newPassword || !confirmPassword}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)" }}>
              {pwSaving ? <><Loader2 size={14} className="animate-spin" /> Updating…</> : "Update Password"}
            </button>
          </div>
        )}

        {!isEditing("password") && (
          <div className="flex items-center gap-3 p-3 rounded-xl"
            style={{ background: "rgba(42,74,26,0.03)" }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(141,198,63,0.1)" }}>
              <Lock size={14} style={{ color: "#8DC63F" }} />
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: "#2A4A1A" }}>Password</p>
              {/* FIX 7: Real last sign-in time from Firebase Auth metadata */}
              <p className="text-xs" style={{ color: "#8A9BA8" }}>
                {lastSignIn ? `Last sign-in: ${lastSignIn}` : "Password protected"}
              </p>
            </div>
            <div className="ml-auto">
              <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                style={{ background: "rgba(141,198,63,0.1)", color: "#6BA028" }}>
                Protected
              </span>
            </div>
          </div>
        )}
      </Section>

      {/* Email change note */}
      <div className="rounded-2xl p-4 flex items-start gap-3"
        style={{ background: "rgba(42,74,26,0.03)", border: "1px solid rgba(42,74,26,0.07)" }}>
        <Mail size={15} className="flex-shrink-0 mt-0.5" style={{ color: "#8A9BA8" }} />
        <p className="text-xs" style={{ color: "#8A9BA8" }}>
          To change your email address please contact{" "}
          <a href="mailto:support@valeoexperience.com"
            className="underline font-medium" style={{ color: "#2A4A1A" }}>
            support@valeoexperience.com
          </a>
        </p>
      </div>
    </div>
  );
}
