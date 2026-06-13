// src/app/(dashboard)/admin/users/add-doctor/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import {
  ArrowLeft, User, Mail, Lock, Briefcase, BookOpen,
  Globe, Heart, Clock, Users, CheckCircle, Loader2,
  AlertCircle, Plus, X, Award,
} from "lucide-react";

// ── Option sets ────────────────────────────────────────────────────────────
const SPECIALIZATION_OPTIONS = [
  "Anxiety", "Depression", "Trauma", "PTSD", "Grief & Bereavement",
  "Stress Management", "Relationship Therapy", "Couples Therapy",
  "Family Therapy", "Child Psychology", "Adolescent Therapy",
  "Self-Esteem", "Identity & Personal Development", "Anger Management",
  "Eating Disorders", "Addiction & Substance Use", "ADHD",
  "Neurodivergence", "Workplace Wellness", "Burnout", "Life Coaching",
  "Mood Disorders", "Bipolar", "OCD", "Panic Disorder",
  "Sleep Disorders", "Chronic Illness", "Emotional Regulation",
];

const SESSION_TYPE_OPTIONS = [
  "Individual Therapy", "Couples Therapy", "Family Therapy",
  "Life Coaching", "Workplace Wellness", "Free Consultation",
];

const APPROACH_OPTIONS = [
  "CBT (Cognitive Behavioural Therapy)",
  "DBT (Dialectical Behaviour Therapy)",
  "Psychodynamic",
  "Mindfulness-Based",
  "ACT (Acceptance & Commitment Therapy)",
  "EMDR",
  "Person-Centred",
  "Narrative Therapy",
  "Solution-Focused",
  "Integrative",
  "Somatic Therapy",
  "Trauma-Informed Care",
];

const LANGUAGE_OPTIONS = ["English", "Spanish", "French", "Portuguese", "Dutch", "Papiamento"];
const TIMEZONE_OPTIONS = [
  "America/Port_of_Spain", "America/Barbados", "America/St_Vincent",
  "America/New_York", "America/Los_Angeles", "Europe/London", "UTC",
];

// ── Multi-select chip component ────────────────────────────────────────────
function ChipSelect({ options, selected, onChange, max }: {
  options: string[]; selected: string[];
  onChange: (v: string[]) => void; max?: number;
}) {
  const toggle = (opt: string) => {
    if (selected.includes(opt)) {
      onChange(selected.filter(s => s !== opt));
    } else {
      if (max && selected.length >= max) return;
      onChange([...selected, opt]);
    }
  };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => {
        const active = selected.includes(opt);
        return (
          <button key={opt} type="button" onClick={() => toggle(opt)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
            style={{
              background: active ? "rgba(42,74,26,0.1)" : "rgba(42,74,26,0.03)",
              border:     `1.5px solid ${active ? "#2A4A1A" : "rgba(42,74,26,0.12)"}`,
              color:      active ? "#2A4A1A" : "#8A9BA8",
            }}>
            {active && <CheckCircle size={11} />}
            {opt}
          </button>
        );
      })}
    </div>
  );
}

// ── Section wrapper ────────────────────────────────────────────────────────
function Section({ title, icon: Icon, children }: {
  title: string; icon: any; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl p-6"
      style={{ background: "white", boxShadow: "0 1px 4px rgba(42,74,26,0.07)" }}>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ background: "rgba(141,198,63,0.1)" }}>
          <Icon size={15} style={{ color: "#8DC63F" }} />
        </div>
        <h3 className="text-sm font-semibold" style={{ color: "#2A4A1A" }}>{title}</h3>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

// ── Field wrapper ──────────────────────────────────────────────────────────
function Field({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: "#4A5568" }}>
        {label} {required && <span style={{ color: "#F7941D" }}>*</span>}
      </label>
      {children}
      {hint && <p className="text-xs mt-1" style={{ color: "#8A9BA8" }}>{hint}</p>}
    </div>
  );
}

const inputCls = "w-full px-3 py-2.5 rounded-xl text-sm border focus:outline-none transition-colors";
const inputStyle = { borderColor: "rgba(42,74,26,0.15)", background: "#FAFAFA", color: "#22272B" };

// ── Main page ──────────────────────────────────────────────────────────────
export default function AddDoctorPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    // Account
    displayName:     "",
    email:           "",
    password:        "",
    title:           "Dr.",

    // Profile
    bio:             "",
    photoURL:        "",
    gender:          "prefer-not-to-say" as "male" | "female" | "non-binary" | "prefer-not-to-say",
    yearsExperience: 1,
    timezone:        "America/Port_of_Spain",

    // Clinical
    specializations: [] as string[],
    sessionTypes:    [] as string[],
    approaches:      [] as string[],
    languages:       ["English"] as string[],

    // Capacity
    acceptingClients: true,
    maxClients:       20,
  });

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState("");

  const set = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    // Validation
    if (!form.displayName.trim()) return setError("Full name is required.");
    if (!form.email.trim())       return setError("Email is required.");
    if (form.password.length < 8) return setError("Password must be at least 8 characters.");
    if (!form.bio.trim())         return setError("Bio is required.");
    if (form.specializations.length === 0) return setError("Select at least one specialization.");
    if (form.sessionTypes.length === 0)    return setError("Select at least one session type.");
    if (form.languages.length === 0)       return setError("Select at least one language.");

    setLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/admin/create-doctor", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body:    JSON.stringify({
          displayName:      form.displayName.trim(),
          email:            form.email.trim(),
          password:         form.password,
          // Profile
          title:            form.title,
          bio:              form.bio.trim(),
          photoURL:         form.photoURL.trim(),
          gender:           form.gender,
          yearsExperience:  Number(form.yearsExperience),
          timezone:         form.timezone,
          // Clinical
          specializations:  form.specializations,
          sessionTypes:     form.sessionTypes,
          approaches:       form.approaches,
          languages:        form.languages,
          // Capacity
          acceptingClients: form.acceptingClients,
          maxClients:       Number(form.maxClients),
          currentClients:   0,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create doctor.");

      setSuccess(`Dr. ${form.displayName} has been added successfully.`);
      setTimeout(() => router.push("/admin/users"), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()}
          className="p-2 rounded-xl hover:bg-black/5 transition-colors"
          style={{ color: "#8A9BA8" }}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-2xl" style={{ fontFamily: "var(--font-dm-serif)", color: "#2A4A1A" }}>
            Add New Therapist
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "#8A9BA8" }}>
            Create a doctor account and configure their clinical profile for client matching
          </p>
        </div>
      </div>

      {/* Success */}
      {success && (
        <div className="flex items-center gap-3 px-5 py-4 rounded-2xl"
          style={{ background: "rgba(141,198,63,0.08)", border: "1px solid rgba(141,198,63,0.2)" }}>
          <CheckCircle size={18} style={{ color: "#8DC63F" }} />
          <p className="text-sm font-medium" style={{ color: "#6BA028" }}>{success}</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 px-5 py-4 rounded-2xl"
          style={{ background: "rgba(247,148,29,0.08)", border: "1px solid rgba(247,148,29,0.2)" }}>
          <AlertCircle size={18} style={{ color: "#F7941D" }} />
          <p className="text-sm font-medium" style={{ color: "#F7941D" }}>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── Account Details ── */}
        <Section title="Account Details" icon={User}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Title" required>
              <select value={form.title} onChange={e => set("title", e.target.value)}
                className={inputCls} style={inputStyle}>
                <option>Dr.</option>
                <option>Ms.</option>
                <option>Mr.</option>
                <option>Mx.</option>
                <option>Prof.</option>
              </select>
            </Field>
            <Field label="Full Name" required>
              <input value={form.displayName} onChange={e => set("displayName", e.target.value)}
                placeholder="Jozelle Miller" className={inputCls} style={inputStyle} />
            </Field>
          </div>
          <Field label="Email Address" required>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#8A9BA8" }} />
              <input type="email" value={form.email} onChange={e => set("email", e.target.value)}
                placeholder="doctor@valeoexperience.com"
                className={inputCls} style={{ ...inputStyle, paddingLeft: "36px" }} />
            </div>
          </Field>
          <Field label="Temporary Password" required hint="Doctor will be prompted to change this on first login.">
            <div className="relative">
              <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#8A9BA8" }} />
              <input type="password" value={form.password} onChange={e => set("password", e.target.value)}
                placeholder="Min 8 characters"
                className={inputCls} style={{ ...inputStyle, paddingLeft: "36px" }} />
            </div>
          </Field>
        </Section>

        {/* ── Professional Profile ── */}
        <Section title="Professional Profile" icon={Briefcase}>
          <Field label="Bio / About" required hint="This is shown to clients on their match card.">
            <textarea value={form.bio} onChange={e => set("bio", e.target.value)}
              rows={4} placeholder="Describe the therapist's background, approach, and what clients can expect..."
              className={inputCls + " resize-none"} style={inputStyle} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Years of Experience" required>
              <div className="relative">
                <Award size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#8A9BA8" }} />
                <input type="number" min={0} max={60} value={form.yearsExperience}
                  onChange={e => set("yearsExperience", e.target.value)}
                  className={inputCls} style={{ ...inputStyle, paddingLeft: "36px" }} />
              </div>
            </Field>
            <Field label="Gender" required hint="Used for client gender preference matching.">
              <select value={form.gender} onChange={e => set("gender", e.target.value)}
                className={inputCls} style={inputStyle}>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="non-binary">Non-binary</option>
                <option value="prefer-not-to-say">Prefer not to say</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Timezone">
              <select value={form.timezone} onChange={e => set("timezone", e.target.value)}
                className={inputCls} style={inputStyle}>
                {TIMEZONE_OPTIONS.map(tz => (
                  <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>
                ))}
              </select>
            </Field>
            <Field label="Profile Photo URL" hint="Optional. Paste a direct image URL.">
              <input value={form.photoURL} onChange={e => set("photoURL", e.target.value)}
                placeholder="https://..." className={inputCls} style={inputStyle} />
            </Field>
          </div>
        </Section>

        {/* ── Clinical Specializations ── */}
        <Section title="Specializations" icon={Heart}>
          <Field label="Areas of Expertise" required hint="These are matched against client intake responses.">
            <ChipSelect options={SPECIALIZATION_OPTIONS}
              selected={form.specializations}
              onChange={v => set("specializations", v)} />
          </Field>
        </Section>

        {/* ── Session Types & Approaches ── */}
        <Section title="Session Types & Approaches" icon={BookOpen}>
          <Field label="Session Types Offered" required>
            <ChipSelect options={SESSION_TYPE_OPTIONS}
              selected={form.sessionTypes}
              onChange={v => set("sessionTypes", v)} />
          </Field>
          <Field label="Therapeutic Approaches" hint="Optional — improves matching accuracy.">
            <ChipSelect options={APPROACH_OPTIONS}
              selected={form.approaches}
              onChange={v => set("approaches", v)} />
          </Field>
        </Section>

        {/* ── Languages ── */}
        <Section title="Languages" icon={Globe}>
          <Field label="Session Languages" required>
            <ChipSelect options={LANGUAGE_OPTIONS}
              selected={form.languages}
              onChange={v => set("languages", v)} />
          </Field>
        </Section>

        {/* ── Capacity ── */}
        <Section title="Capacity & Availability" icon={Users}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Maximum Clients" hint="Total number of active clients this therapist can hold.">
              <div className="relative">
                <Users size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#8A9BA8" }} />
                <input type="number" min={1} max={100} value={form.maxClients}
                  onChange={e => set("maxClients", e.target.value)}
                  className={inputCls} style={{ ...inputStyle, paddingLeft: "36px" }} />
              </div>
            </Field>
            <Field label="Accepting New Clients">
              <div className="flex items-center gap-3 mt-1">
                <button type="button"
                  onClick={() => set("acceptingClients", !form.acceptingClients)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all"
                  style={{
                    borderColor: form.acceptingClients ? "#8DC63F" : "rgba(42,74,26,0.15)",
                    background:  form.acceptingClients ? "rgba(141,198,63,0.1)" : "white",
                    color:       form.acceptingClients ? "#6BA028" : "#8A9BA8",
                  }}>
                  {form.acceptingClients
                    ? <><CheckCircle size={15} /> Accepting</>
                    : <><X size={15} /> Not Accepting</>}
                </button>
              </div>
            </Field>
          </div>
        </Section>

        {/* ── Submit ── */}
        <div className="flex items-center gap-3 justify-end pb-6">
          <button type="button" onClick={() => router.back()}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold border"
            style={{ borderColor: "rgba(42,74,26,0.15)", color: "#4A5568" }}>
            Cancel
          </button>
          <button type="submit" disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)" }}>
            {loading
              ? <><Loader2 size={15} className="animate-spin" /> Creating Account...</>
              : <><Plus size={15} /> Add Therapist</>}
          </button>
        </div>

      </form>
    </div>
  );
}
