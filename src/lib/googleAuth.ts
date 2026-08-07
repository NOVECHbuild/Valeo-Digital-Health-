// ════════════════════════════════════════════════════════════════════════════
//  Google auth — per-doctor OAuth resolution (SERVER-ONLY)
//  Each doctor can connect their own Google Calendar. Their refresh token is
//  stored at googleTokens/{doctorId} (locked to server access by rules).
//  getDoctorAuth() returns an authorized client for that doctor, falling back
//  to the shared env refresh token so single-doctor setups keep working.
// ════════════════════════════════════════════════════════════════════════════
import { google } from "googleapis";
import { adminDb } from "@/lib/firebase-admin";
import { decryptSecret } from "@/lib/crypto";

function resolveRedirectUri(): string {
  const fromEnv = (process.env.GOOGLE_REDIRECT_URI || "").trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  const base = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "https://www.valeoexperience.com"
  ).replace(/\/$/, "");

  return `${base}/api/auth/callback/google`;
}

/** Exact URI Google must list under Authorized redirect URIs. */
export const GOOGLE_REDIRECT_URI = resolveRedirectUri();

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

/** True when we have any refresh token (doctor-owned or shared env). */
export function hasGoogleRefreshToken(doctorId?: string): Promise<boolean> {
  return (async () => {
    if (doctorId) {
      try {
        const snap = await adminDb.collection("googleTokens").doc(doctorId).get();
        if (snap.data()?.refreshToken) return true;
      } catch { /* fall through */ }
    }
    return Boolean(process.env.GOOGLE_REFRESH_TOKEN);
  })();
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
      if (t) refreshToken = decryptSecret(t);
    } catch {
      // fall back to env token on any lookup error
    }
  }
  if (!refreshToken) {
    throw Object.assign(
      new Error(
        "Google Calendar is not connected. Open Schedule → Availability → Calendar Sync and connect Google Calendar.",
      ),
      { code: "GOOGLE_NOT_CONNECTED", status: 503 },
    );
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
