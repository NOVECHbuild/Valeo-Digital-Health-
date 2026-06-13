// src/app/api/admin/create-user/route.ts
import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/requireAuth";

export async function POST(req: Request) {
  try {
    const gate = await requireAdmin(req);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const body = await req.json();
    const { displayName, email, password, role, phone } = body;

    // ── Validation ────────────────────────────────────────────────────────
    if (!displayName?.trim()) {
      return NextResponse.json({ error: "Full name is required." }, { status: 400 });
    }
    if (!email?.trim()) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }
    if (!password || password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }
    if (!["client", "doctor", "admin"].includes(role)) {
      return NextResponse.json({ error: "Invalid role." }, { status: 400 });
    }

    // ── Create Firebase Auth user ─────────────────────────────────────────
    const userRecord = await adminAuth.createUser({
      email:        email.trim(),
      password,
      displayName:  displayName.trim(),
    });

    // ── Create Firestore users document ──────────────────────────────────
    await adminDb.collection("users").doc(userRecord.uid).set({
      uid:         userRecord.uid,
      displayName: displayName.trim(),
      email:       email.trim().toLowerCase(),
      role,
      phone:       phone?.trim() ?? "",
      isActive:    true,
      onboarded:   false,
      createdAt:   new Date().toISOString(),
      updatedAt:   new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      uid:     userRecord.uid,
      email:   userRecord.email,
    });

  } catch (err: any) {
    console.error("[CreateUser]", err);

    if (err.code === "auth/email-already-exists") {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }
    if (err.code === "auth/invalid-email") {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }
    if (err.code === "auth/weak-password") {
      return NextResponse.json({ error: "Password is too weak." }, { status: 400 });
    }

    return NextResponse.json(
      { error: err.message ?? "Failed to create account." },
      { status: 500 }
    );
  }
}
