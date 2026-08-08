"use client";

import { useState, useEffect, Suspense } from "react";
import { collection, query, where, getDoc, doc, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useSearchParams } from "next/navigation";
import {
  Search, Users, Calendar, Clock, ChevronRight, Loader2,
  Mail, Phone, MapPin, Heart, X, CheckCircle, MessageCircle,
  ExternalLink, FileText, TrendingUp, AlertCircle, Shield, FolderOpen,
} from "lucide-react";
import Link from "next/link";
import { CONSENT_VERSION, isConsentCurrent, CONSENT_ACKS, type ConsentRecord } from "@/lib/consent";
import ClinicalFile from "@/components/ClinicalFile";
import JoinSessionLink from "@/components/JoinSessionLink";

// ── Types ──────────────────────────────────────────────────────────────────
interface Client {
  uid:             string;
  displayName:     string;
  email:           string;
  phone?:          string;
  city?:           string;
  country?:        string;
  goals?:          string[];
  preferredTime?:  string;
  emergencyContact?: { name: string; phone: string };
  createdAt:       any;
  isActive?:       boolean;
  consentSignedAt?: any;
  consentVersion?: string;
}

interface Appointment {
  id:        string;
  type:      string;
  date:      string;
  time:      string;
  duration:  number;
  status:    "pending" | "approved" | "rejected" | "completed" | "cancelled";
  notes?:    string;
  meetLink?: string;
  clientId:  string;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function toDate(ts: any): Date | null {
  if (!ts) return null;
  if (ts.toDate) return ts.toDate();           // Firestore Timestamp
  if (ts instanceof Date) return ts;
  if (typeof ts === "string") return new Date(ts); // ISO string (admin-created users)
  return null;
}

function timeAgo(ts: any): string {
  const d = toDate(ts);
  if (!d) return "—";
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

// ── Status badge ───────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: Appointment["status"] }) {
  const map = {
    pending:   { bg: "rgba(247,148,29,0.12)",  color: "#C4700A", label: "Pending"   },
    approved:  { bg: "rgba(141,198,63,0.12)",  color: "#6BA028", label: "Confirmed" },
    rejected:  { bg: "rgba(247,148,29,0.12)",   color: "#F7941D", label: "Rejected"  },
    completed: { bg: "rgba(42,74,26,0.1)",     color: "#2A4A1A", label: "Completed" },
    cancelled: { bg: "rgba(138,155,168,0.12)", color: "#8A9BA8", label: "Cancelled" },
  };
  const s = map[status];
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

// ── Client drawer ──────────────────────────────────────────────────────────
function ClientDrawer({ client, appointments, consent, onClose, initialTab = "profile", initialFileAppt }: {
  client: Client; appointments: Appointment[]; consent: ConsentRecord | null; onClose: () => void;
  initialTab?: "profile" | "clinical";
  initialFileAppt?: string;
}) {
  const [tab, setTab] = useState<"profile" | "clinical">(initialTab);
  const [apptFilter, setApptFilter] = useState<"all"|"upcoming"|"completed">("all");
  const [showConsent, setShowConsent] = useState(false);

  const upcoming  = appointments.filter(a => ["pending","approved"].includes(a.status));
  const completed = appointments.filter(a => a.status === "completed");

  const shownAppts = apptFilter === "upcoming"  ? upcoming
                   : apptFilter === "completed" ? completed
                   : appointments;

  const memberSince = toDate(client.createdAt);
  const consentOk = isConsentCurrent(consent?.version ?? client.consentVersion);
  const consentDate = toDate(consent?.signedAt ?? client.consentSignedAt);

  // Completion rate
  const completionRate = appointments.length > 0
    ? Math.round((completed.length / appointments.length) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end"
      style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg h-full overflow-y-auto"
        style={{ background: "#F6FAF0", boxShadow: "-4px 0 24px rgba(0,0,0,0.1)" }}>

        {/* Header */}
        <div className="sticky top-0 z-10 border-b"
          style={{ background: "#F6FAF0", borderColor: "rgba(42,74,26,0.08)" }}>
          <div className="flex items-center justify-between px-6 py-4">
            <h3 className="font-semibold" style={{ color: "#2A4A1A" }}>
              {client.displayName}
            </h3>
            <div className="flex items-center gap-2">
              <Link href="/doctor/messages"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors hover:opacity-80"
                style={{ background: "rgba(141,198,63,0.12)", color: "#6BA028" }}>
                <MessageCircle size={12}/> Message
              </Link>
              <button onClick={onClose} className="p-2 rounded-lg hover:bg-black/5">
                <X size={18} style={{ color: "#4A5568" }} />
              </button>
            </div>
          </div>
          <div className="flex gap-1 px-6 pb-3">
            {([
              { key: "profile", label: "Profile", Icon: Users },
              { key: "clinical", label: "Clinical file", Icon: FolderOpen },
            ] as const).map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: tab === key ? "#2A4A1A" : "rgba(42,74,26,0.06)",
                  color: tab === key ? "white" : "#8A9BA8",
                }}
              >
                <Icon size={12} /> {label}
              </button>
            ))}
          </div>
        </div>

        {tab === "clinical" ? (
          <div className="p-6">
            <ClinicalFile
              clientId={client.uid}
              clientName={client.displayName}
              appointments={appointments}
              initialApptId={initialFileAppt}
            />
          </div>
        ) : (
        <div className="p-6 space-y-5">

          {/* Avatar + name */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold flex-shrink-0"
              style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)", color: "white" }}>
              {client.displayName?.[0]?.toUpperCase() ?? "C"}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-lg"
                style={{ fontFamily: "var(--font-dm-serif)", color: "#2A4A1A" }}>
                {client.displayName}
              </p>
              <p className="text-xs" style={{ color: "#8A9BA8" }}>
                Client since {memberSince
                  ? memberSince.toLocaleDateString("en-US", { month: "long", year: "numeric" })
                  : "—"}
              </p>
            </div>
            {/* Active status dot */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
              style={{ background: upcoming.length > 0 ? "rgba(141,198,63,0.1)" : "rgba(138,155,168,0.1)" }}>
              <span className="w-1.5 h-1.5 rounded-full"
                style={{ background: upcoming.length > 0 ? "#8DC63F" : "#8A9BA8" }}/>
              <span className="text-xs font-medium"
                style={{ color: upcoming.length > 0 ? "#6BA028" : "#8A9BA8" }}>
                {upcoming.length > 0 ? "Active" : "Inactive"}
              </span>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "Total",      value: appointments.length, accent: "#2A4A1A" },
              { label: "Upcoming",   value: upcoming.length,     accent: "#8DC63F" },
              { label: "Completed",  value: completed.length,    accent: "#F7941D" },
              { label: "Rate",       value: `${completionRate}%`,accent: "#6BA028" },
            ].map(({ label, value, accent }) => (
              <div key={label} className="rounded-xl p-3 text-center"
                style={{ background: "white", boxShadow: "0 1px 3px rgba(42,74,26,0.06)" }}>
                <p className="text-xl font-semibold"
                  style={{ fontFamily: "var(--font-dm-serif)", color: accent }}>
                  {value}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "#8A9BA8" }}>{label}</p>
              </div>
            ))}
          </div>

          {/* Telehealth consent */}
          <div className="rounded-2xl p-4"
            style={{ background: "white", boxShadow: "0 1px 3px rgba(42,74,26,0.06)" }}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Shield size={16} className="mt-0.5 flex-shrink-0"
                  style={{ color: consentOk ? "#6BA028" : "#F7941D" }} />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#8A9BA8" }}>
                    Telehealth consent
                  </p>
                  <p className="text-sm font-medium mt-0.5"
                    style={{ color: consentOk ? "#2A4A1A" : "#F7941D" }}>
                    {consentOk
                      ? `Signed${consentDate ? ` · ${consentDate.toLocaleDateString()}` : ""}`
                      : "Not signed yet"}
                  </p>
                  {consentOk && consent && (
                    <p className="text-xs mt-0.5" style={{ color: "#8A9BA8" }}>
                      {consent.typedSignature} · v{consent.version || CONSENT_VERSION}
                    </p>
                  )}
                </div>
              </div>
              {consentOk && consent && (
                <button type="button" onClick={() => setShowConsent(s => !s)}
                  className="text-xs font-semibold px-2.5 py-1.5 rounded-lg"
                  style={{ background: "rgba(42,74,26,0.06)", color: "#2A4A1A" }}>
                  {showConsent ? "Hide" : "View"}
                </button>
              )}
            </div>
            {showConsent && consent && (
              <ul className="mt-3 space-y-1.5 pt-3 border-t" style={{ borderColor: "rgba(42,74,26,0.06)" }}>
                {CONSENT_ACKS.map(a => (
                  <li key={a.key} className="text-xs" style={{ color: "#4A5568" }}>
                    {consent.accepted?.[a.key] ? "✓" : "○"} {a.label}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Contact */}
          <div className="rounded-2xl p-4 space-y-3"
            style={{ background: "white", boxShadow: "0 1px 3px rgba(42,74,26,0.06)" }}>
            <p className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: "#8A9BA8" }}>Contact</p>
            {[
              { Icon: Mail,   val: client.email,   href: `mailto:${client.email}`,   fallback: "No email"    },
              { Icon: Phone,  val: client.phone,   href: `tel:${client.phone}`,      fallback: "No phone"    },
              { Icon: MapPin, val: [client.city, client.country].filter(Boolean).join(", "), href: null, fallback: "No location" },
            ].map(({ Icon, val, href, fallback }) => (
              <div key={fallback} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: "rgba(42,74,26,0.05)" }}>
                  <Icon size={13} style={{ color: "#8A9BA8" }} />
                </div>
                {href && val ? (
                  <a href={href} className="text-sm hover:underline" style={{ color: "#6BA028" }}>{val}</a>
                ) : (
                  <p className="text-sm" style={{ color: val ? "#22272B" : "#C4C4C4" }}>
                    {val || fallback}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Wellness goals */}
          {(client.goals?.length ?? 0) > 0 && (
            <div className="rounded-2xl p-4"
              style={{ background: "white", boxShadow: "0 1px 3px rgba(42,74,26,0.06)" }}>
              <div className="flex items-center gap-2 mb-3">
                <Heart size={13} style={{ color: "#8DC63F" }} />
                <p className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "#8A9BA8" }}>Wellness Goals</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {client.goals!.map(g => (
                  <span key={g} className="px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{ background: "rgba(141,198,63,0.1)", color: "#6BA028" }}>
                    {g}
                  </span>
                ))}
              </div>
              {client.preferredTime && (
                <p className="text-xs mt-3 flex items-center gap-1" style={{ color: "#8A9BA8" }}>
                  <Clock size={11}/>
                  Prefers {client.preferredTime} sessions
                </p>
              )}
            </div>
          )}

          {/* Emergency contact */}
          {client.emergencyContact?.name && (
            <div className="rounded-2xl p-4"
              style={{ background: "rgba(247,148,29,0.04)", border: "1px solid rgba(247,148,29,0.12)" }}>
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle size={13} style={{ color: "#F7941D" }}/>
                <p className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: "#8A9BA8" }}>Emergency Contact</p>
              </div>
              <p className="text-sm font-medium" style={{ color: "#2A4A1A" }}>
                {client.emergencyContact.name}
              </p>
              <a href={`tel:${client.emergencyContact.phone}`}
                className="text-xs hover:underline" style={{ color: "#F7941D" }}>
                {client.emergencyContact.phone}
              </a>
            </div>
          )}

          {/* Session history */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: "#8A9BA8" }}>Session History</p>
              {/* Filter pills */}
              <div className="flex gap-1">
                {(["all","upcoming","completed"] as const).map(f => (
                  <button key={f} onClick={() => setApptFilter(f)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-all"
                    style={{
                      background: apptFilter === f ? "#2A4A1A" : "rgba(42,74,26,0.05)",
                      color:      apptFilter === f ? "white"   : "#8A9BA8",
                    }}>
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {shownAppts.length === 0 ? (
              <div className="rounded-xl p-6 text-center"
                style={{ background: "white", boxShadow: "0 1px 3px rgba(42,74,26,0.06)" }}>
                <p className="text-sm" style={{ color: "#C4C4C4" }}>
                  No {apptFilter === "all" ? "" : apptFilter} sessions
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {shownAppts.map(appt => (
                  <div key={appt.id} className="rounded-xl p-4"
                    style={{ background: "white", boxShadow: "0 1px 3px rgba(42,74,26,0.06)" }}>
                    <div className="flex items-center gap-3 mb-2">
                      {/* Date block */}
                      <div className="w-10 h-10 rounded-xl flex flex-col items-center justify-center flex-shrink-0"
                        style={{ background: "rgba(42,74,26,0.05)" }}>
                        <span className="text-xs font-bold leading-none" style={{ color: "#2A4A1A" }}>
                          {new Date(appt.date + "T12:00:00").toLocaleDateString("en-US", { month: "short" })}
                        </span>
                        <span className="text-sm font-bold leading-none" style={{ color: "#2A4A1A" }}>
                          {new Date(appt.date + "T12:00:00").getDate()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: "#2A4A1A" }}>
                          {appt.type}
                        </p>
                        <p className="text-xs" style={{ color: "#8A9BA8" }}>
                          {appt.time} · {appt.duration} min
                        </p>
                      </div>
                      <StatusBadge status={appt.status} />
                    </div>
                    {/* Notes */}
                    {appt.notes && (
                      <div className="flex items-start gap-2 mt-2 pt-2 border-t"
                        style={{ borderColor: "rgba(42,74,26,0.06)" }}>
                        <FileText size={12} className="flex-shrink-0 mt-0.5" style={{ color: "#8A9BA8" }}/>
                        <p className="text-xs italic" style={{ color: "#4A5568" }}>{appt.notes}</p>
                      </div>
                    )}
                    {/* Meet link */}
                    {appt.meetLink && (
                      <JoinSessionLink
                        href={appt.meetLink}
                        className="flex items-center gap-1.5 mt-2 text-xs font-medium hover:underline"
                        style={{ color: "#4285F4" }}
                        ariaLabel="Join Google Meet"
                      >
                        <ExternalLink size={11}/> Join Google Meet
                      </JoinSessionLink>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setTab("clinical")}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
            style={{ background: "rgba(42,74,26,0.06)", color: "#2A4A1A" }}
          >
            <FolderOpen size={15} /> Open clinical file
          </button>

        </div>
        )}
      </div>
    </div>
  );
}

// ── Client card ────────────────────────────────────────────────────────────
function ClientCard({ client, appts, consentOk, onClick }: {
  client: Client; appts: Appointment[]; consentOk: boolean; onClick: () => void;
}) {
  const lastAppt   = appts[0] ?? null;
  const upcoming   = appts.filter(a => ["pending","approved"].includes(a.status));
  const completed  = appts.filter(a => a.status === "completed");
  const isActive   = upcoming.length > 0;

  return (
    <button onClick={onClick}
      className="w-full text-left rounded-2xl p-5 transition-all hover:-translate-y-0.5 group"
      style={{ background: "white", boxShadow: "0 1px 4px rgba(42,74,26,0.07)" }}>
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center text-base font-bold"
            style={{ background: "linear-gradient(135deg, #2A4A1A, #3D6B24)", color: "white" }}>
            {client.displayName?.[0]?.toUpperCase() ?? "C"}
          </div>
          {/* Active dot */}
          {isActive && (
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white"
              style={{ background: "#8DC63F" }}/>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-sm" style={{ color: "#2A4A1A" }}>
                {client.displayName}
              </p>
              <p className="text-xs mt-0.5 truncate" style={{ color: "#8A9BA8" }}>
                {client.email}
              </p>
            </div>
            <ChevronRight size={16}
              className="flex-shrink-0 mt-0.5 transition-transform group-hover:translate-x-0.5"
              style={{ color: "#C4C4C4" }} />
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
              style={{
                background: consentOk ? "rgba(107,160,40,0.1)" : "rgba(247,148,29,0.1)",
                color: consentOk ? "#6BA028" : "#F7941D",
              }}>
              <Shield size={10} />
              {consentOk ? "Consent signed" : "Consent missing"}
            </span>
            <span className="flex items-center gap-1 text-xs" style={{ color: "#8A9BA8" }}>
              <CheckCircle size={11} style={{ color: "#6BA028" }}/>
              {completed.length} completed
            </span>
            {upcoming.length > 0 && (
              <span className="flex items-center gap-1 text-xs font-semibold"
                style={{ color: "#8DC63F" }}>
                <Clock size={11}/>
                {upcoming.length} upcoming
              </span>
            )}
            {client.city && (
              <span className="flex items-center gap-1 text-xs" style={{ color: "#8A9BA8" }}>
                <MapPin size={11}/>{client.city}
              </span>
            )}
            {lastAppt && (
              <span className="flex items-center gap-1 text-xs" style={{ color: "#8A9BA8" }}>
                <Calendar size={11}/>
                {new Date(lastAppt.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            )}
          </div>

          {/* Goals */}
          {(client.goals?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {client.goals!.slice(0, 2).map(g => (
                <span key={g} className="px-2 py-0.5 rounded-full text-xs"
                  style={{ background: "rgba(141,198,63,0.08)", color: "#6BA028" }}>
                  {g}
                </span>
              ))}
              {client.goals!.length > 2 && (
                <span className="px-2 py-0.5 rounded-full text-xs"
                  style={{ background: "rgba(42,74,26,0.05)", color: "#8A9BA8" }}>
                  +{client.goals!.length - 2} more
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
type FilterType = "all" | "active" | "inactive";

function DoctorClientsPageInner() {
  const { user }  = useAuth();
  const searchParams = useSearchParams();
  const [clients,  setClients]  = useState<Client[]>([]);
  const [allAppts, setAllAppts] = useState<Record<string, Appointment[]>>({});
  const [consents, setConsents] = useState<Record<string, ConsentRecord | null>>({});
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [filter,   setFilter]   = useState<FilterType>("all");
  const [selected, setSelected] = useState<Client | null>(null);
  const [drawerTab, setDrawerTab] = useState<"profile" | "clinical">("profile");
  const [fileApptId, setFileApptId] = useState<string | undefined>();

  // Deep link: /doctor/clients?clientId=…&file=appointmentId
  useEffect(() => {
    const cid = searchParams.get("clientId");
    const file = searchParams.get("file") || undefined;
    if (!cid || clients.length === 0) return;
    const c = clients.find(x => x.uid === cid);
    if (c) {
      setSelected(c);
      setDrawerTab("clinical");
      setFileApptId(file);
    }
  }, [searchParams, clients]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setClients([]);
    setAllAppts({});

    const unsub = onSnapshot(
      query(
        collection(db, "appointments"),
        where("doctorId", "==", user.uid),
        orderBy("createdAt", "desc")
      ),
      async (apptSnap) => {
        const apptsByClient: Record<string, Appointment[]> = {};
        const clientIds = new Set<string>();

        apptSnap.docs.forEach(d => {
          const data = d.data() as any;
          const cid  = data.clientId as string;
          if (!cid) return;
          clientIds.add(cid);
          if (!apptsByClient[cid]) apptsByClient[cid] = [];
          apptsByClient[cid].push({ id: d.id, ...data } as Appointment);
        });

        setAllAppts(apptsByClient);

        if (clientIds.size === 0) {
          setClients([]);
          setConsents({});
          setLoading(false);
          return;
        }

        const ids = [...clientIds];
        const [clientDocs, consentDocs] = await Promise.all([
          Promise.all(ids.map(uid => getDoc(doc(db, "users", uid)))),
          Promise.all(ids.map(uid => getDoc(doc(db, "consents", uid)))),
        ]);
        const loaded: Client[] = [];
        const consentMap: Record<string, ConsentRecord | null> = {};
        clientDocs.forEach(snap => {
          if (snap.exists()) {
            loaded.push({ uid: snap.id, ...snap.data() } as Client);
          }
        });
        consentDocs.forEach((snap, i) => {
          consentMap[ids[i]] = snap.exists()
            ? ({ ...snap.data() } as ConsentRecord)
            : null;
        });
        loaded.sort((a, b) => a.displayName?.localeCompare(b.displayName ?? "") ?? 0);
        setClients(loaded);
        setConsents(consentMap);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsub();
  }, [user]);

  // ── Derived stats ────────────────────────────────────────────────────────
  const totalSessions  = Object.values(allAppts).reduce((s, a) => s + a.length, 0);
  const totalCompleted = Object.values(allAppts).reduce((s, a) => s + a.filter(x => x.status === "completed").length, 0);
  const totalUpcoming  = Object.values(allAppts).reduce((s, a) => s + a.filter(x => ["pending","approved"].includes(x.status)).length, 0);
  const activeClients  = clients.filter(c => (allAppts[c.uid] ?? []).some(a => ["pending","approved"].includes(a.status)));

  // ── Filter + search ──────────────────────────────────────────────────────
  const filtered = clients.filter(c => {
    const matchSearch = !search
      || c.displayName?.toLowerCase().includes(search.toLowerCase())
      || c.email?.toLowerCase().includes(search.toLowerCase());

    const isActive = (allAppts[c.uid] ?? []).some(a => ["pending","approved"].includes(a.status));
    const matchFilter = filter === "all"
      || (filter === "active"   &&  isActive)
      || (filter === "inactive" && !isActive);

    return matchSearch && matchFilter;
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Subtitle + actions — page name lives in the sticky header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm" style={{ color: "#8A9BA8" }}>
            Everyone who has booked a session with you
          </p>
        </div>
        {activeClients.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: "rgba(141,198,63,0.1)", color: "#6BA028" }}>
            <TrendingUp size={14}/>
            {activeClients.length} active client{activeClients.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Clients",  value: clients.length,  accent: "#2A4A1A", Icon: Users        },
          { label: "Total Sessions", value: totalSessions,   accent: "#8DC63F", Icon: Calendar     },
          { label: "Upcoming",       value: totalUpcoming,   accent: "#F7941D", Icon: Clock        },
          { label: "Completed",      value: totalCompleted,  accent: "#6BA028", Icon: CheckCircle  },
        ].map(({ label, value, accent, Icon }) => (
          <div key={label} className="rounded-2xl p-4 flex items-center gap-3"
            style={{ background: "white", boxShadow: "0 1px 4px rgba(42,74,26,0.07)" }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: accent + "15" }}>
              <Icon size={16} style={{ color: accent }} />
            </div>
            <div>
              <p className="text-2xl font-semibold leading-none"
                style={{ fontFamily: "var(--font-dm-serif)", color: "#2A4A1A" }}>
                {value}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "#8A9BA8" }}>{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search + filter */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2"
            style={{ color: "#8A9BA8" }} />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-11 pr-10 py-3 rounded-xl text-sm border focus:outline-none"
            style={{ borderColor: "rgba(42,74,26,0.12)", background: "white" }} />
          {search && (
            <button onClick={() => setSearch("")}
              className="absolute right-4 top-1/2 -translate-y-1/2">
              <X size={14} style={{ color: "#8A9BA8" }} />
            </button>
          )}
        </div>

        {/* Active / Inactive filter */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(42,74,26,0.06)" }}>
          {(["all", "active", "inactive"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all"
              style={{
                background: filter === f ? "white"       : "transparent",
                color:      filter === f ? "#2A4A1A"     : "#8A9BA8",
                boxShadow:  filter === f ? "0 1px 3px rgba(42,74,26,0.1)" : "none",
              }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Client list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={28} className="animate-spin" style={{ color: "#8DC63F" }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl p-12 text-center"
          style={{ background: "white", boxShadow: "0 1px 4px rgba(42,74,26,0.07)" }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
            style={{ background: "rgba(141,198,63,0.08)" }}>
            <Users size={24} style={{ color: "#8DC63F" }} />
          </div>
          <p className="text-sm font-medium mb-1" style={{ color: "#2A4A1A" }}>
            {search ? "No clients found" : filter !== "all" ? `No ${filter} clients` : "No clients yet"}
          </p>
          <p className="text-xs" style={{ color: "#8A9BA8" }}>
            {search
              ? "Try a different name or email."
              : filter !== "all"
              ? "Try switching to All to see everyone."
              : "Clients will appear here once they book a session."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtered.map(client => {
            const consent = consents[client.uid];
            const consentOk = isConsentCurrent(
              consent?.version ?? client.consentVersion
            );
            return (
              <ClientCard
                key={client.uid}
                client={client}
                appts={allAppts[client.uid] ?? []}
                consentOk={consentOk}
                onClick={() => {
                  setDrawerTab("profile");
                  setFileApptId(undefined);
                  setSelected(client);
                }}
              />
            );
          })}
        </div>
      )}

      {/* Drawer */}
      {selected && (
        <ClientDrawer
          client={selected}
          appointments={allAppts[selected.uid] ?? []}
          consent={consents[selected.uid] ?? null}
          initialTab={drawerTab}
          initialFileAppt={fileApptId}
          onClose={() => {
            setSelected(null);
            setFileApptId(undefined);
            setDrawerTab("profile");
          }}
        />
      )}
    </div>
  );
}

export default function DoctorClientsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-24">
        <Loader2 size={28} className="animate-spin" style={{ color: "#8DC63F" }} />
      </div>
    }>
      <DoctorClientsPageInner />
    </Suspense>
  );
}
