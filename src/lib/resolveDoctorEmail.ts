import { adminAuth, adminDb } from "@/lib/firebase-admin";

/**
 * Resolve a doctor's delivery email: Firestore → Firebase Auth → DOCTOR_EMAIL env.
 * Returns "" if nothing usable (caller should skip send + log).
 */
export async function resolveDoctorEmail(doctorId?: string | null): Promise<{
  email: string;
  displayName: string;
  source: "firestore" | "auth" | "env" | "none";
}> {
  let displayName = "";
  let email = "";

  if (doctorId) {
    try {
      const snap = await adminDb.collection("users").doc(doctorId).get();
      if (snap.exists) {
        const d = snap.data() as any;
        displayName = (d.displayName || "") as string;
        if (typeof d.email === "string" && d.email.includes("@")) {
          email = d.email.trim();
          return { email, displayName, source: "firestore" };
        }
      }
    } catch { /* continue */ }

    try {
      const user = await adminAuth.getUser(doctorId);
      displayName = displayName || user.displayName || "";
      if (user.email) {
        // Backfill Firestore so future sends are faster
        try {
          await adminDb.collection("users").doc(doctorId).set(
            { email: user.email, updatedAt: new Date().toISOString() },
            { merge: true },
          );
        } catch { /* ignore */ }
        return { email: user.email, displayName, source: "auth" };
      }
    } catch { /* continue */ }
  }

  const envEmail = (process.env.DOCTOR_EMAIL || "").trim();
  if (envEmail.includes("@")) {
    return { email: envEmail, displayName, source: "env" };
  }

  return { email: "", displayName, source: "none" };
}

/** Calendar date YYYY-MM-DD in Caribbean practice timezone. */
export function todayCaribbean(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Barbados",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
