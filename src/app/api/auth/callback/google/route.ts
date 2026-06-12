// src/app/api/auth/callback/google/route.ts
// Google redirects here after the doctor consents. We exchange the code for a
// refresh token and store it (server-only) at googleTokens/{doctorId}, then mark
// the doctor's schedule as connected and send them back to /doctor/schedule.
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { makeOAuthClient } from "@/lib/googleAuth";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.valeoexperience.com";

export async function GET(req: NextRequest) {
  const params   = req.nextUrl.searchParams;
  const code     = params.get("code");
  const doctorId = params.get("state") ?? "";
  const oauthErr = params.get("error");

  const back = (status: string) =>
    NextResponse.redirect(`${APP_URL}/doctor/schedule?calendar=${status}`);

  if (oauthErr || !code || !doctorId) {
    return back("error");
  }

  try {
    const client = makeOAuthClient();
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // Identify the connected calendar (its id is the account email).
    let email = "primary";
    try {
      const calendar = google.calendar({ version: "v3", auth: client });
      const list = await calendar.calendarList.list({ maxResults: 50 });
      const primary = list.data.items?.find(c => c.primary);
      if (primary?.id) email = primary.id;
    } catch { /* non-fatal — default to "primary" */ }

    // Store the refresh token (server-only). Only overwrite if Google returned one.
    const tokenDoc: Record<string, any> = {
      email,
      connectedAt: FieldValue.serverTimestamp(),
      updatedAt:   FieldValue.serverTimestamp(),
    };
    if (tokens.refresh_token) tokenDoc.refreshToken = tokens.refresh_token;
    await adminDb.collection("googleTokens").doc(doctorId).set(tokenDoc, { merge: true });

    // Reflect connection on the doctor's schedule so the UI shows "Connected".
    await adminDb.collection("schedules").doc(doctorId).set(
      { googleCalendarId: email, googleConnected: true, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );

    return back("connected");
  } catch (err: any) {
    console.error("[auth/callback/google]", err?.message ?? err);
    return back("error");
  }
}
