// src/app/api/admin/reset-password/route.ts
import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { requireAdmin } from "@/lib/requireAuth";

export async function POST(req: Request) {
  try {
    const gate = await requireAdmin(req);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: "Email is required." }, { status: 400 });

    // Generate a password reset link via Firebase Admin
    const resetLink = await adminAuth.generatePasswordResetLink(email);

    // In production, send via your email provider (SendGrid, Resend, etc.)
    // For now we return the link so admin can manually share it
    // or integrate with your email service below:
    //
    // await sendEmail({
    //   to: email,
    //   subject: "Reset your Valeo Experience password",
    //   html: `<p>Click <a href="${resetLink}">here</a> to reset your password.</p>`,
    // });

    console.log(`[AdminResetPassword] Reset link for ${email}: ${resetLink}`);

    return NextResponse.json({ success: true, resetLink });
  } catch (err: any) {
    console.error("[AdminResetPassword]", err);
    if (err.code === "auth/user-not-found") {
      return NextResponse.json({ error: "No account found with that email." }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to generate reset link." }, { status: 500 });
  }
}
