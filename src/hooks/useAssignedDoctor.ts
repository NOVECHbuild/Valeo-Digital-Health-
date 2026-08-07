"use client";

import { useEffect, useState } from "react";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

// Resolves the doctor a client is assigned to. Returns null when the client
// has not been matched yet (the booking flow uses this to require matching).
export interface AssignedDoctor {
  doctorId:    string;
  displayName: string;  // raw, e.g. "Jozelle Miller"
  doctorName:  string;  // "Dr. Jozelle Miller" (single prefix)
}

function withDr(name: string): string {
  const n = (name || "").trim();
  if (!n) return "your therapist";
  return /^dr\.?\s/i.test(n) ? n : `Dr. ${n}`;
}

export function useAssignedDoctor() {
  const { user } = useAuth();
  const [doctor,  setDoctor]  = useState<AssignedDoctor | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setDoctor(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setDoctor(null);

    let cancelled = false;
    let doctorUnsub: (() => void) | undefined;

    async function resolveDoctor(doctorId: string) {
      if (!doctorId) {
        if (!cancelled) {
          setDoctor(null);
          setLoading(false);
        }
        doctorUnsub?.();
        doctorUnsub = undefined;
        return;
      }
      doctorUnsub?.();
      doctorUnsub = onSnapshot(doc(db, "users", doctorId), (dSnap) => {
        if (cancelled) return;
        const dn = (dSnap.exists() ? (dSnap.data() as any).displayName : "") || "";
        setDoctor({ doctorId, displayName: dn, doctorName: withDr(dn) });
        setLoading(false);
      }, () => {
        if (!cancelled) {
          setDoctor(null);
          setLoading(false);
        }
      });
    }

    // Prefer live assignments/{clientId}; fall back to users.doctorId once if needed
    const unsubAssign = onSnapshot(doc(db, "assignments", user.uid), async (aSnap) => {
      if (cancelled) return;
      let doctorId = aSnap.exists() ? ((aSnap.data() as any).doctorId || "") : "";
      if (!doctorId) {
        try {
          const uSnap = await getDoc(doc(db, "users", user.uid));
          if (uSnap.exists()) doctorId = (uSnap.data() as any).doctorId || "";
        } catch { /* ignore */ }
      }
      await resolveDoctor(doctorId);
    }, async () => {
      // assignments missing / denied — try user doc once
      try {
        const uSnap = await getDoc(doc(db, "users", user.uid));
        const doctorId = uSnap.exists() ? ((uSnap.data() as any).doctorId || "") : "";
        await resolveDoctor(doctorId);
      } catch {
        if (!cancelled) {
          setDoctor(null);
          setLoading(false);
        }
      }
    });

    return () => {
      cancelled = true;
      unsubAssign();
      doctorUnsub?.();
    };
  }, [user]);

  return { doctor, loading };
}
