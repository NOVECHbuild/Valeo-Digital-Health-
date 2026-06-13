// ════════════════════════════════════════════════════════════════════════════
//  requireAuth — server-side API route authorization (SERVER ONLY)
//  Verifies the caller's Firebase ID token (Authorization: Bearer <token>) and
//  checks their role. Use at the top of privileged API routes.
// ════════════════════════════════════════════════════════════════════════════
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export type AuthResult =
  | { ok: true; uid: string; role: string }
  | { ok: false; status: number; error: string };

// Verify the bearer token and resolve the caller's role (claim, else users doc).
async function verify(req: Request): Promise<AuthResult> {
  const header = req.headers.get("authorization") || "";
  const token  = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return { ok: false, status: 401, error: "Not signed in." };
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    let role = (decoded as any).role as string | undefined;
    if (!role) {
      const snap = await adminDb.collection("users").doc(decoded.uid).get();
      role = snap.data()?.role;
    }
    return { ok: true, uid: decoded.uid, role: role ?? "" };
  } catch {
    return { ok: false, status: 401, error: "Invalid or expired session." };
  }
}

// Require any authenticated user.
export async function requireAuth(req: Request): Promise<AuthResult> {
  return verify(req);
}

// Require an admin caller.
export async function requireAdmin(req: Request): Promise<AuthResult> {
  const r = await verify(req);
  if (!r.ok) return r;
  if (r.role !== "admin") return { ok: false, status: 403, error: "Admin access required." };
  return r;
}
