import { useEffect, useState } from "react";
import {
  collection, query, where, orderBy,
  onSnapshot, addDoc, updateDoc, doc, serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { labelToMinutes } from "@/lib/availability";
import { holdExpiresAt, type PaymentStatus } from "@/lib/paymentStatus";

export type AppointmentStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "completed"
  | "cancelled"
  | "payment_failed";

export interface Appointment {
  id: string; clientId: string; clientName: string; clientEmail: string;
  doctorId: string; doctorName?: string; type: string; date: string; time: string;
  duration: number; amount?: number; status: AppointmentStatus; notes?: string;
  createdAt: any; updatedAt: any; meetLink?: string;
  seriesId?: string; seriesIndex?: number; seriesCount?: number;
  cancelledBy?: string;
  cancelledReason?: string;
  /** Pay-in-full: unpaid hold until Stripe succeeds or hold expires. */
  paymentStatus?: PaymentStatus;
  paymentHoldExpiresAt?: string;
  paymentId?: string;
}

/** Sort by session date + time. Default soonest first (asc). */
export function sortAppointmentsBySession(
  list: Appointment[],
  direction: "asc" | "desc" = "asc",
): Appointment[] {
  const mul = direction === "asc" ? 1 : -1;
  return [...list].sort((a, b) => {
    const byDate = (a.date || "").localeCompare(b.date || "");
    if (byDate !== 0) return byDate * mul;
    return (labelToMinutes(a.time || "") - labelToMinutes(b.time || "")) * mul;
  });
}

const ACTIVE = new Set<AppointmentStatus>(["pending", "approved"]);

/** Today as YYYY-MM-DD in the browser (or UTC fallback for SSR). */
export function localTodayStr(): string {
  if (typeof window === "undefined") return new Date().toISOString().split("T")[0];
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Client list order: live sessions on/after today (closest first),
 * then everything else (most recent first). Keeps upcoming at the top.
 */
export function sortClientAppointmentFeed(list: Appointment[], today = localTodayStr()): Appointment[] {
  const upcoming = sortAppointmentsBySession(
    list.filter(a => ACTIVE.has(a.status) && (a.date || "") >= today),
    "asc",
  );
  const rest = sortAppointmentsBySession(
    list.filter(a => !(ACTIVE.has(a.status) && (a.date || "") >= today)),
    "desc",
  );
  return [...upcoming, ...rest];
}

export function useClientAppointments() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!user) {
      setAppointments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setAppointments([]);
    const q = query(collection(db, "appointments"), where("clientId", "==", user.uid), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment)));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [user]);
  return { appointments, loading };
}

export function useDoctorAppointments() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!user) {
      setAppointments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setAppointments([]);
    const q = query(collection(db, "appointments"), where("doctorId", "==", user.uid), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setAppointments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Appointment)));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [user]);
  return { appointments, loading };
}

export async function bookAppointment(data: {
  clientId: string; clientName: string; clientEmail: string; doctorId: string;
  doctorName?: string; type: string; date: string; time: string; duration: number; amount?: number; notes?: string;
  seriesId?: string; seriesIndex?: number; seriesCount?: number;
}) {
  const { notes, seriesId, seriesIndex, seriesCount, ...rest } = data;
  const ref = await addDoc(collection(db, "appointments"), {
    ...rest,
    ...(notes ? { notes } : {}),
    ...(seriesId ? { seriesId, seriesIndex, seriesCount } : {}),
    // Slot held until full payment (or free confirm via /api/payments/initiate).
    status:               "pending",
    paymentStatus:        "unpaid",
    paymentHoldExpiresAt: holdExpiresAt(),
    createdAt:            serverTimestamp(),
    updatedAt:            serverTimestamp(),
  });
  return ref.id;
}

export async function updateAppointmentStatus(appointmentId: string, status: AppointmentStatus) {
  await updateDoc(doc(db, "appointments", appointmentId), { status, updatedAt: serverTimestamp() });
}