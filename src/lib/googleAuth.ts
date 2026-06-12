// ════════════════════════════════════════════════════════════════════════════
//  Google auth — per-doctor OAuth resolution (SERVER-ONLY)
//  Each doctor can connect their own Google Calendar. Their refresh token is
//  stored at googleTokens/{doctorId} (locked to server access by rules).
//  getDoctorAuth() returns an authorized client for that doctor, falling back
//  to the shared env refresh token so single-doctor setups keep working.
// ════════════════════════════════════════════════════════════════════════════
import { google } from "googleapis";
import { adminDb } from "@/lib/firebase-admin";

export const GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ?? "https://www.valeoexperience.com/api/auth/callback/google";

// Scopes needed for free/busy lookups and creating Meet events.
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
];

export function makeOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
  );
}

// Returns an OAuth2 client authorized as the given doctor.
// Uses the doctor's own stored refresh token when connected; otherwise falls
// back to the shared GOOGLE_REFRESH_TOKEN env var (Dr. Miller's account).
export async function getDoctorAuth(doctorId?: string) {
  let refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (doctorId) {
    try {
      const snap = await adminDb.collection("googleTokens").doc(doctorId).get();
      const t = snap.data()?.refreshToken as string | undefined;
      if (t) refreshToken = t;
    } catch {
      // fall back to env token on any lookup error
    }
  }
  const client = makeOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

// True if this doctor has connected their own Google account.
export async function doctorHasOwnCalendar(doctorId?: string): Promise<boolean> {
  if (!doctorId) return false;
  try {
    const snap = await adminDb.collection("googleTokens").doc(doctorId).get();
    return !!snap.data()?.refreshToken;
  } catch {
    return false;
  }
}
