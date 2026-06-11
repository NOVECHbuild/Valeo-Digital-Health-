// src/app/api/calendar/test/route.ts
// Verifies that the Google Calendar OAuth connection is working.
// Used by the doctor's "Connect Google Calendar" panel.
import { NextResponse } from "next/server";
import { google } from "googleapis";

function getAuth() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI ?? "https://www.valeoexperience.com/api/auth/callback/google"
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return oauth2Client;
}

export async function GET() {
  try {
    if (!process.env.GOOGLE_REFRESH_TOKEN) {
      return NextResponse.json(
        { ok: false, error: "Google Calendar is not connected on the server (missing refresh token)." },
        { status: 200 }
      );
    }
    const calendar = google.calendar({ version: "v3", auth: getAuth() });
    // A lightweight call that proves the token + scopes work.
    const res = await calendar.calendarList.list({ maxResults: 1 });
    const primary = res.data.items?.[0]?.summary ?? "primary";
    return NextResponse.json({ ok: true, calendar: primary });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Could not reach Google Calendar." },
      { status: 200 }
    );
  }
}
