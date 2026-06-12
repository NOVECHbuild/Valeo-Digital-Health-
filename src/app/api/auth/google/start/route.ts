// src/app/api/auth/google/start/route.ts
// Starts the per-doctor Google Calendar connection. The doctor's browser hits
// this with their Firebase ID token; we verify it, confirm they're a doctor/admin,
// then redirect to Google's consent screen with state = their uid.
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { makeOAuthClient, GOOGLE_SCOPES } from "@/lib/googleAuth";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.valeoexperience.com";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const fail  = (reason: string) =>
    NextResponse.redirect(`${APP_URL}/doctor/schedule?calendar=error&reason=${encodeURIComponent(reason)}`);

  try {
    if (!token) return fail("missing_token");

    // Verify the caller and confirm they may connect a calendar.
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    const userSnap = await adminDb.collection("users").doc(uid).get();
    const role = userSnap.data()?.role;
    if (role !== "doctor" && role !== "admin") return fail("not_a_doctor");

    // Force offline + consent so Google returns a refresh token.
    const url = makeOAuthClient().generateAuthUrl({
      access_type: "offline",
      prompt:      "consent",
      scope:       GOOGLE_SCOPES,
      state:       uid,
    });
    return NextResponse.redirect(url);
  } catch (err: any) {
    console.error("[auth/google/start]", err?.message ?? err);
    return fail("auth_failed");
  }
}
