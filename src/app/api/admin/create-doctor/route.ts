// src/app/api/admin/create-doctor/route.ts
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/requireAuth";

export async function POST(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const {
      // Account
      displayName, email, password,
      // Profile
      title, bio, photoURL, gender, yearsExperience, timezone,
      // Clinical
      specializations, sessionTypes, approaches, languages,
      // Capacity
      acceptingClients, maxClients, currentClients,
    } = await req.json();

    // Basic validation
    if (!displayName || !email || !password) {
      return NextResponse.json({ error: "Name, email and password are required." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    // Create Firebase Auth user
    const userRecord = await adminAuth.createUser({
      displayName: `${title} ${displayName}`.trim(),
      email,
      password,
      emailVerified: true, // admin-created accounts skip verification
    });

    // Set custom role claim
    await adminAuth.setCustomUserClaims(userRecord.uid, { role: "doctor" });

    // Save full doctor profile to Firestore
    await adminDb.collection("users").doc(userRecord.uid).set({
      uid:              userRecord.uid,
      displayName,
      email,
      role:             "doctor",

      // Professional profile
      title:            title            ?? "Dr.",
      bio:              bio              ?? "",
      photoURL:         photoURL         ?? "",
      gender:           gender           ?? "prefer-not-to-say",
      yearsExperience:  yearsExperience  ?? 0,
      timezone:         timezone         ?? "America/Port_of_Spain",

      // Clinical matching fields
      specializations:  specializations  ?? [],
      sessionTypes:     sessionTypes     ?? [],
      approaches:       approaches       ?? [],
      languages:        languages        ?? ["English"],

      // Capacity
      acceptingClients: acceptingClients ?? true,
      maxClients:       maxClients       ?? 20,
      currentClients:   currentClients   ?? 0,

      // Metadata
      onboarded:        true,
      createdAt:        new Date().toISOString(),
      updatedAt:        new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      uid:     userRecord.uid,
      message: `Doctor account created for ${displayName}`,
    });

  } catch (err: any) {
    console.error("[create-doctor]", err);

    // Firebase auth errors
    if (err.code === "auth/email-already-exists") {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }
    if (err.code === "auth/invalid-email") {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }
    if (err.code === "auth/weak-password") {
      return NextResponse.json({ error: "Password is too weak." }, { status: 400 });
    }

    return NextResponse.json({ error: err.message ?? "Internal error" }, { status: 500 });
  }
}
