// src/app/(dashboard)/admin/assignments/page.tsx
"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, query, where, doc, updateDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Users, RefreshCw, CheckCircle, AlertCircle, Search,
  ChevronDown, Loader2, UserCheck, Flag, ArrowRight, X
} from "lucide-react";

interface Assignment {
  clientId:          string;
  clientName:        string;
  clientEmail:       string;
  doctorId:          string;
  doctorName:        string;
  matchPercent:      number;
  assignedAt:        any;
  assignedBy:        string;
  status:            "active" | "inactive";
  switchRequested:   boolean;
  switchReason?:     string;
}

interface Doctor {
  uid:         string;
  displayName: string;
  title:       string;
  specializations: string[];
  currentClients:  number;
  maxClients:      number;
  acceptingClients: boolean;
}

export default function AdminAssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [doctors,     setDoctors]     = useState<Doctor[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");
  const [filter,      setFilter]      = useState<"all" | "switch_requested" | "unassigned">("all");
  const [reassigning, setReassigning] = useState<string | null>(null);
  const [targetDoctor, setTargetDoctor] = useState<string>("");
  const [saving,       setSaving]      = useState(false);
  const [toast,        setToast]       = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [assignSnap, doctorSnap, clientSnap] = await Promise.all([
        getDocs(collection(db, "assignments")),
        getDocs(query(collection(db, "users"), where("role", "==", "doctor"))),
        getDocs(query(collection(db, "users"), where("role", "==", "client"))),
      ]);

      const assignMap: Record<string, Assignment> = {};
      assignSnap.docs.forEach(d => {
        assignMap[d.id] = { clientId: d.id, ...d.data() } as Assignment;
      });

      // Enrich with client names from users collection
      const clientMap: Record<string, { displayName: string; email: string }> = {};
      clientSnap.docs.forEach(d => {
        const data = d.data();
        clientMap[d.id] = { displayName: data.displayName ?? "Unknown", email: data.email ?? "" };
      });

      const enriched = Object.values(assignMap).map(a => ({
        ...a,
        clientName:  clientMap[a.clientId]?.displayName ?? a.clientName ?? "Unknown",
        clientEmail: clientMap[a.clientId]?.email       ?? "",
      }));

      // Find unassigned clients
      const assignedIds = new Set(Object.keys(assignMap));
      const unassigned  = clientSnap.docs
        .filter(d => !assignedIds.has(d.id))
        .map(d => ({
          clientId:        d.id,
          clientName:      d.data().displayName ?? "Unknown",
          clientEmail:     d.data().email ?? "",
          doctorId:        "",
          doctorName:      "— Unassigned —",
          matchPercent:    0,
          assignedAt:      null,
          assignedBy:      "",
          status:          "inactive" as const,
          switchRequested: false,
        }));

      setAssignments([...enriched, ...unassigned]);
      setDoctors(doctorSnap.docs.map(d => ({ uid: d.id, ...d.data() }) as Doctor));
      setLoading(false);
    })();
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  async function handleReassign(clientId: string) {
    if (!targetDoctor) return;
    setSaving(true);
    const doctor = doctors.find(d => d.uid === targetDoctor);
    if (!doctor) { setSaving(false); return; }

    try {
      await setDoc(doc(db, "assignments", clientId), {
        clientId,
        doctorId:        targetDoctor,
        doctorName:      doctor.displayName,
        matchPercent:    0,
        assignedAt:      serverTimestamp(),
        assignedBy:      "admin",
        status:          "active",
        switchRequested: false,
        switchReason:    null,
      }, { merge: true });

      await updateDoc(doc(db, "users", clientId), { doctorId: targetDoctor });

      setAssignments(prev => prev.map(a =>
        a.clientId === clientId
          ? { ...a, doctorId: targetDoctor, doctorName: doctor.displayName,
              assignedBy: "admin", status: "active", switchRequested: false }
          : a
      ));
      showToast(`Reassigned successfully to ${doctor.title} ${doctor.displayName}`);
      setReassigning(null);
      setTargetDoctor("");
    } finally {
      setSaving(false);
    }
  }

  async function dismissSwitch(clientId: string) {
    await updateDoc(doc(db, "assignments", clientId), { switchRequested: false, switchReason: null });
    setAssignments(prev => prev.map(a =>
      a.clientId === clientId ? { ...a, switchRequested: false } : a
    ));
    showToast("Switch request dismissed.");
  }

  const filtered = assignments.filter(a => {
    const matchesSearch = !search ||
      a.clientName.toLowerCase().includes(search.toLowerCase()) ||
      a.doctorName.toLowerCase().includes(search.toLowerCase());

    const matchesFilter =
      filter === "all"              ? true :
      filter === "switch_requested" ? a.switchRequested :
      filter === "unassigned"       ? !a.doctorId
      : true;

    return matchesSearch && matchesFilter;
  });

  const switchCount    = assignments.filter(a => a.switchRequested).length;
  const unassignedCount = assignments.filter(a => !a.doctorId).length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-lg text-sm font-medium text-white"
          style={{ background: "#2A4A1A" }}>
          <CheckCircle size={16} />{toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl" style={{ fontFamily: "var(--font-dm-serif)", color: "#2A4A1A" }}>
            Assignments
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "#8A9BA8" }}>
            Manage client–therapist assignments and switch requests
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Assigned",     value: assignments.filter(a => a.doctorId).length, accent: "#2A4A1A", Icon: UserCheck   },
          { label: "Unassigned",         value: unassignedCount,                            accent: "#F7941D", Icon: Users       },
          { label: "Switch Requests",    value: switchCount,                                accent: "#F7941D", Icon: RefreshCw   },
          { label: "Active Therapists",  value: doctors.filter(d => d.acceptingClients).length, accent: "#8DC63F", Icon: CheckCircle },
        ].map(({ label, value, accent, Icon }) => (
          <div key={label} className="rounded-2xl p-4 flex items-center gap-3"
            style={{ background: "white", boxShadow: "0 1px 4px rgba(42,74,26,0.07)" }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: accent + "12" }}>
              <Icon size={16} style={{ color: accent }} />
            </div>
            <div>
              <p className="text-2xl font-semibold leading-none"
                style={{ fontFamily: "var(--font-dm-serif)", color: "#2A4A1A" }}>{value}</p>
              <p className="text-xs mt-0.5" style={{ color: "#8A9BA8" }}>{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter + search */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#8A9BA8" }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search clients or therapists..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border focus:outline-none"
            style={{ borderColor: "rgba(42,74,26,0.15)", background: "white", color: "#22272B" }} />
        </div>
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(42,74,26,0.06)" }}>
          {([
            { key: "all",              label: "All" },
            { key: "switch_requested", label: `Switch Requests ${switchCount > 0 ? `(${switchCount})` : ""}` },
            { key: "unassigned",       label: `Unassigned ${unassignedCount > 0 ? `(${unassignedCount})` : ""}` },
          ] as const).map(({ key, label }) => (
            <button key={key} onClick={() => setFilter(key)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: filter === key ? "white" : "transparent",
                color:      filter === key ? "#2A4A1A" : "#8A9BA8",
                boxShadow:  filter === key ? "0 1px 3px rgba(42,74,26,0.1)" : "none",
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={28} className="animate-spin" style={{ color: "#8DC63F" }} />
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden"
          style={{ background: "white", boxShadow: "0 1px 4px rgba(42,74,26,0.07)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(42,74,26,0.07)" }}>
                {["Client", "Assigned Therapist", "Match", "Assigned By", "Status", "Actions"].map(h => (
                  <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "#8A9BA8" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, i) => (
                <>
                  <tr key={a.clientId}
                    style={{ borderBottom: i < filtered.length - 1 ? "1px solid rgba(42,74,26,0.05)" : "none" }}>

                    {/* Client */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: "rgba(141,198,63,0.12)", color: "#2A4A1A" }}>
                          {a.clientName[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold" style={{ color: "#2A4A1A" }}>{a.clientName}</p>
                          <p className="text-xs" style={{ color: "#8A9BA8" }}>{a.clientEmail}</p>
                        </div>
                      </div>
                    </td>

                    {/* Doctor */}
                    <td className="px-5 py-4">
                      <p className="font-medium" style={{ color: a.doctorId ? "#2A4A1A" : "#C4C4C4" }}>
                        {a.doctorName}
                      </p>
                    </td>

                    {/* Match % */}
                    <td className="px-5 py-4">
                      {a.matchPercent > 0 ? (
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                          style={{ background: "rgba(141,198,63,0.1)", color: "#6BA028" }}>
                          {a.matchPercent}%
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: "#C4C4C4" }}>—</span>
                      )}
                    </td>

                    {/* Assigned by */}
                    <td className="px-5 py-4">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{
                          background: a.assignedBy === "admin" ? "rgba(42,74,26,0.07)" : "rgba(141,198,63,0.08)",
                          color:      a.assignedBy === "admin" ? "#2A4A1A" : "#6BA028",
                        }}>
                        {a.assignedBy === "admin" ? "Admin" : a.assignedBy ? "System" : "—"}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4">
                      {a.switchRequested ? (
                        <span className="flex items-center gap-1.5 text-xs font-semibold"
                          style={{ color: "#F7941D" }}>
                          <Flag size={12} /> Switch Req.
                        </span>
                      ) : a.doctorId ? (
                        <span className="flex items-center gap-1.5 text-xs font-semibold"
                          style={{ color: "#6BA028" }}>
                          <CheckCircle size={12} /> Active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs font-semibold"
                          style={{ color: "#F7941D" }}>
                          <AlertCircle size={12} /> Unassigned
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {a.switchRequested && (
                          <button onClick={() => dismissSwitch(a.clientId)}
                            className="p-1.5 rounded-lg hover:bg-red-50"
                            title="Dismiss switch request">
                            <X size={13} style={{ color: "#F7941D" }} />
                          </button>
                        )}
                        <button
                          onClick={() => { setReassigning(a.clientId); setTargetDoctor(""); }}
                          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
                          style={{ background: "rgba(42,74,26,0.05)", color: "#2A4A1A" }}>
                          <RefreshCw size={11} />
                          {a.doctorId ? "Reassign" : "Assign"}
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Inline reassign row */}
                  {reassigning === a.clientId && (
                    <tr key={`${a.clientId}-reassign`}
                      style={{ background: "rgba(42,74,26,0.02)", borderBottom: "1px solid rgba(42,74,26,0.05)" }}>
                      <td colSpan={6} className="px-5 py-4">
                        <div className="flex items-center gap-3 flex-wrap">
                          <p className="text-sm font-semibold" style={{ color: "#2A4A1A" }}>
                            Assign {a.clientName} to:
                          </p>
                          <select value={targetDoctor} onChange={e => setTargetDoctor(e.target.value)}
                            className="flex-1 min-w-48 px-3 py-2 rounded-xl text-sm border focus:outline-none"
                            style={{ borderColor: "rgba(42,74,26,0.15)", background: "white", color: "#22272B" }}>
                            <option value="">Select therapist...</option>
                            {doctors.map(d => (
                              <option key={d.uid} value={d.uid}>
                                {d.title} {d.displayName} — {d.currentClients}/{d.maxClients} clients
                                {!d.acceptingClients ? " (not accepting)" : ""}
                              </option>
                            ))}
                          </select>
                          <div className="flex gap-2">
                            <button onClick={() => { setReassigning(null); setTargetDoctor(""); }}
                              className="px-3 py-2 rounded-xl text-xs font-semibold border"
                              style={{ borderColor: "rgba(42,74,26,0.12)", color: "#8A9BA8" }}>
                              Cancel
                            </button>
                            <button onClick={() => handleReassign(a.clientId)}
                              disabled={!targetDoctor || saving}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-50"
                              style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)" }}>
                              {saving ? <Loader2 size={12} className="animate-spin" /> : <><ArrowRight size={12} /> Confirm</>}
                            </button>
                          </div>
                        </div>
                        {/* Switch reason */}
                        {a.switchReason && (
                          <div className="mt-2 px-3 py-2 rounded-xl text-xs italic"
                            style={{ background: "rgba(247,148,29,0.06)", color: "#F7941D", border: "1px solid rgba(247,148,29,0.15)" }}>
                            Client's reason: "{a.switchReason}"
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-sm" style={{ color: "#8A9BA8" }}>
                    No assignments found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
