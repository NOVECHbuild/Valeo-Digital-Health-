import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/requireAuth";

export async function POST(req: Request) {
  try {
    const gate = await requireAdmin(req);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { uid, role } = await req.json();

    // Validate role
    const validRoles = ["client", "doctor", "admin"];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: "Invalid role" },
        { status: 400 }
      );
    }

    // Set Firebase Auth custom claim
    await adminAuth.setCustomUserClaims(uid, { role });

    // Update Firestore user document
    await adminDb.collection("users").doc(uid).update({
      role,
      updatedAt: new Date(),
    });

    return NextResponse.json({ success: true, uid, role });

  } catch (error) {
    console.error("set-role error:", error);
    return NextResponse.json(
      { error: "Failed to set role" },
      { status: 500 }
    );
  }
}
