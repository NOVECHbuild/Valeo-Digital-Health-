"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
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
    if (!user) { setDoctor(null); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        // 1) assignments/{clientId}.doctorId   2) users/{clientId}.doctorId
        let doctorId = "";
        const aSnap = await getDoc(doc(db, "assignments", user.uid));
        if (aSnap.exists()) doctorId = (aSnap.data() as any).doctorId || "";
        if (!doctorId) {
          const uSnap = await getDoc(doc(db, "users", user.uid));
          if (uSnap.exists()) doctorId = (uSnap.data() as any).doctorId || "";
        }
        if (!doctorId) { if (!cancelled) setDoctor(null); return; }

        const dSnap = await getDoc(doc(db, "users", doctorId));
        const dn = (dSnap.exists() ? (dSnap.data() as any).displayName : "") || "";
        if (!cancelled) setDoctor({ doctorId, displayName: dn, doctorName: withDr(dn) });
      } catch {
        if (!cancelled) setDoctor(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  return { doctor, loading };
}
